// tests/helpers/browser.js — starts headless Chrome/Edge on app/index.html and gives a tiny DevTools-protocol driver.
const { spawn } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const CANDIDATES = [
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "/usr/bin/google-chrome", "/usr/bin/chromium", "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// page: file to open, relative to the repo root (default: the app). The app also waits for its sample sheet to be read.
async function launch({ width = 1300, height = 2200, page: pagePath = "app/index.html" } = {}) {
  const chrome = CANDIDATES.find((p) => fs.existsSync(p));
  if (!chrome) { console.error("No Chrome or Edge found."); process.exit(2); }
  const port = 9333 + Math.floor(Math.random() * 600);
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "sagot-"));
  const url = /^https?:/.test(pagePath) ? pagePath : pathToFileURL(path.join(__dirname, "..", "..", pagePath)).href; // a repo file, or a live URL
  const proc = spawn(chrome, ["--headless=new", "--disable-gpu", `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, `--window-size=${width},${height}`, "about:blank"], { stdio: "ignore" });

  let targets;
  for (let i = 0; i < 50; i++) { try { targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); break; } catch (e) { await sleep(200); } }
  const page = targets.find((t) => t.type === "page");
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((r) => (ws.onopen = r));
  let id = 0; const pending = new Map(); const errors = []; const requests = []; // every URL the page asked for
  ws.onmessage = (m) => {
    const d = JSON.parse(m.data);
    if (d.id && pending.has(d.id)) { pending.get(d.id)(d); pending.delete(d.id); }
    if (d.method === "Network.requestWillBeSent") requests.push(d.params.request.url);
    if (d.method === "Runtime.exceptionThrown") errors.push(d.params.exceptionDetails.exception?.description || d.params.exceptionDetails.text);
    if (d.method === "Runtime.consoleAPICalled" && d.params.type === "error") errors.push(d.params.args.map((a) => a.value || a.description).join(" "));
  };
  const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
  const ev = async (expr) => {
    const r = await send("Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true });
    if (r.result.exceptionDetails) throw new Error(r.result.exceptionDetails.exception?.description || "eval failed");
    return r.result.result.value;
  };
  await send("Runtime.enable");
  await send("Network.enable");
  await send("Page.enable");
  await send("Emulation.setFocusEmulationEnabled", { enabled: true }); // so focus and blur events fire in headless
  await send("Page.navigate", { url });
  if (/(^|\/)app\/index\.html$/.test(pagePath)) { // the app: wait for its sample sheet to be read
    for (let i = 0; i < 60; i++) { await sleep(300); if (await ev(`document.querySelectorAll("#tbody tr[data-id]").length`).catch(() => 0)) break; }
  } else {
    for (let i = 0; i < 40; i++) { await sleep(150); if (await ev(`document.readyState`).catch(() => "") === "complete") break; }
    await sleep(300);
  }

  let failures = 0;
  const check = (name, ok, extra = "") => { console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : "  " + extra}`); if (!ok) failures++; };
  const finish = (error) => {
    if (error) { console.error("ERROR", error); failures++; }
    try { ws.close(); } catch (e) {}
    proc.kill();
    setTimeout(() => { try { fs.rmSync(profile, { recursive: true, force: true }); } catch (e) {} console.log(failures ? `\n${failures} FAILED` : "\nALL PASSED"); process.exit(failures ? 1 : 0); }, 800);
  };
  return { ev, send, check, errors, requests, finish, sleep };
}

module.exports = { launch, sleep };
