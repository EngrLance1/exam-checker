const test = require("node:test");
const assert = require("node:assert/strict");
const { load, sheet } = require("./helpers/load");

const KEY = "ABCD".repeat(7) + "AB";

function filled() {
  const c = load();
  c.run(`state.test.name = "Q1 Summative"; state.test.size = 30; state.test.keys.A = ${JSON.stringify(KEY)}`);
  c.run(`state.sheets = ${JSON.stringify([sheet("s01", KEY, { name: "Ana" }), sheet("s02", "B" + KEY.slice(1), { name: "Ben" })])}`);
  c.run(`setFix("A", 1, "also:B")`);
  return c;
}
const text = (c) => c.run("JSON.stringify(buildTestFile())");
const parse = (c, t) => c.run(`parseTestFile(${JSON.stringify(t)})`);

test("save then open gives back the same test", () => {
  const c = filled();
  const t = text(c);
  const before = c.run("JSON.stringify(state.sheets.map(scoreOf))");
  const d = load();
  assert.equal(parse(d, t).ok, true);
  d.run(`applyTestFile(parseTestFile(${JSON.stringify(t)}).data)`);
  assert.equal(d.run("state.test.name"), "Q1 Summative");
  assert.equal(d.run("state.test.keys.A"), KEY);
  assert.equal(d.run("state.sheets.length"), 2);
  assert.equal(d.run("state.sheets[1].name"), "Ben");
  assert.equal(d.run("JSON.stringify(state.sheets.map(scoreOf))"), before);
  assert.equal(d.run("state.test.fixes.A[1].letter"), "B"); // fixes travel with the file
});

test("the sample sheet is not written to the file", () => {
  const c = filled();
  c.run(`state.sheets.push(${JSON.stringify(sheet("s99", KEY, { sample: true }))})`);
  assert.equal(JSON.parse(text(c)).sheets.length, 2);
});

test("rejects things that are not test files, and changes nothing", () => {
  const c = filled();
  for (const bad of ["not json", "{}", "[]", "null", '{"app":"Other","version":1,"test":{}}', '{"app":"SagotScan","test":{"size":30}}']) {
    assert.equal(parse(c, bad).ok, false, bad);
  }
  assert.equal(c.run("state.sheets.length"), 2);
});

test("rejects a file from a newer version", () => {
  const f = JSON.parse(text(filled()));
  f.version = 99;
  const r = parse(load(), JSON.stringify(f));
  assert.equal(r.ok, false);
  assert.match(r.error, /newer/);
});

test("rejects bad sizes and damaged sheets", () => {
  const f = JSON.parse(text(filled()));
  const ok = (mut) => { const g = JSON.parse(JSON.stringify(f)); mut(g); return parse(load(), JSON.stringify(g)).ok; };
  assert.equal(ok(() => {}), true); // control: untouched file is fine
  assert.equal(ok((g) => { g.test.size = 0; }), false);
  assert.equal(ok((g) => { g.test.size = 61; }), false);
  assert.equal(ok((g) => { g.test.size = 30.5; }), false);
  assert.equal(ok((g) => { g.sheets[0].answers.pop(); }), false);
  assert.equal(ok((g) => { g.sheets[0].answers[0] = "Z"; }), false);
  assert.equal(ok((g) => { g.sheets[0].size = 45; }), false);
  assert.equal(ok((g) => { delete g.sheets[0].id; }), false);
  assert.equal(ok((g) => { g.sheets[0].answers = "ABC"; }), false);
});

test("cleans values instead of trusting them", () => {
  const f = JSON.parse(text(filled()));
  f.test.keys.A = "abcd-xyz9" + KEY.slice(9);
  f.sheets[0].classNo = "1a2b3";
  f.sheets[0].set = "Q";
  f.test.name = "x".repeat(500);
  const d = parse(load(), JSON.stringify(f)).data;
  assert.match(d.test.keys.A, /^[A-D-]+$/);
  assert.equal(d.sheets[0].classNo, "12");
  assert.equal(d.sheets[0].set, "");
  assert.equal(d.test.name.length, 200);
});

test("hasWork: the sample alone is not work; a name or a real sheet is", () => {
  const c = load();
  c.run(`state.test.keys.B = "ABCD"; state.sampleKeySet = "B"; state.sheets = [${JSON.stringify(sheet("s01", KEY, { sample: true }))}]`);
  assert.equal(c.run("hasWork()"), false);
  c.run(`state.test.name = "x"`);
  assert.equal(c.run("hasWork()"), true);
  c.run(`state.test.name = ""; state.sheets.push(${JSON.stringify(sheet("s02", KEY))})`);
  assert.equal(c.run("hasWork()"), true);
});

test("a failed save is reported once and clears when saving works again", () => {
  const c = load();
  c.run(`globalThis.shown = []; showStorageWarning = (on) => shown.push(on)`);
  c.__failSave = true;
  c.run("save(); save()");
  assert.deepEqual(JSON.parse(c.run("JSON.stringify(shown)")), [true]);
  c.__failSave = false;
  c.run("save()");
  assert.deepEqual(JSON.parse(c.run("JSON.stringify(shown)")), [true, false]);
});
