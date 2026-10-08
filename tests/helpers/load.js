// tests/helpers/load.js — loads the app's non-DOM files into a Node vm context, the same way the browser shares globals.
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = path.join(__dirname, "..", "..");
const FILES = ["js/config.js", "js/core/util.js", "js/core/state.js", "js/core/testfile.js", "js/core/classlist.js", "js/core/undo.js", "js/core/scoring.js", "js/core/analysis.js", "js/core/mps.js", "js/core/dashboard.js", "js/ui/charts.js"];

function load() {
  const store = {};
  const ctx = vm.createContext({
    document: { querySelector: () => null },
    localStorage: {
      getItem: (k) => (k in store ? store[k] : null),
      setItem: (k, v) => { if (ctx.__failSave) throw new Error("quota"); store[k] = String(v); },
    },
    console, SAMPLE_SRC: "", SAMPLE_KEY: "",
  });
  for (const f of FILES) vm.runInContext(fs.readFileSync(path.join(ROOT, f), "utf8"), ctx, { filename: f });
  ctx.run = (code) => vm.runInContext(code, ctx);
  ctx.store = store;
  return ctx;
}

// Builds a sheet record from an answers string ("." = blank).
function sheet(id, answers, extra = {}) {
  const arr = answers.split("").map((c) => (c === "." ? "" : c));
  return { id, size: arr.length, classNo: id.slice(-2), name: "", set: "A", answers: arr, flags: arr.map(() => null), pts: arr.map(() => []), r: arr.map(() => 0), w: 1, h: 1, ...extra };
}

module.exports = { load, sheet };
