# RH Points Sandbox

An offline tool for the Raffles Hall JCRC (AY26/27). It loads every CCA leader's points file
plus JCRC's own lists, lets you tune every multiplier and bonus, and produces five lists:
**male staying, female staying, male bidding, female bidding and sem-2 bidding**.

## Confidentiality: read this first

- **Nothing leaves this computer.** The tool makes no network calls and loads no fonts or
  scripts from the internet. Files are read with the file picker, in the browser tab only.
- **Resident data is never saved.** Names, matrics and points live only in the open tab.
  Reloading or closing the tab clears them. Only your *settings* (and saved scenarios, which
  hold settings only) are remembered by the browser.
- **Never commit real files.** Keep real CSVs in the `data/` folder, which git ignores. The
  `samples/` folder holds made-up data only ("Test Resident 001", matrics `A99…Z`).
- Exports are files you choose to save. Store and share them like any other confidential file.

## Install and run

You need Node.js 20 or newer.

```
npm install
npm run dev
```

Open the address it prints (usually http://localhost:5173). In this development mode an extra
**Load demo data** button loads the synthetic samples.

To run the built version instead (no demo button):

```
npm run build
npm run preview
```

## Input files

Drop all files at once on the Import screen. A file with the same name replaces the old one.

| File | Who makes it | Columns |
|---|---|---|
| `points_<ccaID>_<YYYYMMDD>.csv` | each CCA leader (RH app export) | formatVersion, ccaID, ccaName, matric, name, basePoints, semesterOnly, outgoingRole, incomingRole, exportedAt |
| `residents.csv` | JCRC | matric, name, gender, sem2, aux |
| `ccas.csv` | JCRC | ccaID, ccaName, type, placement, outgoingTier, outgoingMultiplier, meanMin, meanMax, sdMin, sdMax |
| `ihg.csv` (optional) | JCRC / Sports | matric, ccaID, placement |

Exact formats, allowed values and every rule are in the [points spec](docs/points-spec.md).

## Workflow

1. **Import.** Drop the files. The tool checks every file and lists problems in plain English,
   grouped by file. Errors must be fixed in the file and dropped again. The one exception is a
   CCA whose average or spread (mean/SD) is outside its allowed range: JCRC may **override** it
   in the "Mean and SD check" table. Every override is printed at the top of every export.
2. **Tune settings** on the Results screen. Every number in the spec can be changed. A gold dot
   marks a value that differs from the default; the arrow next to it resets that value.
   Start with **Headcounts**: the lists are only final once the seats per band are set.
3. **Save scenarios** (Scenarios button) to keep named sets of settings. You can rename,
   duplicate, delete, export them as a file and import them on another computer.
4. **Compare** two scenarios (or a scenario against the current settings) on the same data.
   It shows who changes band, rank and points, plus which settings differ.
5. **Finalise lists.** This locks settings and files and freezes each gender's green cut-off
   (the lowest green staying score at that moment).
6. **Export** one list or all five as CSV. While finalised, each export also says how many
   penalties have been applied.
7. **Penalties later.** If a resident drops an incoming Head/Vice Head role, open their row,
   press **Drop incoming role**, check the preview and apply. Each penalty can be undone.
   **Unlock** clears every penalty.

Click any row (or press Enter on it) to see how that resident's points were built. Use the up and
down arrow keys to move through the list and Esc to close.

## The five lists

- **Staying lists (male, female):** non-sem-2 residents ranked by staying points. The first
  seats are **green**, the next are **grey**, the rest are **white**. Nobody is left out.
  Residents removed by a penalty appear at the bottom as **removed**.
- **Bidding lists (male, female):** everyone of that gender ranked by bidding points (every CCA
  counts in full). The status column repeats the staying status for reference. Rows for a
  resident with a dropped role say "informational — rooms may already be picked".
- **Sem-2 list:** all sem-2 residents ranked by bidding points. The first seats have a **spot**.
  In "merged" mode, spot-holders also appear in their gender's bidding list at bidding × the
  sem-2 factor, labelled **sem-2**.

## Ties and wheel spins

Equal points share a rank (1, 2, 2, 4). The tool never breaks a tie. When a tied group sits
across a band boundary it is flagged, for example **TIE green/grey · 1 of 3**: three residents
are tied and one green seat is left for them. These ties are settled by a wheel spin outside
the tool.

## For developers

- `npm test` runs every test; `npm run coverage` checks the calculation and import code.
- `npm run samples` regenerates the synthetic sample files.
- The calculation engine (`src/engine`) and file checks (`src/import`) are plain TypeScript
  with no user-interface code. The interface lives in `src/ui`.
