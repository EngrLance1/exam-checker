// js/excel/scores.js — the "Scores" sheet: one row per student, then class totals.

function scoresSheet(x) {
  const { t, sheets, today, title, hasSec } = x, o = hasSec ? 1 : 0;
  const pad = (n) => Array(n).fill("");
  const sc = [[title], [`Exported ${today}`, "", "", `${t.size} items`], [],
    ["No.", ...(hasSec ? ["Section"] : []), "Class No.", "Name", "Set", "Score", "Total", "Percent", "Mastery level", "Remarks"]];
  sheets.forEach((s, i) => {
    const r = scoreOf(s), iss = issuesOf(s).map((v) => v.t).join("; ");
    sc.push([i + 1, ...(hasSec ? [secOf(s)] : []), s.classNo || "", s.name || "", s.set || "", r ? r.score : "", r ? r.total : "",
      r && r.total ? r.score / r.total : "", r && r.total ? masteryLevel(r.score / r.total * 100) : "", iss]);
  });
  const scoredRows = sheets.map(scoreOf).filter(Boolean);
  if (scoredRows.length) {
    sc.push([]);
    const om = mpsOf(scoredRows);
    sc.push([...pad(2 + o), "Mean Percentage Score (MPS)", "", "", "", om.mps / 100, om.level]);
    sc.push([...pad(2 + o), "Mean score", "", Math.round(om.mean * 100) / 100]);
    sc.push([...pad(2 + o), "Highest score", "", Math.max(...scoredRows.map((r) => r.score))]);
    sc.push([...pad(2 + o), "Lowest score", "", Math.min(...scoredRows.map((r) => r.score))]);
  }
  const ws = XLSX.utils.aoa_to_sheet(sc);
  ws["!cols"] = [{ wch: 5 }, ...(hasSec ? [{ wch: 14 }] : []), { wch: 10 }, { wch: 30 }, { wch: 5 }, { wch: 7 }, { wch: 7 }, { wch: 9 }, { wch: 28 }, { wch: 44 }];
  ws["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 8 + o } }];
  for (let r = 4; r < sc.length; r++) { const ref = XLSX.utils.encode_cell({ r, c: 6 + o }); if (ws[ref] && typeof ws[ref].v === "number") ws[ref].z = "0.0%"; }
  return ws;
}
