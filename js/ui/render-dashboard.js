// js/ui/render-dashboard.js — the Dashboard page: three stat cards, the item chart, needs-attention, recent activity, top scores.
// Everything shown is computed from the scanned sheets (js/core/dashboard.js). Nothing is invented.

const icon = (n) => `<svg class="ic" aria-hidden="true"><use href="#i-${n}"/></svg>`;
const pct0 = (v) => `${Math.round(v)}%`;

let chartActive = null;   // item index the chart cursor is on
let chartData = null;     // what the chart is drawing right now

function statCard(el, title, main, extra, viz, foot) {
  el.innerHTML = `<div class="card-head"><h2 class="card-title">${title}</h2></div>
    <div class="stat-body"><div class="stat-main"><span class="big">${main}</span>${extra || ""}</div><div class="stat-viz">${viz || ""}</div></div>
    ${foot ? `<p class="muted-sm">${foot}</p>` : ""}`;
}

function renderStatCards(d) {
  const toCheck = d.toCheck
    ? `<span class="pill warn">${d.toCheck} to check</span>`
    : d.sheets ? `<span class="pill ok">All clear</span>` : "";
  statCard($("#cardSheets"), "Sheets scanned", d.sheets, toCheck, d.sheets ? sparkBarsSVG(d.bands) : "",
    d.sheets ? "Students by mastery level" : "Scan a sheet to get started.");
  statCard($("#cardMps"), "Class MPS", d.mps == null ? "—" : `${d.mps.toFixed(1)}%`, "",
    d.mps == null ? "" : donutSVG(d.mps), d.mps == null ? "Needs an answer key and a scanned sheet." : `${esc(d.level)} · target ${d.target}%`);
  const t = d.atTarget;
  statCard($("#cardTarget"), "At or above target", t ? pct0(t.pct) : "—",
    t ? `<span class="pill ${t.pct >= 50 ? "ok" : "warn"}">${t.n} of ${t.of}</span>` : "",
    t ? `<div class="bar-track" role="img" aria-label="${t.n} of ${t.of} students at or above ${d.target} percent"><i style="width:${t.pct}%"></i></div>` : "",
    t ? `Students scoring ${d.target}% or higher` : "Shows once sheets are scored.");
}

/* ---------- chart ---------- */
function chartSeries(items) {
  return [
    { id: "gradP", color: "--primary", values: items.map((it) => it.p * 100) },
    { id: "gradD", color: "--violet", values: items.map((it) => (it.d == null ? null : it.d * 100)) },
  ];
}
function defaultActive(items) {
  let best = -1, low = Infinity;
  items.forEach((it, i) => { if (it.d != null && it.d < low) { low = it.d; best = i; } });
  return best >= 0 ? best : Math.max(0, items.length - 1);
}

function drawChart() {
  const box = $("#chartBox");
  if (!box || !chartData) return;
  const items = chartData.items, W = box.clientWidth;
  if (!items.length || !W) return;
  if (chartActive == null || chartActive >= items.length) chartActive = defaultActive(items);
  const { svg, geo } = areaChartSVG({
    width: W, height: 250, labels: items.map((it) => it.no), series: chartSeries(items),
    yMin: 0, yMax: 100, yTicks: [0, 25, 50, 75, 100], xEvery: Math.max(1, Math.ceil(items.length / Math.max(4, Math.floor(W / 46)))), active: chartActive,
  });
  box.querySelector(".chart-plot").innerHTML = svg;
  const it = items[chartActive], tip = $("#chartTip");
  tip.innerHTML = `<b>Item ${it.no}</b><span>Difficulty ${Math.round(it.p * 100)}%</span><span>${it.d == null ? "Discrimination needs 4+ students" : `D ${it.d.toFixed(2)}`}</span>`;
  const x = geo.x[chartActive], yTop = Math.min(...geo.y.map((s) => (s[chartActive] == null ? 1e9 : s[chartActive])));
  const tw = tip.offsetWidth || 150;
  tip.style.left = `${Math.max(geo.left, Math.min(x - tw / 2, geo.right - tw))}px`;
  tip.style.top = `${Math.max(0, (yTop === 1e9 ? 60 : yTop) - tip.offsetHeight - 14)}px`;
  box.dataset.geo = JSON.stringify({ x: geo.x });
  $("#chartLive").textContent = `Item ${it.no}: difficulty ${Math.round(it.p * 100)} percent${it.d == null ? "" : `, discrimination ${it.d.toFixed(2)}`}`;
}

function moveChart(i) {
  if (!chartData || !chartData.items.length) return;
  chartActive = Math.max(0, Math.min(chartData.items.length - 1, i));
  drawChart();
}

function renderChartCard(d) {
  const el = $("#cardChart"), c = d.chart;
  chartData = c;
  if (!c.items.length) {
    el.innerHTML = `<div class="card-head"><h2 class="card-title">Item analysis overview</h2></div>
      <div class="empty-state">${icon("chart")}<p><b>No items to chart yet.</b></p><p class="muted-sm">Enter an answer key and scan sheets to see how hard each item was and how well it separated strong and weak students.</p></div>`;
    return;
  }
  const tabs = c.sets.length > 1 ? `<div class="set-tabs" role="group" aria-label="Answer key set">${c.sets.map((s) => `<button type="button" class="tab${s === c.set ? " on" : ""}" data-chart-set="${s}" aria-pressed="${s === c.set}">Set ${s}</button>`).join("")}</div>` : "";
  el.innerHTML = `<div class="card-head"><h2 class="card-title">Item analysis overview</h2>
      <div class="mini-stats"><div><span class="muted-sm">Mean score</span><strong>${c.mean == null ? "—" : c.mean.toFixed(1)}</strong></div><div><span class="muted-sm">KR-20</span><strong>${c.kr20 == null ? "—" : c.kr20.toFixed(2)}</strong></div></div></div>
    ${tabs}
    <div class="chart-box" id="chartBox" tabindex="0" role="group" aria-label="Chart of difficulty and discrimination for ${c.items.length} items in Set ${c.set}. Use the left and right arrow keys to move between items." >
      <div class="chart-plot"></div><div class="chart-tip" id="chartTip" aria-hidden="true"></div>
    </div>
    <p class="sr" id="chartLive" aria-live="polite"></p>
    ${c.n < 4 ? `<p class="muted-sm chart-note">Only ${c.n} student${c.n === 1 ? "" : "s"} scanned, so each item shows 0% or 100% and discrimination is not available yet. Scan a few more sheets for a useful picture.</p>` : ""}
    <ul class="legend-row"><li><i style="background:var(--primary)"></i>Difficulty (% who got it right)</li><li><i style="background:var(--violet)"></i>Discrimination (D × 100, negative shown at 0)</li></ul>`;
  drawChart();
}

/* ---------- lists ---------- */
const LVL = { bad: ["bad", "Urgent"], warn: ["warn", "Check"], info: ["info", "Review"] };

function renderAttention(d) {
  const el = $("#cardAttn"), list = d.attention;
  const rows = list.slice(0, 3).map((a) => {
    const [cls, label] = LVL[a.level];
    const goto = a.id ? `data-sheet="${esc(a.id)}"` : /answer key/i.test(a.title) && !/Check the/.test(a.title) ? `data-goto="setup"` : `data-goto="analysis"`;
    return `<li class="dl lvl-${cls}"><button type="button" class="dl-btn" ${goto}><span class="dl-main"><b>${esc(a.title)}</b><span class="muted-sm">${esc(a.detail)}</span></span><span class="pill ${cls}">${label}</span></button></li>`;
  }).join("");
  el.innerHTML = `<div class="card-head"><h2 class="card-title">Needs attention</h2>${list.length ? `<span class="muted-sm">${list.length} item${list.length > 1 ? "s" : ""}</span>` : ""}</div>
    ${list.length ? `<ul class="deadlines">${rows}</ul><div class="center"><button type="button" class="btn primary pill" id="attnAll">View all</button></div>`
      : `<div class="empty-state ok">${icon("check")}<p><b>Nothing to check.</b></p><p class="muted-sm">Every sheet is ready and the answer keys look complete.</p></div>`}`;
}

function renderRecent(d) {
  const el = $("#cardRecent");
  el.innerHTML = `<div class="card-head"><h2 class="card-title">Recent activity</h2></div>` + (d.recent.length
    ? `<ul class="rows">${d.recent.map((r) => `<li><button type="button" class="row-btn" data-sheet="${esc(r.id)}"><span class="ico tint-blue">${icon("camera")}</span><span class="row-main"><span>${esc(r.text)}${r.sample ? " (sample)" : ""}</span><span class="muted-sm">${esc(r.sub)}</span></span><span class="muted-sm time">${esc(r.time)}</span></button></li>`).join("")}</ul>`
    : `<div class="empty-state">${icon("camera")}<p><b>No sheets scanned yet.</b></p><p class="muted-sm">Scanned sheets appear here, newest first.</p></div>`);
}

function renderTop(d) {
  const el = $("#cardTop");
  el.innerHTML = `<div class="card-head"><h2 class="card-title">Top scores</h2></div>` + (d.top.length
    ? `<ul class="rows">${d.top.map((t, i) => `<li><button type="button" class="row-btn" data-sheet="${esc(t.id)}"><span class="avatar sm t${i % 3}" aria-hidden="true">${esc(initialsOf(t.name, t.classNo))}</span><span class="row-main"><b>${esc(t.name || `Class No. ${t.classNo || "??"}`)}</b><span class="status"><i class="dot-green" aria-hidden="true"></i>${t.score} / ${t.total} · ${pct0(t.pct)}</span></span></button></li>`).join("")}</ul>`
    : `<div class="empty-state">${icon("users")}<p><b>No scores yet.</b></p><p class="muted-sm">The five highest scores show here.</p></div>`);
}

function renderDashboard() {
  const d = dashboardData(state.chartSet);
  renderStatCards(d);
  renderChartCard(d);
  renderAttention(d);
  renderRecent(d);
  renderTop(d);
}

// Chart interaction: pointer, keyboard, set tabs. Dashboard clicks: open a sheet or a page.
$("#view-dashboard").addEventListener("click", (e) => {
  const tab = e.target.closest("[data-chart-set]");
  if (tab) { state.chartSet = tab.dataset.chartSet; chartActive = null; renderDashboard(); return; }
  const sheet = e.target.closest("[data-sheet]");
  if (sheet) { showView("scores"); selectRow(sheet.dataset.sheet); return; }
  const go = e.target.closest("[data-goto]");
  if (go) { showView(go.dataset.goto); return; }
  if (e.target.closest("#attnAll")) { state.onlyIssues = state.sheets.some((s) => issuesOf(s).length); showView(state.onlyIssues ? "scores" : "analysis"); renderResults(); }
});
$("#view-dashboard").addEventListener("pointermove", (e) => {
  const box = e.target.closest("#chartBox");
  if (!box || !chartData || !box.dataset.geo) return;
  const xs = JSON.parse(box.dataset.geo).x, px = e.clientX - box.getBoundingClientRect().left;
  let best = 0;
  xs.forEach((x, i) => { if (Math.abs(x - px) < Math.abs(xs[best] - px)) best = i; });
  if (best !== chartActive) moveChart(best);
});
$("#view-dashboard").addEventListener("keydown", (e) => {
  if (!e.target.closest("#chartBox")) return;
  const k = { ArrowLeft: -1, ArrowRight: 1 }[e.key];
  if (k) { e.preventDefault(); moveChart((chartActive == null ? 0 : chartActive) + k); }
  else if (e.key === "Home") { e.preventDefault(); moveChart(0); }
  else if (e.key === "End") { e.preventDefault(); moveChart(1e6); }
});
if (window.ResizeObserver) {
  let raf = 0;
  new ResizeObserver(() => { cancelAnimationFrame(raf); raf = requestAnimationFrame(drawChart); }).observe($("#cardChart"));
}
