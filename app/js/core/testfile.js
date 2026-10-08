// js/core/testfile.js — save a test (name, keys, fixes, scanned answers) to a file and open it again.
// Photos are not stored in the file. No DOM here, so it can be tested in Node.

const TESTFILE_APP = "SagotScan";
const TESTFILE_VERSION = 1;

function buildTestFile() {
  return {
    app: TESTFILE_APP, version: TESTFILE_VERSION, saved: new Date().toISOString(),
    test: state.test, sheets: state.sheets.filter((s) => !s.sample), activeSet: state.activeSet, activeSection: state.activeSection
  };
}

const isStr = (v) => typeof v === "string";
function cleanSheet(s) {
  if (!s || typeof s !== "object" || !isStr(s.id) || !s.id) return null;
  if (!SIZES.includes(s.size)) return null;
  if (!Array.isArray(s.answers) || s.answers.length !== s.size) return null;
  if (!s.answers.every((a) => isStr(a) && (a === "" || a === "*" || (a.length === 1 && LET.includes(a))))) return null;
  const flags = Array.isArray(s.flags) && s.flags.length === s.size ? s.flags.map((f) => (isStr(f) ? f : null)) : s.answers.map(() => null);
  const pts = Array.isArray(s.pts) && s.pts.length === s.size ? s.pts : null;
  const r = Array.isArray(s.r) && s.r.length === s.size ? s.r : null;
  return {
    id: s.id, size: s.size, classNo: isStr(s.classNo) ? s.classNo.replace(/\D/g, "").slice(0, 2) : "",
    name: isStr(s.name) ? s.name : "", section: cleanSection(s.section), set: isStr(s.set) && s.set.length === 1 && LET.includes(s.set) ? s.set : "",
    answers: s.answers.slice(), flags, pts: pts || s.answers.map(() => []), r: r || s.answers.map(() => 0),
    w: Number(s.w) || 0, h: Number(s.h) || 0, sample: false, edited: !!s.edited, scanned: isStr(s.scanned) ? s.scanned : ""
  };
}

// Returns {ok:true, data} with clean data, or {ok:false, error}. Never changes app state.
function parseTestFile(text) {
  let d;
  try { d = JSON.parse(text); } catch (e) { return { ok: false, error: "This isn't a SagotScan test file." }; }
  if (!d || d.app !== TESTFILE_APP || !d.test || typeof d.test !== "object") return { ok: false, error: "This isn't a SagotScan test file." };
  if (!Number.isInteger(d.version) || d.version < 1) return { ok: false, error: "This test file has no valid version." };
  if (d.version > TESTFILE_VERSION) return { ok: false, error: "This file was saved by a newer SagotScan. Update the app to open it." };
  const t = d.test;
  if (!isTestSize(t.size)) return { ok: false, error: "The number of items in this file is not valid." };
  const keys = {};
  for (const L of LET) keys[L] = isStr(t.keys && t.keys[L]) ? cleanKey(t.keys[L]) : "";
  const sheets = [];
  for (const s of Array.isArray(d.sheets) ? d.sheets : []) {
    const c = cleanSheet(s);
    if (!c) return { ok: false, error: "Some scanned sheets in this file are damaged, so nothing was opened." };
    sheets.push(c);
  }
  return {
    ok: true,
    data: {
      test: { name: isStr(t.name) ? t.name.slice(0, 200) : "", size: t.size, target: cleanTarget(t.target), roster: cleanRoster(t.roster), keys, fixes: cleanFixes(t.fixes) },
      sheets, activeSection: cleanSection(d.activeSection), activeSet: isStr(d.activeSet) && d.activeSet.length === 1 && LET.includes(d.activeSet) ? d.activeSet : "A"
    }
  };
}

function applyTestFile(data) {
  Object.keys(photos).forEach((k) => delete photos[k]);
  state.test = data.test;
  state.sheets = data.sheets;
  state.activeSet = data.activeSet;
  state.activeSection = data.activeSection;
  state.iaSection = "";
  state.selected = data.sheets.length ? data.sheets[0].id : null;
  state.keyCapture = null;
  state.sampleKeySet = null;
}

// True when there is real work (not just the sample) that opening a file would replace.
function hasWork() {
  if (state.test.name) return true;
  if (state.sheets.some((s) => !s.sample)) return true;
  return LET.split("").some((L) => state.test.keys[L] && L !== state.sampleKeySet);
}
