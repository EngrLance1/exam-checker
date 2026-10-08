// sheets/sheets.js — the printing page: choose the number of items, preview the sheet, print.
// Needs app/js/config.js, app/js/data/layouts.js and app/js/core/sheetlayout.js (layoutFor), then sheet-svg.js.

const SIZE_KEY = "sagotscan-sheet-size";
const box = document.getElementById("sheetBox");
const area = document.getElementById("printArea");
const input = document.getElementById("sizeInput");
const help = document.getElementById("sizeHelp");
const HELP = help.textContent;
const parseSize = (v) => (/^\d{1,2}$/.test(String(v).trim()) && isTestSize(Number(v)) ? Number(v) : null);

function show(size) {
  const layouts = { [size]: layoutFor(size) };
  box.innerHTML = buildSheetSVG(size, layouts);
  // Printed 187 mm wide: the frame is 170 mm between corner-square centres, plus an 8.5 mm margin each side.
  area.innerHTML = buildSheetSVG(size, layouts, { width: "187mm" });
  document.querySelectorAll("#sizeSeg button").forEach((b) => b.setAttribute("aria-pressed", String(+b.dataset.size === size)));
  if (document.activeElement !== input) input.value = size;
  input.setAttribute("aria-invalid", "false");
  help.textContent = HELP; help.classList.remove("bad");
  box.setAttribute("aria-label", `Preview of the ${size}-item answer sheet`);
  try { localStorage.setItem(SIZE_KEY, String(size)); } catch (e) {}
  if (location.hash !== "#" + size) { try { history.replaceState(null, "", "#" + size); } catch (e) {} }
}

document.getElementById("sizeSeg").addEventListener("click", (e) => {
  const b = e.target.closest("button");
  if (b) show(+b.dataset.size);
});
input.addEventListener("input", () => {
  const n = parseSize(input.value);
  if (n === null) { input.setAttribute("aria-invalid", "true"); help.textContent = `Enter a whole number from 1 to ${MAX_ITEMS}.`; help.classList.add("bad"); return; }
  show(n);
});
input.addEventListener("blur", () => { const n = parseSize(input.value); if (n === null) input.value = box.getAttribute("aria-label").match(/\d+/)[0]; input.setAttribute("aria-invalid", "false"); help.textContent = HELP; help.classList.remove("bad"); });
document.getElementById("printBtn").addEventListener("click", () => window.print());

let start = parseSize(location.hash.slice(1));
if (start === null) { try { start = parseSize(localStorage.getItem(SIZE_KEY)); } catch (e) { start = null; } }
show(start === null ? 50 : start);
