// js/excel/answers.js — the "Answers" sheet: every student's answer to every item, under the answer keys.

function answersSheet(x) {
  const { t, N, sheets, title, hasSec } = x;
  const sec = (v) => (hasSec ? [v] : []);
  const head = [...sec("Section"), "Class No.", "Name", "Set", "Score"]; for (let i = 1; i <= N; i++) head.push(i);
  const ans = [[title + " — answers per item"], ["Blank = no answer, * = two or more circles shaded"], []];
  LET.split("").forEach((s) => {
    if (!t.keys[s]) return;
    const row = [...sec(""), "KEY", `Set ${s} answer key`, s, ""];
    for (let i = 0; i < N; i++) row.push(t.keys[s][i] && t.keys[s][i] !== "-" ? t.keys[s][i] : "");
    ans.push(row);
  });
  ans.push([]); ans.push(head);
  sheets.forEach((s) => {
    const r = scoreOf(s), row = [...sec(secOf(s)), s.classNo || "", s.name || "", s.set || "", r ? r.score : ""];
    for (let i = 0; i < N; i++) row.push(s.answers[i] || "");
    ans.push(row);
  });
  const ws = XLSX.utils.aoa_to_sheet(ans);
  ws["!cols"] = [...(hasSec ? [{ wch: 14 }] : []), { wch: 10 }, { wch: 28 }, { wch: 5 }, { wch: 7 }].concat(Array.from({ length: N }, () => ({ wch: 4 })));
  return ws;
}
