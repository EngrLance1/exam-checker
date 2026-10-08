// js/excel.js — puts the workbook together (one builder per sheet lives in js/excel/) and saves it.

function buildWorkbook() {
  const t = state.test;
  const sheets = [...state.sheets].sort((a, b) => secOf(a).localeCompare(secOf(b), undefined, { numeric: true }) || (a.classNo || "99z").localeCompare(b.classNo || "99z"));
  const x = {
    t, N: t.size, sheets, hasSec: sectionsList().length > 0,
    today: new Date().toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" }),
    title: t.name || "Test results",
  };
  const wb = XLSX.utils.book_new();
  const add = (ws, name) => { if (ws) XLSX.utils.book_append_sheet(wb, ws, name); };
  add(scoresSheet(x), "Scores");
  add(mpsSheet(x), "MPS");
  add(answersSheet(x), "Answers");
  add(analysisSheet(x), "Item Analysis");
  add(fixesSheet(x), "Item Fixes");
  add(notesSheet(x), "Scan Notes");
  return wb;
}

async function exportExcel() {
  if (!state.sheets.length) { toast("Scan at least one sheet first."); return; }
  if (typeof XLSX === "undefined") { toast("The Excel builder didn't load. Reload the page and try again."); return; }
  const wb = buildWorkbook();
  const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  await saveWithToast(`${fileBase()} - SagotScan.xlsx`, new Blob([buf]), "Excel file saved.");
}
