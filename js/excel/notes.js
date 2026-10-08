// js/excel/notes.js — the "Scan Notes" sheet: items and sheets the scanner flagged for checking.

function notesSheet(x) {
  const { sheets, hasSec } = x;
  const sec = (v) => (hasSec ? [v] : []);
  const notes = [["Items the scanner flagged for checking"], [], [...sec("Section"), "Class No.", "Name", "Item", "Issue", "Recorded answer"]];
  sheets.forEach((s) => s.flags.forEach((f, i) => { if (f) notes.push([...sec(secOf(s)), s.classNo || "", s.name || "", i + 1, FLAGTXT[f] || f, s.answers[i] || "(blank)"]); }));
  sheets.forEach((s) => issuesOf(s).forEach((v) => { if (!/to check$/.test(v.t)) notes.push([...sec(secOf(s)), s.classNo || "", s.name || "", "", v.t, ""]); }));
  if (notes.length === 3) notes.push(["", "No flagged items."]);
  const ws = XLSX.utils.aoa_to_sheet(notes);
  ws["!cols"] = [...(hasSec ? [{ wch: 14 }] : []), { wch: 10 }, { wch: 28 }, { wch: 6 }, { wch: 40 }, { wch: 16 }];
  return ws;
}
