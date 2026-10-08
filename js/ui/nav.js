// js/ui/nav.js — pages (sidebar), the top bar (test title, search, attention bell) and the small ⋯ menus.

const VIEWS = ["dashboard", "setup", "scan", "scores", "analysis", "reports"];

function showView(name, opts = {}) {
  if (!VIEWS.includes(name)) name = "dashboard";
  state.view = name;
  VIEWS.forEach((v) => { $("#view-" + v).hidden = v !== name; });
  document.querySelectorAll(".nav-item[data-view]").forEach((b) => {
    if (b.dataset.view === name) b.setAttribute("aria-current", "page"); else b.removeAttribute("aria-current");
  });
  if (!opts.noHash && location.hash !== "#" + name) { try { history.pushState(null, "", "#" + name); } catch (e) {} }
  if (name === "dashboard") renderDashboard();
  if (!opts.keepScroll) window.scrollTo(0, 0);
}

// Keeps the parts of the shell that mirror the data: test title, avatar, nav badge, attention dot.
function renderNav() {
  const name = state.test.name.trim();
  $("#topTitle").textContent = name || "Untitled test";
  document.title = name ? `${name} · SagotScan` : "SagotScan";
  $("#topAvatar").innerHTML = name ? esc(initialsOf(name, "")) : icon("setup");
  const n = state.sheets.length, badge = $("#navBadge");
  badge.hidden = !n; badge.textContent = n;
  badge.setAttribute("aria-label", `${n} sheet${n === 1 ? "" : "s"}`);
  const flagged = attentionList().length;
  $("#attnDot").hidden = !flagged;
  $("#attnBtn").setAttribute("aria-label", flagged ? `${flagged} thing${flagged > 1 ? "s" : ""} need attention` : "Nothing needs attention");
}

document.querySelectorAll(".nav-item[data-view]").forEach((b) => b.addEventListener("click", () => showView(b.dataset.view)));
window.addEventListener("popstate", () => showView(location.hash.slice(1), { noHash: true }));

// A button with data-proxy="#id" does what clicking #id does (one real button, several places to reach it).
document.addEventListener("click", (e) => {
  const p = e.target.closest("[data-proxy]");
  if (!p) return;
  closeMenus();
  const target = $(p.dataset.proxy);
  if (target) target.click();
});

$("#attnBtn").addEventListener("click", () => { showView("dashboard"); $("#cardAttn").scrollIntoView({ block: "center" }); });

$("#searchInput").addEventListener("input", (e) => {
  state.search = e.target.value;
  if (state.search.trim() && state.view !== "scores") showView("scores", { keepScroll: true });
  renderResults();
});
$("#onlyIssues").addEventListener("change", (e) => { state.onlyIssues = e.target.checked; renderResults(); });

/* ---- ⋯ menus ---- */
function closeMenus(except) {
  document.querySelectorAll(".menu-wrap").forEach((w) => {
    if (w === except) return;
    w.querySelector(".menu").hidden = true;
    w.querySelector("[data-menu]").setAttribute("aria-expanded", "false");
  });
}
document.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-menu]");
  if (btn) {
    const wrap = btn.closest(".menu-wrap"), menu = wrap.querySelector(".menu"), open = menu.hidden;
    closeMenus(wrap);
    menu.hidden = !open; btn.setAttribute("aria-expanded", String(open));
    if (open) menu.querySelector(".menu-item").focus();
    return;
  }
  if (!e.target.closest(".menu")) closeMenus();
});
document.addEventListener("keydown", (e) => {
  const open = [...document.querySelectorAll(".menu-wrap")].find((w) => !w.querySelector(".menu").hidden);
  if (!open) return;
  if (e.key === "Escape") { e.preventDefault(); const b = open.querySelector("[data-menu]"); closeMenus(); b.focus(); }
  if (e.key === "ArrowDown" || e.key === "ArrowUp") {
    e.preventDefault();
    const items = [...open.querySelectorAll(".menu-item")], i = items.indexOf(document.activeElement);
    items[(i + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length].focus();
  }
});
