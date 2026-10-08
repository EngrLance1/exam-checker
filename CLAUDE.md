# SagotScan: project rules for Claude

SagotScan is a browser app (open `index.html`) for Filipino classroom teachers. They photograph multiple-choice answer sheets (30, 50 or 60 items), the app checks them against answer keys (Sets A-D), shows the Mean Percentage Score (target 75%) and item analysis, and exports Excel.

## Stack and conventions
1. Plain HTML + CSS + vanilla JS split into small files. No package.json, no bundler, no build step. It must keep working when `index.html` is opened straight from disk, so use classic `<script src>` tags (not ES modules, which browsers block on `file://`). All scripts share one global scope, so **load order in `index.html` matters**.
2. One concern per file, so each can be read and checked alone:
   - `index.html`: markup only, plus the ordered script tags.
   - `css/styles.css`: screen styles. Every colour, radius, blur, shadow and spacing value is a variable in `:root` (light only, no dark mode). `css/print.css`: the printed report only (fixed black-on-white colours).
   - `js/config.js`: constants. `js/data/`: generated data (`layouts.js` bubble positions, `sample.js` sample photo; never hand-edit).
   - `js/omr.js`: the sheet reader. Pure image code, no DOM, no app state.
   - `js/core/`: logic with no DOM drawing: `util.js`, `state.js` (state, sections, target, localStorage), `testfile.js` (save/open a test file), `classlist.js` (pasted class list), `undo.js` (snapshots), `scoring.js` (scores, item fixes, sheet and key problems), `analysis.js` (item analysis, key/option notes, KR-20), `mps.js` (MPS, distribution), `dashboard.js` (the numbers the Dashboard cards show; real data only).
   - `js/scanner.js`: photo to sheet record.
   - `js/ui/`: `render-*.js` (one per panel/page, incl. `render-dashboard.js`), `charts.js` (hand-drawn SVG charts, no chart library), `nav.js` (pages, top bar, search, ⋯ menus), `report.js` (printable report), `events.js`, `clear.js` (confirm bar, undo toast).
   - `js/excel.js` assembles the workbook; one builder per sheet in `js/excel/`. `js/download.js`: saving any file (claude.ai downloads service, else a normal browser download). `js/main.js`: start-up.
   - `js/vendor/xlsx.full.min.js`: SheetJS 0.18.5, kept local so export works offline. Never edit it.
3. Keep `core/` and `omr.js` free of DOM calls so they can be tested in Node. New code goes in the file that owns that concern; add a new file (and its script tag) rather than growing a big one.
4. Only external dependency is SheetJS 0.18.5 (vendored in `js/vendor/`); Google Fonts is optional (system fonts are the fallback). No new dependency without justification and an exact pinned version.
5. Mis-scoring a student or losing saved sheets is the worst kind of bug. Be careful in `js/omr.js`, `scoring.js`, `analysis.js` and `state.js`.
6. Tests live in `tests/`. Run `node --test tests/*.test.js` (logic and the colour-contrast check of the CSS tokens; loads the real files in a Node `vm`; add new core files to `tests/helpers/load.js`) and the real-browser scripts (headless Chrome/Edge): `node tests/browser-smoke.js` (export, fixes, save/open, custom items), `node tests/browser-features.js` (sections, duplicates, undo, class list, target, key warnings, print report, Excel), `node tests/browser-shell.js` (glass look, pages, dashboard, search, menus, chart, responsive, focus rings). Run all after any change; add a test with every new feature. The app has pages (`showView`): Dashboard, Test setup, Scan sheets, Scores, Item analysis, Reports. Tests that type into a field must be on its page (`showView` first).
7. Data rules: the test is `state.test` = `{name, size, keys, fixes}`. `size` is 1-60 (the test's item count); sheets are always 30/50/60 and a test uses the smallest sheet that fits (`sheetSizeFor`). `target` (1-100, default 75) drives every MPS comparison via `targetPct()`; never hard-code 75. Sheets carry an optional `section`; class numbers are unique per section (`duplicatesOf`), and `state.test.roster[section][classNo]` holds pasted names. Sheets of the wrong printed size are scored and flagged but left out of item analysis (`rightSize`). Item fixes (`also`, `key`, `credit`, `drop`) change what counts as right via `ruleFor`; never read `keys[set][i]` directly for scoring. Saved data and test files must stay loadable by later versions (`TESTFILE_VERSION`, `cleanFixes`).

## Team workflow
Four subagents live in `.claude/agents/`. Use them in this order:
1. **New feature ideas:** `product-manager`. It studies the site and users and writes a prioritized backlog to `docs/feature-backlog.md`.
2. **Before building, when anything is unfamiliar:** `researcher`. Read-only, returns a sourced brief; unconfirmed claims are marked "unverified".
3. **Build:** `fullstack-engineer`. Plans, asks approval before anything destructive, builds in small edits, verifies, reports. It also owns all UI/UX work.
4. **After building:** `qa-tester`. It runs checks, writes tests in `tests/`, and reports PASS/FAIL with bugs. It never edits app code.
5. **Bugs go back to `fullstack-engineer`, and the loop repeats until `qa-tester` reports PASS.**

Simple edits (one file, obvious change) can be done directly without a subagent.

## UI/UX design rules (apply to every task)
The goal is an interface that looks designed for *this* product by a person with taste, not a template.

> **Design override (Oct 2026).** The user explicitly asked for a soft glassmorphism UI. For this app that overrides banned items 1 (gradients), 2 (glassmorphism, frosted blur), 8 (rounded cards with soft shadows) and the "flat colour / borders over shadows / 4px radius" guidance below. The other banned items still apply, above all **no fake stats, fake testimonials or fake logos**: dashboard cards show only real exam data (see `js/core/dashboard.js`), and empty states say so. The older record-book direction (Bitter/Source Sans, ledger tables, highlighter) is retired.

NO generic "AI look". Banned unless the user names them:
1. Purple/indigo/violet gradients, and gradient text
2. Glassmorphism, frosted blur, glowing or neon shadows
3. The centered hero with headline, subtitle, two pill buttons and a gradient blob
4. Three identical icon-topped feature cards in a row
5. Emoji used as icons
6. Sparkle, robot, brain or magic-wand imagery
7. Inter/Poppins/system-ui as the default font with no reason
8. Everything rounded-2xl with the same soft shadow
9. Filler copy ("Unlock", "Seamless", "Elevate", "Supercharge", "Revolutionize")
10. Fake stats, fake testimonials or fake logos

Instead:
1. State a visual direction in one line before designing, and stick to it. Current direction: soft glassmorphism. Frosted white cards (`.glass`: ~68% white, `--blur` 18px, `--radius-card` 18px, blue-tinted soft shadow) floating over a pale lavender-blue gradient with blurred blue/violet blobs, inside one rounded window (`--radius-window` 28px). Primary blue `--primary` #4C6EF5 with violet `--violet` #7C5CFA (used together in charts and highlights), navy `--navy` text, muted `--muted` secondary text, status colours only as small tinted pills or dots. Light only: no dark mode. Cards lift 2px on hover (200ms ease).
2. Restrained palette: neutrals plus one accent, flat color, CSS variables. Extend the light and dark token sets together.
3. Deliberate font pairing with a clear type scale. Left-align by default. Font: Plus Jakarta Sans (system fallback so it still looks right offline); big numbers 28-32px bold, card titles ~15px semibold, labels 12-13px muted; ligatures off so small text like "fix" stays clear. IBM Plex Mono only for the answer-key box and tables of letters.
4. A real grid with some asymmetry; vary section layouts.
5. Use the radius variables (`--radius-card`, `--radius-field`, `--radius-pill`); never hard-code a radius, colour, blur or shadow outside `:root`.
6. One line-icon set, used sparingly.
7. Plain, specific, human copy.
8. WCAG AA contrast, visible focus states, works at phone width, no horizontal scroll.

Self-check before finishing any UI: "Would this look the same if built for a different product?" If yes, redo it.

## General working rules
1. Read before you edit. Match existing conventions.
2. Plan in numbered steps for anything over a few lines.
3. Run it before saying it works. Report what was and was not verified.
4. Ask before anything destructive (deleting files, changing the saved-data shape, data loss).
5. Keep explanations short and numbered.
