// js/ui/events.js — user input handlers: setup, scanning, review, sample removal, export, save/open test file.

$("#testName").addEventListener("input", (e) => { state.test.name = e.target.value; $("#resAside").textContent = state.test.name; renderNav(); save(); });
$("#sizeSeg").addEventListener("click", (e) => {
  const b = e.target.closest("button"); if (!b) return;
  if (b.dataset.size === "other") { state.otherOpen = true; renderSetup(); $("#sizeCustom").focus(); return; }
  state.otherOpen = false; state.test.size = +b.dataset.size; renderAll(); save();
});
$("#sizeCustom").addEventListener("input", (e) => {
  const v = e.target.value.trim(), n = Number(v);
  const ok = /^\d{1,2}$/.test(v) && isTestSize(n);
  e.target.setAttribute("aria-invalid", String(!ok));
  renderSizeHint(ok ? n : null, v);
  if (!ok || n === state.test.size) return;
  state.test.size = n; renderAll(); save();
});
$("#sizeCustom").addEventListener("blur", renderSetup);
$("#targetInput").addEventListener("input", (e) => {
  const v = e.target.value.trim(), n = Number(v);
  const ok = /^\d{1,3}$/.test(v) && n >= 1 && n <= 100;
  e.target.setAttribute("aria-invalid", String(!ok));
  $("#targetHint").textContent = ok ? "Class MPS and item MPS are compared to this. DepEd's usual target is 75." : "Enter a whole number from 1 to 100.";
  if (!ok || n === state.test.target) return;
  state.test.target = n; renderAll(); save();
});
$("#targetInput").addEventListener("blur", () => { $("#targetHint").textContent = "Class MPS and item MPS are compared to this. DepEd's usual target is 75."; renderSetup(); });
$("#sectionInput").addEventListener("input", (e) => {
  state.activeSection = cleanSection(e.target.value); save();
  $("#sectionList").innerHTML = sectionsList().map((s) => `<option value="${esc(s)}">`).join("");
});
$("#sectionInput").addEventListener("change", () => renderAll());
$("#setSeg").addEventListener("click", (e) => { const b = e.target.closest("button"); if (!b) return; state.activeSet = b.dataset.set; renderSetup(); save(); });
$("#keyInput").addEventListener("input", (e) => {
  const k = cleanKey(e.target.value);
  state.test.keys[state.activeSet] = k;
  if (state.sampleKeySet === state.activeSet) state.sampleKeySet = null;
  renderSetup(); renderResults(); renderMPS(); renderReview(); renderAnalysis(); save();
});
$("#keyInput").addEventListener("blur", renderSetup);
$("#keyScanBtn").addEventListener("click", () => { state.keyCapture = state.keyCapture ? null : state.activeSet; renderSetup(); });
$("#camInput").addEventListener("change", (e) => { handleFiles([...e.target.files]); e.target.value = ""; });
$("#fileInput").addEventListener("change", (e) => { handleFiles([...e.target.files]); e.target.value = ""; });
const drop = $("#drop");
drop.addEventListener("dragover", (e) => { e.preventDefault(); drop.classList.add("over"); });
drop.addEventListener("dragleave", () => drop.classList.remove("over"));
drop.addEventListener("drop", (e) => { e.preventDefault(); drop.classList.remove("over"); handleFiles([...e.dataTransfer.files]); });

function selectRow(id) { state.selected = id; renderResults(); renderReview(); $("#reviewPanel").scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" }); }
$("#tbody").addEventListener("click", (e) => { const tr = e.target.closest("tr[data-id]"); if (tr) selectRow(tr.dataset.id); });
$("#tbody").addEventListener("keydown", (e) => { const tr = e.target.closest("tr[data-id]"); if (tr && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); selectRow(tr.dataset.id); } });

const cur = () => state.sheets.find((s) => s.id === state.selected);
$("#items").addEventListener("click", (e) => {
  const b = e.target.closest(".bub"); const sh = cur(); if (!b || !sh) return;
  const i = +b.dataset.i, L = b.dataset.l;
  sh.answers[i] = sh.answers[i] === L ? "" : L;
  sh.flags[i] = null; sh.edited = true;
  renderResults(); renderMPS(); renderReview(); renderAnalysis(); save();
});
$("#rvClass").addEventListener("input", (e) => { const sh = cur(); if (!sh) return; sh.classNo = e.target.value.replace(/\D/g, "").slice(0, 2); sh.edited = true; save(); });
$("#rvClass").addEventListener("change", (e) => {
  const sh = cur(); if (!sh) return;
  if (sh.classNo.length === 1) sh.classNo = "0" + sh.classNo;
  if (!sh.name) sh.name = rosterName(sh);
  renderResults(); renderReview(); renderAnalysis(); save();
});
$("#rvSection").addEventListener("input", (e) => { const sh = cur(); if (!sh) return; sh.section = cleanSection(e.target.value); save(); });
$("#rvSection").addEventListener("change", () => {
  const sh = cur(); if (!sh) return;
  sh.edited = true;
  if (!sh.name) sh.name = rosterName(sh);
  renderAll(); save();
});
$("#dupBar").addEventListener("click", (e) => {
  const sh = cur(); if (!sh) return;
  const keepThis = e.target.closest("#dupKeepThis"), keepOther = e.target.closest("#dupKeepOther");
  if (!keepThis && !keepOther) return;
  const snap = takeSnapshot(), dups = duplicatesOf(sh);
  const drop = keepThis ? dups : [sh];
  state.sheets = state.sheets.filter((s) => !drop.includes(s));
  drop.forEach((s) => delete photos[s.id]);
  state.selected = keepThis ? sh.id : dups[0].id;
  renderAll(); save();
  showUndo(`Removed ${drop.length} sheet${drop.length > 1 ? "s" : ""}.`, snap);
});
$("#rvName").addEventListener("input", (e) => { const sh = cur(); if (!sh) return; sh.name = e.target.value; save(); });
$("#rvName").addEventListener("change", () => renderResults());
$("#rvSet").addEventListener("change", (e) => { const sh = cur(); if (!sh) return; sh.set = e.target.value; sh.edited = true; renderAll(); save(); });
$("#useAsKey").addEventListener("click", () => {
  const sh = cur(); if (!sh) return;
  const snap = takeSnapshot();
  const set = sh.set || state.activeSet;
  state.test.size = sizeAfterKey(sh.size);
  state.test.keys[set] = sh.answers.slice(0, state.test.size).map((a) => a && a !== "*" ? a : "-").join("");
  state.activeSet = set;
  state.sheets = state.sheets.filter((s) => s !== sh); state.selected = null;
  renderAll(); save();
  showUndo(`Set ${set} key taken from this sheet. The sheet was moved out of the student list.`, snap);
});
$("#removeSheet").addEventListener("click", () => { $("#removeConfirm").hidden = false; $("#removeSheet").hidden = true; });
$("#removeNo").addEventListener("click", () => { $("#removeConfirm").hidden = true; $("#removeSheet").hidden = false; });
$("#removeYes").addEventListener("click", () => {
  const sh = cur(); if (!sh) return;
  const snap = takeSnapshot();
  state.sheets = state.sheets.filter((s) => s !== sh); delete photos[sh.id]; state.selected = null;
  renderAll(); save();
  showUndo("Sheet removed.", snap);
});
$("#clearSample").addEventListener("click", () => {
  state.sheets.filter((s) => s.sample).forEach((s) => delete photos[s.id]);
  state.sheets = state.sheets.filter((s) => !s.sample);
  if (state.sampleKeySet) { state.test.keys[state.sampleKeySet] = ""; state.test.fixes[state.sampleKeySet] = {}; state.sampleKeySet = null; }
  if (!state.sheets.some((s) => s.id === state.selected)) state.selected = null;
  renderAll(); save();
});
$("#iaSection").addEventListener("change", (e) => { state.iaSection = e.target.value; renderAnalysis(); });
$("#rosterApply").addEventListener("click", () => {
  const { entries, bad } = parseClassList($("#rosterInput").value);
  const count = Object.keys(entries).length;
  if (!count) { $("#rosterNote").textContent = bad.length ? `Couldn't read any line. Start each with the class number, like "12 Dela Cruz, Juan".` : "Paste the class list first."; return; }
  const { filled, unmatched } = applyRoster(entries, state.activeSection);
  $("#rosterInput").value = "";
  $("#rosterNote").textContent = `${count} name${count > 1 ? "s" : ""} saved${state.activeSection ? ` for ${state.activeSection}` : ""}. ${filled} sheet${filled === 1 ? "" : "s"} named.`
    + (unmatched.length ? ` Not on the list: ${unmatched.join(", ")}.` : "")
    + (bad.length ? ` ${bad.length} line${bad.length > 1 ? "s" : ""} skipped: ${bad.slice(0, 3).join(" | ")}${bad.length > 3 ? " …" : ""}.` : "");
  renderAll(); save();
});
$("#rosterClear").addEventListener("click", () => {
  const sec = state.activeSection, had = Object.keys((state.test.roster || {})[sec] || {}).length;
  if (!had) { $("#rosterNote").textContent = "There is no saved list for this section."; return; }
  const snap = takeSnapshot();
  delete state.test.roster[sec];
  $("#rosterNote").textContent = "";
  save();
  showUndo("Class list cleared. Names already on sheets stay.", snap);
});

$("#printBtn").addEventListener("click", () => {
  if (!state.sheets.some((s) => scoreOf(s))) { toast("Scan at least one sheet and enter an answer key first."); return; }
  $("#printBar").hidden = false;
  $("#printGo").focus();
});
$("#printCancel").addEventListener("click", () => { $("#printBar").hidden = true; });
$("#printGo").addEventListener("click", () => { printReport($("#printNames").checked); });

$("#ia").addEventListener("change", (e) => {
  const sel = e.target.closest("select.fixsel");
  if (!sel || !setFix(sel.dataset.set, +sel.dataset.no, sel.value)) return;
  renderAll(); save();
});
$("#exportBtn").addEventListener("click", exportExcel);

$("#saveFileBtn").addEventListener("click", () => {
  saveWithToast(`${fileBase()} - SagotScan.json`, new Blob([JSON.stringify(buildTestFile())], { type: "application/json" }), "Test file saved.");
});
$("#openInput").addEventListener("change", async (e) => {
  const f = e.target.files[0]; e.target.value = "";
  if (!f) return;
  let text;
  try { text = await f.text(); } catch (err) { toast("That file couldn't be read."); return; }
  const res = parseTestFile(text);
  if (!res.ok) { toast(res.error); return; }
  if (!hasWork()) { applyTestFile(res.data); renderAll(); save(); toast(`Test file opened (${res.data.sheets.length} sheet${res.data.sheets.length === 1 ? "" : "s"}).`); return; }
  pendingOpen = res.data;
  askClear("open");
});
