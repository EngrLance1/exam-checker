// js/scanner.js — loads a photo, runs the OMR reader, and turns the result into a sheet record (or a key).

/* ---------- image processing ---------- */
const tick = () => new Promise((r) => setTimeout(r, 30));
async function loadImage(src) {
  const img = new Image();
  img.src = src;
  await img.decode();
  const s = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.round(img.naturalWidth * s), h = Math.round(img.naturalHeight * s);
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  const ctx = c.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, w, h);
  return { canvas: c, gray: OMR.toGray(ctx.getImageData(0, 0, w, h).data, w, h), w, h };
}

let qid = 0;
function queueItem(name) {
  const li = document.createElement("li");
  li.innerHTML = `<span class="spin" aria-hidden="true"></span><span class="nm"></span>`;
  li.querySelector(".nm").textContent = `Reading ${name}…`;
  $("#queue").prepend(li);
  return {
    done(msg) { li.remove(); if (msg) toast(msg); },
    fail(msg) { li.className = "err"; li.innerHTML = `<span class="nm"></span><button type="button" class="btn small" aria-label="Dismiss"><svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg></button>`; li.querySelector(".nm").textContent = `${name}: ${msg}`; li.querySelector("button").onclick = () => li.remove(); }
  };
}

async function processSource(src, name, opts = {}) {
  const q = queueItem(name);
  await tick();
  let im;
  try { im = await loadImage(src); } catch (e) { q.fail("This file couldn't be opened as an image."); return; }
  await tick();
  const res = OMR.read(im.gray, LAYOUTS);
  if (!res.ok) { q.fail(res.error); return; }
  const letters = res.items.map((it) => it.flag === "multiple" ? "*" : it.choice == null ? "" : LET[it.choice]);
  if (state.keyCapture) {
    const set = state.keyCapture;
    state.test.size = sizeAfterKey(res.size);
    state.test.keys[set] = letters.slice(0, state.test.size).map((l) => l && l !== "*" ? l : "-").join("");
    state.keyCapture = null; state.activeSet = set;
    const gaps = letters.filter((l) => !l || l === "*").length;
    q.done(`Set ${set} key read from the sheet (${state.test.size} items${gaps ? `, ${gaps} unreadable — fill them in` : ""}).`);
    renderAll(); save(); return;
  }
  const id = "s" + Date.now().toString(36) + (qid++);
  const sheet = {
    id, size: res.size, classNo: res.classNo || "", name: opts.name || "", section: opts.sample ? "" : state.activeSection, set: res.set || "",
    answers: letters,
    flags: res.items.map((it) => it.flag === "blank" ? null : it.flag),
    pts: res.items.map((it) => it.pts.map(([x, y]) => [Math.round(x), Math.round(y)])),
    r: res.items.map((it) => Math.round(it.r * 10) / 10),
    w: im.w, h: im.h, sample: !!opts.sample, scanned: new Date().toISOString()
  };
  if (!sheet.name) sheet.name = rosterName(sheet);
  photos[id] = opts.sample ? SAMPLE_SRC : im.canvas.toDataURL("image/jpeg", 0.8);
  state.sheets.push(sheet);
  state.selected = id;
  q.done(opts.sample ? "" : `Read Class No. ${sheet.classNo || "?"} (${res.size} items).`);
  renderAll(); save();
}

async function handleFiles(files) {
  for (const f of files) {
    if (!f.type.startsWith("image/")) { const q = queueItem(f.name); q.fail("Only photos or image scans can be read (JPG, PNG, HEIC from the camera)."); continue; }
    const url = URL.createObjectURL(f);
    await processSource(url, f.name);
    URL.revokeObjectURL(url);
  }
}
