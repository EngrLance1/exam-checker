// Geometry checks for the printable sheets: every bubble the scanner expects is drawn exactly where it expects it.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = path.join(__dirname, "..");
const ctx = vm.createContext({});
for (const f of ["app/js/data/layouts.js", "sheets/sheet-svg.js"]) vm.runInContext(fs.readFileSync(path.join(ROOT, f), "utf8"), ctx, { filename: f });
const run = (code) => vm.runInContext(code, ctx);
const LAYOUTS = run("LAYOUTS");
const svgOf = (size, opts) => { ctx.__o = opts || {}; return run(`buildSheetSVG(${size}, LAYOUTS, __o)`); };

// bubbles are the circles drawn with a 1.5 stroke (the "correct / wrong" examples use different styling)
const bubbles = (svg) => [...svg.matchAll(/<circle cx="(-?[\d.]+)" cy="(-?[\d.]+)" r="([\d.]+)" fill="(#[0-9a-f]+)" stroke="#222" stroke-width="1\.5"\/>/g)]
  .map((m) => ({ x: +m[1], y: +m[2], r: +m[3], fill: m[4] }));

for (const size of [30, 50, 60]) {
  const lay = LAYOUTS[String(size)];
  const { W, H, R } = run(`sheetGeometry(LAYOUTS["${size}"])`);

  test(`${size}-item sheet: the frame is as tall as the scanner expects`, () => {
    assert.equal(W, 1000);
    assert.ok(Math.abs(H / W - lay.r / lay.ry) < 1e-9);
    assert.ok(Math.abs(R - lay.r * 1000) < 1e-9);
  });

  test(`${size}-item sheet: every bubble the scanner reads is drawn at its position`, () => {
    const drawn = bubbles(svgOf(size));
    const want = [...lay.items.flat(), ...lay.cls.flat(), ...lay.set];
    assert.equal(drawn.length, want.length, "number of bubbles");
    assert.equal(want.length, size * 4 + 20 + 4);
    for (const [fx, fy] of want) {
      const hit = drawn.find((d) => Math.abs(d.x - fx * W) < 0.01 && Math.abs(d.y - fy * H) < 0.01);
      assert.ok(hit, `no bubble at ${fx}, ${fy}`);
      assert.ok(Math.abs(hit.r - R) < 0.01, "bubble radius");
    }
  });

  test(`${size}-item sheet: the four corner squares are centred on the frame corners`, () => {
    const svg = svgOf(size);
    const rects = [...svg.matchAll(/<rect class="corner" x="(-?[\d.]+)" y="(-?[\d.]+)" width="(\d+)" height="(\d+)" fill="#000"\/>/g)].map((m) => ({ cx: +m[1] + m[3] / 2, cy: +m[2] + m[4] / 2, w: +m[3] }));
    assert.equal(rects.length, 4);
    for (const [cx, cy] of [[0, 0], [W, 0], [W, H], [0, H]]) assert.ok(rects.find((r) => Math.abs(r.cx - cx) < 0.01 && Math.abs(r.cy - cy) < 0.01), `corner ${cx},${cy}`);
    assert.ok(rects.every((r) => r.w >= 20), "big enough for the scanner to find");
  });

  test(`${size}-item sheet: blank by default, and nothing is shaded`, () => {
    const dark = bubbles(svgOf(size)).filter((b) => b.fill !== "#fff");
    assert.equal(dark.length, 0);
  });

  test(`${size}-item sheet: a filled sample shades exactly the requested bubbles`, () => {
    const answers = Array.from({ length: size }, (_, i) => (i % 5 === 0 ? "" : i % 7 === 0 ? "AC" : "ABCD"[i % 4]));
    const want = answers.reduce((n, a) => n + a.length, 0) + 2 /* class digits */ + 1 /* set */;
    const svg = svgOf(size, { fill: { answers, classNo: "07", set: "C" } });
    const dark = bubbles(svg).filter((b) => b.fill !== "#fff");
    assert.equal(dark.length, want);
    const at = (fx, fy) => dark.some((d) => Math.abs(d.x - fx * W) < 0.01 && Math.abs(d.y - fy * H) < 0.01);
    assert.ok(at(...lay.cls[0][0]) && at(...lay.cls[1][7]), "class number 07");
    assert.ok(at(...lay.set[2]), "set C");
    assert.ok(at(...lay.items[1][1]), "item 2 = B");
    assert.ok(!at(...lay.items[0][0]) && !at(...lay.items[0][1]), "item 1 left blank");
    assert.ok(at(...lay.items[7][0]) && at(...lay.items[7][2]), "item 8 double-marked A and C");
  });

  test(`${size}-item sheet: ink colour option changes the shading colour`, () => {
    const svg = svgOf(size, { ink: "#666666", fill: { answers: ["A"], classNo: "", set: "" } });
    assert.ok(bubbles(svg).some((b) => b.fill === "#666666"));
  });

  test(`${size}-item sheet: valid, self-contained SVG with every item numbered once`, () => {
    const svg = svgOf(size);
    assert.ok(svg.startsWith("<svg") && svg.trim().endsWith("</svg>"));
    assert.ok(!/NaN|undefined|null/.test(svg));
    assert.equal((svg.match(/<svg/g) || []).length, 1);
    assert.ok(!/<script|<image|href=|url\(/.test(svg), "no scripts or external references");
    const opens = (svg.match(/<text /g) || []).length, closes = (svg.match(/<\/text>/g) || []).length;
    assert.equal(opens, closes);
    for (let i = 1; i <= size; i++) {
      const hits = [...svg.matchAll(new RegExp(`<text x="(-?[\\d.]+)" y="[\\d.]+" font-size="15" font-weight="700" text-anchor="end">${i}</text>`, "g"))];
      assert.equal(hits.length, 1, `item number ${i}`);
    }
    assert.match(svg, new RegExp(`${size} Items`));
    assert.match(svg, new RegExp(`SCORE: ________ / ${size}`));
  });

  test(`${size}-item sheet: nothing is drawn outside the printed area`, () => {
    const vb = svgOf(size).match(/viewBox="(-?[\d.]+) (-?[\d.]+) ([\d.]+) ([\d.]+)"/).slice(1).map(Number);
    const [x0, y0, w, h] = vb;
    const all = [...svgOf(size).matchAll(/(?:cx|x|x1|x2)="(-?[\d.]+)"/g)].map((m) => +m[1]);
    const ys = [...svgOf(size).matchAll(/(?:cy|y|y1|y2)="(-?[\d.]+)"/g)].map((m) => +m[1]);
    assert.ok(all.every((x) => x >= x0 && x <= x0 + w), "x inside the page");
    assert.ok(ys.every((y) => y >= y0 && y <= y0 + h), "y inside the page");
  });

  test(`${size}-item sheet: bubbles do not overlap each other or the corner squares`, () => {
    const bs = bubbles(svgOf(size));
    for (let i = 0; i < bs.length; i++) for (let j = i + 1; j < bs.length; j++) {
      const d = Math.hypot(bs[i].x - bs[j].x, bs[i].y - bs[j].y);
      assert.ok(d > 2 * R + 4, `bubbles ${i} and ${j} are ${d.toFixed(1)} apart`);
    }
    for (const [cx, cy] of [[0, 0], [W, 0], [W, H], [0, H]]) assert.ok(bs.every((b) => Math.hypot(b.x - cx, b.y - cy) > 60), "clear of the corner squares");
  });
}

test("the sheet fits the page: 187 mm wide prints well inside A4 and Letter", () => {
  const { W, H } = run('sheetGeometry(LAYOUTS["50"])');
  const pad = run("SHEET_PAD"), mm = 187, tall = mm * (H + 2 * pad) / (W + 2 * pad);
  assert.ok(mm < 210 - 2 * 8, "wide enough margins on A4");
  assert.ok(tall < 297 - 2 * 12, `${tall.toFixed(1)} mm tall leaves room on A4`);
  assert.ok(tall < 279.4 - 2 * 10, "and on US Letter");
});

test("an unsupported size is refused clearly", () => {
  assert.throws(() => run("buildSheetSVG(40, LAYOUTS)"), /No layout for a 40-item sheet/);
});

test("all three sizes share the same frame, so one corner-square position fits every sheet", () => {
  const g = ["30", "50", "60"].map((k) => run(`sheetGeometry(LAYOUTS["${k}"])`));
  assert.ok(g.every((x) => Math.abs(x.H - g[0].H) < 1e-9));
});
