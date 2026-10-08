// tests/browser-shell.js — the glass shell: navigation, dashboard cards, search, menus, chart, look, responsive, accessibility.
// Run: node tests/browser-shell.js
const { launch } = require("./helpers/browser");

(async () => {
  const b = await launch({ width: 1440, height: 900 });
  const { ev, send, check, errors, requests, sleep } = b;
  const text = (sel) => ev(`document.querySelector(${JSON.stringify(sel)}).textContent.replace(/\\s+/g, " ").trim()`);
  const visible = (sel) => ev(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); return !!e && !e.hidden && e.getClientRects().length > 0; })()`);
  const css = (sel, prop) => ev(`getComputedStyle(document.querySelector(${JSON.stringify(sel)})).getPropertyValue(${JSON.stringify(prop)})`);
  const key = (k, code) => send("Input.dispatchKeyEvent", { type: "keyDown", key: k, code, windowsVirtualKeyCode: code === "Tab" ? 9 : 0 }).then(() => send("Input.dispatchKeyEvent", { type: "keyUp", key: k, code }));
  const addClass = (n, opts = {}) => ev(`(() => {
    let seed = 7; const rnd = () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
    const wrong = { A: "B", B: "C", C: "D", D: "A" };
    for (let i = 0; i < ${n}; i++) {
      const ab = 0.3 + (i / ${n}) * 0.6;
      const answers = SAMPLE_KEY.split("").map((k) => (rnd() < ab ? k : wrong[k]));
      state.sheets.push({ id: "t" + i, size: 50, classNo: String(i + 4).padStart(2, "0"), name: ["Reyes, Ana", "Dela Cruz, Juan", "Santos, Ria", "Lim, Ben"][i % 4], section: "", set: "B", answers, flags: answers.map(() => null), pts: answers.map(() => []), r: answers.map(() => 0), w: 1, h: 1, scanned: new Date(Date.now() - (${n} - i) * 60000).toISOString() });
    }
    renderAll();
  })()`);

  try {
    /* ---- the shell, section by section ---- */
    check("the page sits inside one rounded glass window", (await css(".window", "border-radius")) === "28px" && (await css(".window", "backdrop-filter")).includes("blur"));
    check("a sky gradient is behind it, with blurred colour blobs", (await css("body", "background-image")).includes("linear-gradient") && (await ev(`document.querySelectorAll(".blob").length`)) === 3 && (await css(".blob", "filter")).includes("blur"));
    check("the sidebar lists the pages, Dashboard active", (await ev(`[...document.querySelectorAll(".nav-item[data-view] .nav-label")].map((e) => e.textContent).join("|")`)) === "Dashboard|Test setup|Scan sheets|Scores|Item analysis|Reports"
      && (await ev(`document.querySelector('.nav-item[aria-current="page"]').dataset.view`)) === "dashboard");
    check("the active nav item is a solid white pill", (await css('.nav-item[aria-current="page"]', "background-color")) === "rgb(255, 255, 255)" && (await css('.nav-item[aria-current="page"]', "border-radius")).startsWith("999"));
    check("the brand has a mark and a two-line name", (await ev(`!!document.querySelector(".brand svg.logo")`)) && (await text(".brand-name")) === "SagotScan" && (await text(".brand-sub")) === "Answer sheet checker");
    check("the top bar has an avatar, a label, the test title, search and icon buttons", (await visible("#topAvatar")) && (await text(".welcome-text .muted-sm")) === "Test" && (await visible("#searchInput")) && (await visible("#printBtn")) && (await visible("#attnBtn")));
    check("the search box is a rounded pill", (await css(".search", "border-radius")).startsWith("999"));
    check("there are three equal stat cards on the dashboard", await ev(`(() => { const w = [...document.querySelectorAll(".cards3 .stat-card")].map((e) => Math.round(e.getBoundingClientRect().width)); return w.length === 3 && Math.max(...w) - Math.min(...w) <= 1; })()`));
    check("cards are glass: translucent white, blur(18px), 18px radius, thin white border", await ev(`(() => { const c = getComputedStyle(document.querySelector(".stat-card")); return c.backdropFilter.includes("blur(18px)") && c.borderRadius === "18px" && c.borderTopWidth === "1px" && /rgba\\(255, 255, 255, 0\\.6/.test(c.borderTopColor) && /rgba\\(255, 255, 255, 0\\.6\\d*\\)/.test(c.backgroundColor); })()`));
    check("the middle row is about two thirds and one third", await ev(`(() => { const [a, c] = ["#cardChart", "#cardAttn"].map((s) => document.querySelector(s).getBoundingClientRect().width); return a / c > 1.8 && a / c < 2.2; })()`));
    check("fonts: Plus Jakarta Sans first, headings navy", (await css("body", "font-family")).startsWith('"Plus Jakarta Sans"') && (await css(".card-title", "color")) === "rgb(30, 35, 64)");
    check("no emoji and no ⋯ text glyph anywhere", await ev(`!/[\\u{1F300}-\\u{1FAFF}\\u2600-\\u27BF\\u22EF\\u2026]/u.test(document.body.innerText.replace(/…/g, ""))`));
    check("icons are inline Lucide-style SVG (no icon font, no emoji)", (await ev(`document.querySelectorAll("svg.ic use").length`)) > 15);

    /* ---- privacy: nothing is fetched from anywhere but this site ---- */
    const foreign = requests.filter((u) => !u.startsWith("file:") && !u.startsWith("data:") && !u.startsWith("about:"));
    check("the app loads nothing from other sites (no CDN, no Google Fonts)", requests.length > 20 && foreign.length === 0, JSON.stringify(foreign));
    check("the fonts are served from the app's own folder", requests.some((u) => /fonts\/PlusJakartaSans.*\.woff2$/.test(u)), JSON.stringify(requests.filter((u) => /font/i.test(u))));

    /* ---- dashboard with real data ---- */
    await ev(`document.querySelector("#clearSample").click()`);
    await sleep(100);
    check("with no sheets the cards say so instead of showing fake numbers", (await text("#cardMps")).includes("—") && (await text("#cardChart")).includes("No items to chart yet") && (await text("#cardTop")).includes("No scores yet") && (await text("#cardRecent")).includes("No sheets scanned yet") && (await text("#cardAttn")).includes("Nothing to check"));
    await ev(`state.test.keys.B = SAMPLE_KEY; state.activeSet = "B"; 0`);
    await addClass(12);
    await ev(`state.sheets.push({ ...state.sheets[2], id: "dupe", scanned: new Date().toISOString() }); renderAll()`); // a duplicate class number
    const d = await ev(`(() => { const r = mpsReport(); return { n: state.sheets.length, mps: r.overall.mps.toFixed(1), passed: r.overall.passed, of: r.overall.n }; })()`);
    check("the sheet count card matches the data", (await text("#cardSheets .big")) === String(d.n));
    check("the Class MPS card matches the data and draws a ring", (await text("#cardMps .big")) === `${d.mps}%` && (await ev(`!!document.querySelector("#cardMps svg.donut circle[stroke^='url']")`)));
    check("the ring's stroke runs blue to violet to orange with round caps", await ev(`(() => { const g = document.querySelector("#ringGrad"); const cols = [...g.querySelectorAll("stop")].map((s) => s.getAttribute("stop-color")); return cols.join() === "var(--primary),var(--violet),var(--orange)" && document.querySelector("#cardMps svg.donut circle[stroke^='url']").getAttribute("stroke-linecap") === "round"; })()`));
    check("the target card shows the share at or above target", (await text("#cardTarget .big")) === `${Math.round((d.passed / d.of) * 100)}%` && (await text("#cardTarget")).includes(`${d.passed} of ${d.of}`));
    check("the sparkline has thin rounded bars in blue and violet", await ev(`(() => { const r = [...document.querySelectorAll("#cardSheets svg.spark rect")]; return r.length === 7 && new Set(r.map((x) => x.getAttribute("fill"))).size === 2 && r.every((x) => Number(x.getAttribute("width")) < 14 && Number(x.getAttribute("rx")) > 0); })()`));
    check("a status pill says how many sheets need checking", (await text("#cardSheets .pill")).includes("to check"));

    /* ---- chart ---- */
    check("the chart draws two smooth curves and gradient fills that fade out", await ev(`(() => { const s = document.querySelector("#chartBox svg"); const strokes = [...s.querySelectorAll("path[stroke]")]; const fills = [...s.querySelectorAll("path[fill^='url']")]; const stops = [...s.querySelectorAll("linearGradient stop")].map((e) => e.getAttribute("stop-opacity")); return strokes.length >= 2 && fills.length >= 2 && strokes.every((p) => /C/.test(p.getAttribute("d")) && p.getAttribute("stroke-linecap") === "round") && stops.includes("0"); })()`));
    check("gridlines are dashed and light, with y numbers and item labels", await ev(`(() => { const s = document.querySelector("#chartBox svg"); return s.querySelectorAll("line.grid").length === 5 && getComputedStyle(s.querySelector("line.grid")).strokeDasharray !== "none" && s.querySelectorAll("text.ytick").length === 5 && s.querySelectorAll("text.xtick").length >= 5; })()`));
    check("one point shows a white rounded tooltip", (await visible("#chartTip")) && (await css("#chartTip", "background-color")) === "rgb(255, 255, 255)" && (await css("#chartTip", "border-radius")) === "12px" && (await text("#chartTip")).includes("Difficulty"));
    const tip0 = await text("#chartTip");
    await ev(`document.querySelector("#chartBox").focus()`);
    await key("ArrowLeft", "ArrowLeft");
    await sleep(100);
    check("arrow keys move the chart cursor and the tooltip", (await text("#chartTip")) !== tip0 && (await text("#chartLive")).startsWith("Item"));
    await key("Home", "Home");
    check("Home jumps to item 1", (await text("#chartTip")).startsWith("Item 1"));
    const w0 = await ev(`document.querySelector("#chartBox svg").getAttribute("width")`);
    await send("Emulation.setDeviceMetricsOverride", { width: 900, height: 900, deviceScaleFactor: 1, mobile: false });
    await sleep(500);
    check("the chart redraws to fit when the window resizes", (await ev(`document.querySelector("#chartBox svg").getAttribute("width")`)) !== w0);
    await send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
    await sleep(400);

    /* ---- needs attention ---- */
    check("Needs attention lists the duplicate as Urgent with a red edge", (await text("#cardAttn .dl")).includes("Urgent") && (await css("#cardAttn .dl.lvl-bad", "border-left-color")) === "rgb(229, 72, 77)");
    check("View all is a centred blue pill", (await text("#attnAll")) === "View all" && (await css("#attnAll", "border-radius")).startsWith("999"));
    await ev(`document.querySelector("#cardAttn .dl-btn").click()`);
    await sleep(200);
    check("clicking an item opens Scores with that sheet selected", (await visible("#view-scores")) && !(await visible("#view-dashboard")) && (await ev(`!!state.selected && !document.querySelector("#reviewPanel").hidden`)));
    check("the URL records the page (so Back works)", (await ev(`location.hash`)) === "#scores");
    await ev(`history.back()`);
    await sleep(300);
    check("Back returns to the dashboard", (await visible("#view-dashboard")) && (await ev(`document.querySelector('.nav-item[aria-current="page"]').dataset.view`)) === "dashboard");
    await ev(`document.querySelector("#attnAll").click()`);
    check("View all shows only the sheets to check", (await visible("#view-scores")) && (await ev(`document.querySelector("#onlyIssues").checked`)) && (await text("#searchNote")).startsWith("Showing"));
    await ev(`document.querySelector("#onlyIssues").click()`);

    /* ---- navigation ---- */
    for (const [v, label] of [["setup", "Test details"], ["scan", "Scan answer sheets"], ["scores", "Scores"], ["analysis", "Item analysis"], ["reports", "Class MPS"], ["dashboard", "Needs attention"]]) {
      await ev(`document.querySelector('.nav-item[data-view="${v}"]').click()`);
      const shown = await ev(`[...document.querySelectorAll(".view")].filter((e) => !e.hidden).map((e) => e.id)`);
      check(`nav → ${v}: only that page shows`, shown.length === 1 && shown[0] === `view-${v}` && (await ev(`document.querySelector('.nav-item[aria-current="page"]').dataset.view`)) === v && (await ev(`document.querySelector("#view-${v}").innerText`)).includes(label));
    }
    check("the Scores nav item shows the sheet count", (await text("#navBadge")) === String(d.n));

    /* ---- search ---- */
    await ev(`(() => { const i = document.querySelector("#searchInput"); i.value = "dela cruz"; i.dispatchEvent(new Event("input", { bubbles: true })); })()`);
    const rows = await ev(`[...document.querySelectorAll("#tbody tr[data-id]")].map((r) => r.textContent)`);
    check("typing in Search jumps to Scores and filters by name", (await visible("#view-scores")) && rows.length > 0 && rows.every((r) => /Dela Cruz/.test(r)) && (await text("#searchNote")).startsWith("Showing"));
    await ev(`(() => { const i = document.querySelector("#searchInput"); i.value = "zzz"; i.dispatchEvent(new Event("input", { bubbles: true })); })()`);
    check("no match says so plainly", (await text("#tbody")).includes('No sheet matches "zzz"'));
    await ev(`(() => { const i = document.querySelector("#searchInput"); i.value = "07"; i.dispatchEvent(new Event("input", { bubbles: true })); })()`);
    check("search also matches class numbers", (await ev(`document.querySelectorAll("#tbody tr[data-id]").length`)) >= 1);
    await ev(`(() => { const i = document.querySelector("#searchInput"); i.value = ""; i.dispatchEvent(new Event("input", { bubbles: true })); })()`);
    check("clearing Search restores every sheet", (await ev(`document.querySelectorAll("#tbody tr[data-id]").length`)) === d.n);

    /* ---- ⋯ menus ---- */
    await ev(`document.querySelector("#view-scores [data-menu]").click()`);
    check("the ⋯ button opens a glass menu and tells screen readers", (await visible("#view-scores .menu")) && (await ev(`document.querySelector("#view-scores [data-menu]").getAttribute("aria-expanded")`)) === "true" && (await css("#view-scores .menu", "border-radius")) === "14px");
    check("focus moves into the menu", await ev(`document.activeElement.classList.contains("menu-item")`));
    await key("Escape", "Escape");
    check("Escape closes it and returns focus to the button", !(await visible("#view-scores .menu")) && (await ev(`document.activeElement.hasAttribute("data-menu")`)));
    await ev(`document.querySelector("#view-scores [data-menu]").click(); document.querySelector("#clearSheetsBtn").click()`);
    check("the menu's Clear sheets asks before clearing", (await visible("#confirmBar")) && (await text("#confirmMsg")).includes("scanned sheet"));
    await ev(`document.querySelector("#confirmNo").click()`);
    await ev(`document.querySelector("#view-scores [data-menu]").click()`);
    await ev(`document.body.click()`);
    check("clicking elsewhere closes an open menu", !(await visible("#view-scores .menu")));
    await ev(`window.__dl = []; const _c = HTMLAnchorElement.prototype.click; HTMLAnchorElement.prototype.click = function () { if (this.download) { window.__dl.push(this.download); return; } return _c.call(this); }; 0`);
    await ev(`document.querySelector("#view-scores [data-menu]").click(); document.querySelector('#view-scores .menu-item[data-proxy="#exportBtn"]').click()`);
    await sleep(900);
    check("Download Excel from the menu really downloads", (await ev(`window.__dl.length`)) === 1 && (await ev(`window.__dl[0]`)).endsWith(".xlsx"));

    /* ---- hover and motion ---- */
    await ev(`document.querySelector('.nav-item[data-view="dashboard"]').click()`);
    check("cards lift 2px on hover with a 200ms ease", await ev(`(() => { const c = getComputedStyle(document.querySelector(".stat-card")); return c.transitionDuration.includes("0.2s") && c.transitionProperty.includes("transform"); })()`));
    await send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-color-scheme", value: "dark" }] });
    check("a dark-mode device still gets the light look", (await css("body", "background-image")).includes("linear-gradient") && (await css(".stat-card", "background-color")).startsWith("rgba(255, 255, 255"));
    await send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-color-scheme", value: "light" }] });

    /* ---- the look can be changed from :root ---- */
    await ev(`document.documentElement.style.setProperty("--radius-card", "10px"); document.documentElement.style.setProperty("--primary-strong", "#c2185b"); 0`);
    await sleep(400); // colours ease over 200ms
    check("changing one :root variable restyles every card and the nav", (await css(".stat-card", "border-radius")) === "10px" && (await css('.nav-item[aria-current="page"]', "color")) === "rgb(194, 24, 91)");
    await ev(`document.documentElement.style.removeProperty("--radius-card"); document.documentElement.style.removeProperty("--primary-strong"); 0`);

    /* ---- keyboard focus is visible ---- */
    await ev(`document.activeElement.blur(); document.body.focus(); 0`);
    const outlines = [];
    for (let i = 0; i < 14; i++) {
      await key("Tab", "Tab");
      outlines.push(await ev(`(() => { const e = document.activeElement; const s = getComputedStyle(e); return { tag: e.tagName + (e.id ? "#" + e.id : ""), w: parseFloat(s.outlineWidth), st: s.outlineStyle, shadow: s.boxShadow !== "none", wrap: !!e.closest(".search") }; })()`));
    }
    const bad = outlines.filter((o) => o.tag !== "BODY" && !o.wrap && !(o.st !== "none" && o.w >= 2));
    check("every control reached with Tab shows a visible focus ring", outlines.length === 14 && bad.length === 0, JSON.stringify(bad));
    check("the search box shows its ring through the wrapper", await ev(`(() => { document.querySelector("#searchInput").focus(); const s = getComputedStyle(document.querySelector(".search")); return s.outlineStyle !== "none" && parseFloat(s.outlineWidth) >= 2; })()`));

    /* ---- responsive ---- */
    await send("Emulation.setDeviceMetricsOverride", { width: 1000, height: 900, deviceScaleFactor: 1, mobile: false });
    await sleep(400);
    check("tablet: the sidebar collapses to icons only", (await ev(`document.querySelector(".side").getBoundingClientRect().width`)) < 100 && (await ev(`document.querySelector(".nav-label").getBoundingClientRect().width`)) <= 1);
    check("tablet: every nav item keeps an accessible name", await ev(`[...document.querySelectorAll(".nav-item[data-view]")].every((b) => b.textContent.trim().length > 2)`));
    await send("Emulation.setDeviceMetricsOverride", { width: 400, height: 860, deviceScaleFactor: 1, mobile: true });
    await sleep(500);
    check("phone: cards stack in one column", await ev(`(() => { const x = [...document.querySelectorAll(".cards3 .stat-card, #cardChart, #cardAttn, #cardRecent, #cardTop")].map((e) => Math.round(e.getBoundingClientRect().left)); return new Set(x).size === 1; })()`));
    check("phone: search sits under the welcome text", await ev(`document.querySelector(".search").getBoundingClientRect().top >= document.querySelector(".welcome").getBoundingClientRect().bottom - 1`));
    check("phone: the nav is pinned to the bottom of the screen", await ev(`(() => { const r = document.querySelector(".side").getBoundingClientRect(); return getComputedStyle(document.querySelector(".side")).position === "fixed" && Math.abs(window.innerHeight - r.bottom) < 16 && r.width > 300; })()`));
    check("phone: Take photo replaces Download Excel in the top bar", (await visible('label[for="camInput"].phone-only')) && !(await visible("#exportBtn")));
    for (const v of ["dashboard", "setup", "scan", "scores", "analysis", "reports"]) {
      await ev(`showView("${v}")`);
      await sleep(250);
      check(`phone: no sideways scrolling on ${v}`, await ev(`document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1`), `${await ev("document.documentElement.scrollWidth")} > ${await ev("document.documentElement.clientWidth")}`);
    }

    check("no console errors or exceptions", errors.length === 0, errors.join(" | ").slice(0, 500));
    b.finish();
  } catch (e) { b.finish(e); }
})();
