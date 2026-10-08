// js/core/util.js — tiny DOM and text helpers, and the toast message.

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
let toastTimer;
// action (optional): {label, fn} adds a button, used for Undo. A toast with a button stays longer.
function toast(msg, action) {
  const t = $("#toast"); t.textContent = msg; t.hidden = false;
  if (action) {
    const b = document.createElement("button");
    b.type = "button"; b.className = "toast-btn"; b.textContent = action.label;
    b.onclick = () => { t.hidden = true; clearTimeout(toastTimer); action.fn(); };
    t.appendChild(b);
  }
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.hidden = true; }, action ? 10000 : 3800);
}
