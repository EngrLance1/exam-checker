// tests/browser-landing.js — the landing page and the printable sheets page, in a real browser. Run: node tests/browser-landing.js
const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL, fileURLToPath } = require("node:url");
const { launch } = require("./helpers/browser");

const ROOT = path.join(__dirname, "..");
const fileUrl = (rel) => pathToFileURL(path.join(ROOT, rel)).href;

(async () => {
  const b = await launch({ width: 1440, height: 900, page: "index.html" });
  const { ev, send, check, errors, requests, sleep } = b;
  const key = (k, code, vk, text) => send("Input.dispatchKeyEvent", { type: "keyDown", key: k, code, windowsVirtualKeyCode: vk, text }).then(() => send("Input.dispatchKeyEvent", { type: "keyUp", key: k, code, windowsVirtualKeyCode: vk }));
  const visible = (sel) => ev(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); return !!e && e.getClientRects().length > 0; })()`);
  const noSideScroll = () => ev(`document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1`);
  const viewport = async (w, h, mobile) => { await send("Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: 1, mobile: !!mobile }); await sleep(400); };
  const pageCount = (b64) => (Buffer.from(b64, "base64").toString("latin1").match(/\/Type\s*\/Page[^s]/g) || []).length;

  try {
    /* ---------- landing page ---------- */
    check("the headline is the chosen one", (await ev(`document.querySelector("h1").textContent.trim()`)) === "Check answer sheets from your phone. Get your MPS in minutes.");
    check("the Filipino privacy line is marked as Filipino", await ev(`document.querySelector(".fil").getAttribute("lang") === "fil" && document.querySelector(".fil").textContent.includes("Libre")`));
    check("the page loads nothing from other sites", requests.filter((u) => !/^(file|data|about):/.test(u)).length === 0, JSON.stringify(requests.filter((u) => !/^(file|data|about):/.test(u))));
    check("fonts and styles come from the app's own folder", requests.some((u) => /app\/fonts\/PlusJakartaSans.*woff2$/.test(u)) && requests.some((u) => /app\/css\/tokens\.css$/.test(u)));
    check("the design tokens are shared with the app", (await ev(`getComputedStyle(document.documentElement).getPropertyValue("--btn-a").trim()`)) === "#4a66e8" && (await ev(`getComputedStyle(document.body).fontFamily`)).startsWith('"Plus Jakarta Sans"'));
    check("the sky gradient and the glass mockups are there", (await ev(`getComputedStyle(document.body).backgroundImage`)).includes("linear-gradient") && (await ev(`getComputedStyle(document.querySelector(".scores-mock")).backdropFilter`)).includes("blur(18px)"));
    check("no sideways scrolling at 1440 wide", await noSideScroll());

    // every image really loads (they are lazy, so scroll through the page first)
    await ev(`(async () => { for (let y = 0; y < document.body.scrollHeight; y += 400) { window.scrollTo({ top: y, behavior: "instant" }); await new Promise((r) => setTimeout(r, 120)); } window.scrollTo({ top: 0, behavior: "instant" }); })()`);
    await sleep(800);
    check("every image loads and has size", await ev(`[...document.images].every((i) => i.complete && i.naturalWidth > 100)`), JSON.stringify(await ev(`[...document.images].map((i) => [i.src.split("/").pop(), i.naturalWidth])`)));
    check("the sheet figure shows the corner squares and the four numbered callouts", await ev(`document.querySelectorAll(".pin-wrap .pin").length === 7 && document.querySelectorAll(".pins-list li").length === 4`));

    // weight: everything the page asked for, by file size
    const sizes = requests.filter((u) => u.startsWith("file:")).map((u) => { try { return fs.statSync(fileURLToPath(u)).size; } catch (e) { return 0; } });
    const total = sizes.reduce((a, c) => a + c, 0);
    check("the whole page weighs under 500 KB before compression", total < 500 * 1024, `${(total / 1024).toFixed(0)} KB`);

    // keyboard: skip link first, then visible focus on every stop
    await ev(`window.scrollTo({ top: 0, behavior: "instant" }); document.activeElement.blur(); 0`);
    await key("Tab", "Tab", 9);
    check("the first Tab stop is the skip link, and it appears on screen", (await ev(`document.activeElement.className`)) === "skip" && (await ev(`document.activeElement.getBoundingClientRect().top >= 0`)));
    await key("Enter", "Enter", 13, "\r");
    await sleep(100);
    check("the skip link jumps to the main content", (await ev(`location.hash`)) === "#main");
    await ev(`window.scrollTo({ top: 0, behavior: "instant" }); document.activeElement.blur(); 0`);
    const rings = [];
    for (let i = 0; i < 14; i++) { await key("Tab", "Tab", 9); rings.push(await ev(`(() => { const e = document.activeElement, s = getComputedStyle(e); return { tag: e.tagName + "." + e.className, ok: s.outlineStyle !== "none" && parseFloat(s.outlineWidth) >= 2 }; })()`)); }
    check("every control reached with Tab shows a visible focus ring", rings.every((r) => r.ok), JSON.stringify(rings.filter((r) => !r.ok)));
    check("every button and link is at least 44px tall to tap", await ev(`[...document.querySelectorAll(".btn, .faq summary, .nav a")].filter((e) => e.getClientRects().length).every((e) => e.getBoundingClientRect().height >= 43.5)`));

    // FAQ opens and closes from the keyboard
    check("the FAQ starts closed", (await ev(`document.querySelectorAll("details[open]").length`)) === 0);
    await ev(`document.querySelector(".faq summary").focus(); 0`);
    await key("Enter", "Enter", 13, "\r");
    check("Enter opens a question", (await ev(`document.querySelector(".faq details").open`)) === true);
    await key(" ", "Space", 32, " ");
    check("Space closes it again", (await ev(`document.querySelector(".faq details").open`)) === false);

    // motion and transparency preferences
    await send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] });
    check("reduced motion turns the hover lift and transitions off", (await ev(`getComputedStyle(document.querySelector(".btn")).transitionDuration`)).replace(/s/g, "").split(",").every((v) => parseFloat(v) === 0));
    await send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "no-preference" }, { name: "prefers-reduced-transparency", value: "reduce" }] });
    check("reduced transparency swaps the glass for solid white", (await ev(`getComputedStyle(document.querySelector(".tile")).backdropFilter`)) === "none");
    await send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-transparency", value: "no-preference" }, { name: "prefers-color-scheme", value: "dark" }] });
    check("a dark-mode device still gets the light page", (await ev(`getComputedStyle(document.body).backgroundImage`)).includes("linear-gradient"));
    await send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-color-scheme", value: "light" }] });

    // phone
    for (const w of [400, 320]) { await viewport(w, 800, true); check(`no sideways scrolling at ${w}px`, await noSideScroll(), `${await ev("document.documentElement.scrollWidth")} > ${w}`); }
    await viewport(400, 800, true);
    await ev(`window.scrollTo({ top: 0, behavior: "instant" }); 0`);
    await sleep(400);
    check("on a phone the headline and the main button are in the first screen", await ev(`(() => { const h = document.querySelector("h1").getBoundingClientRect(), c = document.querySelector("#heroCta").getBoundingClientRect(); return h.top > 0 && c.bottom < window.innerHeight; })()`));
    check("on a phone the buttons are full width", await ev(`document.querySelector("#heroCta").getBoundingClientRect().width > 330`));
    check("the pinned bar is hidden while the hero button is on screen", await ev(`getComputedStyle(document.querySelector("#stickyCta")).opacity === "0" && !document.querySelector("#stickyCta").classList.contains("show")`));
    await ev(`document.querySelector("#how").scrollIntoView({ behavior: "instant" }); 0`);
    await sleep(500);
    check("the pinned bar appears once the hero button has scrolled away", await ev(`document.querySelector("#stickyCta").classList.contains("show") && getComputedStyle(document.querySelector("#stickyCta")).opacity === "1"`));
    await ev(`document.querySelector("#finalCta").scrollIntoView({ block: "center", behavior: "instant" }); 0`);
    await sleep(500);
    check("and hides again near the final call to action", await ev(`!document.querySelector("#stickyCta").classList.contains("show")`));
    check("the pinned bar leaves room: text is not hidden behind it at the end of the page", await ev(`parseFloat(getComputedStyle(document.body).paddingBottom) >= 70`));
    await viewport(1440, 900, false);

    // the buttons go where they say
    await ev(`document.querySelector("#heroCta").click()`);
    await sleep(1800);
    check("Open SagotScan opens the app (and it loads with its sample sheet)", (await ev(`location.pathname`)).endsWith("/app/index.html") && (await ev(`document.querySelectorAll("#tbody tr[data-id]").length`)) >= 1);
    await send("Page.navigate", { url: fileUrl("index.html") });
    await sleep(1200);
    await ev(`document.querySelector(".hero .btn:not(.primary)").click()`);
    await sleep(1200);
    check("Print the answer sheet opens the sheets page", (await ev(`location.pathname`)).endsWith("/sheets/index.html"));

    /* ---------- sheets page ---------- */
    const circles = () => ev(`document.querySelectorAll("#sheetBox svg circle[stroke-width='1.5']").length`);
    check("the sheets page shows the 50-item sheet by default", (await ev(`document.querySelector('#sizeSeg [aria-pressed="true"]').dataset.size`)) === "50" && (await circles()) === 50 * 4 + 24);
    await ev(`document.querySelector('#sizeSeg [data-size="30"]').click()`);
    check("choosing 30 items shows the 30-item sheet", (await circles()) === 30 * 4 + 24 && (await ev(`location.hash`)) === "#30" && (await ev(`document.querySelector("#sheetBox").textContent`)).includes("30 Items"));
    await ev(`document.querySelector('#sizeSeg [data-size="60"]').click()`);
    check("choosing 60 items shows the 60-item sheet", (await circles()) === 60 * 4 + 24 && (await ev(`document.querySelector("#sheetBox").textContent`)).includes("SCORE: ________ / 60"));
    check("the page explains how to print", (await ev(`document.body.innerText`)).includes("Print at 100% (actual size)"));
    check("no sideways scrolling on the sheets page at 400px", await (async () => { await viewport(400, 800, true); const ok = await noSideScroll(); await viewport(1440, 900, false); return ok; })());
    await ev(`window.__printed = 0; window.print = () => { window.__printed++; }; document.querySelector("#printBtn").click()`);
    check("Print this sheet opens the print dialog", (await ev(`window.__printed`)) === 1);

    for (const size of [30, 50, 60]) {
      await ev(`document.querySelector('#sizeSeg [data-size="${size}"]').click()`);
      await send("Emulation.setEmulatedMedia", { media: "print" });
      await sleep(200);
      const geo = await ev(`(() => { const s = document.querySelector("#printArea svg").getBoundingClientRect(); return { visible: getComputedStyle(document.querySelector(".page")).display === "none", mm: s.width / 96 * 25.4, tall: s.height / 96 * 25.4 }; })()`);
      check(`${size}-item sheet, in print: only the sheet shows, 187 mm wide`, geo.visible && Math.abs(geo.mm - 187) < 0.5, JSON.stringify(geo));
      const a4 = await send("Page.printToPDF", { paperWidth: 8.27, paperHeight: 11.69, marginTop: 0, marginBottom: 0, marginLeft: 0, marginRight: 0, preferCSSPageSize: false, printBackground: true });
      const letter = await send("Page.printToPDF", { paperWidth: 8.5, paperHeight: 11, marginTop: 0, marginBottom: 0, marginLeft: 0, marginRight: 0, preferCSSPageSize: false, printBackground: true });
      check(`${size}-item sheet prints on one A4 page and one Letter page`, pageCount(a4.result.data) === 1 && pageCount(letter.result.data) === 1, `A4 ${pageCount(a4.result.data)} pages, Letter ${pageCount(letter.result.data)} pages, ${geo.tall.toFixed(0)} mm tall`);
      await send("Emulation.setEmulatedMedia", { media: "screen" });
    }

    check("no console errors or exceptions on either page", errors.length === 0, errors.join(" | ").slice(0, 400));
    b.finish();
  } catch (e) { b.finish(e); }
})();
