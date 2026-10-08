// js/core/dashboard.js — the numbers behind the Dashboard page. Real data only; no DOM here, so it can be tested in Node.

// "just now", "5 min ago", "2 h ago", "3 d ago", else the date. iso: an ISO date string.
function relTime(iso, now = Date.now()) {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "";
  const m = Math.round((now - t) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  if (m < 60 * 24) return `${Math.round(m / 60)} h ago`;
  if (m < 60 * 24 * 7) return `${Math.round(m / 1440)} d ago`;
  return new Date(t).toLocaleDateString("en-PH", { month: "short", day: "numeric" });
}

// Two letters for an avatar: "Dela Cruz, Juan" -> "DJ", "Ana Reyes" -> "AR", nothing -> the class number.
function initialsOf(name, classNo) {
  const words = String(name || "").split(/[\s,]+/).filter(Boolean);
  if (!words.length) return classNo || "?";
  const first = String(name).includes(",") ? words[words.length - 1] : words[0];
  const last = String(name).includes(",") ? words[0] : words[words.length - 1];
  return (first[0] + (words.length > 1 ? last[0] : "")).toUpperCase();
}

const sheetLabel = (s) => `Class No. ${s.classNo || "??"}${s.name ? " · " + s.name : ""}`;

// Things the teacher should look at, worst first. level: "bad" (urgent), "warn" (check), "info".
function attentionList() {
  const out = [];
  state.sheets.filter((s) => !s.sample || issuesOf(s).length).forEach((s) => {
    const iss = issuesOf(s).sort((a, b) => (b.c === "bad") - (a.c === "bad"));
    if (iss.length) out.push({ id: s.id, level: iss[0].c === "bad" ? "bad" : "warn", title: sheetLabel(s), detail: iss.map((i) => i.t).join(" · ") });
  });
  keyProblems().forEach((t) => out.push({ id: null, level: "warn", title: "Answer key", detail: t }));
  const groups = analyze();
  const miskey = [];
  groups.forEach((g) => g.items.forEach((it) => { if (it.notes.some((n) => n.kind === "miskey")) miskey.push(`${groups.length > 1 ? g.set + "-" : ""}#${it.no}`); }));
  if (miskey.length) out.push({ id: null, level: "warn", title: "Check the answer key", detail: `Top scorers preferred a wrong option on ${miskey.slice(0, 6).join(", ")}${miskey.length > 6 ? " …" : ""}.` });
  const reject = groups.reduce((a, g) => a + g.items.filter((it) => !it.dropped && decision(it.p, it.d) === "Reject").length, 0);
  if (reject) out.push({ id: null, level: "info", title: `${reject} item${reject > 1 ? "s" : ""} to reject`, detail: "Low discrimination. See Item analysis." });
  const rank = { bad: 0, warn: 1, info: 2 };
  return out.sort((a, b) => rank[a.level] - rank[b.level]);
}

// Everything the dashboard cards show. setName: which answer-key set the chart uses (default: the first with data).
function dashboardData(setName = "", now = Date.now()) {
  const rep = mpsReport(), o = rep.overall, tg = rep.target;
  const sheets = state.sheets;
  const toCheck = sheets.filter((s) => issuesOf(s).length).length;
  const scored = sheets.map((s) => ({ s, r: scoreOf(s) })).filter((x) => x.r);

  const groups = analyze(), g = groups.find((x) => x.set === setName) || groups[0] || null;
  const items = g ? g.items.filter((it) => !it.dropped).map((it) => ({ no: it.no, p: it.p, d: it.d })) : [];
  const gm = g ? mpsOf(scored.filter((x) => x.r.set === g.set).map((x) => x.r)) : null;

  return {
    sheets: sheets.length, toCheck, target: tg,
    mps: o ? o.mps : null, level: o ? o.level : "",
    atTarget: o ? { n: o.passed, of: o.n, pct: (o.passed / o.n) * 100 } : null,
    bands: rep.dist.map((b) => b.count),
    attention: attentionList(),
    recent: [...sheets].filter((s) => s.scanned).sort((a, b) => Date.parse(b.scanned) - Date.parse(a.scanned)).slice(0, 6).map((s) => {
      const r = scoreOf(s);
      return { id: s.id, text: `Scanned ${sheetLabel(s)}`, sub: r ? `${r.score} / ${r.total}` : "no key yet", time: relTime(s.scanned, now), sample: !!s.sample };
    }),
    top: scored.filter((x) => x.r.total).map((x) => ({ id: x.s.id, name: x.s.name, classNo: x.s.classNo, score: x.r.score, total: x.r.total, pct: (x.r.score / x.r.total) * 100 }))
      .sort((a, b) => b.pct - a.pct || (a.classNo || "").localeCompare(b.classNo || "")).slice(0, 5),
    chart: { sets: groups.map((x) => x.set), set: g ? g.set : "", items, mean: gm ? gm.mean : null, kr20: g && g.rel ? g.rel.kr20 : null, n: g ? g.n : 0 },
  };
}
