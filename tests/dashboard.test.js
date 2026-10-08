const test = require("node:test");
const assert = require("node:assert/strict");
const { load, sheet } = require("./helpers/load");

const KEY = "ABCD".repeat(7) + "AB";
const json = (c, code) => JSON.parse(c.run(`JSON.stringify(${code})`));
function setup(sheets, key = KEY) {
  const c = load();
  c.run(`state.test.size = 30; state.test.keys.A = ${JSON.stringify(key)}; state.sheets = ${JSON.stringify(sheets)}`);
  return c;
}
const NOW = Date.parse("2026-10-08T12:00:00Z");

test("relTime speaks plainly", () => {
  const c = load();
  const r = (ms) => c.run(`relTime(${JSON.stringify(new Date(NOW - ms).toISOString())}, ${NOW})`);
  assert.equal(r(10 * 1000), "just now");
  assert.equal(r(5 * 60000), "5 min ago");
  assert.equal(r(3 * 3600000), "3 h ago");
  assert.equal(r(2 * 86400000), "2 d ago");
  assert.match(r(30 * 86400000), /Sep/);
  assert.equal(c.run(`relTime("nonsense")`), "");
  assert.equal(c.run(`relTime(undefined)`), "");
});

test("initials", () => {
  const c = load();
  assert.equal(c.run(`initialsOf("Dela Cruz, Juan", "07")`), "JD");
  assert.equal(c.run(`initialsOf("Ana Reyes", "07")`), "AR");
  assert.equal(c.run(`initialsOf("Cher", "07")`), "C");
  assert.equal(c.run(`initialsOf("", "07")`), "07");
  assert.equal(c.run(`initialsOf(null, "")`), "?");
});

test("an empty class gives empty, safe dashboard data", () => {
  const d = json(setup([]), "dashboardData()");
  assert.equal(d.sheets, 0);
  assert.equal(d.mps, null);
  assert.equal(d.atTarget, null);
  assert.deepEqual(d.attention, []);
  assert.deepEqual(d.recent, []);
  assert.deepEqual(d.top, []);
  assert.deepEqual(d.chart.items, []);
});

test("counts, MPS, at-target share and top scores come from the real scores", () => {
  const sheets = [
    sheet("s01", KEY, { classNo: "01", name: "Ana Reyes" }),                       // 30/30
    sheet("s02", KEY.slice(0, 24) + "......", { classNo: "02", name: "Ben Lim" }),   // 24/30 = 80%
    sheet("s03", ".".repeat(30), { classNo: "03", name: "Zed Co" }),               // 0
    sheet("s04", KEY.slice(0, 15) + ".".repeat(15), { classNo: "04" }),            // 15/30 = 50%
  ];
  const c = setup(sheets);
  const d = json(c, "dashboardData()");
  assert.equal(d.sheets, 4);
  assert.ok(Math.abs(d.mps - ((30 + 24 + 0 + 15) / 120) * 100) < 1e-9);
  assert.deepEqual({ n: d.atTarget.n, of: d.atTarget.of }, { n: 2, of: 4 }); // 100% and 80% reach 75
  assert.equal(d.atTarget.pct, 50);
  assert.equal(d.top[0].classNo, "01");
  assert.equal(d.top[1].classNo, "02");
  assert.equal(d.top.length, 4);
  assert.equal(d.bands.reduce((a, b) => a + b, 0), 4);
  c.run("state.test.target = 90");
  assert.equal(json(c, "dashboardData()").atTarget.n, 1);
});

test("top scores are at most five, best first", () => {
  const sheets = Array.from({ length: 8 }, (_, i) => sheet("s0" + i, KEY.slice(0, 10 + i * 2) + "B".repeat(20 - i * 2), { classNo: "0" + i }));
  const d = json(setup(sheets), "dashboardData()");
  assert.equal(d.top.length, 5);
  assert.ok(d.top.every((t, i) => i === 0 || d.top[i - 1].pct >= t.pct));
});

test("needs-attention: urgent first, with the sheet to open", () => {
  const ok = sheet("s01", KEY, { classNo: "01" });
  const dupA = sheet("s02", KEY, { classNo: "02" }), dupB = sheet("s03", KEY, { classNo: "02" });
  const flagged = sheet("s04", KEY, { classNo: "04" }); flagged.flags[3] = "faint";
  const c = setup([ok, dupA, dupB, flagged]);
  const all = json(c, "attentionList()");
  const a = all.filter((x) => x.level !== "info"); // item-analysis notes may add an info line
  assert.equal(a.length, 3);
  assert.equal(all[all.length - 1].level === "info" || all.length === 3, true); // info always last
  assert.equal(a[0].level, "bad");
  assert.match(a[0].detail, /used twice/);
  assert.ok(a[0].id === "s02" || a[0].id === "s03");
  assert.equal(a[2].level, "warn");
  assert.equal(a[2].id, "s04");
  assert.match(a[2].detail, /1 item to check/);
});

test("needs-attention includes key problems and the sample is not nagged about", () => {
  const c = setup([sheet("s01", KEY, { classNo: "01", sample: true })], KEY.slice(0, 20));
  const a = json(c, "attentionList()");
  assert.equal(a.length, 1);
  assert.equal(a[0].title, "Answer key");
  assert.equal(a[0].id, null);
});

test("needs-attention mentions a likely wrong key and rejected items", () => {
  const sheets = [];
  for (let i = 0; i < 4; i++) sheets.push(sheet("t0" + i, "B" + KEY.slice(1), { classNo: "0" + i }));
  for (let i = 0; i < 7; i++) sheets.push(sheet("w0" + i, "A" + ".".repeat(29), { classNo: "1" + i }));
  const a = json(setup(sheets), "attentionList()");
  assert.ok(a.some((x) => x.title === "Check the answer key" && /#1/.test(x.detail)));
  assert.ok(a.some((x) => x.level === "info" && /reject/.test(x.title)));
});

test("recent activity is newest first, capped at six, and says when", () => {
  const sheets = Array.from({ length: 8 }, (_, i) => sheet("s0" + i, KEY, { classNo: "0" + i, scanned: new Date(NOW - (8 - i) * 60000).toISOString() }));
  const d = json(setup(sheets), `dashboardData("", ${NOW})`);
  assert.equal(d.recent.length, 6);
  assert.equal(d.recent[0].id, "s07");
  assert.equal(d.recent[0].time, "1 min ago");
  assert.match(d.recent[0].text, /Scanned Class No\. 07/);
  assert.equal(d.recent[0].sub, "30 / 30");
});

test("chart series: one point per scored item, null discrimination for tiny classes", () => {
  const few = json(setup([sheet("s01", KEY), sheet("s02", KEY)]), "dashboardData().chart");
  assert.equal(few.items.length, 30);
  assert.equal(few.items[0].d, null);
  assert.equal(few.items[0].p, 1);
  assert.equal(few.n, 2);
  const many = Array.from({ length: 8 }, (_, i) => sheet("s0" + i, i < 4 ? KEY : "B".repeat(30), { classNo: "0" + i }));
  const c = setup(many);
  const ch = json(c, "dashboardData().chart");
  assert.ok(ch.items[0].d != null);
  c.run(`setFix("A", 1, "drop")`);
  assert.equal(json(c, "dashboardData().chart").items.length, 29); // dropped items are not charted
});

test("chart picks the requested set, else the first with data", () => {
  const c = setup([sheet("s01", KEY, { set: "A" })]);
  c.run(`state.test.keys.B = ${JSON.stringify(KEY)}; state.sheets.push(${JSON.stringify(sheet("s02", KEY, { set: "B", classNo: "02" }))})`);
  assert.deepEqual(json(c, "dashboardData().chart.sets"), ["A", "B"]);
  assert.equal(json(c, "dashboardData().chart.set"), "A");
  assert.equal(json(c, `dashboardData("B").chart.set`), "B");
  assert.equal(json(c, `dashboardData("Z").chart.set`), "A");
});

/* ---------- chart helpers ---------- */
test("smoothPath: straight start, curved segments, safe on tiny input", () => {
  const c = load();
  assert.equal(c.run("smoothPath([])"), "");
  assert.equal(c.run("smoothPath([[5,6]])"), "M5,6");
  const d = c.run("smoothPath([[0,0],[10,10],[20,0]], 0.4)");
  assert.match(d, /^M0\.0,0\.0 C/);
  assert.equal((d.match(/C/g) || []).length, 2);
  assert.ok(!d.includes("NaN"));
  assert.ok(c.run("smoothPath([[0,0],[10,10],[20,0]], 0)").includes("C"));
});

test("smoothPath never swings past the data (no overshoot)", () => {
  const c = load();
  // a square-wave series like a one-student class: 100, 0, 100, 100, 0
  const ys = [100, 0, 100, 100, 0], pts = ys.map((y, i) => [i * 20, 100 - y]); // screen y: 0 = top
  const d = c.run(`smoothPath(${JSON.stringify(pts)}, 0.4)`);
  const nums = [...d.matchAll(/C([\d.]+),([\d.]+) ([\d.]+),([\d.]+) ([\d.]+),([\d.]+)/g)];
  assert.equal(nums.length, 4);
  nums.forEach((m, i) => {
    const lo = Math.min(pts[i][1], pts[i + 1][1]), hi = Math.max(pts[i][1], pts[i + 1][1]);
    for (const y of [Number(m[2]), Number(m[4])]) assert.ok(y >= lo - 0.05 && y <= hi + 0.05, `segment ${i}: ${y} outside ${lo}..${hi}`);
  });
});

test("runsOf splits a series at gaps", () => {
  const c = load();
  assert.deepEqual(json(c, "runsOf([1, 2, null, 3, null, null, 4, 5])"), [[[0, 1], [1, 2]], [[3, 3]], [[6, 4], [7, 5]]]);
  assert.deepEqual(json(c, "runsOf([null, null])"), []);
});

test("area chart builds valid SVG, clamps out-of-range values, and reports geometry", () => {
  const c = load();
  const r = c.run(`areaChartSVG({ width: 500, height: 250, labels: ["1","2","3","4"], yMin: -50, yMax: 100, yTicks: [-50,0,50,100],
    series: [{ id: "a", color: "--primary", values: [10, 60, 150, 40] }, { id: "b", color: "--violet", values: [null, -200, 20, null] }], active: 2 })`);
  assert.ok(r.svg.startsWith("<svg") && r.svg.endsWith("</svg>"));
  assert.ok(!r.svg.includes("NaN") && !r.svg.includes("undefined"));
  assert.equal(r.geo.x.length, 4);
  assert.ok(r.geo.y[0][2] >= r.geo.top - 0.01);          // 150 is clamped to the top of the plot
  assert.equal(r.geo.y[1][0], null);                      // gap stays a gap
  assert.match(r.svg, /class="cursor"/);
  assert.equal((r.svg.match(/class="dot"/g) || []).length, 2);
});

test("area chart survives one point and no active point", () => {
  const c = load();
  const r = c.run(`areaChartSVG({ labels: ["1"], yMin: 0, yMax: 100, yTicks: [0,100], series: [{ id: "a", color: "--primary", values: [50] }] })`);
  assert.ok(!r.svg.includes("NaN"));
  assert.ok(!r.svg.includes('class="cursor"'));
});

test("donut: dash length follows the percent, empty draws no arc, out of range is clamped", () => {
  const c = load();
  assert.ok(!c.run("donutSVG(0)").includes("ringGrad)"));
  assert.match(c.run("donutSVG(50, 100)"), /stroke-dasharray="(\d+\.\d) (\d+\.\d)"/);
  const m = c.run("donutSVG(50, 100)").match(/stroke-dasharray="([\d.]+) ([\d.]+)"/);
  assert.ok(Math.abs(Number(m[1]) - Number(m[2])) < 0.2); // half and half
  assert.ok(!c.run("donutSVG(250)").includes("NaN"));
  assert.ok(!c.run("donutSVG(null)").includes("NaN"));
});

test("spark bars: one bar per value, tallest fills the height, zeros still show", () => {
  const c = load();
  const s = c.run("sparkBarsSVG([0, 5, 10], 84, 40)");
  assert.equal((s.match(/<rect/g) || []).length, 3);
  assert.ok(s.includes('height="38.0"'));
  assert.ok(s.includes('height="2.0"'));
  assert.ok(!c.run("sparkBarsSVG([0,0,0])").includes("NaN"));
});
