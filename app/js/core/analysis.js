// js/core/analysis.js — item analysis: difficulty (p), discrimination (D), option counts, decision, key and option warnings, KR-20.

/* ---------- item analysis ---------- */
function pLevel(p) { return p >= 0.81 ? "Very easy" : p >= 0.61 ? "Easy" : p >= 0.41 ? "Average" : p >= 0.21 ? "Difficult" : "Very difficult"; }
function dLevel(d) { return d >= 0.40 ? "Very good" : d >= 0.30 ? "Good" : d >= 0.20 ? "Fair" : "Poor"; }
function decision(p, d) {
  if (d == null) return "Need 4+ students";
  if (d < 0.20) return "Reject";
  if (d >= 0.30 && p >= 0.21 && p <= 0.80) return "Retain";
  return "Revise";
}
// Warning thresholds. Plain rules of thumb, stated in the report so a teacher can judge them.
const MISKEY_MIN_UPPER = 2;    // a wrong option picked by at least this many top scorers, and more than the right answer
const WEAK_OPTION_MIN_N = 20;  // below this class size "nobody picked it" says little
const WEAK_OPTION_SHARE = 0.05;
const KR20_MIN_STUDENTS = 10;

// KR-20 reliability of the scored items and the standard error of measurement (in score points).
// scores: each student's total. items: analysis items (dropped ones are skipped). Returns null when it cannot be trusted.
function reliability(scores, items) {
  const live = items.filter((it) => !it.dropped), n = scores.length, k = live.length;
  if (n < KR20_MIN_STUDENTS || k < 2) return null;
  const mean = scores.reduce((a, b) => a + b, 0) / n;
  const variance = scores.reduce((a, x) => a + (x - mean) ** 2, 0) / n;
  if (variance === 0) return null;
  const pq = live.reduce((a, it) => a + it.p * (1 - it.p), 0);
  const kr20 = (k / (k - 1)) * (1 - pq / variance);
  const sd = Math.sqrt(variance);
  return { kr20, sd, sem: sd * Math.sqrt(Math.max(0, 1 - kr20)), k, n };
}

// Notes for one item: a wrong option that drew more top scorers than the right answer, and options almost nobody chose.
function itemNotes(rule, cnt, upper, i, n) {
  const notes = [];
  if (!rule || rule.all) return notes;
  const upperCnt = { A: 0, B: 0, C: 0, D: 0 };
  upper.forEach(({ sh }) => { const a = sh.answers[i]; if (upperCnt[a] !== undefined) upperCnt[a]++; });
  const upperRight = upper.filter(({ sh }) => isRight(rule, sh.answers[i] || "")).length;
  const wrong = LET.split("").filter((L) => !rule.letters.includes(L));
  const top = wrong.sort((a, b) => upperCnt[b] - upperCnt[a])[0];
  if (top && upperCnt[top] >= MISKEY_MIN_UPPER && upperCnt[top] > upperRight) notes.push({ kind: "miskey", letters: [top] });
  if (n >= WEAK_OPTION_MIN_N) {
    const weak = LET.split("").filter((L) => !rule.letters.includes(L) && cnt[L] / n < WEAK_OPTION_SHARE);
    if (weak.length) notes.push({ kind: "weak", letters: weak });
  }
  return notes;
}
const noteText = (nt) => (nt.kind === "miskey" ? `Check the key: ${nt.letters[0]} drew more top scorers` : `Few chose ${nt.letters.join(", ")}`);

// Sheets that are scored but have the wrong printed size: left out of item analysis.
function excludedFromAnalysis(section = null) {
  return state.sheets.filter((sh) => scoreOf(sh) && !rightSize(sh) && (section === null || secOf(sh) === section));
}

// section: null = every section, or a section name. Returns one entry per answer-key set.
function analyze(section = null) {
  const groups = {};
  state.sheets.forEach((sh) => {
    if (!rightSize(sh) || (section !== null && secOf(sh) !== section)) return;
    const sc = scoreOf(sh);
    if (!sc) return;
    (groups[sc.set] = groups[sc.set] || []).push({ sh, score: sc.score });
  });
  return Object.keys(groups).sort().map((set) => {
    const list = groups[set].sort((a, b) => b.score - a.score);
    const key = state.test.keys[set], n = list.length;
    const g = n >= 4 ? Math.max(1, Math.round(n * 0.27)) : 0;
    const upper = list.slice(0, g), lower = list.slice(n - g);
    const items = [];
    for (let i = 0; i < Math.min(key.length, state.test.size); i++) {
      const k = key[i];
      if (!k || k === "-") continue;
      const cnt = { A: 0, B: 0, C: 0, D: 0, none: 0 };
      list.forEach(({ sh }) => { const a = sh.answers[i]; if (cnt[a] !== undefined) cnt[a]++; else cnt.none++; });
      const rule = ruleFor(set, i), fix = fixOf(set, i);
      if (!rule) { items.push({ no: i + 1, key: k, accept: "", cnt, correct: 0, p: null, d: null, fix, dropped: true, notes: [] }); continue; }
      const right = ({ sh }) => isRight(rule, sh.answers[i] || "");
      const correct = list.filter(right).length, p = correct / n;
      let d = null;
      if (g) d = (upper.filter(right).length - lower.filter(right).length) / g;
      items.push({ no: i + 1, key: k, accept: rule.label, cnt, correct, p, d, fix, dropped: false, notes: itemNotes(rule, cnt, upper, i, n) });
    }
    return { set, n, g, items, rel: reliability(list.map((x) => x.score), items) };
  });
}
