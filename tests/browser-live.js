// tests/browser-live.js — a smoke test of the DEPLOYED site, run after every deploy.
// Usage: node tests/browser-live.js [https://your-site.vercel.app]
// Loads the landing page, the app and the sheets page over the real network in a real browser, and checks that each one
// works, makes no request to any other site, and throws no errors.
const { launch } = require("./helpers/browser");

const SITE = (process.argv[2] || "https://sagotscan.vercel.app").replace(/\/$/, "");
const ORIGIN = new URL(SITE).origin;

(async () => {
  const b = await launch({ width: 1440, height: 900, page: SITE + "/" });
  const { ev, send, check, errors, requests, sleep } = b;
  const noSideScroll = () => ev(`document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1`);
  const foreign = () => requests.filter((u) => !u.startsWith(ORIGIN) && !/^(data|about|blob):/.test(u));
  try {
    // ---- landing page ----
    check("landing page: loaded over HTTPS with its title", (await ev(`location.protocol`)) === "https:" && (await ev(`document.title`)).startsWith("SagotScan"));
    check("landing page: the headline is there", (await ev(`document.querySelector("h1").textContent.trim()`)) === "Check answer sheets from your phone. Get your MPS in minutes.");
    check("landing page: fonts, styles and images come from this site", requests.some((u) => /\/app\/fonts\/PlusJakartaSans.*\.woff2$/.test(u)) && requests.some((u) => /\/landing\.css$/.test(u)), JSON.stringify(requests.filter((u) => /font|css/i.test(u))));
    await ev(`(async () => { for (let y = 0; y < document.body.scrollHeight; y += 400) { window.scrollTo({ top: y, behavior: "instant" }); await new Promise((r) => setTimeout(r, 120)); } window.scrollTo({ top: 0, behavior: "instant" }); })()`);
    await sleep(800);
    check("landing page: every image loaded", await ev(`[...document.images].every((i) => i.complete && i.naturalWidth > 100)`));
    check("landing page: no sideways scrolling on desktop", await noSideScroll());
    await send("Emulation.setDeviceMetricsOverride", { width: 400, height: 800, deviceScaleFactor: 1, mobile: true });
    await sleep(500);
    check("landing page: no sideways scrolling on a 400px phone", await noSideScroll());
    check("landing page: the main button is in the first phone screen", await ev(`document.querySelector("#heroCta").getBoundingClientRect().bottom < innerHeight`));
    await send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
    check("landing page: links lead to the app, the sheets and GitHub", await ev(`(() => { const h = [...document.querySelectorAll("a")].map((a) => a.getAttribute("href")); return h.includes("app/index.html") && h.includes("sheets/index.html") && h.includes("https://github.com/EngrLance1/exam-checker"); })()`));

    // ---- the call to action opens the app ----
    await ev(`document.querySelector("#heroCta").click()`);
    for (let i = 0; i < 40; i++) { await sleep(300); if (await ev(`document.querySelectorAll("#tbody tr[data-id]").length`).catch(() => 0)) break; }
    check("app: Open SagotScan reaches the app, and it reads the built-in sample sheet", (await ev(`location.pathname`)).endsWith("/app/index.html") && (await ev(`document.querySelectorAll("#tbody tr[data-id]").length`)) >= 1);
    check("app: the dashboard shows real numbers from the sample", (await ev(`document.querySelector("#cardSheets .big").textContent`)) === "1" && /\d+\.\d%/.test(await ev(`document.querySelector("#cardMps .big").textContent`)));
    check("app: it keeps its work in this browser", (await ev(`!!localStorage.getItem("sagotscan-v1")`)));
    await ev(`window.__dl = []; const _c = HTMLAnchorElement.prototype.click; HTMLAnchorElement.prototype.click = function () { if (this.download) { window.__dl.push(this.download); return; } return _c.call(this); }; document.querySelector("#exportBtn").click()`);
    await sleep(1500);
    check("app: Download Excel produces a file (SheetJS loaded from this site)", (await ev(`window.__dl.length`)) === 1 && (await ev(`window.__dl[0]`)).endsWith(".xlsx"));
    await ev(`showView("scan")`);
    check("app: the camera button and upload are there", (await ev(`!!document.querySelector('#camInput[capture]') && !!document.querySelector("#fileInput")`)));

    // ---- the sheets page ----
    await send("Page.navigate", { url: SITE + "/sheets/index.html" });
    await sleep(1500);
    check("sheets: the 50-item sheet draws", (await ev(`document.querySelectorAll("#sheetBox svg circle[stroke-width='1.5']").length`)) === 50 * 4 + 24);
    await ev(`document.querySelector('#sizeSeg [data-size="60"]').click()`);
    check("sheets: choosing 60 items draws the 60-item sheet", (await ev(`document.querySelectorAll("#sheetBox svg circle[stroke-width='1.5']").length`)) === 60 * 4 + 24);

    // ---- across all three pages ----
    check("no request went to any other site (no CDN, no Google, no analytics)", foreign().length === 0, JSON.stringify(foreign()));
    check("no failed or blocked requests", errors.filter((e) => /Failed to load|ERR_|404|403|blocked/i.test(e)).length === 0, errors.join(" | ").slice(0, 300));
    check("no console errors or exceptions", errors.length === 0, errors.join(" | ").slice(0, 400));
    console.log(`      ${requests.filter((u) => u.startsWith(ORIGIN)).length} requests, all to ${ORIGIN}`);
    b.finish();
  } catch (e) { b.finish(e); }
})();
