// js/core/state.js — the single app state object and its localStorage save/restore.

const state = {
  test: { name: "", size: 50, target: DEFAULT_TARGET, roster: {}, keys: { A: "", B: "", C: "", D: "" }, fixes: { A: {}, B: {}, C: {}, D: {} } },
  sheets: [], activeSet: "A", selected: null, keyCapture: null, sampleKeySet: null,
  activeSection: "", // new sheets are filed under this section ("" = no sections used)
  iaSection: "",     // screen only: which section the item analysis shows ("" = all)
  otherOpen: false,  // screen only: the "Other" item count box is open
  view: "dashboard", // screen only: which page is showing
  search: "",        // screen only: the search box text
  onlyIssues: false, // screen only: Scores table shows only sheets to check
  chartSet: ""       // screen only: which answer-key set the dashboard chart shows
};
const photos = {}; // sheet id -> image src (kept in memory only)

// Item fixes: state.test.fixes[set][itemNo] = {type:"key"|"also", letter} | {type:"credit"} | {type:"drop"}.
// Keeps only well-formed entries, so old or damaged saved data cannot break scoring.
function cleanFixes(f) {
  const out = { A: {}, B: {}, C: {}, D: {} };
  if (!f || typeof f !== "object") return out;
  for (const set of LET) {
    const src = f[set];
    if (!src || typeof src !== "object") continue;
    for (const no of Object.keys(src)) {
      const x = src[no], n = Number(no);
      if (!Number.isInteger(n) || n < 1 || n > 200 || !x || typeof x !== "object") continue;
      if ((x.type === "key" || x.type === "also") && typeof x.letter === "string" && x.letter.length === 1 && LET.includes(x.letter)) out[set][n] = { type: x.type, letter: x.letter };
      else if (x.type === "credit" || x.type === "drop") out[set][n] = { type: x.type };
    }
  }
  return out;
}

// Section names are free text: trimmed, single-spaced, at most MAX_SECTION_LEN characters.
const cleanSection = (s) => (typeof s === "string" ? s.replace(/\s+/g, " ").trim().slice(0, MAX_SECTION_LEN) : "");
const secOf = (sh) => cleanSection(sh.section);
const cleanTarget = (n) => (Number.isInteger(n) && n >= 1 && n <= 100 ? n : DEFAULT_TARGET);
const targetPct = () => cleanTarget(state.test.target);
// Every section in use, sorted: those on scanned sheets plus the one being scanned into.
function sectionsList() {
  const set = new Set(state.sheets.map(secOf).filter(Boolean));
  if (state.activeSection) set.add(state.activeSection);
  return [...set].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}

// A key read from a sheet of `sheetSize` items: a custom item count (say 40) is kept when the sheet is big enough.
function sizeAfterKey(sheetSize) {
  const cur = state.test.size;
  return !SIZES.includes(cur) && cur <= sheetSize ? cur : sheetSize;
}

let storageOk = true;
function showStorageWarning(on) {
  const el = $("#storageWarn");
  if (el) el.hidden = !on;
}
function save() {
  try {
    localStorage.setItem(STORE, JSON.stringify({ test: state.test, sheets: state.sheets, activeSet: state.activeSet, activeSection: state.activeSection, sampleKeySet: state.sampleKeySet }));
    if (!storageOk) { storageOk = true; showStorageWarning(false); }
  } catch (e) {
    if (storageOk) { storageOk = false; showStorageWarning(true); }
  }
}
function restore() {
  try {
    const raw = localStorage.getItem(STORE);
    if (!raw) return false;
    const d = JSON.parse(raw);
    if (!d || !d.test) return false;
    Object.assign(state.test, d.test);
    state.test.fixes = cleanFixes(d.test.fixes);
    state.test.target = cleanTarget(d.test.target);
    state.test.roster = cleanRoster(d.test.roster);
    state.activeSection = cleanSection(d.activeSection);
    state.sheets = Array.isArray(d.sheets) ? d.sheets : [];
    state.activeSet = d.activeSet || "A";
    state.sampleKeySet = d.sampleKeySet || null;
    state.sheets.forEach((s) => { if (s.sample) photos[s.id] = SAMPLE_SRC; });
    return true;
  } catch (e) { return false; }
}
