// js/download.js — saves a file to the user's device.
// Inside claude.ai it uses the host's downloads service; anywhere else it uses a normal browser download.

let downloads = null; // set in main.js when the claude.ai downloads service exists

async function saveFile(filename, blob) {
  if (downloads) { await downloads.save({ filename, data: blob }); return; }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.hidden = true;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

async function saveWithToast(filename, blob, okMsg) {
  try { await saveFile(filename, blob); toast(okMsg); }
  catch (e) {
    const code = e && e.code;
    if (code === "declined") toast("Download cancelled.");
    else if (code === "rate_limited") toast("A save prompt is already open. Finish it, then try again.");
    else toast("The file couldn't be saved here.");
  }
}

// A safe file name from the test name.
function fileBase() {
  return (state.test.name || "Test results").replace(/[\/:*?"<>|]+/g, " ").trim().slice(0, 80) || "Test results";
}
