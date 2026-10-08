// js/ui/clear.js — the confirm bar and the actions that need a yes/no: clear sheets, clear key, clear everything, open a test file.

let pendingClear = null;
let pendingOpen = null; // parsed test file waiting for the teacher to confirm replacing current work
const CLEARS = {
  sheets: {
    msg: () => `Clear all ${state.sheets.length} scanned sheet${state.sheets.length === 1 ? "" : "s"}? The test name and answer keys stay, so you can scan the next section.`,
    run: () => {
      Object.keys(photos).forEach((k) => delete photos[k]);
      state.sheets = []; state.selected = null;
      if (state.sampleKeySet) { state.test.keys[state.sampleKeySet] = ""; state.test.fixes[state.sampleKeySet] = {}; state.sampleKeySet = null; }
      $("#queue").innerHTML = "";
      return "All sheets cleared. Answer keys kept.";
    }
  },
  key: {
    msg: () => `Clear the Set ${state.activeSet} answer key?`,
    run: () => {
      state.test.keys[state.activeSet] = "";
      state.test.fixes[state.activeSet] = {};
      if (state.sampleKeySet === state.activeSet) state.sampleKeySet = null;
      return `Set ${state.activeSet} key cleared.`;
    }
  },
  all: {
    msg: () => "Clear everything for a new test? This removes the test name, all answer keys and all scanned sheets.",
    run: () => {
      Object.keys(photos).forEach((k) => delete photos[k]);
      state.test = { name: "", size: state.test.size, target: state.test.target, roster: {}, keys: { A: "", B: "", C: "", D: "" }, fixes: { A: {}, B: {}, C: {}, D: {} } };
      state.sheets = []; state.selected = null; state.sampleKeySet = null; state.keyCapture = null; state.activeSet = "A";
      $("#queue").innerHTML = "";
      return "Cleared. Ready for a new test.";
    }
  },
  open: {
    yes: "Replace",
    msg: () => "Open this test file? It replaces the test name, answer keys and scanned sheets you have now.",
    run: () => {
      const data = pendingOpen; pendingOpen = null;
      if (!data) return "";
      applyTestFile(data);
      $("#queue").innerHTML = "";
      return `Test file opened (${data.sheets.length} sheet${data.sheets.length === 1 ? "" : "s"}).`;
    }
  }
};
function askClear(kind) {
  if (kind === "sheets" && !state.sheets.length) { toast("There are no sheets to clear."); return; }
  if (kind === "key" && !state.test.keys[state.activeSet]) { toast(`Set ${state.activeSet} has no key yet.`); return; }
  pendingClear = kind;
  $("#confirmYes").textContent = CLEARS[kind].yes || "Clear";
  $("#confirmMsg").textContent = CLEARS[kind].msg();
  $("#confirmBar").hidden = false;
  $("#confirmBar").scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "nearest" });
  $("#confirmNo").focus();
}
$("#clearSheetsBtn").addEventListener("click", () => askClear("sheets"));
$("#clearKeyBtn").addEventListener("click", () => askClear("key"));
$("#newTestBtn").addEventListener("click", () => askClear("all"));
$("#confirmNo").addEventListener("click", () => { pendingClear = null; pendingOpen = null; $("#confirmBar").hidden = true; });
$("#confirmYes").addEventListener("click", () => {
  if (!pendingClear) return;
  const snap = takeSnapshot();
  const msg = CLEARS[pendingClear].run();
  pendingClear = null; $("#confirmBar").hidden = true;
  const ta = $("#keyInput"); if (document.activeElement === ta) ta.blur(); ta.value = "";
  renderAll(); save();
  if (msg) showUndo(msg, snap);
});

// Shows a message with an Undo button that puts everything back as it was in `snap`.
function showUndo(msg, snap) {
  toast(msg, { label: "Undo", fn: () => { applySnapshot(snap); $("#queue").innerHTML = ""; renderAll(); save(); toast("Undone."); } });
}
