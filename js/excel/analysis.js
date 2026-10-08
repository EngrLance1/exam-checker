// js/excel/analysis.js — the "Item Analysis" sheet, and the "Item Fixes" sheet (only when the teacher changed something).

function analysisSheet(x) {
  const { title } = x;
  const groups = analyze();
  const ia = [[title + " — item analysis"], [], ["Difficulty index p = students who got it right ÷ students who took the set."],
    ["Discrimination index D = (upper 27% right − lower 27% right) ÷ group size."],
    [sectionsList().length > 1 ? "Counts all sections together." : ""], []];
  const left = excludedFromAnalysis();
  if (left.length) ia.push([`${left.length} sheet(s) on the wrong sheet size were left out of this analysis.`], []);
  groups.forEach((g) => {
    ia.push([`Set ${g.set}`, `${g.n} students`, g.g ? `Upper and lower groups: ${g.g} each` : "Discrimination needs at least 4 students"]);
    ia.push([g.rel ? `KR-20 reliability ${g.rel.kr20.toFixed(2)}` : `KR-20 needs ${KR20_MIN_STUDENTS}+ students with different scores`, g.rel ? `SEM ${g.rel.sem.toFixed(2)} points` : "", g.rel ? `SD ${g.rel.sd.toFixed(2)}` : ""]);
    ia.push(["Item", "Key", "A", "B", "C", "D", "Blank / two marks", "Correct", "Difficulty (p)", "Difficulty level", "Discrimination (D)", "Discrimination level", "Decision", "Notes", "Fix"]);
    g.items.forEach((it) => {
      const notes = it.notes.map(noteText).join("; ");
      ia.push(it.dropped
        ? [it.no, it.key, it.cnt.A, it.cnt.B, it.cnt.C, it.cnt.D, it.cnt.none, "", "", "", "", "", "Dropped", "", fixText(it.fix, it.key)]
        : [it.no, it.accept, it.cnt.A, it.cnt.B, it.cnt.C, it.cnt.D, it.cnt.none, it.correct, Math.round(it.p * 100) / 100, pLevel(it.p),
          it.d == null ? "" : Math.round(it.d * 100) / 100, it.d == null ? "" : dLevel(it.d), decision(it.p, it.d), notes, fixText(it.fix, it.key)]);
    });
    ia.push([]);
  });
  ia.push(["Guide"]);
  ia.push(["Difficulty (p)", "0.81–1.00 Very easy · 0.61–0.80 Easy · 0.41–0.60 Average · 0.21–0.40 Difficult · 0.00–0.20 Very difficult"]);
  ia.push(["Discrimination (D)", "0.40 and up Very good · 0.30–0.39 Good · 0.20–0.29 Fair · below 0.20 Poor"]);
  ia.push(["Decision", "Retain: D ≥ 0.30 and p between 0.21 and 0.80 · Reject: D below 0.20 · Revise: everything else"]);
  ia.push(["Check the key", `A wrong option picked by ${MISKEY_MIN_UPPER}+ students in the upper group, and by more of them than the right answer.`]);
  ia.push(["Few chose", `An option chosen by under ${WEAK_OPTION_SHARE * 100}% of students. Only shown for classes of ${WEAK_OPTION_MIN_N}+.`]);
  ia.push(["KR-20", "Internal consistency of the test (0 to 1). Higher means the items agree with each other; around 0.70 or more is commonly taken as acceptable for a classroom test. SEM = SD × √(1 − KR-20)."]);
  const ws = XLSX.utils.aoa_to_sheet(ia);
  ws["!cols"] = [{ wch: 18 }, { wch: 12 }, { wch: 5 }, { wch: 5 }, { wch: 5 }, { wch: 5 }, { wch: 17 }, { wch: 8 }, { wch: 13 }, { wch: 15 }, { wch: 17 }, { wch: 19 }, { wch: 12 }, { wch: 36 }, { wch: 30 }];
  return ws;
}

function fixesSheet(x) {
  const { t, title } = x;
  const fx = [[title + " — item fixes"], ["Scores, MPS and item analysis use the fixed answer. The Key column in Item Analysis shows what counts as right."], [], ["Set", "Item", "Original key", "Fix"]];
  LET.split("").forEach((s) => Object.keys(t.fixes[s] || {}).map(Number).sort((a, b) => a - b).forEach((no) => {
    const key = (t.keys[s] || "")[no - 1];
    fx.push([s, no, key || "", fixText(t.fixes[s][no], key)]);
  }));
  if (fx.length <= 4) return null;
  const ws = XLSX.utils.aoa_to_sheet(fx);
  ws["!cols"] = [{ wch: 6 }, { wch: 6 }, { wch: 14 }, { wch: 34 }];
  return ws;
}
