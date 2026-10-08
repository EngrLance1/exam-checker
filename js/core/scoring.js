// js/core/scoring.js — turns a scanned sheet plus the answer key into a score, and lists problems with a sheet.

/* ---------- scoring ---------- */
const cleanKey = (s) => s.toUpperCase().replace(/[^A-D-]/g, "");
function keyFor(sh) {
  const k = state.test.keys;
  if (sh.set && k[sh.set]) return { key: k[sh.set], set: sh.set };
  const filled = LET.split("").filter((s) => k[s]);
  if (filled.length === 1) return { key: k[filled[0]], set: filled[0], fallback: true };
  return null;
}

// The teacher's fix for one item (1-based number) of a set, or null.
function fixOf(set, i) {
  return ((state.test.fixes || {})[set] || {})[i + 1] || null;
}
// What counts as right for item i (0-based) of a set, after fixes.
// null = not scored (no key letter, "-", or dropped). Otherwise {letters, all, label, fix}.
function ruleFor(set, i) {
  const c = (state.test.keys[set] || "")[i], fx = fixOf(set, i);
  if (!c || c === "-" || (fx && fx.type === "drop")) return null;
  if (fx && fx.type === "credit") return { letters: LET, all: true, label: "All", fix: fx };
  if (fx && fx.type === "key") return { letters: fx.letter, all: false, label: fx.letter, fix: fx };
  if (fx && fx.type === "also" && fx.letter !== c) return { letters: c + fx.letter, all: false, label: `${c}, ${fx.letter}`, fix: fx };
  return { letters: c, all: false, label: c, fix: null };
}
function isRight(rule, answer) {
  return rule.all || (answer.length === 1 && rule.letters.includes(answer));
}
function scoreOf(sh) {
  const kk = keyFor(sh);
  if (!kk) return null;
  let s = 0, t = 0;
  for (let i = 0; i < Math.min(kk.key.length, sh.size, state.test.size); i++) {
    const rule = ruleFor(kk.set, i);
    if (!rule) continue;
    t++;
    if (isRight(rule, sh.answers[i] || "")) s++;
  }
  return { score: s, total: t, set: kk.set };
}
const FLAGTXT = { multiple: "Two marks", faint: "Faint mark", erasure: "Possible erasure" };
function issuesOf(sh) {
  const out = [];
  const f = sh.flags.filter(Boolean).length;
  if (f) out.push({ t: `${f} item${f > 1 ? "s" : ""} to check`, c: "warn" });
  if (!/^\d{2}$/.test(sh.classNo || "")) out.push({ t: "Class number unreadable", c: "warn" });
  else if (duplicatesOf(sh).length) out.push({ t: `Class No. ${sh.classNo} used twice${secOf(sh) ? ` in ${secOf(sh)}` : ""}`, c: "bad" });
  const usedSets = LET.split("").filter((s) => state.test.keys[s]);
  if (!sh.set && usedSets.length > 1) out.push({ t: "Test set not shaded", c: "warn" });
  else if (sh.set && usedSets.length && !state.test.keys[sh.set] && usedSets.length > 1) out.push({ t: `No key for Set ${sh.set}`, c: "bad" });
  if (sh.size !== sheetSizeFor(state.test.size)) out.push({ t: `${sh.size}-item sheet (a ${state.test.size}-item test uses the ${sheetSizeFor(state.test.size)}-item sheet)`, c: "bad" });
  return out;
}

// Plain-words description of a fix, for tables and the Excel file.
function fixText(fix, key) {
  if (!fix) return "";
  if (fix.type === "also") return `Also accept ${fix.letter}`;
  if (fix.type === "key") return `Key changed from ${key} to ${fix.letter}`;
  if (fix.type === "credit") return "Credit to everyone";
  return "Dropped from scoring";
}
// Sets or clears one fix. value: "" | "credit" | "drop" | "also:B" | "key:B". Returns true if it changed anything.
function setFix(set, no, value) {
  if (!LET.includes(set) || set.length !== 1) return false;
  const key = (state.test.keys[set] || "")[no - 1];
  if (!key || key === "-") return false;
  const fixes = state.test.fixes[set] = state.test.fixes[set] || {};
  let fx = null;
  if (value === "credit" || value === "drop") fx = { type: value };
  else if (/^(also|key):[A-D]$/.test(value)) fx = { type: value.split(":")[0], letter: value.split(":")[1] };
  else if (value !== "") return false;
  if (fx && fx.letter === key) fx = null; // same as the key: nothing to fix
  if (fx) fixes[no] = fx; else delete fixes[no];
  return true;
}

// Other sheets with the same class number in the same section (class numbers repeat across sections).
function duplicatesOf(sh) {
  if (!/^\d{2}$/.test(sh.classNo || "")) return [];
  return state.sheets.filter((o) => o !== sh && o.classNo === sh.classNo && secOf(o) === secOf(sh));
}
// Sheets of the wrong printed size for this test. They are scored (and flagged) but kept out of item analysis.
const rightSize = (sh) => sh.size === sheetSizeFor(state.test.size);

// Problems with the answer keys themselves, one sentence each.
function keyProblems() {
  const out = [], n = state.test.size;
  LET.split("").forEach((s) => {
    const k = state.test.keys[s];
    if (!k) return;
    if (k.length < n) out.push(`Set ${s} key has ${k.length} of ${n} items. The other ${n - k.length} are not scored.`);
    else if (k.length > n) out.push(`Set ${s} key has ${k.length} letters. Only the first ${n} are used.`);
  });
  return out;
}
