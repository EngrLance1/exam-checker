// The sheet code: a row of 11 small squares that tells the scanner how many items a sheet has.
const test = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./helpers/load");

const c = load();
const run = (code) => c.run(code);
const MAX = run("MAX_ITEMS");
const bits = (n) => JSON.parse(run(`JSON.stringify(sheetCodeBits(${n}))`));
const value = (b) => run(`sheetCodeValue(${JSON.stringify(b)})`);

test("every length from 1 to 75 survives encode then decode", () => {
  for (let n = 1; n <= MAX; n++) assert.equal(value(bits(n)), n, String(n));
});

test("a code is 11 squares: sync 1 0 1, seven length bits, one parity bit", () => {
  const b = bits(40);                                            // 40 = 0101000
  assert.deepEqual(b, [1, 0, 1, 0, 1, 0, 1, 0, 0, 0, 0]);
  assert.equal(bits(75).length, 11);
  for (let n = 1; n <= MAX; n++) { const x = bits(n); assert.equal(x.slice(3).reduce((a, v) => a + v, 0) % 2, 0, `${n}: even number of 1s after the sync`); }
});

test("exactly 75 of the 2048 possible patterns are valid, so a random smudge passes only about 3.7% of the time", () => {
  let valid = 0;
  for (let p = 0; p < 2048; p++) { const b = Array.from({ length: 11 }, (_, i) => (p >> (10 - i)) & 1); if (value(b) !== null) valid++; }
  assert.equal(valid, 75);
});

test("one square read wrongly can never turn a code into a different valid code", () => {
  for (let n = 1; n <= MAX; n++) for (let i = 0; i < 11; i++) {
    const b = bits(n); b[i] ^= 1;
    assert.equal(value(b), null, `length ${n}, square ${i} flipped`);
  }
});

test("things that are not codes are refused", () => {
  assert.equal(value([]), null);
  assert.equal(value(null), null);
  assert.equal(value(new Array(11).fill(0)), null);              // blank paper: no sync
  assert.equal(value(new Array(11).fill(1)), null);              // a black smudge: bad sync
  assert.equal(value([1, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0]), null);  // length 0
  assert.equal(value([1, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1]), null);  // 127: more than 75 (also fails parity)
  assert.equal(value([1, 0, 1, 1, 0, 0, 1, 1, 0, 0, 0]), null);  // 76 with a correct parity bit is still out of range
  assert.equal(value(bits(40).slice(0, 10)), null);              // too short
});

test("bits for lengths outside 1 to 75 are refused", () => {
  for (const n of [0, 76, 100, 2.5]) assert.throws(() => bits(n), /A sheet has 1 to 75 items/, String(n));
});

test("the 11 squares sit in a row inside the frame, apart from each other, clear of the corner square and the title", () => {
  const pos = JSON.parse(run("JSON.stringify(sheetCodePositions())"));
  const W = 1000, size = run("SHEET_CODE_SQUARE");
  assert.equal(pos.length, 11);
  pos.forEach(([x, y], i) => {
    assert.ok(x * W - size / 2 > 700 && x * W + size / 2 < 960, `square ${i} is right of the title and left of the corner square`);
    assert.ok(Math.abs(y - pos[0][1]) < 1e-9, "one row");
    if (i) assert.ok((x - pos[i - 1][0]) * W >= size + 4, "squares do not touch");
  });
  const top = pos[0][1] * (W * run("LAYOUTS['30'].r") / run("LAYOUTS['30'].ry"));
  assert.ok(top - size / 2 > 20 + 10, "below the top corner squares' reach");
  assert.ok(top + size / 2 < 90, "above the class number and test set panel");
});

test("the squares are much smaller than a corner square, so they can never be mistaken for one", () => {
  assert.ok(run("SHEET_CODE_SQUARE") * run("SHEET_CODE_SQUARE") * 6 < 40 * 40);
});
