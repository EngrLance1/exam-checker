const test = require("node:test");
const assert = require("node:assert/strict");
const { load, sheet } = require("./helpers/load");

// 30-item key. Sheets are given as records; sizes must be 30/50/60 for file tests, but scoring does not care.
const KEY = "ABCD".repeat(7) + "AB";

function setup(key, sheets) {
  const c = load();
  c.run(`state.test.size = 30; state.test.keys.A = ${JSON.stringify(key)}; state.sheets = ${JSON.stringify(sheets)}`);
  return c;
}
const score = (c, i) => c.run(`scoreOf(state.sheets[${i}])`);
const fixes = (c) => JSON.parse(c.run("JSON.stringify(state.test.fixes)"));

test("plain scoring: right answers counted, blank and wrong not", () => {
  const c = setup(KEY, [sheet("s01", KEY), sheet("s02", ".".repeat(30))]);
  assert.equal(score(c, 0).score, 30);
  assert.equal(score(c, 0).total, 30);
  assert.equal(score(c, 1).score, 0);
});

test("'-' in the key is not scored", () => {
  const c = setup("-" + KEY.slice(1), [sheet("s01", KEY)]);
  assert.equal(score(c, 0).total, 29);
});

test("also-accept: both letters earn the point, a third letter does not", () => {
  const c = setup(KEY, [sheet("s01", "B" + KEY.slice(1)), sheet("s02", "A" + KEY.slice(1)), sheet("s03", "C" + KEY.slice(1))]);
  c.run(`setFix("A", 1, "also:B")`);
  assert.equal(score(c, 0).score, 30);
  assert.equal(score(c, 1).score, 30);
  assert.equal(score(c, 2).score, 29);
});

test("change key: the old key stops counting", () => {
  const c = setup(KEY, [sheet("s01", "B" + KEY.slice(1)), sheet("s02", "A" + KEY.slice(1))]);
  c.run(`setFix("A", 1, "key:B")`);
  assert.equal(score(c, 0).score, 30);
  assert.equal(score(c, 1).score, 29);
});

test("credit everyone: even a blank or double-marked answer earns the point", () => {
  const c = setup(KEY, [sheet("s01", "." + KEY.slice(1)), sheet("s02", "*" + KEY.slice(1))]);
  c.run(`setFix("A", 1, "credit")`);
  assert.equal(score(c, 0).score, 30);
  assert.equal(score(c, 1).score, 30);
});

test("drop item: total goes down and nobody is scored on it", () => {
  const c = setup(KEY, [sheet("s01", "B" + KEY.slice(1))]);
  c.run(`setFix("A", 1, "drop")`);
  assert.equal(score(c, 0).score, 29);
  assert.equal(score(c, 0).total, 29);
});

test("a blank answer never matches an accepted letter", () => {
  const c = setup(KEY, [sheet("s01", "." + KEY.slice(1))]);
  c.run(`setFix("A", 1, "also:B")`);
  assert.equal(score(c, 0).score, 29);
});

test("clearing a fix restores the original scoring", () => {
  const c = setup(KEY, [sheet("s01", "B" + KEY.slice(1))]);
  c.run(`setFix("A", 1, "credit")`);
  assert.equal(score(c, 0).score, 30);
  c.run(`setFix("A", 1, "")`);
  assert.equal(score(c, 0).score, 29);
});

test("setFix rejects bad input and unkeyed items", () => {
  const c = setup("-" + KEY.slice(1), []);
  assert.equal(c.run(`setFix("A", 1, "credit")`), false); // item 1 is '-'
  assert.equal(c.run(`setFix("A", 2, "bogus")`), false);
  assert.equal(c.run(`setFix("Z", 2, "credit")`), false);
  assert.equal(c.run(`setFix("A", 2, "also:E")`), false);
  assert.deepEqual(fixes(c).A, {});
});

test("fixing to the key's own letter is no fix", () => {
  const c = setup(KEY, []);
  c.run(`setFix("A", 1, "also:A")`);
  assert.deepEqual(fixes(c).A, {});
});

test("item analysis follows the fix and still lists dropped items", () => {
  const sheets = ["s01", "s02", "s03", "s04", "s05"].map((id, n) => sheet(id, (n < 3 ? "B" : "A") + KEY.slice(1)));
  const c = setup(KEY, sheets);
  assert.equal(c.run(`analyze()[0].items[0].correct`), 2);
  c.run(`setFix("A", 1, "also:B")`);
  assert.equal(c.run(`analyze()[0].items[0].correct`), 5);
  assert.equal(c.run(`analyze()[0].items[0].p`), 1);
  assert.equal(c.run(`analyze()[0].items[0].accept`), "A, B");
  c.run(`setFix("A", 1, "drop")`);
  assert.equal(c.run(`analyze()[0].items[0].dropped`), true);
  assert.equal(c.run(`analyze()[0].items[0].p`), null);
  assert.equal(c.run(`analyze()[0].items.length`), 30); // still listed so the teacher can undo
  assert.equal(c.run(`mpsReport().items.length`), 29); // but not counted in item MPS
});

test("discrimination uses the fixed answer", () => {
  const good = KEY.slice(1), none = ".".repeat(29);
  const sheets = [
    sheet("s01", "B" + good), sheet("s02", "B" + good), sheet("s03", "B" + good),
    sheet("s04", "A" + none), sheet("s05", "A" + none), sheet("s06", "A" + none), sheet("s07", "A" + none), sheet("s08", "A" + none),
  ];
  const c = setup(KEY, sheets);
  assert.ok(c.run(`analyze()[0].items[0].d`) < 0); // key A: weak students got it, strong did not
  c.run(`setFix("A", 1, "key:B")`);
  assert.ok(c.run(`analyze()[0].items[0].d`) > 0); // key B: now it separates the right way
});

test("old saved data without fixes still loads", () => {
  const c = load();
  c.store["sagotscan-v1"] = JSON.stringify({ test: { name: "x", size: 30, keys: { A: KEY, B: "", C: "", D: "" } }, sheets: [], activeSet: "A" });
  assert.equal(c.run("restore()"), true);
  assert.deepEqual(fixes(c), { A: {}, B: {}, C: {}, D: {} });
});

test("damaged fixes in saved data are dropped, good ones kept", () => {
  const c = load();
  const bad = { A: { 1: { type: "also", letter: "B" }, 2: { type: "also", letter: "Z" }, 3: "nope", 999: { type: "drop" }, 4: { type: "drop" } }, B: "bad" };
  c.store["sagotscan-v1"] = JSON.stringify({ test: { name: "", size: 30, keys: { A: KEY }, fixes: bad }, sheets: [] });
  c.run("restore()");
  assert.deepEqual(fixes(c).A, { 1: { type: "also", letter: "B" }, 4: { type: "drop" } });
});
