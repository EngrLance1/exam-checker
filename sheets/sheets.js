// sheets/sheets.js — the printing page: choose a size, preview the sheet, print.

const SIZE_KEY = "sagotscan-sheet-size";
const box = document.getElementById("sheetBox");
const area = document.getElementById("printArea");
let current = 50;

function show(size) {
  current = size;
  const svg = buildSheetSVG(size, LAYOUTS);
  box.innerHTML = svg;
  // Printed 187 mm wide: the frame is 170 mm between corner-square centres, plus an 8.5 mm margin each side.
  area.innerHTML = buildSheetSVG(size, LAYOUTS, { width: "187mm" });
  document.querySelectorAll("#sizeSeg button").forEach((b) => b.setAttribute("aria-pressed", String(+b.dataset.size === size)));
  box.setAttribute("aria-label", `Preview of the ${size}-item answer sheet`);
  try { localStorage.setItem(SIZE_KEY, String(size)); } catch (e) {}
  if (location.hash !== "#" + size) { try { history.replaceState(null, "", "#" + size); } catch (e) {} }
}

document.getElementById("sizeSeg").addEventListener("click", (e) => {
  const b = e.target.closest("button");
  if (b) show(+b.dataset.size);
});
document.getElementById("printBtn").addEventListener("click", () => window.print());

let start = +location.hash.slice(1);
if (![30, 50, 60].includes(start)) { try { start = +localStorage.getItem(SIZE_KEY); } catch (e) { start = 50; } }
show([30, 50, 60].includes(start) ? start : 50);
