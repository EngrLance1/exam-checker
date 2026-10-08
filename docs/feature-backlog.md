# SagotScan: review and feature backlog

Scope guard: SagotScan does **exam score checking and item analysis only**. Every item below must serve one of those two jobs. Anything that turns it into a gradebook, class record, LMS or AI tool is listed under "Not recommended".

Reviewed file: the original single-file `exam checker.html` (since split into `index.html`, `css/` and `js/`, and removed).

## Status (updated)
| # | Feature | Status |
|---|---|---|
| 1 | Export that works anywhere | **Built.** Browser download fallback; SheetJS vendored locally for offline use |
| 2 | Backup and open test file | **Built.** Save/Open test file, confirm before replacing, visible warning if browser storage fails |
| 3 | Fix a miskeyed item after scoring | **Built.** Per item in Item analysis: also accept a letter, change key, credit everyone, drop. Recomputes everything; new "Item Fixes" Excel sheet |
| new | Custom number of items (1-60) | **Built.** "Other" box beside 30/50/60. A 40-item test uses the 50-item sheet; items after 40 are ignored |
| 4 | Printable MPS and item analysis report | **Built.** "Print report" button, option to leave names out; separate print stylesheet |
| 5 | Several sections of one test | **Built.** Section on each sheet, class numbers unique per section, MPS per section and overall, item analysis filter, Section columns in Excel |
| 6 | Smarter item analysis | **Built.** "Check the key" and "Few chose" notes, KR-20 and SEM per set |
| 7 | Score distribution | **Built.** DepEd mastery-band table with bars, in the MPS panel, report and Excel |
| 8 | Key and sheet sanity checks | **Built.** Short/long key warnings, wrong-size sheets left out of analysis, duplicate resolver |
| 9 | Class list for names | **Built.** Paste "12 Dela Cruz, Juan" lines, per section, saved in the test file |
| 10 | Undo | **Built.** Undo button after remove sheet, use as key, clear sheets/key/all, open file, duplicate removal, clear class list |
| 11 | Configurable target | **Built.** Target MPS field in setup; MPS bar, counts, least-mastered list, Excel and report follow it |

## 1. What it does today (before these changes)

| Panel | What is implemented |
|---|---|
| 1 Test setup | Test name; 30/50/60 items; answer keys for Sets A-D typed in or read from a scanned key sheet; `-` marks an unscored item |
| 2 Scan sheets | Camera or upload, drag and drop, auto-detects sheet size, reads class number and set, flags double marks, faint marks and erasures |
| 3 Check results | Table of class no., name, set, score, status; counts of sheets, sheets to check, MPS, highest |
| 4 Mean Percentage Score | Class MPS vs 75% target, per-set MPS, DepEd mastery level, SD, high/low, count at 75%+, least-mastered items |
| 5 Review sheet | Photo overlay (right/wrong/check), tap to fix any answer, edit class no./name/set, use a sheet as the key, remove a sheet |
| 6 Item analysis | Per set: A-D and blank counts, difficulty p, discrimination D (upper/lower 27%, needs 4+ students), Retain/Revise/Reject |
| Export | Excel with Scores, MPS, Answers, Item Analysis, Scan Notes sheets |
| Persistence | `localStorage` (`sagotscan-v1`). Photos are not kept after reload |

## 2. Users and assumptions
- **Primary:** a Filipino classroom teacher scoring one test for one or more sections, usually on a phone or a school laptop, sometimes with poor or no internet. Assumed, not researched.
- **Secondary:** a subject head or department head who collects MPS and item analysis from several teachers. Assumed.
- The 75% target, the mastery scale and the Retain/Revise/Reject rule are DepEd-style and are already encoded.

## 3. Problems found in the current code
Ordered by how much they can hurt a teacher. Each was confirmed by reading the code; none was run in a browser.

1. **Download Excel does nothing outside claude.ai.** `exportExcel()` requires `window.claude.use("downloads")` (line ~1040, 1179-1183). Opened as a normal file or hosted page, the button only shows a toast and no file is saved. This is the app's main output.
2. **Export needs internet.** SheetJS loads from cdnjs (line 321). With no connection, `XLSX` is undefined and export fails.
3. **Silent save failure.** `save()` swallows every error (line 586). If storage is full or blocked, the teacher gets no warning and loses the work on reload.
4. **No backup, one test at a time.** "Clear all" wipes the test, keys and sheets. There is no file to keep or reopen. Clearing sheets to scan the next section also discards the previous section's results.
5. **Destructive actions without undo.** "Use as answer key" deletes the sheet from the student list immediately (line ~1097). Remove sheet has a confirm but no undo.
6. **Key shorter than the sheet is accepted quietly.** `scoreOf` stops at `key.length`, so a 40-letter key on a 50-item test gives totals of 40 with no warning. The key counter shows `40 / 50` but nothing blocks scoring.
7. **Duplicate class number has no fix path.** It is flagged "used twice" but the teacher must find and remove one sheet by hand.
8. **Wrong-size sheets still enter item analysis.** `analyze()` includes any scored sheet, even one flagged `N-item sheet (test is M)`.
9. **Item analysis is thin on the "why".** Option counts are shown, but nothing says an item may be miskeyed or that a distractor nobody picked is dead.
10. Minor: dismiss and set-check glyphs (`✕`, `✓`) are text characters used as icons, against the project's "one line-icon set" rule. The 75% target and pass mark are hard-coded.

## 4. Prioritized backlog

| Rank | Feature | Problem | Impact | Effort | Depends on |
|---|---|---|---|---|---|
| 1 | Export that works anywhere | Findings 1, 2 | High | S-M | none |
| 2 | Backup and open test file | Findings 3, 4, 5 | High | M | none |
| 3 | Fix a miskeyed item after scoring | Teachers find bad keys only after seeing results | High | M | none |
| 4 | Printable MPS and item analysis report | Reports get submitted on paper | High | M | none |
| 5 | Several sections of one test | Finding 4; teachers have 3-6 sections | High | L | 2 |
| 6 | Smarter item analysis (miskey and distractor flags, KR-20) | Finding 9 | Med | M | none |
| 7 | Score distribution | Reports usually include a frequency table | Med | S | none |
| 8 | Key and sheet sanity checks | Findings 6, 7, 8 | Med | S | none |
| 9 | Class list for names | Typing names one by one is slow | Med | S | none |
| 10 | Undo for destructive actions | Finding 5 | Low-Med | S | none |
| 11 | Configurable target | 75% hard-coded | Low | S | none |

## 5. Detailed entries

### 1. Export that works anywhere
- **Problem:** the Excel button only works inside claude.ai; offline it fails because SheetJS comes from a CDN.
- **Who benefits:** every teacher.
- **Story:** As a teacher, I want Download Excel to save a file when I open the app from my laptop or phone so that I can submit my results.
- **Acceptance criteria:**
  1. Opened from a local file or any normal web page, Download Excel saves a `.xlsx` with the same five sheets as today.
  2. Inside claude.ai it still uses the existing downloads path.
  3. With the network off, after the page has loaded once, export still works (SheetJS available offline).
  4. If it truly cannot save, the message says why and what to do.
  5. The "Saving files works when the page is open in claude.ai" note appears only when it is true.
- **Effort:** S-M (a download fallback is small; embedding SheetJS makes the file much larger and is a choice for the team).
- **Impact:** High.
- **Dependencies:** none. Open question: embed SheetJS (~1 MB, fully offline) vs keep the pinned CDN plus a service-worker cache. Ask `researcher`.

### 2. Backup and open test file
- **Problem:** all work lives in one browser's `localStorage`; one clear, one cache wipe or a full disk loses it, and save errors are hidden.
- **Who benefits:** teachers scoring large batches; anyone switching devices.
- **Story:** As a teacher, I want to save my test (keys, scores, answers) to a file and open it later so that I never lose a scoring session.
- **Acceptance criteria:**
  1. "Save test file" downloads a `.json` containing test, keys and sheets (photos optional, off by default).
  2. "Open test file" restores it after confirming it will replace current data; bad files give a clear error and change nothing.
  3. If `localStorage` writes fail, a visible warning appears once and points to Save test file.
  4. Files from this version load in later versions (include a version field).
- **Effort:** M. **Impact:** High. **Dependencies:** none.

### 3. Fix a miskeyed item after scoring
- **Problem:** a teacher sees a 0.05 difficulty item, realises the key is wrong, and can only retype the key. There is no way to credit two answers or credit everyone.
- **Who benefits:** teachers and students.
- **Story:** As a teacher, I want to accept more than one answer, or give everyone credit, for a single item so that a bad item does not lower scores unfairly.
- **Acceptance criteria:**
  1. In item analysis, each item offers: change key, also accept another letter, credit everyone, drop from scoring.
  2. Scores, MPS and item analysis recompute at once.
  3. Changed items are marked in the table and listed in the Excel export with the original key.
  4. "Drop" equals today's `-` and reverses cleanly.
  5. Existing saved data still loads.
- **Effort:** M (the key becomes per-item data, touching `scoreOf`, `analyze`, review overlay, export).
- **Impact:** High. **Dependencies:** none. **Risk:** touches core scoring, so `qa-tester` must cover it.

### 4. Printable MPS and item analysis report
- **Problem:** results are submitted on paper; the Excel layout is not print-ready.
- **Who benefits:** teachers, subject heads.
- **Story:** As a teacher, I want a one-click printable report so that I can hand in MPS and item analysis without reformatting Excel.
- **Acceptance criteria:**
  1. A print stylesheet or report view shows test name, date, sets, class MPS, mastery level, score list, least-mastered items, item analysis table and the decision guide.
  2. Fits A4 and Letter, no cut-off columns, tables do not split mid-row.
  3. Student names are optional (print with class numbers only).
  4. Works in light and dark themes (prints light).
- **Effort:** M. **Impact:** High. **Dependencies:** none. Note the claude.ai viewer blocks the print dialog, so this only works outside it (ties to #1).

### 5. Several sections of one test
- **Problem:** the same test is given to many sections, but the app holds one batch. Combined MPS and per-section MPS are common report requirements.
- **Who benefits:** teachers with multiple sections; subject heads.
- **Story:** As a teacher, I want to label sheets by section so that I get MPS per section and for all sections together.
- **Acceptance criteria:**
  1. Each scanning batch has a section label.
  2. Class number is unique per section, not globally (fixes false "used twice").
  3. MPS panel shows per section and overall; item analysis can be run overall or per section.
  4. Excel has section columns and per-section MPS rows.
- **Effort:** L. **Impact:** High. **Dependencies:** #2 (so sections are not lost between sessions).

### 6. Smarter item analysis
- **Problem:** the table gives p, D and a decision, but not the reasons.
- **Who benefits:** teachers revising their test; subject heads.
- **Story:** As a teacher, I want items flagged when the data suggests a wrong key or a useless option so that I know what to fix.
- **Acceptance criteria:**
  1. Flag "possible miskey" when a wrong option is chosen by more of the upper group than the key.
  2. Flag a distractor chosen by under 5% of students as non-functional.
  3. Show KR-20 reliability for the test per set, hidden below a sensible minimum class size, with a one-line plain explanation.
  4. Flags appear in the screen table and the Excel sheet.
  5. Thresholds are stated in the guide text.
- **Effort:** M. **Impact:** Med. **Dependencies:** none. Confirm the formulas and thresholds with `researcher` before building.

### 7. Score distribution
- **Problem:** reports usually include how many students fall in each score range; the app only shows high, low, mean, SD.
- **Story:** As a teacher, I want a score frequency table so that I can see the spread of results.
- **Acceptance criteria:**
  1. Table of score ranges (or mastery bands) with student counts and percent, in the MPS panel, the report (#4) and Excel.
  2. A simple bar next to each row, using the existing accent colour, readable without colour.
- **Effort:** S. **Impact:** Med. **Dependencies:** none.

### 8. Key and sheet sanity checks
- **Problem:** findings 6-8 let wrong numbers through quietly.
- **Story:** As a teacher, I want a warning when the key length, sheet size or duplicates would make results wrong.
- **Acceptance criteria:**
  1. A key shorter than the test size shows a visible warning in setup and in the results header, naming how many items are unkeyed.
  2. Wrong-size sheets are excluded from item analysis and say so.
  3. A duplicate class number offers "keep this one / keep the other".
- **Effort:** S. **Impact:** Med. **Dependencies:** none.

### 9. Class list for names
- **Problem:** names are typed one sheet at a time.
- **Story:** As a teacher, I want to paste my class list once so that names fill in from the class number.
- **Acceptance criteria:**
  1. Paste lines like `12 Dela Cruz, Juan`; names attach to sheets by class number now and on later scans.
  2. Unmatched numbers are listed, not guessed.
  3. Kept in the saved test file (#2). Stored only in the browser or file, never sent anywhere.
- **Effort:** S. **Impact:** Med. **Dependencies:** none.

### 10. Undo for destructive actions
- **Acceptance criteria:** after "Use as answer key" or "Remove sheet", a toast offers Undo for about 10 seconds and restores the sheet at its place.
- **Effort:** S. **Impact:** Low-Med. **Dependencies:** none.

### 11. Configurable target
- **Acceptance criteria:** target (default 75) can be changed in setup; MPS bar, "at 75% and up" count, least-mastered list and Excel labels follow it.
- **Effort:** S. **Impact:** Low. **Dependencies:** none.

## 6. Build next (top 3)
1. **Export that works anywhere (#1).** It is the app's final output and currently does not work outside claude.ai. Nothing else matters if the teacher cannot get the file out. Small change, biggest risk removed.
2. **Backup and open test file (#2).** Protects hours of scanning and corrections from a browser wipe, and is the foundation for sections (#5). It also makes silent save failures visible.
3. **Fix a miskeyed item after scoring (#3).** This is the most common real situation after item analysis and is what item analysis exists to trigger. It turns the analysis from a report into a tool. Needs careful tests because it changes scoring.

Then #4 (print report), which most teachers will use the same day they export.

## 7. Not recommended
| Idea | Why not |
|---|---|
| Gradebook, class record, quarterly grades | Different product; outside score checking and item analysis |
| Student or teacher accounts, cloud sync | Forces a backend and privacy duties for little gain; a test file (#2) covers moving between devices |
| AI explanations or "AI insights" | Item analysis already has fixed, explainable rules; AI would add cost and unverifiable output |
| Essay or written-answer grading | Different problem; the reader only handles shaded bubbles |
| Answer sheet designer or generator | Sheets and layouts are fixed; would add large complexity |
| Student-facing score pages or report cards | Privacy risk, outside scope |
| LMS or SIS integration | Needs servers, auth and per-school formats |
| Dashboards across many tests and years | Needs storage and history the app deliberately does not have |
