// js/ui/render-setup.js — panel 1: test name, item count, answer key box.

// Hint under the item count. n = a valid typed count, or null when the typed text is not valid.
function renderSizeHint(n, raw) {
  const el = $("#sizeHint");
  const open = state.otherOpen || !SIZES.includes(state.test.size);
  el.hidden = !open;
  if (!open) return;
  el.classList.toggle("bad", n == null && raw !== undefined);
  if (n == null && raw !== undefined) el.textContent = `Enter a whole number from 1 to ${MAX_ITEMS}.`;
  else {
    const c = n == null ? state.test.size : n;
    el.textContent = `Use the ${sheetSizeFor(c)}-item sheet. Items after ${c} are ignored.`;
  }
}

function renderSetup() {
  $("#testName").value = state.test.name;
  const other = state.otherOpen || !SIZES.includes(state.test.size);
  document.querySelectorAll("#sizeSeg button").forEach((b) => {
    const on = b.dataset.size === "other" ? other : !other && +b.dataset.size === state.test.size;
    b.setAttribute("aria-pressed", String(on));
  });
  $("#sizeOther").hidden = !other;
  const sc = $("#sizeCustom");
  if (document.activeElement !== sc) { sc.value = state.test.size; sc.setAttribute("aria-invalid", "false"); renderSizeHint(null); }
  document.querySelectorAll("#setSeg button").forEach((b) => {
    const s = b.dataset.set;
    b.setAttribute("aria-pressed", String(s === state.activeSet));
    b.innerHTML = (s === "A" ? "Set A" : s) + (state.test.keys[s] ? `<i class="keydot" role="img" aria-label="key entered"></i>` : "");
  });
  const key = state.test.keys[state.activeSet];
  const ta = $("#keyInput");
  if (document.activeElement !== ta) ta.value = key.replace(/(.{5})/g, "$1 ").trim();
  ta.placeholder = `Set ${state.activeSet}: ${state.test.size} letters`;
  const n = key.replace(/-/g, "").length;
  const kc = $("#keyCount");
  const short = key.length > 0 && key.length < state.test.size;
  kc.textContent = `${key.length} / ${state.test.size} items`
    + (key.length > state.test.size ? " — too many letters" : short ? ` — ${state.test.size - key.length} not scored` : "");
  kc.classList.toggle("full", key.length === state.test.size);
  kc.classList.toggle("warn", short || key.length > state.test.size);
  const tg = $("#targetInput");
  if (document.activeElement !== tg) { tg.value = targetPct(); tg.setAttribute("aria-invalid", "false"); }
  const sec = $("#sectionInput");
  if (document.activeElement !== sec) sec.value = state.activeSection;
  $("#sectionList").innerHTML = sectionsList().map((s) => `<option value="${esc(s)}">`).join("");
  const cn = $("#captureNote");
  cn.hidden = !state.keyCapture;
  if (state.keyCapture) cn.textContent = `Next photo will be read as the Set ${state.keyCapture} answer key. Shade a correct key sheet and scan it.`;
  $("#keyScanBtn").textContent = state.keyCapture ? "Cancel key scan" : "Scan a key sheet";
}
