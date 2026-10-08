// js/core/mps.js — Mean Percentage Score, DepEd mastery levels, per-set and per-item MPS.

/* ---------- MPS ---------- */
// DepEd descriptive equivalents of MPS
function masteryLevel(m) {
  return m >= 96 ? "Mastered" : m >= 86 ? "Closely approximating mastery" : m >= 66 ? "Moving towards mastery"
    : m >= 35 ? "Average" : m >= 15 ? "Low" : m >= 5 ? "Very low" : "Absolutely no mastery";
}
// Colour class for an MPS against the target: on target, within 25 points below, or further below.
function levelClass(m, target = targetPct()) { return m >= target ? "" : m >= target - 25 ? "warn" : "bad"; }
function mpsOf(rows, target = targetPct()) { // rows: [{score,total}]
  const n = rows.length;
  if (!n) return null;
  const sum = rows.reduce((a, r) => a + r.score, 0), tot = rows.reduce((a, r) => a + r.total, 0);
  const mean = sum / n, items = tot / n;
  const sd = n > 1 ? Math.sqrt(rows.reduce((a, r) => a + (r.score - mean) ** 2, 0) / (n - 1)) : 0;
  const mps = tot ? (sum / tot) * 100 : 0;
  const pct = rows.map((r) => r.total ? r.score / r.total * 100 : 0);
  return { n, sum, items, mean, sd, mps, hi: Math.max(...rows.map((r) => r.score)), lo: Math.min(...rows.map((r) => r.score)),
    passed: pct.filter((p) => p >= target).length, level: masteryLevel(mps) };
}

// How many students fall in each DepEd mastery band (by their own percent score). Top band first.
const BANDS = [
  ["96–100", "Mastered"], ["86–95", "Closely approximating mastery"], ["66–85", "Moving towards mastery"],
  ["35–65", "Average"], ["15–34", "Low"], ["5–14", "Very low"], ["0–4", "Absolutely no mastery"],
];
function distribution(rows) {
  const counts = Object.fromEntries(BANDS.map(([, lvl]) => [lvl, 0]));
  rows.forEach((r) => { counts[masteryLevel(r.total ? (r.score / r.total) * 100 : 0)]++; });
  const n = rows.length;
  return BANDS.map(([range, level]) => ({ range, level, count: counts[level], pct: n ? (counts[level] / n) * 100 : 0 }));
}

function mpsReport() {
  const scored = state.sheets.map((s) => ({ s, r: scoreOf(s) })).filter((x) => x.r);
  const overall = mpsOf(scored.map((x) => x.r));
  const sets = LET.split("").map((set) => ({ set, m: mpsOf(scored.filter((x) => x.r.set === set).map((x) => x.r)) })).filter((x) => x.m);
  const sections = sectionsList().map((name) => ({ name, m: mpsOf(scored.filter((x) => secOf(x.s) === name).map((x) => x.r)) })).filter((x) => x.m);
  const items = [];
  analyze().forEach((g) => g.items.filter((it) => !it.dropped).forEach((it) => items.push({ set: g.set, no: it.no, key: it.accept, correct: it.correct, n: g.n, mps: it.p * 100 })));
  return { overall, sets, sections, items, dist: distribution(scored.map((x) => x.r)), target: targetPct() };
}
