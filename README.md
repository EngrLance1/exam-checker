# SagotScan

An answer sheet checker for classroom teachers. Take a photo of a filled multiple-choice answer sheet, and SagotScan reads it, scores it against your answer key, and gives you the class Mean Percentage Score (MPS) and item analysis. It runs entirely in the browser: no server, no account, no build step, and your photos never leave your device.

Scope: **exam score checking and item analysis only.** It is not a gradebook or class record.

## Run it

Open `index.html` in a browser (Chrome, Edge, Firefox or Safari). That's all. It also works from a phone: "Take photo" opens the camera.

## What it does

- **Scans** photos of 30, 50 or 60-item answer sheets. It finds the four corner squares, flattens the photo, reads the class number, the test set (A to D) and every answer, and flags double marks, faint marks and erasures for you to check.
- **Scores** against up to four answer keys (Sets A to D). Type a key, or scan a key sheet. A test can have any number of items from 1 to 60 (a 40-item test uses the 50-item sheet).
- **Class MPS** with the DepEd mastery levels, a configurable target (75% by default), per-section and per-set breakdowns, and a score distribution.
- **Item analysis:** difficulty (p), discrimination (D, upper and lower 27%), option counts, Retain / Revise / Reject decisions, "check the key" and "few chose" notes, and KR-20 reliability with SEM.
- **Fix a bad item** after scoring: also accept another letter, change the key, credit everyone, or drop the item. Everything recomputes.
- **Sections** (several classes taking one test), a pasted **class list** that fills in names, **search**, and **undo** for destructive actions.
- **Export:** Excel (Scores, MPS, Answers, Item Analysis, Item Fixes, Scan Notes), a printable report, and a saved test file you can open again later.
- A glass-style **dashboard** summarising the class, the chart of each item, and what needs attention. Every number shown comes from your scanned sheets.

## Limits

- Only the three printed sheet designs in `js/data/layouts.js` are supported (30, 50 and 60 items, four corner squares, items numbered down each column). The scanner works from stored bubble positions; it does not read the printed numbers, so a different sheet layout will not read correctly.
- Work is kept in the browser's `localStorage`. Photos are not stored: use **Save test file** to keep a copy of a test.
- Tested on generated data and the built-in sample sheet. Check the first few real scans against the paper.

## Project layout

```
index.html          page shell: sidebar, top bar, the six pages
css/styles.css      all screen styles (every colour, radius, blur, shadow is a variable in :root)
css/print.css       the printed report only
js/omr.js           the sheet reader (pure image code)
js/core/            logic without any DOM: state, scoring, analysis, MPS, dashboard numbers, test file, class list, undo
js/scanner.js       photo to sheet record
js/ui/              rendering, navigation, charts (hand-drawn SVG), events, printable report
js/excel/           one builder per Excel sheet
js/data/            generated data: bubble layouts and the sample sheet photo
js/vendor/          SheetJS (kept local so Excel export works offline)
tests/              logic tests and real-browser tests
docs/               the feature backlog
```

Scripts are plain `<script>` tags that share one global scope, so the load order in `index.html` matters. They are not ES modules because browsers block modules when a page is opened straight from disk.

## Tests

Needs Node 22 or newer (the browser tests use its built-in WebSocket). The browser tests also need Chrome or Edge installed.

```
node --test tests/*.test.js     # logic, colour contrast of the CSS tokens
node tests/browser-smoke.js     # export, item fixes, save/open, custom item counts
node tests/browser-features.js  # sections, duplicates, undo, class list, target, print report, Excel
node tests/browser-shell.js     # the glass look, pages, dashboard, search, menus, responsive, focus rings
```

## Credits

- [SheetJS](https://sheetjs.com) community edition 0.18.5 (Apache-2.0) for Excel export. See `js/vendor/NOTICE.md`.
- [Lucide](https://lucide.dev) icons (ISC), inlined in `index.html`.
- Plus Jakarta Sans and IBM Plex Mono, loaded from Google Fonts when online (system fonts are the fallback).

No licence has been chosen for this project yet.
