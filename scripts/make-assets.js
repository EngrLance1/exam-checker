// scripts/make-assets.js — generates the landing page's images from the real sheet design.
// Run: node scripts/make-assets.js   (needs only Node; rerun it if the sheet layout or design changes)
//
//   assets/sheet-blank-50.svg   a blank 50-item sheet (answer-sheet explainer)
//   assets/sheet-sample-50.svg  the same sheet, filled in with sample answers (hero)
//   assets/favicon.svg          the SagotScan mark
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = path.join(__dirname, "..");
const OUT = path.join(ROOT, "assets");
fs.mkdirSync(OUT, { recursive: true });

const ctx = vm.createContext({});
for (const f of ["app/js/data/layouts.js", "app/js/data/sample.js", "sheets/sheet-svg.js"]) vm.runInContext(fs.readFileSync(path.join(ROOT, f), "utf8"), ctx, { filename: f });
const run = (code) => vm.runInContext(code, ctx);

// Sample answers: the in-app sample key, with some deliberate wrong answers, a blank and a double mark.
const key = run("SAMPLE_KEY").split("");
let seed = 17;
const rnd = () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
const answers = key.map((k, i) => {
  if (i === 7) return "";                                   // an item left blank
  if (i === 22) return "AB";                                // a double mark, which SagotScan flags
  if (rnd() < 0.26) return "ABCD".replace(k, "")[Math.floor(rnd() * 3)];
  return k;
});
ctx.__fill = { answers, classNo: "03", set: "B" };

const size = (name, svg) => { fs.writeFileSync(path.join(OUT, name), svg + "\n"); console.log(name.padEnd(24), (svg.length / 1024).toFixed(1) + " KB"); };
// explicit width and height give the images an intrinsic size (the page also sets them to avoid layout shift)
ctx.__fill.width = 1100; ctx.__fill.height = 1438;
size("sheet-blank-50.svg", run("buildSheetSVG(50, LAYOUTS, { width: 1100, height: 1438 })"));
size("sheet-sample-50.svg", run("buildSheetSVG(50, LAYOUTS, { fill: { answers: __fill.answers, classNo: __fill.classNo, set: __fill.set }, width: 1100, height: 1438 })"));

// The mark: the same four bubbles as the app's logo, on the brand gradient.
size("favicon.svg", `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#4c6ef5"/><stop offset="1" stop-color="#7c5cfa"/></linearGradient></defs>
<rect width="40" height="40" rx="12" fill="url(#g)"/>
<circle cx="14" cy="15" r="4" fill="none" stroke="#fff" stroke-width="2"/><circle cx="26" cy="15" r="4" fill="#fff"/>
<circle cx="14" cy="27" r="4" fill="#fff"/><circle cx="26" cy="27" r="4" fill="none" stroke="#fff" stroke-width="2"/>
</svg>`);
