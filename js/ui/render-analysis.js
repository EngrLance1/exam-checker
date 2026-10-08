// js/ui/render-analysis.js — panel 6: item analysis tables, with a Fix control and notes for each item.

function fixOptions(it, set) {
  const cur = it.fix ? (it.fix.letter ? `${it.fix.type}:${it.fix.letter}` : it.fix.type) : "";
  const opts = [["", "No fix"]];
  LET.split("").filter((L) => L !== it.key).forEach((L) => opts.push([`also:${L}`, `Also accept ${L}`]));
  LET.split("").filter((L) => L !== it.key).forEach((L) => opts.push([`key:${L}`, `Change key to ${L}`]));
  opts.push(["credit", "Credit everyone"], ["drop", "Drop item"]);
  return `<select class="fixsel${it.fix ? " on" : ""}" id="fx-${set}-${it.no}" data-set="${set}" data-no="${it.no}" aria-label="Fix for item ${it.no}">`
    + opts.map(([v, t]) => `<option value="${v}"${v === cur ? " selected" : ""}>${t}</option>`).join("") + `</select>`;
}

// One line about test reliability for a set, or why it is missing.
function reliabilityText(gr) {
  if (!gr.rel) return `KR-20 reliability needs ${KR20_MIN_STUDENTS}+ students with different scores.`;
  return `KR-20 reliability ${gr.rel.kr20.toFixed(2)} · SEM ${gr.rel.sem.toFixed(2)} points · SD ${gr.rel.sd.toFixed(2)}`;
}

function renderIaFilter() {
  const secs = sectionsList(), box = $("#iaFilter"), sel = $("#iaSection");
  box.hidden = secs.length < 2;
  if (state.iaSection && !secs.includes(state.iaSection)) state.iaSection = "";
  sel.innerHTML = `<option value="">All sections</option>` + secs.map((s) => `<option value="${esc(s)}"${s === state.iaSection ? " selected" : ""}>${esc(s)}</option>`).join("");
}

function renderAnalysis() {
  renderIaFilter();
  const section = state.iaSection || null;
  const groups = analyze(section);
  const box = $("#ia");
  const wasOpen = new Set([...box.querySelectorAll("details.ia[open]")].map((d) => d.dataset.set));
  const focusId = box.contains(document.activeElement) ? document.activeElement.id : "";
  const left = excludedFromAnalysis(section);
  const leftNote = left.length ? `<p class="hint">${left.length} sheet${left.length > 1 ? "s" : ""} on the wrong sheet size ${left.length > 1 ? "are" : "is"} left out of this analysis (a ${state.test.size}-item test uses the ${sheetSizeFor(state.test.size)}-item sheet).</p>` : "";
  if (!groups.length) { box.innerHTML = `${leftNote}<p class="hint">Enter an answer key and scan sheets to see the difficulty and discrimination of each item.</p>`; return; }
  box.innerHTML = leftNote + groups.map((gr) => {
    const rows = gr.items.map((it) => {
      const dec = it.dropped ? "Dropped" : decision(it.p, it.d);
      const cls = dec === "Retain" ? "" : dec === "Revise" ? "warn" : dec === "Reject" ? "bad" : "plain";
      const notes = it.notes.map((n) => `<span class="note">${esc(noteText(n))}</span>`).join("");
      return `<tr${it.fix ? ' class="fixed"' : ""}><td class="num mono">${it.no}</td><td class="mono">${it.dropped ? it.key : it.accept}</td>
        <td class="num mono">${it.cnt.A}</td><td class="num mono">${it.cnt.B}</td><td class="num mono">${it.cnt.C}</td><td class="num mono">${it.cnt.D}</td><td class="num mono">${it.cnt.none}</td>
        <td class="num">${it.dropped ? "—" : it.p.toFixed(2)}</td><td>${it.dropped ? "—" : pLevel(it.p)}</td>
        <td class="num">${it.d == null ? "—" : it.d.toFixed(2)}</td><td>${it.d == null ? "—" : dLevel(it.d)}</td>
        <td><span class="chip ${cls}">${dec}</span>${notes}</td>
        <td>${fixOptions(it, gr.set)}</td></tr>`;
    }).join("");
    const counts = { Retain: 0, Revise: 0, Reject: 0 };
    gr.items.forEach((it) => { if (it.dropped) return; const d = decision(it.p, it.d); if (counts[d] !== undefined) counts[d]++; });
    const fixed = gr.items.filter((it) => it.fix).length;
    const open = wasOpen.size ? wasOpen.has(gr.set) : groups.length === 1;
    return `<details class="ia" data-set="${gr.set}"${open ? " open" : ""}>
      <summary>Set ${gr.set} · ${gr.n} student${gr.n > 1 ? "s" : ""}${gr.g ? ` · upper and lower groups of ${gr.g}` : ""} · ${counts.Retain} retain, ${counts.Revise} revise, ${counts.Reject} reject${fixed ? ` · ${fixed} fixed` : ""}</summary>
      ${gr.g ? "" : `<p class="hint">Discrimination needs at least 4 students with this set.</p>`}
      <p class="rel">${esc(reliabilityText(gr))}</p>
      <div class="tablewrap" style="margin-top:10px"><table>
        <thead><tr><th class="num">Item</th><th>Key</th><th class="num">A</th><th class="num">B</th><th class="num">C</th><th class="num">D</th><th class="num">Blank</th><th class="num">p</th><th>Difficulty</th><th class="num">D</th><th>Discrimination</th><th>Decision</th><th>Fix</th></tr></thead>
        <tbody>${rows}</tbody></table></div>
    </details>`;
  }).join("");
  if (focusId) { const el = document.getElementById(focusId); if (el) el.focus(); }
}
