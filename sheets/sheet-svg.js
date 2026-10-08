// sheets/sheet-svg.js — draws a printable SagotScan answer sheet as SVG. No DOM, so it can be tested in Node.
//
// The scanner (app/js/omr.js) finds the four black corner squares and treats their centres as the corners of a frame.
// Every bubble position in app/js/data/layouts.js is a fraction of that frame. This file draws the sheet in that same
// frame, taking the bubble positions straight from the layout data, so a printed sheet cannot drift from the scanner.
//
//   buildSheetSVG(size, layouts, { fill })      size: any number of items; layouts: an object with a layout under the key String(size),
//                                              e.g. { 40: layoutFor(40) } (see app/js/core/sheetlayout.js)
//   fill (optional, to draw a filled sample): { answers: ["A", "", "BC", ...], classNo: "07", set: "B" }
//   code (optional, default on): the sheet code, a tiny row of squares that tells the scanner how many items the sheet has.
//                                 Pass { code: false } to draw a sheet like the ones printed before the code existed (for tests).
//   ink (optional): colour of shaded bubbles, default near-black. A grey like "#666" imitates light pencil.
//   An item with two letters is drawn double-marked; an empty string is left blank.

const SHEET_VERSION = 1;
const SHEET_PAD = 50;       // margin around the frame, in frame units: keeps the corner squares clear of the paper edge and of printer margins
const SHEET_MARKER = 40;    // side of a corner square, in frame units (the frame is 1000 units wide). Big on purpose: the scanner
                            // keeps only the 7 largest dark shapes, so under tilt the far squares must still beat the shaded bubbles.
const SHEET_LETTERS = "ABCD";

// The frame is 1000 units wide. Its height follows from the bubbles being round: r is a fraction of the width,
// ry the same radius as a fraction of the height.
function sheetGeometry(layout) {
  const W = 1000;
  return { W, H: (W * layout.r) / layout.ry, R: layout.r * W };
}

function buildSheetSVG(size, layouts, opts = {}) {
  const lay = layouts[String(size)];
  if (!lay) throw new Error(`No layout for a ${size}-item sheet`);
  const { W, H, R } = sheetGeometry(lay);
  const X = (f) => f * W, Y = (f) => f * H;
  const n = (v) => Math.round(v * 100) / 100;
  const fill = opts.fill || null;
  const ink = opts.ink || "#1a1a1a";

  const out = [];
  const add = (s) => out.push(s);
  const text = (x, y, s, o = {}) =>
    `<text x="${n(x)}" y="${n(y)}" font-size="${o.size || 12}"${o.bold ? ' font-weight="700"' : ""}${o.anchor ? ` text-anchor="${o.anchor}"` : ""}${o.fill ? ` fill="${o.fill}"` : ""}${o.spacing ? ` letter-spacing="${o.spacing}"` : ""}>${s}</text>`;
  const bubble = (cx, cy, label, on) =>
    `<circle cx="${n(cx)}" cy="${n(cy)}" r="${n(R)}" fill="${on ? ink : "#fff"}" stroke="#222" stroke-width="1.5"/>` +
    (on ? "" : text(cx, cy + 3.3, label, { size: 8.6, anchor: "middle", fill: "#8c8c8c" }));

  const vbW = W + 2 * SHEET_PAD, vbH = H + 2 * SHEET_PAD;
  add(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${-SHEET_PAD} ${-SHEET_PAD} ${n(vbW)} ${n(vbH)}"${opts.width ? ` width="${opts.width}"` : ""}${opts.height ? ` height="${opts.height}"` : ""} font-family="Arial, Helvetica, sans-serif" role="img" aria-label="SagotScan ${size}-item answer sheet">`);
  add(`<title>SagotScan ${size}-item answer sheet</title>`);
  add(`<rect x="${-SHEET_PAD}" y="${-SHEET_PAD}" width="${n(vbW)}" height="${n(vbH)}" fill="#fff"/>`);

  // Four corner squares: their centres are the corners of the frame.
  const half = SHEET_MARKER / 2;
  for (const [cx, cy] of [[0, 0], [W, 0], [W, H], [0, H]]) add(`<rect class="corner" x="${n(cx - half)}" y="${n(cy - half)}" width="${SHEET_MARKER}" height="${SHEET_MARKER}" fill="#000"/>`);

  // The sheet code: how many items this sheet has, as 11 small squares the scanner reads (see app/js/core/sheetlayout.js).
  if (opts.code !== false) {
    const bits = sheetCodeBits(size), cs = SHEET_CODE_SQUARE;
    sheetCodePositions().forEach(([fx, fy], k) => add(`<rect class="code" x="${n(X(fx) - cs / 2)}" y="${n(Y(fy) - cs / 2)}" width="${cs}" height="${cs}" fill="${bits[k] ? "#000" : "#fff"}" stroke="${bits[k] ? "#000" : "#999"}" stroke-width="1"/>`));
    add(text(X(sheetCodePositions()[SHEET_CODE_COUNT - 1][0]) + cs / 2, Y(SHEET_CODE_Y) + 22, `sheet code: ${size} items`, { size: 7, anchor: "end", fill: "#999" }));
  }

  // Title and name fields
  add(text(W / 2, 64, "ANSWER SHEET", { size: 40, bold: true, anchor: "middle" }));
  add(text(W / 2, 92, `${size} Items  •  Multiple Choice (A–D)  •  Shade the circle completely`, { size: 15, anchor: "middle", fill: "#333" }));
  const fields = [["Name:", "Date:"], ["Grade &amp; Section:", "Subject:"], ["Test / Quarter:", "Teacher:"]];
  fields.forEach(([a, b], i) => {
    const y = Y(0.112) + i * 36;
    add(text(30, y, a, { size: 14 }) + `<line x1="190" x2="585" y1="${n(y + 4)}" y2="${n(y + 4)}" stroke="#444" stroke-width="1"/>`);
    add(text(625, y, b, { size: 14 }) + `<line x1="705" x2="975" y1="${n(y + 4)}" y2="${n(y + 4)}" stroke="#444" stroke-width="1"/>`);
  });

  // Class number and test set panel
  const panelTop = Y(0.185), panelBottom = Y(0.47);
  add(`<rect x="28" y="${n(panelTop)}" width="296" height="${n(panelBottom - panelTop)}" rx="14" fill="none" stroke="#222" stroke-width="1.6"/>`);
  add(`<line x1="172" x2="172" y1="${n(panelTop + 14)}" y2="${n(panelBottom - 14)}" stroke="#bbb" stroke-width="1"/>`);
  const clsMid = X((lay.cls[0][0][0] + lay.cls[1][0][0]) / 2);
  add(text(clsMid, panelTop + 22, "CLASS NO.", { size: 13, bold: true, anchor: "middle", spacing: 0.6 }));
  for (const g of [0, 1]) add(`<rect x="${n(X(lay.cls[g][0][0]) - 15)}" y="${n(panelTop + 32)}" width="30" height="30" fill="none" stroke="#222" stroke-width="1.2"/>`);
  add(text(clsMid, panelTop + 76, "write, then shade", { size: 8.5, anchor: "middle", fill: "#777" }));
  const setX = X(lay.set[0][0]);
  add(text(setX, panelTop + 22, "TEST SET", { size: 13, bold: true, anchor: "middle", spacing: 0.6 }));
  add(text(setX, Y(lay.set[3][1]) + 38, "shade one", { size: 8.5, anchor: "middle", fill: "#777" }));

  lay.cls.forEach((grp, g) => grp.forEach(([fx, fy], d) => add(bubble(X(fx), Y(fy), String(d), !!fill && String(fill.classNo || "")[g] === String(d)))));
  lay.set.forEach(([fx, fy], i) => add(bubble(X(fx), Y(fy), SHEET_LETTERS[i], !!fill && fill.set === SHEET_LETTERS[i])));

  // Directions box
  const dx = 346, dTop = panelTop, dBottom = panelBottom;
  add(`<rect x="${dx}" y="${n(dTop)}" width="${W - 25 - dx}" height="${n(dBottom - dTop)}" rx="14" fill="none" stroke="#222" stroke-width="1.6"/>`);
  add(text(dx + 20, dTop + 30, "DIRECTIONS", { size: 14, bold: true, spacing: 0.6 }));
  const dir = [
    "1. Use a No. 2 pencil or a black / dark ballpoint pen.",
    "2. Write your class number in the boxes, then shade",
    "    the matching circles below each box.",
    "3. Shade the TEST SET given by your teacher.",
    "4. Shade only ONE circle per item. Fill it completely.",
    "5. To change an answer, erase completely.",
    "6. Do not fold, staple, or write on the black corner",
    "    squares or the answer area margins.",
  ];
  dir.forEach((t, i) => add(text(dx + 20, dTop + 60 + i * 22, t, { size: 12.5 })));
  const exY = dTop + 60 + dir.length * 22 + 38;
  add(text(dx + 20, exY - 18, "CORRECT", { size: 11, bold: true, spacing: 0.5 }));
  add(`<circle cx="${dx + 34}" cy="${n(exY + 6)}" r="10" fill="#1a1a1a"/>` + text(dx + 20, exY + 36, "Fully shaded", { size: 8.5, fill: "#777" }));
  const wx = dx + 190;
  add(text(wx, exY - 18, "WRONG", { size: 11, bold: true, spacing: 0.5 }));
  const ex = (i) => wx + 14 + i * 38;
  add(`<circle cx="${ex(0)}" cy="${n(exY + 6)}" r="10" fill="#fff" stroke="#222" stroke-width="1.4"/><path d="M${ex(0) - 5} ${n(exY + 6)} l4 5 l7 -10" fill="none" stroke="#222" stroke-width="1.6"/>`);
  add(`<circle cx="${ex(1)}" cy="${n(exY + 6)}" r="10" fill="#fff" stroke="#222" stroke-width="1.4"/><path d="M${ex(1) - 5} ${n(exY + 1)} l10 10 M${ex(1) + 5} ${n(exY + 1)} l-10 10" fill="none" stroke="#222" stroke-width="1.6"/>`);
  add(`<circle cx="${ex(2)}" cy="${n(exY + 6)}" r="10" fill="#fff" stroke="#222" stroke-width="1.4"/><circle cx="${ex(2)}" cy="${n(exY + 6)}" r="2.6" fill="#222"/>`);
  add(`<circle cx="${ex(3)}" cy="${n(exY + 6)}" r="10" fill="#fff" stroke="#222" stroke-width="1.4"/><path d="M${ex(3)} ${n(exY - 4)} a10 10 0 0 1 0 20 z" fill="#222"/>`);
  add(text(wx, exY + 36, "Check, cross, dot, or half-shaded", { size: 8.5, fill: "#777" }));
  add(text(dx + 20, dBottom - 18, "SCORE: ________ / " + size, { size: 14, bold: true }));

  // Answer area: columns of items numbered down, A-D bubbles
  const xs = [...new Set(lay.items.map((g) => g[0][0]))].sort((a, b) => a - b);
  const colTop = xs.map((fx) => Math.min(...lay.items.filter((g) => g[0][0] === fx).map((g) => g[0][1])));
  const lastY = Math.max(...lay.items.map((g) => g[0][1]));
  const areaTop = Y(0.487), areaBottom = Y(lastY + 0.032);
  add(`<rect x="12" y="${n(areaTop)}" width="${W - 24}" height="${n(areaBottom - areaTop)}" rx="14" fill="none" stroke="#222" stroke-width="1.6"/>`);
  // thin separators halfway between one column's last bubble and the next column's item numbers
  const choiceDx = lay.items[0][1][0] - lay.items[0][0][0];
  for (let c = 0; c < xs.length - 1; c++) {
    const sepX = X((xs[c] + 3 * choiceDx + lay.r + xs[c + 1] - 0.045) / 2);
    add(`<line x1="${n(sepX)}" x2="${n(sepX)}" y1="${n(areaTop + 12)}" y2="${n(areaBottom - 12)}" stroke="#bbb" stroke-width="1"/>`);
  }
  xs.forEach((fx, c) => {
    const row0 = lay.items.find((g) => g[0][0] === fx && g[0][1] === colTop[c]);
    row0.forEach(([bx, by], j) => add(text(X(bx), Y(by) - 21, SHEET_LETTERS[j], { size: 10, bold: true, anchor: "middle", fill: "#666" })));
  });
  lay.items.forEach((grp, i) => {
    const picked = fill && fill.answers && fill.answers[i] ? String(fill.answers[i]) : "";
    add(text(X(grp[0][0]) - 20, Y(grp[0][1]) + 5, String(i + 1), { size: 15, bold: true, anchor: "end" }));
    grp.forEach(([bx, by], j) => add(bubble(X(bx), Y(by), SHEET_LETTERS[j], picked.includes(SHEET_LETTERS[j]))));
  });

  // Footer
  add(text(W / 2, H - 26, "Keep all four black corner squares visible when scanning. Lay the sheet flat in good light.", { size: 11, anchor: "middle", fill: "#777" }));
  add(text(W - 6, H + 38, `SagotScan sheet · ${size} items · v${SHEET_VERSION}`, { size: 8, anchor: "end", fill: "#aaa" }));
  add(`</svg>`);
  return out.join("\n");
}
