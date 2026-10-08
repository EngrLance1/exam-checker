// js/excel/mps.js — the "MPS" sheet: MPS per section, set and overall, score distribution, item MPS, mastery scale.

function mpsSheet(x) {
  const { today, title } = x;
  const R = mpsReport(), tg = R.target;
  const mp = [[title + " — Mean Percentage Score (MPS)"], [`Exported ${today}`, `Target MPS: ${tg}%`], [],
    ["Group", "No. of students", "No. of items", "Total score", "Mean", "SD", "Highest", "Lowest", "MPS (%)", "Mastery level", `Students at ${tg}% and up`]];
  const mrow = (label, m) => [label, m.n, Math.round(m.items), m.sum, Math.round(m.mean * 100) / 100, Math.round(m.sd * 100) / 100, m.hi, m.lo, Math.round(m.mps * 100) / 100, m.level, m.passed];
  const multiSec = R.sections.length > 1, multiSets = R.sets.length > 1;
  if (multiSec) R.sections.forEach(({ name, m }) => mp.push(mrow(name, m)));
  if (multiSets) R.sets.forEach(({ set, m }) => mp.push(mrow(`Set ${set}`, m)));
  if (R.overall) mp.push(mrow(multiSec && multiSets ? "All" : multiSec ? "All sections" : multiSets ? "All sets" : R.sets[0] ? `Set ${R.sets[0].set}` : "Class", R.overall));
  else mp.push(["No scored sheets yet."]);
  mp.push([], ["MPS = (total of all scores ÷ (number of students × number of items)) × 100"], []);

  if (R.overall) {
    mp.push(["Score distribution"], ["Percent score", "Mastery level", "No. of students", "% of students"]);
    R.dist.forEach((b) => mp.push([b.range, b.level, b.count, Math.round(b.pct * 10) / 10]));
    mp.push([]);
  }

  mp.push(["Item MPS"], ["Set", "Item", "Key", "Students who got it right", "No. of students", "Item MPS (%)", "Mastery level", `Least mastered (below ${tg}%)`]);
  R.items.forEach((i) => mp.push([i.set, i.no, i.key, i.correct, i.n, Math.round(i.mps * 100) / 100, masteryLevel(i.mps), i.mps < tg ? "Yes" : ""]));
  mp.push([], ["Mastery level scale (DepEd)"], ...BANDS.map(([range, level]) => [range, level]));
  const ws = XLSX.utils.aoa_to_sheet(mp);
  ws["!cols"] = [{ wch: 14 }, { wch: 28 }, { wch: 15 }, { wch: 22 }, { wch: 15 }, { wch: 12 }, { wch: 28 }, { wch: 24 }, { wch: 9 }, { wch: 28 }, { wch: 22 }];
  ws["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 10 } }];
  return ws;
}
