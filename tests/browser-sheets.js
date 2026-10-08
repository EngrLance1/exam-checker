// tests/browser-sheets.js — the printable sheets, scanned by the app's own reader.
// Draws sheets with known answers, "photographs" them under different conditions, runs the app's real reader (app/js/reader.js ->
// app/js/omr.js) on each and checks that every answer, the class number, the set and the sheet length come back right.
// Run: node tests/browser-sheets.js      (about 6 minutes; VERBOSE=1 prints timings)
const fs = require("node:fs");
const path = require("node:path");
const { launch } = require("./helpers/browser");

// A sheet rotated a quarter turn looks wide in the photo, so those variants use a landscape area, like a real photo would.
const WIDE = [[0.04, 0.25], [0.96, 0.22], [0.97, 0.78], [0.03, 0.8]];
const TILT = [[0.12, 0.07], [0.88, 0.04], [0.97, 0.9], [0.04, 0.95]];   // strong keystone: the far edge is about 20% narrower
const ALL = [
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
const SOME = [ALL[0], ALL[2], ALL[4], ALL[6]];                       // a spread, for the many other lengths

const BUILT_IN = [30, 50, 60];
const OTHER = [5, 10, 20, 25, 40, 45, 55, 65, 70, 75];
// [sheet length, what the test was wrongly set to]
const MISMATCH = [[40, 50], [40, 30], [20, 30], [70, 50], [70, 60], [45, 50], [25, 30], [50, 40], [30, 20], [75, 60]];

(async () => {
  const b = await launch({ width: 1000, height: 900, page: "tests/fixtures/roundtrip.html" });
  const { ev, check, errors } = b;
  const run = (size, seed, v, count) => ev(`roundTrip(${size}, ${seed}, ${JSON.stringify(v)}, ${count}).catch((e) => ({ ok: false, error: String(e) }))`);
  const good = (r, size) => r.ok && r.size === size && r.classNo === r.wantedClassNo && r.set === r.wantedSet && r.bad.length === 0;
  const why = (r) => (r.ok ? `size ${r.size}/${r.wantedSize}, class ${r.classNo}/${r.wantedClassNo}, set ${r.set}/${r.wantedSet}, ${r.bad.length} wrong: ${r.bad.slice(0, 3).join("; ")}` : r.error);
  try {
    // 1. the built-in lengths under every condition
    for (const size of BUILT_IN) for (const [name, v] of ALL) {
      const r = await run(size, size * 7 + name.length, v, size);
      check(`${size}-item sheet, ${name}`, good(r, size), why(r));
    }
    // 2. every other length under a spread of conditions
    for (const size of OTHER) for (const [name, v] of SOME) {
      const r = await run(size, size * 5 + name.length, v, size);
      check(`${size}-item sheet, ${name}`, good(r, size), why(r));
    }
    // 3. the test's item count is wrong: the sheet's own code still gets it right
    for (const [size, wrong] of MISMATCH) {
      const r = await run(size, size * 3 + wrong, {}, wrong);
      check(`${size}-item sheet while the test is set to ${wrong}: reads as a ${size}-item sheet`, good(r, size), why(r));
    }
    const tilt = await run(40, 9, { quad: TILT, desk: 200, dim: 0.35, noise: 14, blur: 1 }, 50);
    check("40-item sheet, tilted and dim, test set to 50: still reads as 40 items", good(tilt, 40), why(tilt));
    // 4. sheets printed before the code existed (no code on them)
    for (const size of [30, 50, 60]) for (const [name, v] of [SOME[0], SOME[2]]) {
      const r = await run(size, size + 1, { ...v, noCode: true }, size);
      check(`${size}-item sheet with no code (an older print), ${name}`, good(r, size), why(r));
    }
    for (const size of [20, 40, 70]) {
      const r = await run(size, size + 2, { noCode: true }, size);
      check(`${size}-item sheet with no code, test set to ${size}: found by the test's length`, good(r, size), why(r));
    }
    // 5. a smudged code: falls back to the test's length
    for (const size of [40, 70]) {
      const r = await run(size, size + 4, { blotCode: true }, size);
      check(`${size}-item sheet with a smudged code, test set to ${size}: still reads`, good(r, size), why(r));
    }
    // 6. a blank sheet must not produce phantom answers
    const blank = await ev(`(async () => { const g = await photo(50, { answers: [], classNo: "", set: "" }, {}); const r = readSheet(g, 50); return { ok: r.ok, size: r.size, marked: r.ok ? r.items.filter((i) => i.choice !== null).length : -1, flags: r.ok ? r.items.filter((i) => i.flag !== "blank").length : -1, classNo: r.classNo, set: r.set }; })()`);
    check("a blank sheet reads as blank: no answers, no class number, no set", blank.ok && blank.size === 50 && blank.marked === 0 && blank.flags === 0 && blank.classNo === null && blank.set === null, JSON.stringify(blank));

    // 7. a REAL photo, if one is in samples/ (the folder is private and never committed)
    const real = path.join(__dirname, "..", "samples", "sample.jpg");
    if (fs.existsSync(real)) {
      const url = "data:image/jpeg;base64," + fs.readFileSync(real).toString("base64");
      const want = "DACDCADBAABBCADCDABCDAACBADCDA";
      for (const count of [30, 40, 50]) {
        const r = await ev(`readPhoto(${JSON.stringify(url)}, ${count}).catch((e) => ({ ok: false, error: String(e) }))`);
        check(`real photo (samples/sample.jpg), test set to ${count}: 30 items, class 03, set C, all answers right`, r.ok && r.size === 30 && r.classNo === "03" && r.set === "C" && r.answers === want && r.flags.length === 0, JSON.stringify(r).slice(0, 200));
      }
    } else console.log("SKIP  real photo: put one at samples/sample.jpg to test it");

    check("no console errors or exceptions", errors.length === 0, errors.join(" | ").slice(0, 400));
    b.finish();
  } catch (e) { b.finish(e); }
})();
