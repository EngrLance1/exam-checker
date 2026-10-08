// js/ui/render-review.js — panel 5: review one sheet (answer buttons and the photo overlay).

function renderReview() {
  const sh = state.sheets.find((s) => s.id === state.selected);
  const panel = $("#reviewPanel");
  panel.hidden = !sh;
  if (!sh) return;
  $("#revAside").textContent = `${sh.size} items` + (sh.sample ? " · sample" : "");
  const iss = issuesOf(sh);
  $("#issues").innerHTML = iss.length ? iss.map((i) => `<li class="chip ${i.c}">${esc(i.t)}</li>`).join("") : `<li class="chip">No problems found</li>`;
  const cl = $("#rvClass"), nm = $("#rvName");
  if (document.activeElement !== cl) cl.value = sh.classNo;
  if (document.activeElement !== nm) nm.value = sh.name;
  $("#rvSet").value = sh.set;
  const rs = $("#rvSection");
  if (document.activeElement !== rs) rs.value = secOf(sh);
  const dups = duplicatesOf(sh), dupBar = $("#dupBar");
  dupBar.hidden = !dups.length;
  if (dups.length) {
    const where = secOf(sh) ? ` in ${esc(secOf(sh))}` : "";
    dupBar.innerHTML = `<span>Class No. ${esc(sh.classNo)} is also on ${dups.length === 1 ? "another sheet" : dups.length + " other sheets"}${where}. Same student scanned twice?</span>
      <span class="row"><button type="button" class="btn small" id="dupKeepThis">Keep this one, remove the other${dups.length > 1 ? "s" : ""}</button><button type="button" class="btn small" id="dupKeepOther">${dups.length === 1 ? "Keep the other, remove this one" : "Remove this one"}</button></span>`;
  }
  const kk = keyFor(sh);
  const shown = Math.min(sh.size, state.test.size); // items past the test length are not part of this test
  $("#items").innerHTML = sh.answers.slice(0, shown).map((a, i) => {
    const rule = kk ? ruleFor(kk.set, i) : null;
    const fl = sh.flags[i];
    const btns = LET.split("").map((L) => {
      const on = a === L || (a === "*" && false);
      const isKey = !!rule && !rule.all && rule.letters.includes(L);
      const cls = ["bub", on ? "on" : "", on && rule ? (isRight(rule, L) ? "right" : "wrong") : "", isKey ? "key" : ""].join(" ");
      return `<button type="button" class="${cls}" data-i="${i}" data-l="${L}" aria-pressed="${on}" aria-label="Item ${i + 1} ${L}${isKey ? " (key)" : ""}">${L}</button>`;
    }).join("");
    const why = fl ? `<span class="why">${FLAGTXT[fl] || ""}</span>` : a === "*" ? `<span class="why">Two marks</span>` : "";
    return `<div class="it${fl ? " flagged" : ""}"><span class="n">${i + 1}</span>${btns}${why}</div>`;
  }).join("");
  $("#useAsKey").textContent = `Use as Set ${sh.set || state.activeSet} answer key`;
  $("#removeConfirm").hidden = true; $("#removeSheet").hidden = false;
  drawPhoto(sh, kk);
}

let photoCache = { id: null, img: null };
async function drawPhoto(sh, kk) {
  const box = $("#photo");
  const src = photos[sh.id];
  if (!src) { box.innerHTML = `<div class="none">The photo isn't kept after the page reloads. The answers below are saved.</div>`; return; }
  let img = photoCache.id === sh.id ? photoCache.img : null;
  if (!img) { img = new Image(); img.src = src; try { await img.decode(); } catch (e) { return; } photoCache = { id: sh.id, img }; }
  if (state.selected !== sh.id) return;
  let c = box.querySelector("canvas");
  if (!c) { box.innerHTML = ""; c = document.createElement("canvas"); box.appendChild(c); }
  c.width = sh.w; c.height = sh.h;
  c.setAttribute("aria-label", `Photo of the scanned sheet for class number ${sh.classNo || "unknown"}`);
  const ctx = c.getContext("2d");
  ctx.drawImage(img, 0, 0, sh.w, sh.h);
  const css = getComputedStyle(document.documentElement);
  const OK = "#1f9a5a", BAD = "#d93025", WARN = "#e8890c", NEU = "#1f6a4a";
  const lw = Math.max(2, sh.w / 400);
  const shown = Math.min(sh.size, state.test.size);
  sh.pts.forEach((grp, i) => {
    if (i >= shown) return;
    const r = sh.r[i];
    if (sh.flags[i] || sh.answers[i] === "*") {
      const xs = grp.map((p) => p[0]), ys = grp.map((p) => p[1]);
      ctx.strokeStyle = WARN; ctx.lineWidth = lw * 1.3;
      ctx.strokeRect(Math.min(...xs) - r * 1.6, Math.min(...ys) - r * 1.6, Math.max(...xs) - Math.min(...xs) + r * 3.2, Math.max(...ys) - Math.min(...ys) + r * 3.2);
    }
    const a = sh.answers[i], li = LET.indexOf(a);
    if (li < 0) return;
    const rule = kk ? ruleFor(kk.set, i) : null;
    ctx.strokeStyle = rule ? (isRight(rule, a) ? OK : BAD) : NEU; ctx.lineWidth = lw;
    ctx.beginPath(); ctx.arc(grp[li][0], grp[li][1], r * 1.45, 0, Math.PI * 2); ctx.stroke();
  });
}
