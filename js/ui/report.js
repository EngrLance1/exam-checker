// js/ui/report.js — the printable report (MPS, scores, distribution, item analysis). Built into #printArea, shown only when printing.

function reportMpsRow(label, m) {
  return `<tr><td>${label}</td><td class="num">${m.n}</td><td class="num">${Math.round(m.items)}</td><td class="num">${m.mean.toFixed(2)}</td><td class="num"><b>${m.mps.toFixed(2)}%</b></td><td>${m.level}</td></tr>`;
}

function reportScoreList(withNames, hasSec) {
  const sheets = [...state.sheets].filter((s) => !s.sample && scoreOf(s))
    .sort((a, b) => secOf(a).localeCompare(secOf(b), undefined, { numeric: true }) || (a.classNo || "99z").localeCompare(b.classNo || "99z"));
  if (!sheets.length) return "";
  const rows = sheets.map((s) => {
    const r = scoreOf(s), pct = r.total ? (r.score / r.total) * 100 : 0;
    return `<tr>${hasSec ? `<td>${esc(secOf(s))}</td>` : ""}<td class="num">${esc(s.classNo || "??")}</td>${withNames ? `<td>${esc(s.name)}</td>` : ""}<td>${esc(s.set || "–")}</td><td class="num">${r.score} / ${r.total}</td><td class="num">${pct.toFixed(1)}%</td><td>${masteryLevel(pct)}</td></tr>`;
  }).join("");
  return `<h2>Scores</h2><table><thead><tr>${hasSec ? "<th>Section</th>" : ""}<th class="num">Class No.</th>${withNames ? "<th>Name</th>" : ""}<th>Set</th><th class="num">Score</th><th class="num">Percent</th><th>Mastery level</th></tr></thead><tbody>${rows}</tbody></table>`;
}

function reportAnalysis() {
  const groups = analyze();
  if (!groups.length) return "";
  const left = excludedFromAnalysis();
  const parts = groups.map((gr) => {
    const rows = gr.items.map((it) => {
      const dec = it.dropped ? "Dropped" : decision(it.p, it.d);
      const extra = [...it.notes.map(noteText), it.fix ? fixText(it.fix, it.key) : ""].filter(Boolean).join("; ");
      return `<tr><td class="num">${it.no}</td><td>${it.dropped ? it.key : it.accept}</td><td class="num">${it.cnt.A}</td><td class="num">${it.cnt.B}</td><td class="num">${it.cnt.C}</td><td class="num">${it.cnt.D}</td><td class="num">${it.cnt.none}</td>
        <td class="num">${it.dropped ? "—" : it.p.toFixed(2)}</td><td>${it.dropped ? "—" : pLevel(it.p)}</td><td class="num">${it.d == null ? "—" : it.d.toFixed(2)}</td><td>${it.d == null ? "—" : dLevel(it.d)}</td><td><b>${dec}</b></td><td>${esc(extra)}</td></tr>`;
    }).join("");
    return `<h3>Set ${gr.set} · ${gr.n} student${gr.n > 1 ? "s" : ""}${gr.g ? ` · upper and lower groups of ${gr.g}` : ""}</h3>
      <p class="meta">${esc(reliabilityText(gr))}</p>
      <table class="ia"><thead><tr><th class="num">Item</th><th>Key</th><th class="num">A</th><th class="num">B</th><th class="num">C</th><th class="num">D</th><th class="num">Blank</th><th class="num">p</th><th>Difficulty</th><th class="num">D</th><th>Discrimination</th><th>Decision</th><th>Notes</th></tr></thead><tbody>${rows}</tbody></table>`;
  }).join("");
  return `<section class="pagebreak"><h2>Item analysis</h2>${sectionsList().length > 1 ? `<p class="meta">All sections together.</p>` : ""}
    ${left.length ? `<p class="meta">${left.length} sheet(s) on the wrong sheet size were left out.</p>` : ""}${parts}
    <div class="guide"><b>How to read this</b>
      <p>p (difficulty) = students who got the item right ÷ students: 0.81–1.00 very easy · 0.61–0.80 easy · 0.41–0.60 average · 0.21–0.40 difficult · 0.00–0.20 very difficult.</p>
      <p>D (discrimination) = (upper 27% right − lower 27% right) ÷ group size: 0.40 and up very good · 0.30–0.39 good · 0.20–0.29 fair · below 0.20 poor.</p>
      <p>Decision: Retain if D ≥ 0.30 and p is 0.21–0.80; Reject if D is below 0.20; otherwise Revise.</p>
      <p>Check the key: a wrong option was picked by ${MISKEY_MIN_UPPER}+ upper-group students and more than the right answer. Few chose: under ${WEAK_OPTION_SHARE * 100}% picked the option (classes of ${WEAK_OPTION_MIN_N}+ only).</p>
      <p>KR-20 shows how consistently the items measure the same thing; about 0.70 or more is commonly taken as acceptable for a classroom test. SEM is the likely error in a score, in points.</p></div></section>`;
}

function buildReportHTML(withNames) {
  const R = mpsReport(), o = R.overall;
  const hasSec = sectionsList().length > 0;
  const date = new Date().toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" });
  const multiSec = R.sections.length > 1, multiSets = R.sets.length > 1;
  const rows = (multiSec ? R.sections.map(({ name, m }) => reportMpsRow(esc(name), m)).join("") : "")
    + (multiSets ? R.sets.map(({ set, m }) => reportMpsRow(`Set ${set}`, m)).join("") : "")
    + reportMpsRow(`<b>${multiSec && multiSets ? "All" : multiSec ? "All sections" : multiSets ? "All sets" : R.sets[0] ? "Set " + R.sets[0].set : "Class"}</b>`, o);
  const low = R.items.filter((i) => i.mps < R.target).sort((a, b) => a.mps - b.mps);
  return `<header class="rep-head"><h1>${esc(state.test.name || "Test results")}</h1>
      <p class="meta">${date} · ${o.n} student${o.n > 1 ? "s" : ""} · ${state.test.size} items · Target MPS ${R.target}% · SagotScan</p></header>
    <section><h2>Mean Percentage Score</h2>
      <p class="big">${o.mps.toFixed(2)}%<span> ${o.level}</span></p>
      <p class="meta">SD ${o.sd.toFixed(2)} · Highest ${o.hi} · Lowest ${o.lo} · ${o.passed} of ${o.n} scored ${R.target}% or higher · MPS = total of scores ÷ (students × items) × 100</p>
      <table><thead><tr><th>Group</th><th class="num">Students</th><th class="num">Items</th><th class="num">Mean</th><th class="num">MPS</th><th>Mastery level</th></tr></thead><tbody>${rows}</tbody></table></section>
    <section><h2>Score distribution</h2>${distributionTable(R.dist)}</section>
    <section><h2>Least mastered items (item MPS below ${R.target}%)</h2>${low.length
      ? `<p>${low.map((i) => `${multiSets ? i.set + "-" : ""}#${i.no} (${Math.round(i.mps)}%)`).join(", ")}</p>` : `<p>Every item reached ${R.target}%.</p>`}</section>
    <section>${reportScoreList(withNames, hasSec)}</section>
    ${reportAnalysis()}`;
}

// Fills the hidden print area and opens the browser's print dialog. The screen itself is never hidden.
function printReport(withNames) {
  if (!mpsReport().overall) { toast("Scan at least one sheet and enter an answer key first."); return; }
  const area = $("#printArea");
  area.innerHTML = buildReportHTML(withNames);
  $("#printBar").hidden = true;
  try { window.print(); } catch (e) { toast("Printing isn't available here. Open the page in your browser to print."); }
}
