// tests/browser-features.js — sections, duplicates, undo, class list, target, key warnings, print report. Run: node tests/browser-features.js
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const { launch } = require("./helpers/browser");

(async () => {
  const b = await launch();
  const { ev, send, check, errors, sleep } = b;
  try {
    const typeIn = (sel, v, evt = "input") => ev(`(() => { const i = document.querySelector(${JSON.stringify(sel)}); const pg = i.closest(".view"); if (pg && pg.hidden) showView(pg.id.replace("view-", "")); i.focus(); i.value = ${JSON.stringify(v)}; i.dispatchEvent(new Event(${JSON.stringify(evt)}, { bubbles: true })); })()`);
    const scan = async (section) => { // reads the embedded sample photo as if it were a new student sheet
      await typeIn("#sectionInput", section); await ev(`document.querySelector("#sectionInput").dispatchEvent(new Event("change", { bubbles: true }))`);
      await ev(`processSource(SAMPLE_SRC, "test photo")`);
    };
    const rows = () => ev(`document.querySelectorAll("#tbody tr[data-id]").length`);
    const text = (sel) => ev(`document.querySelector(${JSON.stringify(sel)}).textContent.replace(/\\s+/g, " ").trim()`);

    // The sample sheet is class 03, set B. Start clean of it so counts are simple.
    await ev(`document.querySelector("#clearSample").click()`);
    await ev(`state.test.keys.B = SAMPLE_KEY; state.activeSet = "B"; renderAll()`);
    check("starts with no sheets", (await rows()) === 0);

    // ---- Sections ----
    check("no Section column while no sections are used", !(await text("#thead")).includes("Section"));
    await scan("10-A"); await scan("10-B");
    check("two sheets with the same class number in different sections are not duplicates", (await rows()) === 2 && !(await text("#tbody")).includes("used twice"));
    check("a Section column appears once sections exist", (await text("#thead")).startsWith("Section"));
    check("the MPS table has a row per section and an All row", await ev(`(() => { const t = document.querySelector("#mpsBox tbody").textContent; return t.includes("10-A") && t.includes("10-B") && t.includes("All sections"); })()`));
    check("item analysis offers a section filter", (await ev(`!document.querySelector("#iaFilter").hidden`)) && (await ev(`document.querySelectorAll("#iaSection option").length`)) === 3);
    await ev(`(() => { const s = document.querySelector("#iaSection"); s.value = "10-A"; s.dispatchEvent(new Event("change", { bubbles: true })); })()`);
    check("choosing a section limits the analysis to it", (await text("details.ia summary")).includes("1 student "));
    check("the review panel shows the sheet's section", (await ev(`document.querySelector("#rvSection").value`)) === "10-B");

    // ---- Duplicates and undo ----
    await scan("10-B");
    check("the same class number twice in one section is flagged", (await text("#issues")).includes("used twice in 10-B") && (await text("#tbody")).includes("used twice in 10-B"));
    check("the review panel offers to resolve it", await ev(`!document.querySelector("#dupBar").hidden && !!document.querySelector("#dupKeepThis")`));
    await ev(`document.querySelector("#dupKeepThis").click()`);
    check("keeping one removes the other", (await rows()) === 2 && !(await text("#tbody")).includes("used twice"));
    check("an Undo button is offered", await ev(`!!document.querySelector("#toast .toast-btn")`));
    await ev(`document.querySelector("#toast .toast-btn").click()`);
    check("Undo brings the removed sheet back", (await rows()) === 3 && (await text("#issues")).includes("used twice"));

    // remove sheet, then undo
    await ev(`document.querySelector("#removeSheet").click(); document.querySelector("#removeYes").click()`);
    check("removing a sheet works", (await rows()) === 2);
    await ev(`document.querySelector("#toast .toast-btn").click()`);
    check("and Undo restores it, photo included", (await rows()) === 3 && (await ev(`Object.keys(photos).length`)) === 3);

    // clear everything, then undo
    await ev(`document.querySelector("#newTestBtn").click(); document.querySelector("#confirmYes").click()`);
    check("Clear all empties the test", (await rows()) === 0 && (await ev(`state.test.keys.B`)) === "");
    await ev(`document.querySelector("#toast .toast-btn").click()`);
    check("Undo after Clear all restores sheets and keys", (await rows()) === 3 && (await ev(`state.test.keys.B`)).length === 50);

    // ---- Class list ----
    await ev(`document.querySelector("#clearSheetsBtn").click(); document.querySelector("#confirmYes").click()`);
    await scan("10-A"); await scan("10-A".replace("A", "B"));
    await typeIn("#sectionInput", "10-A");
    await typeIn("#rosterInput", "03 Dela Cruz, Juan\n7. Reyes, Ana\ngarbage line\n12, Lim Ben");
    await ev(`document.querySelector("#rosterApply").click()`);
    const note = await text("#rosterNote");
    check("the class list reports what it did", note.includes("3 names saved") && note.includes("1 sheet named") && note.includes("skipped"), note);
    check("the right sheet got the name (only in that section)", await ev(`state.sheets.filter((s) => s.name === "Dela Cruz, Juan").length === 1 && state.sheets.find((s) => s.name).section === "10-A"`));
    await scan("10-A");
    check("later scans in that section are named from the list", await ev(`state.sheets.filter((s) => s.name === "Dela Cruz, Juan").length === 2`));
    check("the list is saved with the test file", await ev(`buildTestFile().test.roster["10-A"]["07"] === "Reyes, Ana"`));

    // ---- Target ----
    await typeIn("#targetInput", "90");
    check("changing the target updates the MPS panel", (await text("#mpsAside")) === "Target: 90%" && (await text("#mpsBox")).includes("scored 90% or higher"));
    await typeIn("#targetInput", "150");
    check("an out-of-range target is refused", (await ev(`state.test.target`)) === 90 && (await text("#targetHint")).includes("1 to 100"));
    await ev(`document.querySelector("#targetInput").blur()`);

    // ---- Key warning ----
    await typeIn("#keyInput", "ABCD");
    check("a short key warns in setup and over the results", (await text("#keyCount")).includes("not scored") && (await ev(`!document.querySelector("#keyWarn").hidden`)) && (await text("#keyWarn")).includes("4 of 50"));
    await ev(`state.test.keys.B = SAMPLE_KEY; renderAll()`);
    check("a full key clears the warning", await ev(`document.querySelector("#keyWarn").hidden`));

    // ---- Excel with sections, distribution, notes ----
    const xl = await ev(`(() => {
      const wb = buildWorkbook(), rows = (n) => XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1 });
      return { names: wb.SheetNames, scores: rows("Scores").slice(3, 6), mps: rows("MPS").map((r) => r.join("|")), answers: rows("Answers").map((r) => r[0] + "|" + r[1]), ia: rows("Item Analysis").map((r) => r.join("|")), notes: rows("Scan Notes").slice(2, 4) };
    })()`);
    check("Excel has the Section column in Scores and Answers", xl.scores[0][1] === "Section" && xl.answers.some((r) => r.startsWith("10-A|")));
    check("Excel MPS lists each section, the distribution and the target", ["10-A|", "10-B|", "All sections", "Score distribution", "96–100|Mastered", "Target MPS: 90%"].every((t) => xl.mps.some((r) => r.includes(t))), JSON.stringify(xl.mps.slice(0, 8)));
    check("Excel item analysis has the KR-20 line and the notes guide", xl.ia.some((r) => r.includes("KR-20")) && xl.ia.some((r) => r.startsWith("Check the key|")));
    check("Excel's least-mastered column follows the target", xl.mps.some((r) => r.includes("Least mastered (below 90%)")));

    // ---- Print report ----
    await typeIn("#testName", "Q1 <b>Summative</b>");
    await ev(`window.__printed = 0; window.print = () => { window.__printed++; }; 0`);
    await ev(`document.querySelector("#printBtn").click()`);
    check("Print report opens its options bar", await ev(`!document.querySelector("#printBar").hidden`));
    await ev(`document.querySelector("#printGo").click()`);
    check("Print calls the browser print dialog once", (await ev(`window.__printed`)) === 1);
    const rep = await ev(`document.querySelector("#printArea").innerHTML`);
    check("the report has MPS, distribution, scores and item analysis", ["Mean Percentage Score", "Score distribution", "Least mastered", "Scores", "Item analysis", "How to read this"].every((s) => rep.includes(s)));
    check("the test name is escaped, not injected as HTML", rep.includes("Q1 &lt;b&gt;Summative&lt;/b&gt;") && !rep.includes("<b>Summative</b>"));
    check("student names are in the report by default", rep.includes("Dela Cruz, Juan"));
    check("the screen is untouched after printing", await ev(`getComputedStyle(document.querySelector(".window")).display !== "none" && getComputedStyle(document.querySelector("#printArea")).display === "none"`));
    await ev(`document.querySelector("#printBtn").click(); document.querySelector("#printNames").checked = false; document.querySelector("#printGo").click()`);
    check("untick names and they are left out", !(await ev(`document.querySelector("#printArea").innerHTML`)).includes("Dela Cruz"));

    // How it looks on paper: emulate print media, check the app is hidden and make a PDF + screenshot to look at.
    await ev(`document.querySelector("#printBtn").click(); document.querySelector("#printNames").checked = true; document.querySelector("#printGo").click()`);
    await send("Emulation.setEmulatedMedia", { media: "print" });
    check("in print, the app is hidden and the report is shown", await ev(`getComputedStyle(document.querySelector(".window")).display === "none" && getComputedStyle(document.querySelector("#printArea")).display === "block"`));
    const pdf = await send("Page.printToPDF", { paperWidth: 8.27, paperHeight: 11.69, printBackground: true, preferCSSPageSize: true });
    const pdfBuf = Buffer.from(pdf.result.data, "base64");
    const pages = (pdfBuf.toString("latin1").match(/\/Type\s*\/Page[^s]/g) || []).length;
    fs.writeFileSync(path.join(os.tmpdir(), "sagot-report.pdf"), pdfBuf);
    check("a PDF of the report is produced", pdfBuf.length > 5000 && pdfBuf.slice(0, 4).toString() === "%PDF", `${pdfBuf.length} bytes`);
    console.log(`      report PDF: ${pdfBuf.length} bytes, ${pages} page(s) -> ${path.join(os.tmpdir(), "sagot-report.pdf")}`);
    await send("Emulation.setEmulatedMedia", { media: "screen" });

    // ---- Phone width with sections showing ----
    await send("Emulation.setDeviceMetricsOverride", { width: 400, height: 900, deviceScaleFactor: 1, mobile: true });
    await sleep(500);
    check("no horizontal scroll at 400px with sections and the new fields", await ev(`document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1`), `${await ev("document.documentElement.scrollWidth")} > ${await ev("document.documentElement.clientWidth")}`);
    check("no console errors or exceptions", errors.length === 0, errors.join(" | ").slice(0, 400));
    b.finish();
  } catch (e) { b.finish(e); }
})();
