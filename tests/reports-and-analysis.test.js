const test = require("node:test");
const assert = require("node:assert/strict");
const { load, sheet } = require("./helpers/load");

const KEY = "ABCD".repeat(7) + "AB"; // 30 items
const json = (c, code) => JSON.parse(c.run(`JSON.stringify(${code})`));

function setup(sheets, key = KEY, size = 30) {
  const c = load();
  c.run(`state.test.size = ${size}; state.test.keys.A = ${JSON.stringify(key)}; state.sheets = ${JSON.stringify(sheets)}`);
  return c;
}
// Deterministic pseudo-random numbers so tests do not flake.
function rng(seed) { let s = seed; return () => (s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296; }
// A student with the given ability (chance of answering each item right).
function student(id, ability, rand, extra = {}) {
  const wrong = { A: "B", B: "C", C: "D", D: "A" };
  return sheet(id, KEY.split("").map((k) => (rand() < ability ? k : wrong[k])).join(""), extra);
}

/* ---------- sections ---------- */
test("section names are cleaned", () => {
  const c = load();
  assert.equal(c.run(`cleanSection("  10   Newton  ")`), "10 Newton");
  assert.equal(c.run(`cleanSection("x".repeat(100)).length`), 40);
  assert.equal(c.run(`cleanSection(5)`), "");
  assert.equal(c.run(`cleanSection(null)`), "");
});

test("the same class number in two sections is not a duplicate; in one section it is", () => {
  const c = setup([
    sheet("s01", KEY, { classNo: "05", section: "A" }), sheet("s02", KEY, { classNo: "05", section: "B" }), sheet("s03", KEY, { classNo: "05", section: "A" }),
  ]);
  const dup = (i) => c.run(`issuesOf(state.sheets[${i}])`).some((x) => /used twice/.test(x.t));
  assert.equal(dup(0), true);
  assert.equal(dup(1), false);
  assert.equal(dup(2), true);
  assert.equal(c.run("duplicatesOf(state.sheets[0]).length"), 1);
  assert.equal(c.run("duplicatesOf(state.sheets[1]).length"), 0);
});

test("without sections, duplicates work as before", () => {
  const c = setup([sheet("s01", KEY, { classNo: "05" }), sheet("s02", KEY, { classNo: "05" })]);
  assert.equal(c.run("duplicatesOf(state.sheets[0]).length"), 1);
});

test("sectionsList: sorted, unique, includes the one being scanned into", () => {
  const c = setup([sheet("s01", KEY, { section: "10-B" }), sheet("s02", KEY, { section: "10-A" }), sheet("s03", KEY, { section: "10-A" }), sheet("s04", KEY)]);
  c.run(`state.activeSection = "9-Z"`);
  assert.deepEqual(json(c, "sectionsList()"), ["9-Z", "10-A", "10-B"]); // natural order: 9 before 10
});

test("MPS is reported per section and overall", () => {
  const c = setup([
    sheet("s01", KEY, { classNo: "01", section: "A" }), sheet("s02", ".".repeat(30), { classNo: "02", section: "A" }),
    sheet("s03", KEY, { classNo: "01", section: "B" }),
  ]);
  const r = json(c, "mpsReport()");
  assert.equal(r.sections.length, 2);
  assert.equal(r.sections[0].m.mps, 50);
  assert.equal(r.sections[1].m.mps, 100);
  assert.ok(Math.abs(r.overall.mps - 66.6667) < 0.01);
});

test("item analysis can be limited to one section", () => {
  const sheets = [];
  for (let i = 0; i < 6; i++) sheets.push(sheet("a" + String(i).padStart(2, "0"), KEY, { section: "A" }));
  for (let i = 0; i < 4; i++) sheets.push(sheet("b" + String(i).padStart(2, "0"), ".".repeat(30), { section: "B" }));
  const c = setup(sheets);
  assert.equal(c.run("analyze()[0].n"), 10);
  assert.equal(c.run(`analyze("A")[0].n`), 6);
  assert.equal(c.run(`analyze("A")[0].items[0].p`), 1);
  assert.equal(c.run(`analyze("B")[0].items[0].p`), 0);
  assert.equal(json(c, `analyze("Nope")`).length, 0);
});

/* ---------- sanity checks ---------- */
test("keyProblems reports short and long keys, and nothing for a full key", () => {
  const c = setup([]);
  assert.deepEqual(json(c, "keyProblems()"), []);
  c.run(`state.test.keys.B = ${JSON.stringify(KEY.slice(0, 20))}; state.test.keys.C = ${JSON.stringify(KEY + "ABC")}`);
  const p = json(c, "keyProblems()");
  assert.equal(p.length, 2);
  assert.match(p[0], /Set B key has 20 of 30 items\. The other 10/);
  assert.match(p[1], /Set C key has 33 letters\. Only the first 30/);
});

test("a wrong-size sheet is scored but kept out of item analysis", () => {
  const sheets = ["s01", "s02", "s03", "s04"].map((id) => sheet(id, KEY));
  sheets.push(sheet("s05", "A".repeat(50), { classNo: "99" })); // 50-item sheet on a 30-item test
  const c = setup(sheets);
  assert.notEqual(c.run("scoreOf(state.sheets[4])"), null);
  assert.equal(c.run("analyze()[0].n"), 4);
  assert.equal(c.run("excludedFromAnalysis().length"), 1);
  assert.equal(c.run("rightSize(state.sheets[4])"), false);
});

/* ---------- item notes ---------- */
test("flags a possible miskey when top scorers prefer a wrong option", () => {
  const rand = rng(7), sheets = [];
  for (let i = 0; i < 4; i++) sheets.push(sheet("t" + String(i).padStart(2, "0"), "B" + KEY.slice(1)));        // best scores, but chose B on item 1 (key A)
  for (let i = 0; i < 7; i++) sheets.push(student("w" + String(i).padStart(2, "0"), 0.1, rand));              // weak students
  sheets.forEach((s) => { if (s.id[0] === "w") s.answers[0] = "A"; });
  const c = setup(sheets);
  const it = json(c, "analyze()[0].items[0]");
  assert.deepEqual(it.notes.find((n) => n.kind === "miskey"), { kind: "miskey", letters: ["B"] });
  assert.match(c.run(`noteText(analyze()[0].items[0].notes[0])`), /Check the key: B/);
});

test("no miskey flag for a normal item", () => {
  const rand = rng(3), sheets = [];
  for (let i = 0; i < 12; i++) sheets.push(student("s" + String(i).padStart(2, "0"), 0.4 + i * 0.05, rand));
  const c = setup(sheets);
  const items = json(c, "analyze()[0].items");
  assert.ok(items.filter((it) => it.notes.some((n) => n.kind === "miskey")).length <= 3);
  const plain = sheets.map((s) => ({ ...s })); plain.forEach((s) => { s.answers = KEY.split(""); });
  assert.equal(json(setup(plain), "analyze()[0].items").some((it) => it.notes.length), false); // everyone right: nothing to flag
});

test("options nobody chose are flagged only for classes of 20 or more", () => {
  const make = (n) => { const a = []; for (let i = 0; i < n; i++) a.push(sheet("s" + String(i).padStart(2, "0"), (i % 2 ? "A" : "B") + KEY.slice(1))); return a; };
  const big = setup(make(20)), small = setup(make(19));
  const weak = (c) => json(c, "analyze()[0].items[0].notes").find((n) => n.kind === "weak");
  assert.deepEqual(weak(big).letters, ["C", "D"]);
  assert.equal(weak(small), undefined);
});

test("credit-everyone and dropped items get no notes", () => {
  const c = setup(Array.from({ length: 20 }, (_, i) => sheet("s" + String(i).padStart(2, "0"), "B" + KEY.slice(1))));
  c.run(`setFix("A", 1, "credit")`);
  assert.deepEqual(json(c, "analyze()[0].items[0].notes"), []);
  c.run(`setFix("A", 1, "drop")`);
  assert.deepEqual(json(c, "analyze()[0].items[0].notes"), []);
});

/* ---------- KR-20 ---------- */
test("KR-20 and SEM match an independent calculation", () => {
  const rand = rng(11), sheets = [];
  for (let i = 0; i < 25; i++) sheets.push(student("s" + String(i).padStart(2, "0"), 0.25 + (i / 25) * 0.65, rand));
  const c = setup(sheets);
  // Independent: 0/1 matrix straight from the raw answers.
  const m = sheets.map((s) => s.answers.map((a, i) => (a === KEY[i] ? 1 : 0)));
  const n = m.length, k = 30;
  const totals = m.map((r) => r.reduce((a, b) => a + b, 0));
  const mean = totals.reduce((a, b) => a + b, 0) / n;
  const variance = totals.reduce((a, t) => a + (t - mean) ** 2, 0) / n;
  let pq = 0;
  for (let i = 0; i < k; i++) { const p = m.reduce((a, r) => a + r[i], 0) / n; pq += p * (1 - p); }
  const kr20 = (k / (k - 1)) * (1 - pq / variance);
  const sem = Math.sqrt(variance) * Math.sqrt(1 - kr20);
  const rel = json(c, "analyze()[0].rel");
  assert.ok(Math.abs(rel.kr20 - kr20) < 1e-9, `${rel.kr20} vs ${kr20}`);
  assert.ok(Math.abs(rel.sem - sem) < 1e-9);
  assert.ok(kr20 > 0.3 && kr20 < 1);
});

test("KR-20 is withheld for small classes and when every score is the same", () => {
  const rand = rng(5);
  const nine = Array.from({ length: 9 }, (_, i) => student("s" + i + "0", 0.3 + i * 0.07, rand));
  assert.equal(json(setup(nine), "analyze()[0].rel"), null);
  const same = Array.from({ length: 12 }, (_, i) => sheet("s" + String(i).padStart(2, "0"), KEY));
  assert.equal(json(setup(same), "analyze()[0].rel"), null);
});

test("KR-20 skips dropped items", () => {
  const rand = rng(2), sheets = [];
  for (let i = 0; i < 15; i++) sheets.push(student("s" + String(i).padStart(2, "0"), 0.3 + i * 0.04, rand));
  const c = setup(sheets);
  assert.equal(json(c, "analyze()[0].rel.k"), 30);
  c.run(`setFix("A", 1, "drop")`);
  assert.equal(json(c, "analyze()[0].rel.k"), 29);
});

/* ---------- distribution ---------- */
test("distribution puts every student in one band and the counts add up", () => {
  const rows = [30, 28, 25, 20, 10, 5, 1, 0].map((s) => ({ score: s, total: 30 }));
  const c = load();
  const d = json(c, `distribution(${JSON.stringify(rows)})`);
  assert.equal(d.reduce((a, b) => a + b.count, 0), 8);
  assert.equal(d.reduce((a, b) => a + b.pct, 0).toFixed(6), "100.000000");
  const by = Object.fromEntries(d.map((b) => [b.level, b.count]));
  assert.equal(by["Mastered"], 1);                       // 30/30
  assert.equal(by["Closely approximating mastery"], 1);  // 28/30 = 93.3
  assert.equal(by["Moving towards mastery"], 2);        // 25/30 = 83.3 and 20/30 = 66.7
  assert.equal(by["Average"], 0);
  assert.equal(by["Low"], 2);                            // 10/30 = 33.3 and 5/30 = 16.7
  assert.equal(by["Very low"], 0);
  assert.equal(by["Absolutely no mastery"], 2);          // 1/30 = 3.3 and 0
});

test("distribution band edges match masteryLevel", () => {
  const c = load();
  for (const [pct, level] of [[100, "Mastered"], [96, "Mastered"], [95.9, "Closely approximating mastery"], [86, "Closely approximating mastery"], [85.9, "Moving towards mastery"], [66, "Moving towards mastery"], [65.9, "Average"], [35, "Average"], [34.9, "Low"], [15, "Low"], [14.9, "Very low"], [5, "Very low"], [4.9, "Absolutely no mastery"], [0, "Absolutely no mastery"]]) {
    const d = json(c, `distribution([{ score: ${pct}, total: 100 }])`);
    assert.equal(d.find((b) => b.count === 1).level, level, String(pct));
  }
  assert.equal(json(c, "distribution([])").every((b) => b.count === 0 && b.pct === 0), true);
});

/* ---------- target ---------- */
test("target: invalid values fall back to 75; MPS counts and colours follow it", () => {
  const c = load();
  for (const v of [0, 101, 80.5, "80", null, NaN]) assert.equal(c.run(`cleanTarget(${JSON.stringify(v)})`), 75, String(v));
  assert.equal(c.run("cleanTarget(80)"), 80);
  const rows = JSON.stringify([{ score: 76, total: 100 }, { score: 82, total: 100 }, { score: 60, total: 100 }]);
  assert.equal(c.run(`mpsOf(${rows}, 75).passed`), 2);
  assert.equal(c.run(`mpsOf(${rows}, 80).passed`), 1);
  assert.equal(c.run(`levelClass(75, 75)`), "");
  assert.equal(c.run(`levelClass(74, 75)`), "warn");
  assert.equal(c.run(`levelClass(49, 75)`), "bad");
  assert.equal(c.run(`levelClass(79, 80)`), "warn");
});

test("changing the target changes 'passed' in the MPS the app reports", () => {
  const c = setup([sheet("s01", KEY), sheet("s02", KEY.slice(0, 24) + "BBBBBB")]); // 100% and 80%
  assert.equal(c.run("mpsReport().overall.passed"), 2);
  c.run("state.test.target = 90");
  assert.equal(c.run("mpsReport().overall.passed"), 1);
  assert.equal(c.run("mpsReport().target"), 90);
});

/* ---------- undo ---------- */
test("undo brings back removed sheets, keys, fixes and photos", () => {
  const c = setup([sheet("s01", KEY, { name: "Ana" }), sheet("s02", KEY, { name: "Ben" })]);
  c.run(`photos.s01 = "data:photo-1"; setFix("A", 1, "credit"); state.selected = "s02"; state.activeSection = "X"`);
  c.run("globalThis.snap = takeSnapshot()");
  c.run(`state.sheets = []; Object.keys(photos).forEach((k) => delete photos[k]); state.test.keys.A = ""; state.test.fixes.A = {}; state.selected = null; state.activeSection = ""`);
  c.run("applySnapshot(snap)");
  assert.equal(c.run("state.sheets.length"), 2);
  assert.equal(c.run("state.sheets[1].name"), "Ben");
  assert.equal(c.run("state.test.keys.A"), KEY);
  assert.equal(c.run("state.test.fixes.A[1].type"), "credit");
  assert.equal(c.run("state.selected"), "s02");
  assert.equal(c.run("state.activeSection"), "X");
  assert.equal(c.run("photos.s01"), "data:photo-1");
});

test("a snapshot is independent: later edits do not leak into it, and it can be applied twice", () => {
  const c = setup([sheet("s01", KEY)]);
  c.run("globalThis.snap = takeSnapshot()");
  c.run(`state.sheets[0].answers[0] = "D"; state.test.name = "changed"`);
  c.run("applySnapshot(snap)");
  assert.equal(c.run("state.sheets[0].answers[0]"), "A");
  assert.equal(c.run("state.test.name"), "");
  c.run(`state.sheets[0].answers[0] = "D"`);
  c.run("applySnapshot(snap)");
  assert.equal(c.run("state.sheets[0].answers[0]"), "A");
});

/* ---------- test file carries the new data ---------- */
test("test file keeps sections, the scanning section and the target", () => {
  const c = setup([sheet("s01", KEY, { section: "10-A", name: "Ana" })]);
  c.run(`state.test.target = 80; state.activeSection = "10-B"`);
  const t = c.run("JSON.stringify(buildTestFile())");
  const d = load();
  d.run(`applyTestFile(parseTestFile(${JSON.stringify(t)}).data)`);
  assert.equal(d.run("state.sheets[0].section"), "10-A");
  assert.equal(d.run("state.activeSection"), "10-B");
  assert.equal(d.run("state.test.target"), 80);
});

test("an older test file without sections or a target still opens", () => {
  const c = setup([sheet("s01", KEY)]);
  const f = JSON.parse(c.run("JSON.stringify(buildTestFile())"));
  delete f.activeSection; delete f.test.target; delete f.sheets[0].section;
  const d = load();
  const r = d.run(`parseTestFile(${JSON.stringify(JSON.stringify(f))})`);
  assert.equal(r.ok, true);
  assert.equal(r.data.test.target, 75);
  assert.equal(r.data.sheets[0].section, "");
  assert.equal(r.data.activeSection, "");
});
