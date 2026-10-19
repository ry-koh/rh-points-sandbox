# RH Points Sandbox

An offline tool for the Raffles Hall JCRC (AY26/27). It loads every CCA leader's points file
plus JCRC's own lists, lets you tune every multiplier and bonus, and produces five lists:
**male staying, female staying, sem-2 staying, male bidding and female bidding**. The
Publish step turns them into print-ready PDFs for residents.

## Confidentiality: read this first

- **Nothing leaves this computer.** No network calls; no fonts or scripts from the internet.
  Files are read with the file picker, in the browser tab only.
- **Resident data is never stored by the browser.** Names, matrics, points, overrides,
  discretion, wheel results and penalties live only in the open tab. Only your *settings* (and
  saved scenarios, which hold settings only) are remembered by the browser.
- **To keep your work, use Save workspace** (see below). Closing the tab with unsaved changes
  triggers a browser warning.
- **Never commit real files.** Keep real CSVs and workspace files in `data/` (ignored by git).
  `samples/` holds made-up data only ("Test Resident 001", matrics `A99…Z`).

## Install and run

You need Node.js 20 or newer: `npm install`, then `npm run dev`, then open the address it prints
(usually http://localhost:5173). In this mode a **Load demo data** button loads the samples.
`npm run build` and `npm run preview` run the built version (no demo button).

## Input files

Drop all files at once on the Import screen. A file with the same name replaces the old one.

| File | Who makes it | Columns |
|---|---|---|
| `points_bundle_<YYYYMMDD>.csv` | JCRC (RH app, "Download sandbox bundle") | formatVersion, section, scope, ccaID, ccaName, matric, name, flatPoints, type, sport, ihgResult, ihgCap, meanMin, meanMax, sdMin, sdMax, note, exportedAt |
| `points_<ccaID>_<YYYYMMDD>.csv` | each CCA leader (RH app) | formatVersion (2), ccaID, ccaName, matric, name, basePoints, semesterOnly, outgoingRole, incomingRole, ihg, exportedAt (formatVersion 1, without `ihg`, is still read) |
| `residents.csv` | JCRC | matric, name (preferred name, as published), gender, sem2, aux, jcrc (N / FULL / EXCHANGE) |
| `flat_points_<YYYYMMDD>.csv` | JCRC (RH app) | older export, superseded by the bundle |
| `points_settings_<YYYYMMDD>.csv` | JCRC (RH app) | older export, superseded by the bundle |

`ccas.csv` and `ihg.csv` are retired: the sandbox refuses them with a message.

Exact formats and every rule are in the [points spec](docs/points-spec.md).

**Load the RH-app bundle.** Download it from the RH app (/admin/points, "Download sandbox bundle") and drop it with the leader files. It lists every CCA with its type, whether it is a sport, and a sport's IHG result and cap; it also carries the flat-points members and the allowed average and spread (the default plus each waiver). While it is loaded, the checks use only those ranges and the range settings here become read-only. **Finalise lists stays locked until it is loaded.**

Each CCA's level is picked on the Review step; the levels themselves are edited in Settings. IHG points go to the members the sport's head ticked in the RH app; the result and cap come from the bundle.

## Workflow

The steps run in order along the top; each opens once the one before it is done.
**Save workspace** works at any step (see the next section).

1. **Import.** Drop the RH-app bundle, the leader files and `residents.csv`. Problems are listed
   in plain English. Errors must be fixed in the file and dropped again. A CCA whose average or
   spread is out of range is allowed: it shows as a warning in the "Mean and SD check" table,
   and CCAs out of range are listed on every export.
2. **Checklist.** Every CCA in the bundle needs its leader file, or is marked **not submitting**
   (with an optional note). Flat CCAs tick themselves. Review stays locked until nothing is
   missing.
3. **Review.** CCAs in alphabetical order. For each one:
   - change a member's base score if the vetting needs it (whole number 0 to 20; the reason is
     optional; every change is logged, with no reviewer name). A change applies only while the
     leader file still has the score it started from;
   - see the average and spread against the allowed range (out of range is allowed);
   - **pick the CCA's level** (and, if needed, tweak its bonus or multiplier for this CCA only;
     the levels themselves are edited in Settings, and editing a level clears the tweaks on it);
   - **mark it vetted**. The mark is tied to the leader file: a changed file un-vets the CCA.

   A CCA's type, and a sport's IHG result and cap, are read-only here ("From RH-app"). IHG
   recipients are the members the sport's head ticked in the RH app.
4. **Summary.** One row per resident with the inputs only: reviewed scores, roles, AUX and IHG.
   **JCRC discretion** (a ± change to a resident's final staying and bidding totals, with a reason;
   "Same for both" is on by default) is given here.
5. **Results.** Tune the settings (left panel); each has a plain-English label and a help line,
   a gold dot marks a value changed from the default, and the arrow resets it. Start with
   **How many stay**: lists are only final once the seats are set. Click a resident for their
   breakdown: **Set final points** on a CCA replaces everything for that CCA (with a reason).
   The **Adjustments** strip shows every override and discretion entry, with Open and Remove.
   A tie across a colour boundary is settled by a wheel spin: click the tie, put the residents in
   the wheel's order with ↑/↓, and save (wheel results stay editable after finalising).
   **Finalise lists** locks settings, files, overrides and discretion, and freezes each gender's
   green cut-off. It is allowed only when the bundle is loaded, nothing is "not set" (a blank
   type, a sport with no IHG result or cap, a CCA with no level), the checklist is complete, every
   CCA with a leader file is vetted, and the import has no errors. The button says which. If a
   resident later drops an incoming Head/Vice Head role, open their row, press **Drop incoming
   role**, check the preview and apply; each can be undone, and **Unlock** clears every penalty.
6. **Publish.** Once finalised and every tie is resolved, each list is shown as it will print
   (A4, last year's colours, no matric). **Print / Save as PDF** prints one list; **Print all 5**
   prints them all, each on a new page. In the print dialog choose "Save as PDF". The title line
   can be switched off or edited.

**Compare** runs two saved scenarios (settings) side by side on the same files, with the same
review edits, levels, overrides, discretion and wheel results, and shows who changes colour.

Every list and comparison CSV starts with comment lines: the CCAs out of range, the number of
overrides, discretion entries and review edits, each CCA's level, the level tweaks, and (when
finalised) the penalties. They never contain a score or a resident's name.

## Workspace files and the password

**Save workspace** downloads one `.rhps` file holding everything: the imported files, settings,
the checklist, score edits and their log, vetted marks, CCA levels and tweaks, the current step,
final-points overrides, discretion, wheel results and penalties. **Open workspace** loads it
again, re-checks every file, and lists anything that no longer matches (a score edit whose file
changed, a CCA vetted on an older file, a level for a CCA not in the bundle) and any notes from
upgrading an older file.

- **Protect with a password** is on by default and strongly recommended. The file is then
  encrypted on this computer (AES-GCM). Without the password nobody can read it.
- **If you lose the password, that file cannot be opened by anyone, including this tool.**
  There is no reset. Keep the password somewhere safe and save under a new name often.
- An unprotected file can be read by anyone who gets it: store it like the raw CSVs.
- The top bar shows **Unsaved changes** (with a gold dot) or the time of the last save.

## The five lists

- **Staying lists (male, female):** non-sem-2 residents by staying points. The first seats
  are **green**, the next **grey**, the rest **white**. JCRC members (FULL/EXCHANGE) take the
  highest other bidding points + 1 (or × 75%). Removed residents sit at the bottom.
- **Sem-2 staying list:** all sem-2 residents by bidding-formula points, with its own green
  and grey seats. In "mixed" mode they also appear in their gender's bidding list at points ×
  the factor, inside their colour, labelled **sem-2**.
- **Bidding lists (male, female):** colour first (green, grey, white, removed), then bidding
  points within each colour.

Equal points share a rank and are listed by name. Ties across a colour boundary are flagged
until a wheel result is recorded.

## For developers

- `npm test` runs every test; `npm run coverage` checks engine, import and workspace code.
- `npm run samples` regenerates the synthetic sample files.
- `src/engine`, `src/import` and `src/workspace` are plain TypeScript with no UI code; the
  interface lives in `src/ui`.
