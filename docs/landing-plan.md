# Landing page and printable sheets: plan and decisions

Written after four agents (researcher, UI/UX designer, product manager, frontend architect) each reviewed the idea on their own and reported back. Where they disagreed, the choice and the reason are below.

## What was built

| Part | Where | Notes |
|---|---|---|
| Landing page | `index.html`, `landing.css`, `landing.js` | Headline: "Check answer sheets from your phone. Get your MPS in minutes." with one Filipino line about free, no account, photos stay on the device |
| Printable sheets | `sheets/` | 30, 50 and 60-item sheets drawn from `app/js/data/layouts.js`, printed 187 mm wide, one page on A4 and Letter |
| App moved | `app/` | The landing page owns the site root |
| Shared tokens and fonts | `app/css/tokens.css`, `app/css/fonts.css`, `app/fonts/` | Fonts are self-hosted: no page requests anything from another site |

## Decisions where the agents disagreed

1. **Where the landing page lives.** Researcher: landing at `/`, app at `/app/`. Architect: app stays at `/`, landing at `/landing/` with a rewrite. Chosen: **landing at `/`, app at `/app/`**. The architect's setup relies on a rewrite of `/` that would likely send `/index.html` back to the landing page and lock people out of the app (unverified). The cost of moving the app was about 28 paths plus the test helper, and the tests caught every slip.
2. **Vercel config.** Researcher and architect both suggested `cleanUrls`. Chosen: **no `vercel.json`, and never `cleanUrls`**: with it, `/app/index.html` becomes `/app` and every relative asset path breaks. Links use `app/index.html`, which also works from a folder on disk.
3. **Printable sheet: v1 or later?** Product manager: essential for v1. Architect: risky, do later. Chosen: **build it first** (the user's decision). It was verified by scanning, not just by looking (see below).
4. **Pictures.** Real artifacts, not illustrations: the generated sample sheet and static HTML/CSS mockups of the app, always labelled "Sample data", with numbers that add up.

## How the sheets were verified

`tests/sheets.test.js` checks that every bubble the scanner reads is drawn at its exact position. `tests/browser-sheets.js` draws each sheet with known answers, "photographs" it (straight, rotated, upside down, strong tilt, dim light, noise, blur, low resolution, light pencil) and reads it with the real scanner: 33 scans, every answer, class number, set and size correct. `tests/browser-landing.js` prints each sheet to PDF and confirms one page on A4 and one on Letter.

Testing found two flaws in the first sheet design, both fixed: the corner squares were too close to the paper edge, and too small. Under strong tilt the scanner (which keeps only the 7 largest dark shapes) preferred shaded bubbles near the camera over the far corner squares. Bigger squares and a wider margin fixed it without changing the scanner.

## Still open

- **Real print-and-photograph test.** Everything above uses synthetic photos. Print one sheet, fill it by hand, photograph it with a phone, and scan it. Do this before telling teachers it works.
- **Domain-dependent tags.** `og:url`, `og:image` (1200x630) and a sitemap need the final address.
- **Licence.** None chosen; the page says so.
- **Offline.** The app has no service worker, so reloading with no connection fails once hosted. A small one would make "works offline" fully true. Not built; the page claims only what is true today.
- **Filipino line.** Worth a read by a native speaker.
- **Accuracy claims.** The page says it was tested on generated sheets and one sample, not many real photos. Replace with real numbers once a real-photo test exists.
