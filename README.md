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
| `points_<ccaID>_<YYYYMMDD>.csv` | each CCA leader (RH app) | formatVersion, ccaID, ccaName, matric, name, basePoints, semesterOnly, outgoingRole, incomingRole, exportedAt |
| `flat_points_<YYYYMMDD>.csv` (optional) | JCRC (RH app) | formatVersion, ccaID, ccaName, matric, name, flatPoints, exportedAt |
| `points_settings_<YYYYMMDD>.csv` | JCRC (RH app, "Export settings file") | formatVersion, scope, ccaID, ccaName, meanMin, meanMax, sdMin, sdMax, note, exportedAt |
| `residents.csv` | JCRC | matric, name (preferred name, as published), gender, sem2, aux, jcrc (N / FULL / EXCHANGE) |
| `ccas.csv` | JCRC | ccaID, ccaName, type, placement, outgoingTier, outgoingMultiplier, meanMin, meanMax, sdMin, sdMax |
| `ihg.csv` (optional) | JCRC / Sports | matric, ccaID, placement |

Exact formats and every rule are in the [points spec](docs/points-spec.md).

**Load JCRC's points settings file.** Export it from the RH app (/admin/points, "Export settings file") and drop it with the leader files. While it is loaded, the average and spread checks use only its ranges (the default plus each waiver), the range settings here become read-only, and ranges in `ccas.csv` are ignored. You can explore without it, but **Finalise lists stays locked until it is loaded**.

## Workflow

1. **Import.** Drop the files. Problems are listed in plain English. Errors must be fixed in
   the file and dropped again. A CCA whose average or spread is out of range is allowed: it shows
   as a warning in the "Mean and SD check" table, and CCAs out of range are listed on every export.
2. **Fix issues** until "View results" unlocks.
3. **Tune settings** (left panel on Results). Each setting has a plain-English label and a help
   line; a gold dot marks a value changed from the default, and the arrow resets it. Start
   with **How many stay**: lists are only final once the seats are set.
4. **Overrides and discretion.** Click a resident to open their breakdown:
   - **Set final points** on a CCA replaces everything for that CCA (with a reason).
   - **JCRC discretion** adds a ± change to their final staying and bidding totals (with a
     reason; "Same for both" is on by default).
   The **Adjustments** strip above the lists shows every entry, with Open and Remove.
5. **Save workspace often** (top bar). See the next section.
6. **Finalise lists.** Locks settings, files, final-points overrides and
   discretion, and freezes each gender's green cut-off.
7. **Record wheel results.** A tie across a colour boundary ("TIE green/grey · 1 of 2") is
   settled by a wheel spin. Click the tie, put the residents in the wheel's order with ↑/↓,
   and save. **Ties to resolve** lists every tie still waiting. Wheel results stay editable
   after finalising.
8. **Publish.** Once finalised and every tie is resolved, the Publish step shows each list as
   it will print (A4, last year's colours, no matric). **Print / Save as PDF** prints one list;
   **Print all 5** prints them all, each on a new page. In the print dialog choose
   "Save as PDF". The title line can be switched off or edited.
9. **Penalties later.** If a resident drops an incoming Head/Vice Head role, open their row,
   press **Drop incoming role**, check the preview and apply. Each can be undone. **Unlock**
   clears every penalty but keeps wheel results (any that no longer fit are flagged).

**Compare** runs two saved scenarios (settings) side by side on the same files, with the same
overrides, discretion and wheel results, and shows who changes colour.

## Workspace files and the password

**Save workspace** downloads one `.rhps` file holding everything: the imported files, settings,
final-points overrides, discretion, wheel results and penalties. **Open
workspace** loads it again, re-checks every file, and lists anything that no longer matches.

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
