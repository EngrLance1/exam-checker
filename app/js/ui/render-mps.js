// js/ui/render-mps.js — panel 4: Mean Percentage Score and score distribution, then renderAll() which redraws every panel.

function mpsRow(label, m) {
  return `<tr><td>${label}</td><td class="num">${m.n}</td><td class="num">${Math.round(m.items)}</td><td class="num">${m.sum}</td><td class="num">${m.mean.toFixed(2)}</td><td class="num"><b>${m.mps.toFixed(2)}%</b></td><td><span class="chip ${levelClass(m.mps)}">${m.level}</span></td></tr>`;
}

function distributionTable(dist) {
  return `<table class="dist"><thead><tr><th>Percent score</th><th>Mastery level</th><th class="num">Students</th><th class="num">%</th><th><span class="sr">Share of class</span></th></tr></thead><tbody>${
    dist.map((b) => `<tr><td class="mono">${b.range}</td><td>${b.level}</td><td class="num">${b.count}</td><td class="num">${b.pct.toFixed(0)}%</td><td class="bar"><i style="width:${b.pct}%" aria-hidden="true"></i></td></tr>`).join("")
  }</tbody></table>`;
}

function renderMPS() {
  const box = $("#mpsBox"), rep = mpsReport(), o = rep.overall, tg = rep.target;
  $("#mpsAside").textContent = `Target: ${tg}%`;
  if (!o) { box.innerHTML = `<p class="hint">Enter an answer key and scan sheets to compute the MPS.</p>`; return; }
  const multiSets = rep.sets.length > 1, multiSec = rep.sections.length > 1;
  const secRows = multiSec ? rep.sections.map(({ name, m }) => mpsRow(esc(name), m)).join("") : "";
  const setRows = multiSets ? rep.sets.map(({ set, m }) => mpsRow(`Set ${set}`, m)).join("") : "";
  const total = multiSec && multiSets ? "All" : multiSec ? "All sections" : multiSets ? "All sets" : rep.sets[0] ? "Set " + rep.sets[0].set : "Class";
  const low = rep.items.filter((i) => i.mps < tg).sort((a, b) => a.mps - b.mps);
  box.innerHTML = `<div class="mps">
    <div class="mps-big">
      <span class="lbl" style="margin:0">Class MPS</span>
      <span class="v">${o.mps.toFixed(2)}%</span>
      <div class="meter" role="img" aria-label="MPS ${o.mps.toFixed(1)} percent against a ${tg} percent target"><i style="width:${Math.min(100, o.mps)}%"></i><b style="left:${tg}%"></b></div>
      <span><span class="chip ${levelClass(o.mps)}">${o.level}</span></span>
      <span class="f">MPS = total of scores ÷ (students × items) × 100</span>
    </div>
    <div style="display:flex;flex-direction:column;gap:12px;min-width:0">
      <div class="tablewrap"><table>
        <thead><tr><th>Group</th><th class="num">Students</th><th class="num">Items</th><th class="num">Total score</th><th class="num">Mean</th><th class="num">MPS</th><th>Mastery level</th></tr></thead>
        <tbody>${secRows}${setRows}${mpsRow(`<b>${total}</b>`, o)}</tbody>
      </table></div>
      <p class="hint" style="font-variant-numeric:tabular-nums">SD ${o.sd.toFixed(2)} · Highest ${o.hi} · Lowest ${o.lo} · ${o.passed} of ${o.n} student${o.n > 1 ? "s" : ""} scored ${tg}% or higher</p>
      <div>
        <span class="lbl">Least mastered items (item MPS below ${tg}%)</span>
        ${low.length ? `<ul class="lm">${low.slice(0, 15).map((i) => `<li>${multiSets ? i.set + "-" : ""}#${i.no} · ${Math.round(i.mps)}%</li>`).join("")}${low.length > 15 ? `<li style="background:var(--sunk);color:var(--muted)">+${low.length - 15} more in Excel</li>` : ""}</ul>` : `<p class="hint">Every item reached ${tg}%.</p>`}
      </div>
    </div>
  </div>
  <div style="margin-top:16px">
    <span class="lbl">Score distribution</span>
    <div class="tablewrap">${distributionTable(rep.dist)}</div>
  </div>`;
}

function renderAll() { renderSetup(); renderResults(); renderMPS(); renderReview(); renderAnalysis(); renderDashboard(); renderNav(); }
