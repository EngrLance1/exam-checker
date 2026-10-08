// js/ui/charts.js — small hand-drawn SVG charts (no chart library, so the app stays offline and dependency-free).
// All functions return SVG/HTML strings. Colours come from CSS variables, so the look is tweaked in css/styles.css.

// Smooth curve through points (Catmull-Rom turned into Bézier segments). t ~ 0.4 is gentle; 0 is straight lines.
function smoothPath(pts, t = 0.4) {
  if (!pts.length) return "";
  if (pts.length === 1) return `M${pts[0][0]},${pts[0][1]}`;
  let d = `M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
    // control points are kept between the two neighbouring values, so the curve never swings past the data
    const lo = Math.min(p1[1], p2[1]), hi = Math.max(p1[1], p2[1]), clamp = (v) => Math.max(lo, Math.min(hi, v));
    const c1 = [p1[0] + ((p2[0] - p0[0]) * t) / 2, clamp(p1[1] + ((p2[1] - p0[1]) * t) / 2)];
    const c2 = [p2[0] - ((p3[0] - p1[0]) * t) / 2, clamp(p2[1] - ((p3[1] - p1[1]) * t) / 2)];
    d += ` C${c1[0].toFixed(1)},${c1[1].toFixed(1)} ${c2[0].toFixed(1)},${c2[1].toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
  }
  return d;
}

// Splits a series at gaps (null values) so a line is not drawn across missing data.
function runsOf(values) {
  const runs = []; let cur = [];
  values.forEach((v, i) => { if (v == null) { if (cur.length) runs.push(cur); cur = []; } else cur.push([i, v]); });
  if (cur.length) runs.push(cur);
  return runs;
}

// Two-line area chart. Series values are numbers on the y scale, or null for "no value".
// opts: {width, height, labels[], series:[{values, cls, id}], yMin, yMax, yTicks[], xEvery, active}
function areaChartSVG(o) {
  const W = Math.max(280, o.width || 640), H = o.height || 250;
  const m = { l: 38, r: 12, t: 12, b: 28 };
  const iw = W - m.l - m.r, ih = H - m.t - m.b, n = o.labels.length;
  const x = (i) => m.l + (n <= 1 ? iw / 2 : (i / (n - 1)) * iw);
  const y = (v) => m.t + ih - ((Math.min(o.yMax, Math.max(o.yMin, v)) - o.yMin) / (o.yMax - o.yMin)) * ih;
  let svg = `<svg class="chart-svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" aria-hidden="true" focusable="false"><defs>`;
  o.series.forEach((s) => { svg += `<linearGradient id="${s.id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(${s.color})" stop-opacity="0.32"/><stop offset="1" stop-color="var(${s.color})" stop-opacity="0"/></linearGradient>`; });
  svg += `</defs>`;
  o.yTicks.forEach((v) => { svg += `<line class="grid" x1="${m.l}" x2="${W - m.r}" y1="${y(v)}" y2="${y(v)}"/><text class="ytick" x="${m.l - 8}" y="${y(v) + 4}" text-anchor="end">${v}</text>`; });
  const every = o.xEvery || 1;
  // the last label is added only when it will not run into the previous one
  o.labels.forEach((lb, i) => { if (i % every === 0 || (i === n - 1 && (n - 1) % every >= every / 2)) svg += `<text class="xtick" x="${x(i)}" y="${H - 8}" text-anchor="middle">${lb}</text>`; });
  const base = y(Math.max(o.yMin, 0));
  o.series.forEach((s) => {
    runsOf(s.values).forEach((run) => {
      const pts = run.map(([i, v]) => [x(i), y(v)]);
      if (pts.length > 1) svg += `<path d="${smoothPath(pts)} L${pts[pts.length - 1][0].toFixed(1)},${base} L${pts[0][0].toFixed(1)},${base} Z" fill="url(#${s.id})"/>`;
      svg += `<path d="${smoothPath(pts)}" fill="none" stroke="var(${s.color})" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>`;
      if (pts.length === 1) svg += `<circle cx="${pts[0][0]}" cy="${pts[0][1]}" r="3.5" fill="var(${s.color})"/>`;
    });
  });
  const a = o.active;
  if (a != null && a >= 0 && a < n) {
    svg += `<line class="cursor" x1="${x(a)}" x2="${x(a)}" y1="${m.t}" y2="${m.t + ih}"/>`;
    o.series.forEach((s) => { if (s.values[a] != null) svg += `<circle class="dot" cx="${x(a)}" cy="${y(s.values[a])}" r="5" stroke="var(${s.color})"/>`; });
  }
  svg += `</svg>`;
  const geo = { x: Array.from({ length: n }, (_, i) => x(i)), y: o.series.map((s) => s.values.map((v) => (v == null ? null : y(v)))), top: m.t, left: m.l, right: W - m.r };
  return { svg, geo };
}

// A ring that fills to pct (0-100). The stroke flows blue -> violet -> soft orange; the ends are rounded.
function donutSVG(pct, size = 96) {
  const sw = 11, r = (size - sw) / 2, c = 2 * Math.PI * r, v = Math.max(0, Math.min(100, pct || 0));
  const len = (v / 100) * c;
  return `<svg class="donut" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" aria-hidden="true" focusable="false">
    <defs><linearGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="var(--primary)"/><stop offset="0.55" stop-color="var(--violet)"/><stop offset="1" stop-color="var(--orange)"/></linearGradient></defs>
    <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="var(--track)" stroke-width="${sw}"/>
    ${v > 0 ? `<circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="url(#ringGrad)" stroke-width="${sw}" stroke-linecap="round" stroke-dasharray="${len.toFixed(1)} ${(c - len).toFixed(1)}" transform="rotate(-90 ${size / 2} ${size / 2})"/>` : ""}
  </svg>`;
}

// Thin vertical bars in blue and violet. values: counts. Heights are relative to the biggest count (min 2px so zeros still show).
function sparkBarsSVG(values, w = 84, h = 40) {
  const max = Math.max(1, ...values), n = values.length, gap = 4, bw = Math.max(3, (w - gap * (n - 1)) / n);
  return `<svg class="spark" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" aria-hidden="true" focusable="false">${values.map((v, i) => {
    const bh = Math.max(2, (v / max) * (h - 2));
    return `<rect x="${(i * (bw + gap)).toFixed(1)}" y="${(h - bh).toFixed(1)}" width="${bw.toFixed(1)}" height="${bh.toFixed(1)}" rx="${(bw / 2).toFixed(1)}" fill="var(${i % 2 ? "--violet" : "--primary"})"/>`;
  }).join("")}</svg>`;
}
