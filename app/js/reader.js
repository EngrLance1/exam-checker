// app/js/reader.js — works out which sheet a photo shows and reads it. No DOM; needs OMR, LAYOUTS, layoutFor() and the sheet code
// helpers from app/js/core/sheetlayout.js.
//
// 1. A sheet printed by SagotScan carries a small code that says how many items it has (see sheetlayout.js). It is read first, and
//    the layout it names is tried.
// 2. Sheets printed before the code existed (30, 50 and 60 items) have none, and a damaged code cannot be read. Then the built-in
//    30/50/60 layouts are tried, and the layout made for the test's own length.
// Every candidate is a real read of the photo, and the one that matches the photo best wins, so a wrong guess cannot beat the truth.
// The result's `size` is the number of items on the sheet that was read.

const TRUST_CONF = 55; // a layout named by the sheet's own code that matches the photo this well is accepted without trying the others

// Reads the sheet code at each of the four possible rotations. Returns the item counts that decode to a valid code.
function sheetCodesIn(gray, pts) {
  const { w, h, g } = gray;
  const px = (x, y) => { const xi = Math.round(x), yi = Math.round(y); return xi < 0 || yi < 0 || xi >= w || yi >= h ? 255 : g[yi * w + xi]; };
  const found = [];
  for (let rot = 0; rot < 4; rot++) {
    const order = [0, 1, 2, 3].map((i) => pts[(i + rot) % 4]);
    const H = OMR.homography(order);
    const black = order.reduce((s, [x, y]) => s + px(x, y), 0) / 4;
    const bits = sheetCodePositions().map(([fx, fy]) => {
      const c = H(fx, fy), e = H(fx + 0.003, fy), s = Math.hypot(e[0] - c[0], e[1] - c[1]); // s = 3 frame units in pixels
      let sum = 0, cnt = 0;
      const R = Math.max(1, Math.round(s));
      for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) if (dx * dx + dy * dy <= s * s) { sum += px(c[0] + dx, c[1] + dy); cnt++; }
      const mean = sum / Math.max(1, cnt), ring = [];
      for (let k = 0; k < 24; k++) { const a = (k * Math.PI) / 12; ring.push(px(c[0] + Math.cos(a) * s * 2.67, c[1] + Math.sin(a) * s * 2.67)); }
      ring.sort((p, q) => p - q);
      const white = ring[Math.floor(ring.length * 0.8)];
      return (white - mean) / Math.max(30, white - black) >= 0.5 ? 1 : 0;
    });
    const n = sheetCodeValue(bits);
    if (n !== null && !found.includes(n)) found.push(n);
  }
  return found;
}

function readSheet(gray, itemCount) {
  const tried = new Set();
  let best = null;
  const attempt = (n) => {
    if (tried.has(n) || !isTestSize(n)) return;
    tried.add(n);
    const r = OMR.read(gray, { [String(n)]: layoutFor(n) });
    if (r.ok && (!best || r.conf > best.conf)) best = r;
  };

  const pts = OMR.findMarkers(gray);
  if (pts) sheetCodesIn(gray, pts).forEach(attempt);
  if (best && best.conf >= TRUST_CONF) return best;

  // no code (an older sheet), or the code did not match the photo: try the built-in sheets and the one made for this test
  const builtIn = OMR.read(gray, LAYOUTS);
  if (builtIn.ok && (!best || builtIn.conf > best.conf)) best = builtIn;
  if (!LAYOUTS[String(itemCount)]) attempt(itemCount); // (the built-in ones were just tried)
  return best || builtIn;
}
