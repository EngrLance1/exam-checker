const test = require("node:test");
const assert = require("node:assert/strict");
const { load, sheet } = require("./helpers/load");

const KEY = "ABCD".repeat(7) + "AB";
const json = (c, code) => JSON.parse(c.run(`JSON.stringify(${code})`));
const parse = (c, text) => json(c, `parseClassList(${JSON.stringify(text)})`);

test("reads the usual ways teachers write a list", () => {
  const c = load();
  const r = parse(c, "12 Dela Cruz, Juan\n5. Reyes, Ana\n07, Lim Ben\n3\tRia Santos\r\n 9 - Tan Mia \n10) Co Zed");
  assert.deepEqual(r.entries, { "12": "Dela Cruz, Juan", "05": "Reyes, Ana", "07": "Lim Ben", "03": "Ria Santos", "09": "Tan Mia", "10": "Co Zed" });
  assert.deepEqual(r.bad, []);
});

test("lines it cannot read are returned, not guessed", () => {
  const c = load();
  const r = parse(c, "just a name\n12\n\n  \n99999 Too Many Digits\n04 Okay Name");
  assert.deepEqual(r.entries, { "04": "Okay Name" });
  assert.equal(r.bad.length, 3);
});

test("names are cleaned and capped", () => {
  const c = load();
  const r = parse(c, "01   Ana    Reyes  \n02 " + "x".repeat(200));
  assert.equal(r.entries["01"], "Ana Reyes");
  assert.equal(r.entries["02"].length, 80);
});

test("a later line for the same number wins", () => {
  const c = load();
  assert.deepEqual(parse(c, "01 First\n1 Second").entries, { "01": "Second" });
});

test("applyRoster names empty sheets in that section only, and never overwrites a typed name", () => {
  const c = load();
  c.run(`state.test.size = 30; state.sheets = ${JSON.stringify([
    sheet("a01", KEY, { classNo: "01", section: "A" }),
    sheet("a02", KEY, { classNo: "02", section: "A", name: "Typed By Teacher" }),
    sheet("a03", KEY, { classNo: "03", section: "A" }),
    sheet("b01", KEY, { classNo: "01", section: "B" }),
  ])}`);
  const res = json(c, `applyRoster({ "01": "Ana", "02": "Ben" }, "A")`);
  assert.equal(res.filled, 1);
  assert.deepEqual(res.unmatched, ["03"]);
  assert.equal(c.run("state.sheets[0].name"), "Ana");
  assert.equal(c.run("state.sheets[1].name"), "Typed By Teacher");
  assert.equal(c.run("state.sheets[3].name"), ""); // other section untouched
});

test("the saved list names later sheets, per section", () => {
  const c = load();
  c.run(`applyRoster({ "07": "Ria" }, "A"); applyRoster({ "07": "Zed" }, "B")`);
  assert.equal(c.run(`rosterName({ classNo: "07", section: "A" })`), "Ria");
  assert.equal(c.run(`rosterName({ classNo: "07", section: "B" })`), "Zed");
  assert.equal(c.run(`rosterName({ classNo: "07", section: "C" })`), "");
  assert.equal(c.run(`rosterName({ classNo: "08", section: "A" })`), "");
});

test("adding to a section's list merges with what is there", () => {
  const c = load();
  c.run(`applyRoster({ "01": "Ana" }, ""); applyRoster({ "02": "Ben" }, "")`);
  assert.deepEqual(json(c, `state.test.roster[""]`), { "01": "Ana", "02": "Ben" });
});

test("cleanRoster drops damaged entries", () => {
  const c = load();
  const bad = { "10-A": { "01": "Ana", "1": "no", "ab": "no", "02": 5, "03": "  " }, "": "nope", "10-B": [1], ["x".repeat(100)]: { "04": "Long section" } };
  const out = json(c, `cleanRoster(${JSON.stringify(bad)})`);
  assert.deepEqual(out["10-A"], { "01": "Ana" });
  assert.equal(out["10-B"], undefined);
  assert.equal(Object.keys(out).some((k) => k.length > 40), false);
  assert.deepEqual(json(c, "cleanRoster(null)"), {});
  assert.deepEqual(json(c, "cleanRoster([1,2])"), {});
});

test("the class list travels in the test file", () => {
  const c = load();
  c.run(`state.test.size = 30; state.test.keys.A = ${JSON.stringify(KEY)}; applyRoster({ "01": "Ana" }, "10-A")`);
  const t = c.run("JSON.stringify(buildTestFile())");
  const d = load();
  d.run(`applyTestFile(parseTestFile(${JSON.stringify(t)}).data)`);
  assert.equal(d.run(`state.test.roster["10-A"]["01"]`), "Ana");
});
