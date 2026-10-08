// Checks the glass colour tokens in css/styles.css against WCAG AA (4.5:1 for normal text), computed from the real values.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const css = fs.readFileSync(path.join(__dirname, "..", "css", "styles.css"), "utf8");
const root = css.slice(css.indexOf(":root {"), css.indexOf("}", css.indexOf(":root {")));
const tok = (name) => { const m = root.match(new RegExp(`--${name}:\\s*([^;]+);`)); assert.ok(m, `token --${name} missing`); return m[1].trim(); };

const hex = (h) => { h = h.replace("#", ""); if (h.length === 3) h = [...h].map((c) => c + c).join(""); return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)); };
const lum = ([r, g, b]) => { const f = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
const over = (fg, alpha, bg) => fg.map((c, i) => Math.round(c * alpha + bg[i] * (1 - alpha)));
const rgba = (s) => { const m = s.match(/rgba?\(([^)]+)\)/); const p = m[1].split(",").map((x) => parseFloat(x)); return { rgb: p.slice(0, 3), a: p[3] ?? 1 }; };

// The darkest sky a card can sit on (worst case for contrast).
const skies = [tok("sky-a"), tok("sky-b"), tok("sky-c")].map(hex);
const glass = rgba(tok("glass"));
const onGlass = skies.map((s) => over(glass.rgb, glass.a, s));
const white = [255, 255, 255];

test("tokens named in the brief are set", () => {
  assert.equal(tok("primary"), "#4c6ef5");
  assert.equal(tok("violet"), "#7c5cfa");
  assert.equal(tok("navy"), "#1e2340");
  assert.equal(tok("radius-window"), "28px");
  assert.equal(tok("radius-card"), "18px");
  assert.match(tok("blur"), /^18px$/);
  assert.match(tok("shadow-card"), /rgba\(80, 90, 180, 0\.12\)/);
  assert.deepEqual([tok("sky-a"), tok("sky-b"), tok("sky-c")], ["#e6e9fb", "#d9ddf8", "#eef0fd"]);
  assert.ok(glass.a >= 0.55 && glass.a <= 0.7, "glass is white at 55-70% opacity");
});

test("body text and secondary text meet AA on the glass over the darkest sky", () => {
  for (const bg of onGlass) {
    assert.ok(ratio(hex(tok("navy")), bg) >= 4.5, "navy");
    assert.ok(ratio(hex(tok("muted")), bg) >= 4.5, `muted ${ratio(hex(tok("muted")), bg).toFixed(2)}`);
    assert.ok(ratio(hex(tok("primary-strong")), bg) >= 4.5, "primary-strong");
  }
});

test("muted text also meets AA on white and on the semi-clear window", () => {
  assert.ok(ratio(hex(tok("muted")), white) >= 4.5);
  const win = rgba(tok("window-glass"));
  for (const s of skies) assert.ok(ratio(hex(tok("muted")), over(win.rgb, win.a, s)) >= 4.5, "muted on window");
});

test("white text on both ends of the button gradient meets AA", () => {
  assert.ok(ratio(white, hex(tok("btn-a"))) >= 4.5, `btn-a ${ratio(white, hex(tok("btn-a"))).toFixed(2)}`);
  assert.ok(ratio(white, hex(tok("btn-b"))) >= 4.5, `btn-b ${ratio(white, hex(tok("btn-b"))).toFixed(2)}`);
});

test("status pills: dark text on a soft tint meets AA", () => {
  for (const k of ["ok", "warn", "bad", "info"]) {
    const r = ratio(hex(tok(k)), hex(tok(k + "-soft")));
    assert.ok(r >= 4.5, `${k} ${r.toFixed(2)}`);
  }
});

test("the avatar tint texts meet AA", () => {
  const t = css.match(/\.avatar\.t(\d) \{[^}]*\}/g);
  assert.equal(t.length, 3);
  for (const rule of t) {
    const bgRaw = rule.match(/background: ([^;]+);/)[1].trim();
    const bg = rgba(bgRaw.startsWith("var(") ? tok(bgRaw.slice(6, -1)) : bgRaw);
    const raw = rule.match(/[^-]color: ([^;]+);/)[1].trim();
    const fg = raw.startsWith("var(") ? tok(raw.slice(6, -1)) : raw; // resolve var(--name)
    for (const base of onGlass) assert.ok(ratio(hex(fg), over(bg.rgb, bg.a, base)) >= 4.5, rule);
  }
});

test("there is no dark mode", () => {
  assert.ok(!/prefers-color-scheme:\s*dark/.test(css));
  assert.ok(!/data-theme/.test(css));
  assert.match(css, /color-scheme:\s*light/);
});

test("every colour used in components comes from a variable or the brief's few literals", () => {
  const body = css.slice(css.indexOf("}", css.indexOf(":root {")) + 1);
  const literals = [...body.matchAll(/#[0-9a-fA-F]{3,6}\b/g)].map((m) => m[0].toLowerCase());
  const allowed = new Set(["#fff", "#ffffff"]); // white only
  const stray = literals.filter((l) => !allowed.has(l));
  assert.deepEqual(stray, [], "move these into :root variables");
});
