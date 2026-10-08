// js/ui/render-results.js — panel 3: key warnings, summary counts and the student results table.

function renderResults() {
  const showSec = sectionsList().length > 0;
  const sheets = [...state.sheets].sort((a, b) => secOf(a).localeCompare(secOf(b), undefined, { numeric: true }) || (a.classNo || "99z").localeCompare(b.classNo || "99z"));
  const scored = sheets.map((s) => scoreOf(s)).filter(Boolean);
  const needCheck = sheets.filter((s) => issuesOf(s).length).length;
  const om = mpsOf(scored);
  const mps = om ? om.mps.toFixed(2) + "%" : "—";
  const best = scored.length ? Math.max(...scored.map((s) => s.score)) : null;
  const kp = keyProblems();
  $("#keyWarn").hidden = !kp.length;
  $("#keyWarn").innerHTML = kp.map((t) => `<p>${esc(t)}</p>`).join("");
  $("#stats").innerHTML = `
    <div class="stat"><b>${sheets.length}</b><span>Sheets</span></div>
    <div class="stat${needCheck ? " warn" : ""}"><b>${needCheck}</b><span>To check</span></div>
    <div class="stat"><b>${mps}</b><span>MPS</span></div>
    <div class="stat"><b>${best == null ? "—" : best}</b><span>Highest</span></div>`;
  $("#sampleBanner").hidden = !state.sheets.some((s) => s.sample);
  $("#resAside").textContent = state.test.name || "";
  $("#thead").innerHTML = `<tr>${showSec ? "<th>Section</th>" : ""}<th class="num">Class No.</th><th>Name</th><th>Set</th><th class="num">Score</th><th>Status</th></tr>`;
  const q = state.search.trim().toLowerCase();
  const shown = sheets.filter((s) => (!state.onlyIssues || issuesOf(s).length)
    && (!q || (s.name || "").toLowerCase().includes(q) || (s.classNo || "").includes(q) || secOf(s).toLowerCase().includes(q)));
  $("#onlyIssues").checked = state.onlyIssues;
  $("#searchNote").textContent = q || state.onlyIssues ? `Showing ${shown.length} of ${sheets.length}` : "";
  const tb = $("#tbody");
  if (sheets.length && !shown.length) {
    tb.innerHTML = `<tr><td colspan="${showSec ? 6 : 5}" class="empty">No sheet matches${q ? ` "${esc(state.search.trim())}"` : ""}${state.onlyIssues ? " among the sheets to check" : ""}.</td></tr>`;
    return;
  }
  if (!sheets.length) {
    tb.innerHTML = `<tr><td colspan="${showSec ? 6 : 5}" class="empty">No sheets yet. Take a photo of a filled answer sheet in step 2.</td></tr>`;
    return;
  }
  tb.innerHTML = shown.map((s) => {
    const sc = scoreOf(s), iss = issuesOf(s).sort((a, b) => (b.c === "bad") - (a.c === "bad")); // worst problem shown first
    const status = iss.length ? `<span class="chip ${iss.some((i) => i.c === "bad") ? "bad" : "warn"}">${esc(iss[0].t)}${iss.length > 1 ? ` +${iss.length - 1}` : ""}</span>` : s.edited ? `<span class="chip">Checked</span>` : `<span class="chip">Ready</span>`;
    return `<tr data-id="${s.id}" aria-selected="${s.id === state.selected}" tabindex="0">
      ${showSec ? `<td>${secOf(s) ? esc(secOf(s)) : `<span class="hint">–</span>`}</td>` : ""}
      <td class="num mono">${esc(s.classNo || "??")}</td>
      <td>${s.name ? esc(s.name) : `<span class="hint">${s.sample ? "Sample student" : "No name yet"}</span>`}</td>
      <td>${esc(s.set || "–")}</td>
      <td class="num">${sc ? `<b>${sc.score}</b> / ${sc.total}` : `<span class="hint">no key</span>`}</td>
      <td>${status}</td></tr>`;
  }).join("");
}
