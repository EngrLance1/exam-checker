// js/core/undo.js — snapshots so a destructive action (remove, clear, replace) can be undone. No DOM here.

// Copies everything a teacher could lose. Photos are shared by reference (they are only strings), so this stays cheap.
function takeSnapshot() {
  const data = JSON.parse(JSON.stringify({
    test: state.test, sheets: state.sheets, activeSet: state.activeSet, activeSection: state.activeSection,
    selected: state.selected, sampleKeySet: state.sampleKeySet,
  }));
  return { data, photos: { ...photos } };
}

function applySnapshot(snap) {
  const d = JSON.parse(JSON.stringify(snap.data));
  state.test = d.test; state.sheets = d.sheets; state.activeSet = d.activeSet; state.activeSection = d.activeSection;
  state.selected = d.selected; state.sampleKeySet = d.sampleKeySet; state.keyCapture = null;
  Object.keys(photos).forEach((k) => delete photos[k]);
  Object.assign(photos, snap.photos);
}
