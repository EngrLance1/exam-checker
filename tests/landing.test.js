// Static checks on the landing page and the sheets page: structure, links, honesty of the copy, and colour contrast.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");
const read = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
const html = read("index.html"), css = read("landing.css"), tokens = read("app/css/tokens.css");
const sheetsHtml = read("sheets/index.html");

const strip = (s) => s.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<svg[\s\S]*?<\/svg>/g, " ");
const textOf = (s) => strip(s).replace(/<[^>]+>/g, " ").replace(/&[a-z]+;|&#\d+;/g, " ").replace(/\s+/g, " ").trim();
const attr = (tag, name) => (tag.match(new RegExp(`\\s${name}="([^"]*)"`)) || [])[1];

/* ---------- document basics ---------- */
test("the page has a language, a viewport, a title and a description", () => {
  assert.match(html, /<html lang="en">/);
  assert.match(html, /<meta name="viewport" content="[^"]*width=device-width/);
  const title = html.match(/<title>([^<]+)<\/title>/)[1];
  assert.ok(title.length >= 20 && title.length <= 70, `title length ${title.length}`);
  const desc = html.match(/<meta name="description" content="([^"]+)"/)[1];
  assert.ok(desc.length >= 80 && desc.length <= 170, `description length ${desc.length}`);
});

test("social sharing tags are present (the image and URL need the final domain, so they wait for deploy)", () => {
  for (const p of ["og:type", "og:title", "og:description"]) assert.match(html, new RegExp(`<meta property="${p}"`));
  assert.match(html, /<meta name="twitter:card"/);
  assert.match(html, /<link rel="icon" href="assets\/favicon\.svg"/);
});

test("exactly one h1, and headings never skip a level", () => {
  const hs = [...strip(html).matchAll(/<h([1-6])[ >]/g)].map((m) => +m[1]);
  assert.equal(hs.filter((h) => h === 1).length, 1);
  assert.equal(hs[0], 1);
  hs.forEach((h, i) => { if (i) assert.ok(h <= hs[i - 1] + 1, `h${h} after h${hs[i - 1]}`); });
});

test("landmarks and the skip link exist", () => {
  assert.match(html, /<a class="skip" href="#main">/);
  assert.match(html, /<header[\s>]/); assert.match(html, /<main id="main"/); assert.match(html, /<footer[\s>]/);
  assert.match(html, /<nav[^>]*aria-label=/);
});

/* ---------- links resolve ---------- */
test("every local link, image, stylesheet and script exists, and every #anchor has a target", () => {
  const refs = [...html.matchAll(/(?:href|src)="([^"]+)"/g)].map((m) => m[1]).filter((u) => !/^(https?:|mailto:|data:)/.test(u));
  assert.ok(refs.length > 10);
  const ids = new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));
  for (const u of refs) {
    if (u.startsWith("#")) { assert.ok(ids.has(u.slice(1)), `missing anchor ${u}`); continue; }
    if (u === "./") continue;
    assert.ok(fs.existsSync(path.join(ROOT, u.split("#")[0])), `missing file ${u}`);
  }
});

test("the only outside link is GitHub, and nothing loads from another site", () => {
  const external = [...html.matchAll(/(?:href|src)="(https?:\/\/[^"]+)"/g)].map((m) => m[1]);
  assert.ok(external.length >= 1);
  assert.ok(external.every((u) => u.startsWith("https://github.com/EngrLance1/exam-checker")), JSON.stringify(external));
  const loads = [...html.matchAll(/<(?:script|link|img)[^>]+(?:src|href)="(https?:[^"]+)"/g)].filter((m) => !/<a /.test(m[0])).map((m) => m[1]);
  assert.deepEqual(loads.filter((u) => !/<a /.test(u)), []);
  assert.ok(!/fonts\.googleapis|gstatic|cdnjs|unpkg|jsdelivr/.test(html + css));
});

test("the calls to action lead to the app and the printable sheets, by paths that also work from disk", () => {
  assert.equal([...html.matchAll(/href="app\/index\.html"/g)].length >= 3, true);
  assert.match(html, /href="sheets\/index\.html"/);
  assert.ok(!/href="\/(app|sheets)/.test(html), "absolute paths would break when opened from a folder");
});

test("every image has real alt text, and large images have dimensions to prevent layout shift", () => {
  for (const tag of html.match(/<img [^>]+>/g)) {
    assert.ok((attr(tag, "alt") || "").length > 20, tag);
    assert.ok(attr(tag, "width") && attr(tag, "height"), tag);
  }
  const mocks = html.match(/<div class="mock[ "][^>]*>/g);
  assert.ok(mocks.every((m) => /aria-hidden="true"/.test(m)), "decorative mockups are hidden from screen readers");
});

/* ---------- honesty ---------- */
test("the copy makes none of the claims we decided against", () => {
  const t = textOf(html).toLowerCase();
  for (const bad of ["ai-powered", "powered by ai", "100% accurate", "any sheet", "any answer sheet", "depEd-approved".toLowerCase(), "official", "secure", "trusted by", "teachers use", "testimonial", "unlock", "seamless", "supercharge", "elevate", "revolutionize", "effortless", "no matter", "guarantee"])
    assert.ok(!t.includes(bad), `forbidden phrase: ${bad}`);
  assert.ok(!/\b\d[\d,]*\+?\s*(teachers|schools|users|classes)\b/i.test(t), "no made-up user counts");
  assert.ok(!/[\u{1F300}-\u{1FAFF}✨]/u.test(html), "no emoji");
});

test("the real limits are stated on the page", () => {
  const t = textOf(html);
  assert.match(t, /Only the SagotScan sheets are supported/);
  assert.match(t, /different sheet layout will not read correctly/);
  assert.match(t, /Photos are not stored/);
  assert.match(t, /not yet on many real classroom photos/);
  assert.match(t, /No licence has been chosen/);
});

test("every picture of the app that shows numbers is labelled as sample data", () => {
  // each mockup sits in a tile (<article>) or is a window with its own label; either way "sample data" must appear with it
  const tiles = html.match(/<article class="tile[\s\S]*?<\/article>/g).filter((t) => /class="mock[ "]/.test(t));
  assert.ok(tiles.length >= 2);
  for (const t of tiles) assert.match(t, /sample data/i);
  for (const cls of ["scores-mock", "dash-mock"]) {
    const start = html.indexOf(`<div class="mock ${cls}"`);
    assert.ok(start > 0, cls);
    assert.match(html.slice(start, start + 400), /Sample data/, cls);
  }
});

test("the numbers in the pictures add up", () => {
  // six sheets with these scores: the class MPS shown must be the real calculation
  const scores = [41, 38, 35, 33, 29, 22];
  assert.equal(((scores.reduce((a, b) => a + b, 0) / (6 * 50)) * 100).toFixed(1), "66.0");
  assert.match(html, /<p class="big">66\.0%<\/p>/);
  assert.match(html, /stroke-dasharray="165\.9 85\.4"/);                // 66% of the ring's circumference 251.3
  assert.ok(Math.abs(2 * Math.PI * 40 * 0.66 - 165.9) < 0.1);
  // item decisions follow the app's own rule: D < 0.20 reject; D >= 0.30 and 0.21 <= p <= 0.80 retain; otherwise revise
  const decision = (p, d) => (d < 0.2 ? "Reject" : d >= 0.3 && p >= 0.21 && p <= 0.8 ? "Retain" : "Revise");
  for (const [p, d, want] of [[0.83, 0.17, "Reject"], [0.65, 0.43, "Retain"], [0.73, 0.14, "Reject"], [0.69, 0.43, "Retain"], [0.65, 0.29, "Revise"]]) assert.equal(decision(p, d), want);
  const rows = [...html.matchAll(/<td class="num">([\d.]+)<\/td><td class="num">([\d.]+)<\/td><td><span class="chip(?: (?:warn|bad))?">(\w+)</g)].map((m) => [+m[1], +m[2], m[3]]);
  assert.equal(rows.length, 5);
  for (const [p, d, shown] of rows) assert.equal(decision(p, d), shown, `item p=${p} D=${d}`);
});

test("the sheet explainer's facts match the layout data", () => {
  const L = new Function(read("app/js/data/layouts.js").split("\n").find((l) => l.startsWith("const LAYOUTS")) + ";return LAYOUTS")();
  const perCol = (k) => { const ys = L[k].items.map((g) => g[0][0]); return L[k].items.filter((g) => g[0][0] === ys[0]).length; };
  assert.equal(perCol("30"), 10); assert.equal(perCol("50"), 10); assert.equal(perCol("60"), 12);
  const rows = (n) => { const ctx = {}; return new Function("LAYOUTS", read("app/js/config.js").replace(/^const /gm, "var ") + read("app/js/core/sheetlayout.js").replace(/^const /gm, "var ") + `; return sheetShape(${n}).rows`)(L); };
  assert.equal(rows(50), 10); assert.equal(rows(51), 12); assert.equal(rows(60), 12); assert.equal(rows(61), 15); assert.equal(rows(75), 15);
  assert.match(html, /10 per column up to 50 items, 12 up to 60, 15 up to 75/);
  assert.match(textOf(html), /Class number and test set/);
});

/* ---------- colour contrast ---------- */
const hex = (h) => { h = h.replace("#", ""); if (h.length === 3) h = [...h].map((c) => c + c).join(""); return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)); };
const lum = ([r, g, b]) => { const f = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
const over = (fg, alpha, bg) => fg.map((c, i) => Math.round(c * alpha + bg[i] * (1 - alpha)));
const tok = (name) => { const m = (tokens + "\n" + css).match(new RegExp(`--${name}:\\s*([^;]+);`)); assert.ok(m, `--${name}`); return m[1].trim(); };
const rgba = (s) => { const p = s.match(/rgba?\(([^)]+)\)/)[1].split(",").map(parseFloat); return { rgb: p.slice(0, 3), a: p[3] ?? 1 }; };

test("text on the bare sky meets AA, even over the darkest sky and a violet blob peak", () => {
  const skies = [tok("sky-a"), tok("sky-b"), tok("sky-c")].map(hex);
  const blob = rgba(tok("blob-violet"));
  const worst = skies.map((s) => over(blob.rgb, blob.a, s));          // sky with a violet blob right behind it
  for (const bg of [...skies, ...worst]) {
    assert.ok(ratio(hex(tok("navy")), bg) >= 4.5, "navy body text");
    assert.ok(ratio(hex(tok("ink-2")), bg) >= 4.5, `secondary text ${ratio(hex(tok("ink-2")), bg).toFixed(2)}`);
    assert.ok(ratio(hex(tok("link")), bg) >= 4.5, `links ${ratio(hex(tok("link")), bg).toFixed(2)}`);
  }
});

test("text inside the glass windows and tiles meets AA", () => {
  const glass = rgba(tok("glass"));
  for (const s of [tok("sky-a"), tok("sky-b"), tok("sky-c")].map(hex)) {
    const bg = over(glass.rgb, glass.a, s);
    for (const c of ["navy", "muted", "primary-strong", "info", "ok", "warn", "bad"]) assert.ok(ratio(hex(tok(c)), bg) >= 4.5, `${c} on glass`);
  }
});

test("pills, buttons, the limits panel and the final band meet AA", () => {
  for (const k of ["ok", "warn", "bad", "info"]) assert.ok(ratio(hex(tok(k)), hex(tok(k + "-soft"))) >= 4.5, `${k} pill`);
  for (const k of ["btn-a", "btn-b"]) assert.ok(ratio([255, 255, 255], hex(tok(k))) >= 4.5, `white on ${k}`);
  assert.ok(ratio(hex("#3d2600"), hex(tok("warn-soft"))) >= 7, "limits text");
  assert.ok(ratio(hex("#4d3000"), hex(tok("warn-soft"))) >= 7, "limits heading");
  assert.ok(ratio(hex(tok("primary-strong")), [255, 255, 255]) >= 4.5, "blue text on the white button");
});

/* ---------- size and weight ---------- */
test("the page is light: no images over 100 KB, no script frameworks", () => {
  for (const f of fs.readdirSync(path.join(ROOT, "assets"))) assert.ok(fs.statSync(path.join(ROOT, "assets", f)).size < 100 * 1024, f);
  const js = read("landing.js");
  assert.ok(js.length < 2000);
  assert.ok(!/import |require\(|fetch\(|XMLHttpRequest/.test(js));
});

/* ---------- the sheets page ---------- */
test("the sheets page has a title, headings, the print instructions and works from disk", () => {
  assert.match(sheetsHtml, /<title>[^<]+<\/title>/);
  assert.equal((sheetsHtml.match(/<h1>/g) || []).length, 1);
  assert.match(sheetsHtml, /Print at 100%/);
  assert.match(sheetsHtml, /id="sizeInput"[^>]*min="1" max="75"/);
  for (const n of [20, 25, 30, 40, 50, 60, 75]) assert.match(sheetsHtml, new RegExp(`data-size="${n}"`));
  for (const m of sheetsHtml.matchAll(/(?:href|src)="([^"#]+)"/g)) if (!/^https?:/.test(m[1])) assert.ok(fs.existsSync(path.join(ROOT, "sheets", m[1])), m[1]);
  assert.match(sheetsHtml, /1 to 75/);
});
