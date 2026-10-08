// js/main.js — app start: restore saved data, draw, load the sample on first run, set up downloads.

(async function start() {
  const had = restore();
  renderAll();
  if (!had) {
    state.test.keys.B = SAMPLE_KEY; state.sampleKeySet = "B"; state.activeSet = "B";
    await processSource(SAMPLE_SRC, "sample sheet", { sample: true, name: "" });
  } else if (state.sheets.length && !state.selected) { state.selected = state.sheets[0].id; renderAll(); }
  showView(location.hash.slice(1), { noHash: true, keepScroll: true });
  try {
    if (window.claude && window.claude.use) {
      downloads = await window.claude.use("downloads");
    }
  } catch (e) { downloads = null; }
})();
