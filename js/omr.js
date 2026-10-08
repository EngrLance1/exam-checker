// js/omr.js — the sheet reader (OMR). Finds the 4 corner markers, unwarps the sheet, reads bubbles.
// Pure image code: takes a grayscale image {w, h, g}, touches no DOM, no app state.

// SagotScan core: finds the 4 corner markers, unwarps the sheet, reads bubbles.
// Works on a grayscale image {w, h, g: Uint8Array}.
const OMR = (() => {
  function integral(img) {
    const { w, h, g } = img, I = new Float64Array((w + 1) * (h + 1));
    for (let y = 0; y < h; y++) {
      let row = 0;
      for (let x = 0; x < w; x++) {
        row += g[y * w + x];
        I[(y + 1) * (w + 1) + x + 1] = I[y * (w + 1) + x + 1] + row;
      }
    }
    return I;
  }

  function threshold(img) {
    const { w, h, g } = img, I = integral(img), W = w + 1;
    const s = Math.max(8, Math.round(Math.min(w, h) / 10)), half = s >> 1;
    const bin = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) {
      const y0 = Math.max(0, y - half), y1 = Math.min(h, y + half + 1);
      for (let x = 0; x < w; x++) {
        const x0 = Math.max(0, x - half), x1 = Math.min(w, x + half + 1);
        const sum = I[y1 * W + x1] - I[y0 * W + x1] - I[y1 * W + x0] + I[y0 * W + x0];
        const mean = sum / ((x1 - x0) * (y1 - y0));
        const v = g[y * w + x];
        bin[y * w + x] = v < mean * 0.72 && v < 150 ? 1 : 0;
      }
    }
    return bin;
  }

  function components(bin, w, h) {
    const lab = new Int32Array(w * h), stack = new Int32Array(w * h), out = [];
    let id = 0;
    for (let i = 0; i < w * h; i++) {
      if (!bin[i] || lab[i]) continue;
      id++;
      let sp = 0, area = 0, sx = 0, sy = 0, minx = w, miny = h, maxx = 0, maxy = 0;
      stack[sp++] = i; lab[i] = id;
      while (sp) {
        const p = stack[--sp], x = p % w, y = (p / w) | 0;
        area++; sx += x; sy += y;
        if (x < minx) minx = x; if (x > maxx) maxx = x;
        if (y < miny) miny = y; if (y > maxy) maxy = y;
        if (x > 0 && bin[p - 1] && !lab[p - 1]) { lab[p - 1] = id; stack[sp++] = p - 1; }
        if (x < w - 1 && bin[p + 1] && !lab[p + 1]) { lab[p + 1] = id; stack[sp++] = p + 1; }
        if (y > 0 && bin[p - w] && !lab[p - w]) { lab[p - w] = id; stack[sp++] = p - w; }
        if (y < h - 1 && bin[p + w] && !lab[p + w]) { lab[p + w] = id; stack[sp++] = p + w; }
      }
      const bw = maxx - minx + 1, bh = maxy - miny + 1;
      out.push({ area, cx: sx / area, cy: sy / area, bw, bh, fill: area / (bw * bh) });
    }
    return out;
  }

  // homography mapping unit square corners to 4 image points [TL,TR,BR,BL]
  function homography(pts) {
    const src = [[0, 0], [1, 0], [1, 1], [0, 1]], A = [], b = [];
    for (let i = 0; i < 4; i++) {
      const [x, y] = src[i], [u, v] = pts[i];
      A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]); b.push(u);
      A.push([0, 0, 0, x, y, 1, -v * x, -v * y]); b.push(v);
    }
    for (let c = 0; c < 8; c++) {
      let piv = c;
      for (let r = c + 1; r < 8; r++) if (Math.abs(A[r][c]) > Math.abs(A[piv][c])) piv = r;
      [A[c], A[piv]] = [A[piv], A[c]]; [b[c], b[piv]] = [b[piv], b[c]];
      for (let r = 0; r < 8; r++) {
        if (r === c) continue;
        const f = A[r][c] / A[c][c];
        for (let k = c; k < 8; k++) A[r][k] -= f * A[c][k];
        b[r] -= f * b[c];
      }
    }
    const H = b.map((v, i) => v / A[i][i]);
    return (x, y) => {
      const d = H[6] * x + H[7] * y + 1;
      return [(H[0] * x + H[1] * y + H[2]) / d, (H[3] * x + H[4] * y + H[5]) / d];
    };
  }

  function px(img, x, y) {
    const xi = Math.round(x), yi = Math.round(y);
    if (xi < 0 || yi < 0 || xi >= img.w || yi >= img.h) return 255;
    return img.g[yi * img.w + xi];
  }

  function findMarkers(img) {
    const { w, h } = img, bin = threshold(img), comps = components(bin, w, h);
    const minSide = Math.min(w, h) * 0.008;
    const cands = comps.filter(c => c.bw >= minSide && c.bh >= minSide &&
      c.bw / c.bh > 0.45 && c.bw / c.bh < 2.2 && c.fill > 0.5 &&
      c.bw < w * 0.15 && c.bh < h * 0.15)
      .sort((a, b) => b.area - a.area).slice(0, 7);
    if (cands.length < 4) return null;
    let best = null;
    const n = cands.length;
    for (let a = 0; a < n; a++) for (let b = a + 1; b < n; b++)
      for (let c = b + 1; c < n; c++) for (let d = c + 1; d < n; d++) {
        const q = [cands[a], cands[b], cands[c], cands[d]];
        const areas = q.map(o => o.area), sim = Math.min(...areas) / Math.max(...areas);
        if (sim < 0.3) continue;
        const mx = q.reduce((s, o) => s + o.cx, 0) / 4, my = q.reduce((s, o) => s + o.cy, 0) / 4;
        q.sort((p, r) => Math.atan2(p.cy - my, p.cx - mx) - Math.atan2(r.cy - my, r.cx - mx));
        let qa = 0;
        for (let i = 0; i < 4; i++) { const p = q[i], r = q[(i + 1) % 4]; qa += p.cx * r.cy - r.cx * p.cy; }
        qa = Math.abs(qa) / 2;
        const score = qa * sim * sim;
        if (!best || score > best.score) best = { score, q, qa };
      }
    if (!best || best.qa < w * h * 0.08) return null;
    return best.q.map(o => [o.cx, o.cy]);
  }

  // How well the layout's bubbles line up with printed circles (allows small local shifts).
  function ringScore(img, H, layout, rpx) {
    const R = rpx * 0.8, st = Math.max(1, rpx / 3);
    let total = 0;
    for (const grp of layout.items) {
      const cs = grp.map(([nx, ny]) => H(nx, ny));
      let best = -1e9;
      for (let dy = -R; dy <= R; dy += st) for (let dx = -R; dx <= R; dx += st) {
        let s = 0;
        for (const [cx, cy] of cs) for (let k = 0; k < 12; k++) {
          const a = k * Math.PI / 6, ca = Math.cos(a), sa = Math.sin(a);
          s += px(img, cx + dx + ca * rpx * 1.5, cy + dy + sa * rpx * 1.5) - px(img, cx + dx + ca * rpx, cy + dy + sa * rpx);
        }
        if (s > best) best = s;
      }
      total += best / (cs.length * 12);
    }
    return total / layout.items.length;
  }

  // layouts: {"30": layout, "50": layout, ...}. Detects sheet size and orientation.
  function read(img, layouts) {
    const pts = findMarkers(img);
    if (!pts) return { ok: false, error: "Couldn't find the four black corner squares. Retake the photo with the whole sheet in view." };
    let best = null;
    for (const key of Object.keys(layouts)) for (let rot = 0; rot < 4; rot++) {
      const lay = layouts[key];
      const order = [0, 1, 2, 3].map(i => pts[(i + rot) % 4]);
      const H = homography(order);
      const a = H(0, 0), b = H(lay.r, 0);
      const rpx = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const sc = ringScore(img, H, lay, rpx);
      if (!best || sc > best.sc) best = { sc, H, rpx, order, key };
    }
    const layout = layouts[best.key];
    const { H, order } = best;
    if (best.sc < 15) return { ok: false, error: "The sheet was found but the bubbles couldn't be lined up. Lay the sheet flat and retake the photo." };
    // black reference from marker centers
    let black = 0;
    for (const [x, y] of order) black += px(img, x, y);
    black /= 4;

    // Snap bubbles onto the printed circles (handles curled paper / lens distortion).
    // Coarse pass over a block of nearby rows, then a fine pass per row.
    function bestOffset(cs, r, R, ox, oy, step) {
      let best = null;
      for (let dy = -R; dy <= R; dy += step) for (let dx = -R; dx <= R; dx += step) {
        const X = ox + dx, Y = oy + dy;
        let s = 0;
        for (const [cx, cy] of cs) for (let k = 0; k < 12; k++) {
          const a = k * Math.PI / 6, ca = Math.cos(a), sa = Math.sin(a);
          s += px(img, cx + X + ca * r * 1.5, cy + Y + sa * r * 1.5) - px(img, cx + X + ca * r, cy + Y + sa * r);
        }
        s = s / cs.length - (dx * dx + dy * dy) * 0.02;
        if (!best || s > best.s) best = { s, dx: X, dy: Y };
      }
      return best;
    }
    function radiusAt(nx, ny) {
      const c = H(nx, ny), e = H(nx + layout.r, ny);
      return Math.hypot(e[0] - c[0], e[1] - c[1]);
    }
    function snapGroups(groups) {
      // block = groups sharing a column (same x of first bubble) within +-2 rows
      const proj = groups.map(g => g.map(([nx, ny]) => H(nx, ny)));
      return groups.map((g, i) => {
        const r = radiusAt(g[0][0], g[0][1]);
        const block = [];
        for (let j = Math.max(0, i - 2); j <= Math.min(groups.length - 1, i + 2); j++)
          if (Math.abs(groups[j][0][0] - g[0][0]) < 0.01) block.push(...proj[j]);
        const coarse = bestOffset(block, r, Math.max(2, Math.round(r * 1.6)), 0, 0, 1);
        const fine = bestOffset(proj[i], r, Math.max(1, Math.round(r * 0.4)), coarse.dx, coarse.dy, 1);
        return { cs: proj[i].map(([x, y]) => [x + fine.dx, y + fine.dy]), r };
      });
    }

    function darkness(cx, cy, r) {
      // inner disc mean
      let sum = 0, cnt = 0;
      const ri = r * 0.6, R = Math.ceil(ri);
      for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) {
        if (dx * dx + dy * dy > ri * ri) continue;
        sum += px(img, cx + dx, cy + dy); cnt++;
      }
      const mean = sum / Math.max(1, cnt);
      // local paper white: bright percentile of a ring outside the bubble
      const vals = [];
      for (let k = 0; k < 24; k++) {
        const a = k * Math.PI / 12;
        vals.push(px(img, cx + Math.cos(a) * r * 1.4, cy + Math.sin(a) * r * 1.4));
      }
      vals.sort((p, q) => p - q);
      const white = vals[Math.floor(vals.length * 0.8)];
      const d = (white - mean) / Math.max(30, white - black);
      return Math.max(0, Math.min(1, d));
    }

    const T = 0.45, FAINT = 0.28;
    function pick(sn) {
      const marks = sn.cs.map(([x, y]) => darkness(x, y, sn.r));
      const idx = marks.map((d, i) => [d, i]).sort((p, q) => q[0] - p[0]);
      const [d1, i1] = idx[0], d2 = idx[1][0];
      let choice = null, flag = null;
      if (d1 >= T) {
        if (d2 >= T) {
          if (d1 - d2 > 0.25) { choice = i1; flag = "erasure"; }
          else flag = "multiple";
        } else choice = i1;
      } else if (d1 >= FAINT) flag = "faint";
      else flag = "blank";
      return { choice, marks: marks.map(v => Math.round(v * 100) / 100), flag, pts: sn.cs, r: sn.r };
    }

    const items = snapGroups(layout.items).map(pick);
    const digits = snapGroups(layout.cls).map(pick);
    const set = pick(snapGroups([layout.set])[0]);
    const classNo = digits.every(d => d.choice !== null) ? String(digits[0].choice) + String(digits[1].choice) : null;
    return { ok: true, size: Number(best.key), items, digits, classNo, set: set.choice !== null ? "ABCD"[set.choice] : null, setFlag: set.flag, corners: order, H, conf: best.sc };
  }

  function toGray(rgba, w, h) {
    const g = new Uint8Array(w * h);
    for (let i = 0, j = 0; i < g.length; i++, j += 4) g[i] = (rgba[j] * 77 + rgba[j + 1] * 150 + rgba[j + 2] * 29) >> 8;
    return { w, h, g };
  }

  return { read, toGray, findMarkers, homography };
})();


