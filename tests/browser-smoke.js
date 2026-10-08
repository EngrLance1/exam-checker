// tests/browser-smoke.js — drives the real page in headless Chrome. Run: node tests/browser-smoke.js
// Needs Chrome or Edge installed and the network only for Google Fonts (the app works without it).
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
const chrome = CANDIDATES.find((p) => fs.existsSync(p));
if (!chrome) { console.error("No Chrome or Edge found."); process.exit(2); }

const PORT = 9333 + Math.floor(Math.random() * 300);
const profile = fs.mkdtempSync(path.join(os.tmpdir(), "sagot-"));
const url = pathToFileURL(path.join(__dirname, "..", "index.html")).href;
const proc = spawn(chrome, ["--headless=new", "--disable-gpu", `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, "--window-size=1300,2200", "about:blank"], { stdio: "ignore" });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let failures = 0;
const check = (name, ok, extra = "") => { console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : "  " + extra}`); if (!ok) failures++; };

async function main() {
  let targets;
  for (let i = 0; i < 50; i++) { try { targets = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json(); break; } catch (e) { await sleep(200); } }
  const page = targets.find((t) => t.type === "page");
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((r) => (ws.onopen = r));
  let id = 0; const pending = new Map(); const errors = [];
  ws.onmessage = (m) => {
    const d = JSON.parse(m.data);
    if (d.id && pending.has(d.id)) { pending.get(d.id)(d); pending.delete(d.id); }
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
  await send("Page.enable");
  await send("Emulation.setFocusEmulationEnabled", { enabled: true }); // so focus and blur events fire in headless
  await send("Page.navigate", { url });
  for (let i = 0; i < 60; i++) { await sleep(300); if (await ev(`document.querySelectorAll("#tbody tr[data-id]").length`).catch(() => 0)) break; }

  check("page loads and the sample sheet is read", (await ev(`document.querySelectorAll("#tbody tr[data-id]").length`)) === 1);
  check("SheetJS loaded from the local file (works offline)", (await ev(`typeof XLSX`)) === "object" && (await ev(`[...document.scripts].some(s => s.src.endsWith("js/vendor/xlsx.full.min.js"))`)));
  check("no download service outside claude.ai", (await ev(`downloads`)) === null);

  // Capture downloads made through the plain browser path.
  await ev(`window.__dl = []; const _c = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function () { if (this.download) { const u = this.href; fetch(u).then(r => r.blob()).then(b => window.__dl.push({ name: this.download, size: b.size, type: b.type, blob: b })); return; } return _c.call(this); }; 0`);

  await ev(`document.querySelector("#exportBtn").click()`);
  await sleep(1200);
  const xl = await ev(`window.__dl.map(d => ({ name: d.name, size: d.size }))`);
  check("Download Excel saves an .xlsx file", xl.length === 1 && /\.xlsx$/.test(xl[0].name) && xl[0].size > 3000, JSON.stringify(xl));
  const sheetsInBook = await ev(`(async () => { const b = window.__dl[0].blob; const wb = XLSX.read(await b.arrayBuffer()); return wb.SheetNames; })()`);
  check("the workbook has the expected sheets", ["Scores", "MPS", "Answers", "Item Analysis", "Scan Notes"].every((n) => sheetsInBook.includes(n)), JSON.stringify(sheetsInBook));

  // Item fix through the real dropdown.
  const before = await ev(`document.querySelector("#tbody tr td.num:nth-of-type(4)").textContent.replace(/\\s+/g, "")`);
  await ev(`(() => { const s = document.querySelector("#fx-B-1"); s.value = "drop"; s.dispatchEvent(new Event("change", { bubbles: true })); })()`);
  const after = await ev(`document.querySelector("#tbody tr td.num:nth-of-type(4)").textContent.replace(/\\s+/g, "")`);
  const tot = (s) => Number(s.split("/")[1]);
  check("dropping an item lowers the total by one", tot(after) === tot(before) - 1, `${before} -> ${after}`);
  check("the dropped item stays listed so it can be restored", (await ev(`document.querySelector("#fx-B-1").value`)) === "drop");
  check("the details stay open after a change", (await ev(`!!document.querySelector("details.ia[open]")`)));
  check("saved to browser storage", (await ev(`JSON.parse(localStorage.getItem("sagotscan-v1")).test.fixes.B[1].type`)) === "drop");

  // Credit everyone must never lower a score.
  await ev(`(() => { const s = document.querySelector("#fx-B-1"); s.value = "credit"; s.dispatchEvent(new Event("change", { bubbles: true })); })()`);
  const credited = await ev(`document.querySelector("#tbody tr td.num:nth-of-type(4)").textContent.replace(/\\s+/g, "")`);
  check("crediting everyone does not lower the total", tot(credited) === tot(before) && Number(credited.split("/")[0]) >= Number(before.split("/")[0]), `${before} -> ${credited}`);

  await ev(`showView("setup")`); // the item-count box lives on the Test setup page
  // Custom number of items. 
  const typeSize = (v) => ev(`(() => { const i = document.querySelector("#sizeCustom"); i.focus(); i.value = ${JSON.stringify(v)}; i.dispatchEvent(new Event("input", { bubbles: true })); })()`);
  check("the Other box is hidden while a standard size is chosen", (await ev(`document.querySelector("#sizeOther").hidden`)) === true);
  await ev(`document.querySelector('#sizeSeg [data-size="other"]').click()`);
  check("clicking Other opens the number box", (await ev(`!document.querySelector("#sizeOther").hidden`)) && (await ev(`document.activeElement.id`)) === "sizeCustom");
  await typeSize("40");
  check("typing 40 sets a 40-item test", (await ev(`state.test.size`)) === 40 && (await ev(`document.querySelector("#keyCount").textContent`)).includes("/ 40 items"));
  check("the hint names the sheet to use", (await ev(`document.querySelector("#sizeHint").textContent`)).includes("50-item sheet"));
  const total40 = await ev(`document.querySelector("#tbody tr td.num:nth-of-type(4)").textContent.replace(/\s+/g, "")`);
  check("the sample 50-item sheet is scored out of at most 40 and not flagged", tot(total40) <= 40 && !(await ev(`document.querySelector("#tbody").textContent`)).includes("item sheet"), total40);
  check("review shows 40 items, not 50", (await ev(`document.querySelectorAll("#items .it").length`)) === 40);
  await typeSize("61");
  check("61 is refused with a message and the size stays 40", (await ev(`state.test.size`)) === 40 && (await ev(`document.querySelector("#sizeHint").textContent`)).includes("1 to 60") && (await ev(`document.querySelector("#sizeCustom").getAttribute("aria-invalid")`)) === "true");
  await typeSize("");
  check("an empty box is refused and the size stays 40", (await ev(`state.test.size`)) === 40);
  await typeSize("4.5");
  check("a decimal is refused", (await ev(`state.test.size`)) === 40);
  await ev(`document.querySelector("#sizeCustom").blur()`);
  check("leaving the box with bad text restores the real count", (await ev(`document.querySelector("#sizeCustom").value`)) === "40");
  await ev(`document.querySelector('#sizeSeg [data-size="50"]').click()`);
  check("choosing 50 closes the Other box", (await ev(`state.test.size`)) === 50 && (await ev(`document.querySelector("#sizeOther").hidden`)) === true);

  const fixNames = await ev(`(() => { const wb = buildWorkbook(); return { names: wb.SheetNames, rows: XLSX.utils.sheet_to_json(wb.Sheets["Item Fixes"], { header: 1 }).slice(3) }; })()`);
  check("Excel gets an Item Fixes sheet listing the fix", fixNames.names.includes("Item Fixes") && JSON.stringify(fixNames.rows).includes("Credit to everyone"), JSON.stringify(fixNames));

  // Save test file.
  await ev(`document.querySelector("#testName").value = "Smoke test"; document.querySelector("#testName").dispatchEvent(new Event("input", { bubbles: true })); document.querySelector("#saveFileBtn").click()`);
  await sleep(800);
  const saved = await ev(`window.__dl.filter(d => d.name.endsWith(".json")).map(d => d.name)`);
  check("Save test file downloads a .json file named after the test", saved.length === 1 && saved[0] === "Smoke test - SagotScan.json", JSON.stringify(saved));
  const fileText = await ev(`window.__dl.find(d => d.name.endsWith(".json")).blob.text()`);
  check("the file leaves out the sample sheet", JSON.parse(fileText).sheets.length === 0);

  // Open test file: a bad file first.
  const openWith = (content, name) => ev(`(() => { const dt = new DataTransfer(); dt.items.add(new File([${JSON.stringify(content)}], ${JSON.stringify(name)})); const i = document.querySelector("#openInput"); i.files = dt.files; i.dispatchEvent(new Event("change")); })()`);
  await openWith("this is not json", "bad.json");
  await sleep(400);
  check("a bad file shows an error and changes nothing", (await ev(`document.querySelector("#toast").textContent`)).includes("isn't a SagotScan") && (await ev(`document.querySelector("#testName").value`)) === "Smoke test");

  // A good file replaces the current test only after confirming.
  const good = JSON.parse(fileText); good.test.name = "Opened test";
  await openWith(JSON.stringify(good), "good.json");
  await sleep(400);
  check("opening asks before replacing current work", (await ev(`!document.querySelector("#confirmBar").hidden`)) && (await ev(`document.querySelector("#confirmYes").textContent`)) === "Replace");
  check("nothing changes until confirmed", (await ev(`document.querySelector("#testName").value`)) === "Smoke test");
  await ev(`document.querySelector("#confirmYes").click()`);
  await sleep(300);
  check("after confirming, the file's test is loaded", (await ev(`document.querySelector("#testName").value`)) === "Opened test");
  check("Cancel on the open prompt leaves things alone", await (async () => {
    await openWith(JSON.stringify(good), "good.json"); await sleep(300);
    await ev(`document.querySelector("#confirmNo").click()`);
    return (await ev(`document.querySelector("#confirmBar").hidden`)) && (await ev(`pendingOpen`)) === null;
  })());

  // Storage failure warning.
  check("no storage warning while saving works", (await ev(`document.querySelector("#storageWarn").hidden`)) === true);
  await ev(`Storage.prototype.setItem = function () { throw new Error("quota"); }; document.querySelector("#testName").value = "x"; document.querySelector("#testName").dispatchEvent(new Event("input", { bubbles: true })); 0`);
  check("a storage failure shows the warning", (await ev(`document.querySelector("#storageWarn").hidden`)) === false);

  // Phone width: no sideways scrolling.
  await send("Emulation.setDeviceMetricsOverride", { width: 400, height: 900, deviceScaleFactor: 1, mobile: true });
  await sleep(500);
  check("no horizontal scroll at 400px", (await ev(`document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1`)), `${await ev("document.documentElement.scrollWidth")} > ${await ev("document.documentElement.clientWidth")}`);

  check("no console errors or exceptions", errors.length === 0, errors.join(" | ").slice(0, 400));
  ws.close();
}

main().catch((e) => { console.error("ERROR", e); failures++; }).finally(() => {
  proc.kill();
  setTimeout(() => { try { fs.rmSync(profile, { recursive: true, force: true }); } catch (e) {} console.log(failures ? `\n${failures} FAILED` : "\nALL PASSED"); process.exit(failures ? 1 : 0); }, 800);
});
