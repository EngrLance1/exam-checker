// js/core/classlist.js — a pasted class list (class number + name) that fills in student names. No DOM here.
// Stored per section: state.test.roster = { "<section>": { "<2-digit class no>": "<name>" } }. "" is the no-section list.

const MAX_NAME_LEN = 80;
const cleanName = (s) => (typeof s === "string" ? s.replace(/\s+/g, " ").trim().slice(0, MAX_NAME_LEN) : "");

// Keeps only well-formed entries so damaged saved data cannot break anything.
function cleanRoster(r) {
  const out = {};
  if (!r || typeof r !== "object" || Array.isArray(r)) return out;
  for (const sec of Object.keys(r).slice(0, 50)) {
    const src = r[sec];
    if (!src || typeof src !== "object" || Array.isArray(src)) continue;
    const name = cleanSection(sec), list = {};
    for (const no of Object.keys(src)) { const v = cleanName(src[no]); if (/^\d{2}$/.test(no) && v) list[no] = v; }
    if (Object.keys(list).length) out[name] = { ...(out[name] || {}), ...list };
  }
  return out;
}

// Lines like "12 Dela Cruz, Juan", "5. Ana Reyes", "07, Ben Cruz", "3<TAB>Ria Lim". Returns what it could read and the lines it could not.
function parseClassList(text) {
  const entries = {}, bad = [];
  String(text || "").split(/\r?\n/).forEach((raw) => {
    const line = raw.trim();
    if (!line) return;
    const m = line.match(/^(\d{1,2})[\s.,;:)\-]+(.+)$/);
    const name = m ? cleanName(m[2]) : "";
    if (!m || !name) { bad.push(line.slice(0, 60)); return; }
    entries[m[1].padStart(2, "0")] = name;
  });
  return { entries, bad };
}

// Saves entries for a section and names the sheets in that section that have no name yet.
// Returns {filled, unmatched}: how many sheets got a name, and class numbers on sheets that the list does not cover.
function applyRoster(entries, section) {
  const sec = cleanSection(section);
  state.test.roster = state.test.roster || {};
  state.test.roster[sec] = { ...(state.test.roster[sec] || {}), ...entries };
  let filled = 0;
  const unmatched = [];
  state.sheets.forEach((sh) => {
    if (secOf(sh) !== sec || sh.sample) return;
    const nm = state.test.roster[sec][sh.classNo];
    if (!nm) { if (/^\d{2}$/.test(sh.classNo || "") && !sh.name) unmatched.push(sh.classNo); return; }
    if (!sh.name) { sh.name = nm; filled++; }
  });
  return { filled, unmatched: [...new Set(unmatched)].sort() };
}

// The listed name for a sheet's class number in its section, or "".
const rosterName = (sh) => ((state.test.roster || {})[secOf(sh)] || {})[sh.classNo] || "";
