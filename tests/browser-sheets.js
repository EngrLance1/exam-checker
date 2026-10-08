// tests/browser-sheets.js — the printable sheets, scanned by the app's own reader.
// For each sheet size, draws a sheet with known answers, "photographs" it under different conditions, runs the real
// OMR reader on it (app/js/omr.js) and checks that every answer, the class number, the set and the sheet size come back right.
// Run: node tests/browser-sheets.js
const { launch } = require("./helpers/browser");

// A sheet rotated a quarter turn looks wide in the photo, so those variants use a landscape area, like a real photo would.
const WIDE = [[0.04, 0.25], [0.96, 0.22], [0.97, 0.78], [0.03, 0.8]];
const TILT = [[0.12, 0.07], [0.88, 0.04], [0.97, 0.9], [0.04, 0.95]];   // strong keystone: the far edge is about 20% narrower
const VARIANTS = [
  ["straight-on, good light", { }],
  ["rotated a quarter turn", { rot: 1, quad: WIDE }],
  ["upside down", { rot: 2 }],
  ["rotated three quarters", { rot: 3, quad: WIDE }],
  ["strongly tilted, on a dark desk", { quad: TILT }],
  ["strongly tilted, on a light desk", { quad: TILT, desk: 200 }],
  ["tilted, dim light, noise and blur together", { quad: TILT, desk: 200, dim: 0.35, noise: 14, blur: 1 }],
  ["dim light only", { dim: 0.35 }],
  ["heavily blurred (2 px)", { blur: 2 }],
  ["low-resolution photo", { w: 800, h: 1000, blur: 0.6 }],
  ["light pencil shading", { ink: "#666666" }],
];

(async () => {
  const b = await launch({ width: 1000, height: 900, page: "tests/fixtures/roundtrip.html" });
  const { ev, check, errors } = b;
  try {
    for (const size of [30, 50, 60]) {
      for (const [name, v] of VARIANTS) {
        const seed = size * 7 + name.length;
        const t0 = Date.now();
        const r = await ev(`roundTrip(${size}, ${seed}, ${JSON.stringify(v)})`);
        const ms = Date.now() - t0;
        const ok = r.ok && r.size === r.wantedSize && r.classNo === r.wantedClassNo && r.set === r.wantedSet && r.bad.length === 0;
        check(`${size}-item sheet, ${name}`, ok, r.ok ? `size ${r.size}/${r.wantedSize}, class ${r.classNo}/${r.wantedClassNo}, set ${r.set}/${r.wantedSet}, ${r.bad.length} wrong: ${r.bad.slice(0, 4).join("; ")}` : r.error);
        if (process.env.VERBOSE) console.log(`      ${ms} ms, ${size} items, confidence ${r.conf && r.conf.toFixed(1)}`);
      }
    }
    // A blank sheet must not produce phantom answers.
    const blank = await ev(`(async () => { const g = await photo(50, { answers: [], classNo: "", set: "" }, {}); const r = OMR.read(g, LAYOUTS); return { ok: r.ok, size: r.size, marked: r.ok ? r.items.filter((i) => i.choice !== null).length : -1, flags: r.ok ? r.items.filter((i) => i.flag !== "blank").length : -1, classNo: r.classNo, set: r.set }; })()`);
    check("a blank sheet reads as blank: no answers, no class number, no set", blank.ok && blank.marked === 0 && blank.flags === 0 && blank.classNo === null && blank.set === null, JSON.stringify(blank));
    check("no console errors or exceptions", errors.length === 0, errors.join(" | ").slice(0, 400));
    b.finish();
  } catch (e) { b.finish(e); }
})();
