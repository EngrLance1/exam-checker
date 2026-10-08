# SagotScan

An answer sheet checker for classroom teachers. Take a photo of a filled multiple-choice answer sheet, and SagotScan reads it, scores it against your answer key, and gives you the class Mean Percentage Score (MPS) and item analysis. It runs entirely in the browser: no server, no account, no build step, and your photos never leave your device.

Scope: **exam score checking and item analysis only.** It is not a gradebook or class record.

**Live:** https://sagotscan.vercel.app

## Run it

Open `index.html` (the landing page) in a browser, or go straight to `app/index.html`. That's all: no install, and it works from a folder on your computer. On a phone, "Take photo" opens the camera. To check your own class you need the printed sheet: open `sheets/index.html` to print the 30, 50 or 60-item sheet.

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

- Only the three printed sheet designs in `app/js/data/layouts.js` are supported (print them from `sheets/index.html`) (30, 50 and 60 items, four corner squares, items numbered down each column). The scanner works from stored bubble positions; it does not read the printed numbers, so a different sheet layout will not read correctly.
- Work is kept in the browser's `localStorage`. Photos are not stored: use **Save test file** to keep a copy of a test.
- Tested on generated data and the built-in sample sheet. Check the first few real scans against the paper.

## Project layout

```
index.html, landing.css, landing.js   the landing page (assets/ holds its images)
sheets/                               printable answer sheets, drawn from the scanner's own bubble layout
scripts/make-assets.js                regenerates the landing page images from the sheet design
app/
  index.html                          page shell: sidebar, top bar, the six pages
  css/tokens.css                      every colour, radius, blur, shadow and spacing value (shared by all pages)
  css/fonts.css, fonts/               self-hosted fonts, so no page requests anything from another site
  css/styles.css, print.css           app styles; the printed report
  js/omr.js                           the sheet reader (pure image code)
  js/core/                            logic without any DOM: state, scoring, analysis, MPS, dashboard numbers, test file, class list, undo
  js/scanner.js                       photo to sheet record
  js/ui/                              rendering, navigation, charts (hand-drawn SVG), events, printable report
  js/excel/                           one builder per Excel sheet
  js/data/                            generated data: bubble layouts and the sample sheet photo
  js/vendor/                          SheetJS (kept local so Excel export works offline)
tests/                                logic tests and real-browser tests
docs/                                 the feature backlog and the landing page plan
```

Scripts are plain `<script>` tags that share one global scope, so the load order in each `index.html` matters. They are not ES modules because browsers block modules when a page is opened straight from disk.

## Deploying

It is all static files, so any static host works. It is deployed on Vercel at https://sagotscan.vercel.app (project `sagotscan`, no framework, no build command, repository root as the output). No `vercel.json` is needed. `.vercelignore` keeps tests, scripts, docs and notes off the public site. To deploy: `vercel deploy --prod`. After every deploy run `node tests/browser-live.js https://sagotscan.vercel.app`, which loads the landing page, the app and the sheets page over the network and checks that they work and request nothing from other sites. Do not turn on `cleanUrls`: the app uses relative paths. Once you have a domain, add the `og:url` and `og:image` tags to `index.html` (an image can be made from the landing page).

## Tests

Needs Node 22 or newer (the browser tests use its built-in WebSocket). The browser tests also need Chrome or Edge installed.

```
node --test tests/*.test.js     # logic, sheet geometry, landing page, colour contrast of the CSS tokens
node tests/browser-smoke.js     # export, item fixes, save/open, custom item counts
node tests/browser-features.js  # sections, duplicates, undo, class list, target, print report, Excel
node tests/browser-shell.js     # the glass look, pages, dashboard, search, menus, responsive, focus rings, no outside requests
node tests/browser-landing.js   # landing page, sheets page, a sheet prints on one A4 and one Letter page
node tests/browser-live.js URL   # smoke test of a deployed site (landing, app, sheets; no outside requests)
node tests/browser-sheets.js    # renders each printable sheet, photographs it 11 ways, reads it with the real scanner (about 3 minutes)
```

## Credits

- [SheetJS](https://sheetjs.com) community edition 0.18.5 (Apache-2.0) for Excel export. See `app/js/vendor/NOTICE.md`.
- [Lucide](https://lucide.dev) icons (ISC), inlined in `app/index.html`.
- Plus Jakarta Sans and IBM Plex Mono (SIL Open Font License), self-hosted in `app/fonts/`. See `app/fonts/NOTICE.md`.

No licence has been chosen for this project yet.
