// app/js/core/sheetlayout.js — bubble positions for a sheet with ANY number of items (1 to MAX_ITEMS), in the same design as the
// built-in 30, 50 and 60-item sheets: the same frame, class number, test set and bubble size, items numbered down each column.
// No DOM here, so it can be tested in Node. Used by the reader (app/js/reader.js) and by the printable sheets page (sheets/).
//
// The built-in layouts (app/js/data/layouts.js) stay the source of truth for 30, 50 and 60. layoutByRule() reproduces them from the
// rule below (a test checks it), then extends the same rule to other lengths:
//   up to 50 items  10 rows per column  (as on the 30 and 50-item sheets)
//   51 to 60        12 rows per column  (as on the 60-item sheet)
//   61 to 75        15 rows per column  (bubbles keep a gap of about 10 units; 100 items would not fit)
// Columns are centred on the sheet; the spacing depends on how many there are.

const SHEET_COL_CENTER = 0.4775;                                   // x of the middle column's A bubble, as a fraction of the frame
const SHEET_COL_SPACING = { 1: 0, 2: 0.45, 3: 0.3135, 4: 0.24, 5: 0.1875 };
const SHEET_FIRST_ROW = 0.529;                                     // y of the first row of items

// How many rows and columns a sheet of n items has.
function sheetShape(n) {
  const rows = n <= 10 ? n : n <= 50 ? 10 : n <= 60 ? 12 : 15;
  return { rows, cols: Math.ceil(n / rows) };
}
const sheetRowStep = (rows) => (rows <= 10 ? 0.0393 : 0.3608 / (rows - 1));

// The layout computed from the rule (also used to check the rule against the built-in sheets).
function layoutByRule(n) {
  if (!Number.isInteger(n) || n < 1 || n > MAX_ITEMS) throw new Error(`A sheet has 1 to ${MAX_ITEMS} items, not ${n}`);
  const base = LAYOUTS["30"], { rows, cols } = sheetShape(n), dy = sheetRowStep(rows);
  const dx = base.items[0][1][0] - base.items[0][0][0];            // distance between the A, B, C and D bubbles
  const items = [];
  for (let i = 0; i < n; i++) {
    const col = Math.floor(i / rows), row = i % rows;
    const x0 = SHEET_COL_CENTER + (col - (cols - 1) / 2) * SHEET_COL_SPACING[cols], y = SHEET_FIRST_ROW + row * dy;
    items.push([0, 1, 2, 3].map((j) => [x0 + j * dx, y]));
  }
  return { r: base.r, ry: base.ry, items, cls: base.cls, set: base.set };
}

// The layout for a sheet of n items: the built-in one for 30, 50 and 60, otherwise from the rule.
function layoutFor(n) {
  return LAYOUTS[String(n)] || layoutByRule(n);
}

// ---- The sheet code ----
// Each printed sheet carries a tiny code that says how many items it has, so the scanner knows which layout to use without being
// told. It is 11 small squares in a row near the top-right corner, read like bubbles: black = 1, empty outline = 0.
//   3 sync squares (1 0 1)  +  7 squares for the number of items (most significant first)  +  1 parity square (makes the count of 1s even)
// A random smudge passes the sync, parity and range checks only about 4% of the time, and the reader also checks that the layout the
// code names actually matches the photo, so a false reading cannot win. Sheets printed before the code existed simply have none.
const SHEET_CODE_COUNT = 11;
const SHEET_CODE_X0 = 0.768, SHEET_CODE_DX = 0.016, SHEET_CODE_Y = 0.0374;   // centres, as fractions of the frame (1000 units wide)
const SHEET_CODE_SQUARE = 10;                                                  // side of a square, in frame units

const sheetCodePositions = () => Array.from({ length: SHEET_CODE_COUNT }, (_, k) => [SHEET_CODE_X0 + k * SHEET_CODE_DX, SHEET_CODE_Y]);

// The 11 bits for a sheet of n items.
function sheetCodeBits(n) {
  if (!isTestSize(n)) throw new Error(`A sheet has 1 to ${MAX_ITEMS} items, not ${n}`);
  const body = [];
  for (let b = 6; b >= 0; b--) body.push((n >> b) & 1);
  return [1, 0, 1, ...body, body.reduce((a, c) => a ^ c, 0)];
}

// The number of items an 11-bit reading stands for, or null if it is not a valid code.
function sheetCodeValue(bits) {
  if (!Array.isArray(bits) || bits.length !== SHEET_CODE_COUNT || bits[0] !== 1 || bits[1] !== 0 || bits[2] !== 1) return null;
  const body = bits.slice(3, 10);
  if (body.reduce((a, c) => a ^ c, 0) !== bits[10]) return null;
  const n = body.reduce((a, c) => a * 2 + c, 0);
  return isTestSize(n) ? n : null;
}
