const test = require("node:test");
const assert = require("node:assert/strict");
const { load, sheet } = require("./helpers/load");

const KEY50 = "ABCD".repeat(12) + "AB"; // 50 letters
const KEY40 = KEY50.slice(0, 40);

function setup(size, key, sheets) {
  const c = load();
  c.run(`state.test.size = ${size}; state.test.keys.A = ${JSON.stringify(key)}; state.sheets = ${JSON.stringify(sheets)}`);
  return c;
}

test("sheetSizeFor picks the smallest printed sheet that fits", () => {
  const c = load();
  const f = (n) => c.run(`sheetSizeFor(${n})`);
  assert.equal(f(1), 30);
  assert.equal(f(30), 30);
  assert.equal(f(31), 50);
  assert.equal(f(40), 50);
  assert.equal(f(50), 50);
  assert.equal(f(51), 60);
  assert.equal(f(60), 60);
  assert.equal(f(61), null);
});

test("isTestSize accepts whole numbers 1 to 75 only", () => {
  const c = load();
  for (const n of [1, 40, 60, 61, 75]) assert.equal(c.run(`isTestSize(${n})`), true, String(n));
  for (const n of [0, -5, 76, 2.5, "40", null, NaN]) assert.equal(c.run(`isTestSize(${JSON.stringify(n)})`), false, String(n));
});

test("a 40-item test on a 50-item sheet scores 40 items and ignores the rest", () => {
  // Student gets all 40 right and also shades stray bubbles after item 40 (wrong or right, must not matter).
  const full = sheet("s01", KEY50);
  const stray = sheet("s02", KEY40 + "D".repeat(10));
  const c = setup(40, KEY40, [full, stray]);
  assert.equal(c.run("scoreOf(state.sheets[0])").total, 40);
  assert.equal(c.run("scoreOf(state.sheets[0])").score, 40);
  assert.equal(c.run("scoreOf(state.sheets[1])").score, 40);
});

test("a key longer than the test is cut at the test length", () => {
  const c = setup(40, KEY50, [sheet("s01", KEY50)]);
  assert.equal(c.run("scoreOf(state.sheets[0])").total, 40);
});

test("a key shorter than the sheet but equal to the test is fully scored", () => {
  const c = setup(40, KEY40, [sheet("s01", KEY50)]);
  assert.equal(c.run("scoreOf(state.sheets[0])").total, 40);
});

test("a sheet made for exactly this many items is also the right sheet", () => {
  const own = sheet("s01", KEY40), std = sheet("s02", KEY50), wrong = sheet("s03", "A".repeat(30));
  const c = setup(40, KEY40, [own, std, wrong]);
  const bad = (i) => c.run(`issuesOf(state.sheets[${i}])`).some((x) => /item sheet/.test(x.t));
  assert.equal(bad(0), false); // the 40-item sheet
  assert.equal(bad(1), false); // the standard 50-item sheet that fits a 40-item test
  assert.equal(bad(2), true);  // a 30-item sheet is too short
  assert.equal(c.run("rightSize(state.sheets[0])"), true);
  assert.equal(c.run("rightSize(state.sheets[2])"), false);
});

test("above 60 items only a sheet of exactly that length fits", () => {
  const KEY70 = "ABCD".repeat(17) + "AB";
  const c = setup(70, KEY70, [sheet("s01", KEY70), sheet("s02", KEY70.slice(0, 60))]);
  assert.equal(c.run("sheetSizeFor(70)"), null);
  assert.equal(c.run("rightSize(state.sheets[0])"), true);
  assert.equal(c.run("rightSize(state.sheets[1])"), false);
});

test("sheet size problems: right sheet is fine, wrong sheet is reported", () => {
  const ok = sheet("s01", KEY50), tooSmall = sheet("s02", "A".repeat(30)), tooBig = sheet("s03", "A".repeat(60));
  const c = setup(40, KEY40, [ok, tooSmall, tooBig]);
  const sizeIssue = (i) => c.run(`issuesOf(state.sheets[${i}])`).some((x) => /item sheet/.test(x.t));
  assert.equal(sizeIssue(0), false);
  assert.equal(sizeIssue(1), true);
  assert.equal(sizeIssue(2), true);
  const msg = c.run("issuesOf(state.sheets[1]).find(x => /item sheet/.test(x.t)).t");
  assert.match(msg, /40-item test uses the 40-item sheet or the 50-item sheet/);
});

test("standard sizes behave as before: a 60 sheet for a 50 test is flagged", () => {
  const c = setup(50, KEY50, [sheet("s01", "A".repeat(60)), sheet("s02", KEY50)]);
  assert.equal(c.run("issuesOf(state.sheets[0])").some((x) => /item sheet/.test(x.t)), true);
  assert.equal(c.run("issuesOf(state.sheets[1])").some((x) => /item sheet/.test(x.t)), false);
});

test("item analysis lists only the test's items", () => {
  const sheets = ["s01", "s02", "s03", "s04"].map((id) => sheet(id, KEY50));
  const c = setup(40, KEY50, sheets);
  assert.equal(c.run("analyze()[0].items.length"), 40);
});

test("sizeAfterKey keeps a custom count when the key sheet is big enough", () => {
  const c = load();
  c.run("state.test.size = 40");
  assert.equal(c.run("sizeAfterKey(50)"), 40);
  assert.equal(c.run("sizeAfterKey(60)"), 40);
  assert.equal(c.run("sizeAfterKey(30)"), 30); // sheet too small for a 40-item test: follow the sheet
  c.run("state.test.size = 50");
  assert.equal(c.run("sizeAfterKey(30)"), 30); // standard sizes follow the sheet, as before
  assert.equal(c.run("sizeAfterKey(60)"), 60);
});

test("a saved test file keeps a custom item count", () => {
  const c = setup(40, KEY40, [sheet("s01", KEY50)]);
  const t = c.run("JSON.stringify(buildTestFile())");
  const d = load();
  d.run(`applyTestFile(parseTestFile(${JSON.stringify(t)}).data)`);
  assert.equal(d.run("state.test.size"), 40);
  assert.equal(d.run("scoreOf(state.sheets[0]).total"), 40);
});
