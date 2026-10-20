# RH Hall Points Spec — v2.5

**Changes in v2.5**

- 6.4: JCRC may change a member's outgoing role, incoming role and full year / 1 sem
  (`semesterOnly`) on the Review step: a new **membership edit** kind with the same `from` rule,
  logging and vetted lock. The mean/SD check still uses full scores.
- 6.6: every list and comparison export adds `# role/semester edits: N` after `# AUX edits: N`.
- 7.4: new code `BAD_MEMBERSHIP_VALUE` and `MEMBERSHIP_FLAT_CCA`; `REVIEW_UNKNOWN_MEMBERSHIP`,
  `MISSING_REASON` and `REVIEW_NO_CHANGE` also apply to membership edits.
- 8b: workspace **version 4** adds `review.membershipEdits` and `membershipLog`. Version 1, 2 and 3
  files are migrated with empty lists, and Open workspace lists changed or stale membership edits.

**Changes in v2.4**

- 2(c): more IHG ticks than the sport's cap is a **warning**, never a block. The sandbox lets
  JCRC tick and untick IHG recipients (6.4); an edit that leaves a sport over its cap is still
  allowed, and every export lists the sports over their cap.
- 6.4: IHG ticks and a flat CCA's per-member values are editable on the Review step, like scores.
  Every edit keeps the `from` rule (it applies only while the source still has `from`). A vetted CCA
  is locked: no level, tweak, score, flat value or IHG tick changes until vetted is cleared.
- 6.5: flat CCAs can be vetted. A flat CCA's vetted mark is tied to a content fingerprint of its
  flat value and members, not to a file. Finalise counts flat CCAs in "n of N vetted" (D1).
- 6.6: every list and comparison export adds `# IHG tick edits: N`, `# flat value edits: N`,
  `# AUX edits: N` and `# IHG over cap: ...` after `# review edits: N`. Counts and CCA names only.
- 6.7 (new): AUX edits. JCRC may change a resident's AUX **count** on the Summary step.
- 6.8 (new): CCA groups on the Review step. Browser storage holds only group ids, names and CCA
  ids; the workspace holds them too. A file with groups replaces this computer's groups (D3).
- 7.3 / 7.4: new entry codes `TICK_NOT_SPORT`, `BAD_FLAT_VALUE`, `FLAT_EDIT_NOT_FLAT`,
  `BAD_AUX_EDIT`, `AUX_UNKNOWN_RESIDENT`; `REVIEW_FLAT_CCA`, `REVIEW_UNKNOWN_MEMBERSHIP`,
  `MISSING_REASON` and `REVIEW_NO_CHANGE` also apply to the new edit kinds.
- 8b: workspace **version 3** adds `review.tickEdits`, `tickLog`, `flatEdits`, `flatLog`,
  `auxEdits`, `auxLog` and a top-level `groups`. Version 1 and 2 files are migrated with empty
  lists and `groups: null`, and Open workspace lists changed or stale tick, flat and AUX edits.
- A level's number edited in Settings clears that number's tweak on every CCA at that level,
  vetted ones included; vetted CCAs stay vetted, and Settings says how many tweaks were cleared (D2).


**Changes in v2.3**

- The **RH-app bundle** (2d) replaces ccas.csv: it carries the CCA list, the mean/SD ranges and
  the flat members. ccas.csv is retired (`CCAS_FILE_RETIRED`).
- ihg.csv is retired (`IHG_FILE_RETIRED`). IHG recipients are the members the sport's head
  ticked in the RH app (the leader file's `ihg` column); the sport's result and cap come from the
  bundle.
- The leader export is **formatVersion 2** (adds `ihg`); version 1 is still read.
- A CCA's `type` is set in the RH app and is read-only in the sandbox. The sport flag, IHG
  result and cap are set in the RH app, for sports only.
- **Levels** (3, 3b) replace the placement bonus and the outgoing tiers. Each CCA's level, and
  its optional tweaks, are picked in the sandbox on the Review step and saved in the workspace.
  An older config that still has `placementBonus` / `outgoingTiers` is migrated (3).
- The mean/SD ranges come from the bundle's `settings` rows. The standalone settings (2g) and
  flat-points (2e) files are older exports, superseded by the bundle: recognised, but beside a
  bundle they are `DUPLICATE_SETTINGS_FILE` / `DUPLICATE_FLAT_FILE` and ignored.
- Issue codes added: `CCAS_FILE_RETIRED`, `IHG_FILE_RETIRED`, `MISSING_BUNDLE_FILE`,
  `DUPLICATE_BUNDLE_FILE`, `BAD_BUNDLE_FILE`, `BAD_IHG_CAP`, `DUPLICATE_CCA`, `IHG_OVER_CAP`,
  `IHG_NOT_SET`, `IHG_TICK_IGNORED`, `IHG_NO_TICKS`, `TYPE_NOT_SET`, `LEVEL_NOT_SET`,
  `UNKNOWN_LEVEL`, `BAD_LEVEL_TWEAK`, `DUPLICATE_LEVEL_NAME`, `LEVEL_UNKNOWN_CCA`. The
  `CCAS_RANGE_IGNORED` sentence in 2g is removed: there are no ccas.csv ranges to ignore.
- Spec text corrected to match the code: `IHG_ON_FINAL_CCA` is raised by the engine only (a flat
  CCA has no leader file, so a tick can never reach one); the engine guard stays.
- The planned workspace version 2 (`ccaLevels`, `review`, `step`) is noted in 8b.
- The guided workflow (1): **review edits** (6.4) change a member's base score before the
  mean/SD check and the engine, and apply only while the leader file still has the score the
  edit started from; the **checklist and vetting** (6.5) are built from the bundle's CCA list,
  and a vetted mark is tied to the hash of the leader file it vetted. No reviewer is recorded.
  A CCA marked "not submitting" raises no `NO_LEADER_FILE`. Review codes added (returned by
  `validateReviewEdit`, not raised by import): `BAD_REVIEW_POINTS`, `REVIEW_UNKNOWN_MEMBERSHIP`,
  `REVIEW_FLAT_CCA`, `REVIEW_NO_CHANGE`, and `MISSING_REASON` for a review reason that is too long.
- **Finalise gate** (6.6): beside the bundle and an error-free import, Finalise now needs nothing
  "not set" (a blank type, a sport without an IHG result or cap, a CCA without a level), a complete
  checklist and every CCA that has a leader file vetted. One message names every item.
- **Export header lines** (6.6): every list and comparison export adds `# review edits: N`,
  `# levels: ...` and `# level tweaks: ...` after the out-of-range, override and discretion lines.
  They never carry a score or a resident's name.
- **Open workspace** (8b) lists the migration notes, a missing bundle and, once they can be checked, every stale score
  edit, vetted mark and level entry (until then, one calm line). Save workspace says what it holds.

**Changes in v2.2**

- A mean or SD outside the CCA's range is a **warning**, not an error: it never blocks. It is
  listed on the Import and Results screens and on every export (`# mean/SD out of range: …`).
- The per-CCA mean/SD **override is removed** (the Override button, the `overridable` and
  `overridden` issue fields, the `overridden` CCA status and `report.overrides`). The import
  report lists the CCAs instead as `report.outOfRange`.
- The §7.4 table loses its Overridable column.
- Finalise lists needs the JCRC points settings file (2g) and an import without errors (the bundle
  of v2.3 took over the settings file's job; the full gate is in 6.6).
- Workspace files (8b) no longer carry `meanSdOverrides` (version 2); a v1 file that carries ids
  there still opens and the ids are dropped.

Authoritative rules for the Raffles Hall AY26-27 points system. Where this document and the
CLAUDE.md summary differ, this document wins. Every number below is a **config variable**
(section 3); none may be hardcoded outside the defaults config.

Values marked **PLACEHOLDER** are not confirmed by JCRC (see section 9).

## 1. Overview

```
RH app (CCA leaders)  ->  CSV export  ->  email to portfolio head  ->  vetted
      ->  sandbox (JCRC)  ->  5 lists
```

1. CCA leaders allocate base points (whole numbers 0–20) to members in the RH app. A sport's
   head also ticks the members who get the IHG points (at most the sport's cap). The app
   checks the CCA's mean/SD range in the browser and only then lets the leader export.
   Points are never sent to or stored on the RH-app server.
2. The leader emails the CSV to their portfolio head, who vets it.
3. JCRC works through the offline sandbox in six steps:
   1. **Import**: the **RH-app bundle** (2d: the CCA list with each CCA's type, sport flag,
      IHG result and cap, the mean/SD ranges and the flat members), the leader CSVs and JCRC's
      residents list.
   2. **Checklist** (6.5): every CCA in the bundle has its leader file, is flat, or is marked
      "not submitting" (optional note). Review stays locked until nothing is missing.
   3. **Review** (6.4): CCAs in alphabetical order. JCRC may change a member's base score
      (whole number 0–20, optional reason; every change is logged), sees the mean/SD against
      the range (out of range is allowed), picks the CCA's level (3b) and marks it vetted.
   4. **Summary**: per resident, the inputs only (reviewed scores, roles, AUX, IHG ticks);
      **discretion points** (6.3) are given here.
   5. **Results**: the scenario config and the five lists, **male staying, male bidding,
      female staying, female bidding, sem-2 staying** (bidding lists colour first, 5.3);
      **final-points overrides** (6.2) and **wheel resolutions** (5.6).
   6. **Publish**: the **published lists** (5.7).

   **Finalise lists** (Results) is allowed only when the gate in 6.6 passes: nothing "not set",
   a complete checklist, every CCA with a leader file vetted and an import without errors.

   A **workspace file** (8b) saves all of it at any step.

The **matric number** is the join key across every file.

## 2. Input file formats

All files are UTF-8 CSV with a header row and exact column names (case-sensitive, any
column order, no extra columns). Matric is normalised to uppercase (after trimming
whitespace) and must match `^A\d{7}[A-Z]$`. Y/N fields accept only `Y` or `N`.

### (a) Leader export — produced by the RH app

Filename: `points_<ccaID>_<YYYYMMDD>.csv`. One file per CCA.

| Column | Type / allowed values |
|---|---|
| `formatVersion` | `1` (10 columns, no `ihg`) or `2` (adds `ihg`); must match the file's columns |
| `ccaID` | string, must be a `cca` row of the bundle, identical on every row |
| `ccaName` | string |
| `matric` | matric pattern above |
| `name` | string |
| `basePoints` | integer 0–20 |
| `semesterOnly` | `Y` / `N` |
| `outgoingRole` | `none` / `head` / `vice_head` |
| `incomingRole` | `none` / `head` / `vice_head` |
| `ihg` | version 2 only, after `incomingRole`: `Y` / `N`, this member receives the sport's IHG points (meaningful only for a sports CCA) |
| `exportedAt` | ISO 8601 timestamp |

The RH app writes version 2; a file's `formatVersion` must match its columns.

### (b) residents.csv — JCRC

| Column | Type / allowed values |
|---|---|
| `matric` | matric pattern, unique |
| `name` | string — the resident's **preferred name**, exactly as it should appear on the published lists |
| `gender` | `M` / `F` |
| `sem2` | `Y` / `N` |
| `aux` | integer ≥ 0 |
| `jcrc` | `N` / `FULL` / `EXCHANGE` (required; see 4.6). `FULL` or `EXCHANGE` together with `sem2` = `Y` is an error |

### (c) ihg.csv — retired

ihg.csv (spec ≤ v2.2) is retired: `IHG_FILE_RETIRED`. IHG rows are built from the leader files'
`ihg` ticks and the bundle's `ihgResult` for that sport; more ticks than `ihgCap` is the warning
`IHG_OVER_CAP` (allowed: every ticked member still gets the points; it never blocks Finalise or an
export); a sport with a leader file and no result or cap is `IHG_NOT_SET`. JCRC may tick or untick
members on the Review step (6.4); the cap check uses the ticks after those edits.

### (d) RH-app bundle — produced by the RH app (JCRC)

Filename: `points_bundle_<YYYYMMDD>.csv`. UTF-8, CRLF line endings, RFC 4180 quoting, the
apostrophe formula guard on `ccaName`, `name` and `note` (kept verbatim for display). One file
carries the CCA list, the mean/SD ranges and the flat members. Header exactly (18 columns):

```
formatVersion,section,scope,ccaID,ccaName,matric,name,flatPoints,type,sport,ihgResult,ihgCap,meanMin,meanMax,sdMin,sdMax,note,exportedAt
```

Rows come in this order: `settings` rows (the default row, then waivers by `ccaID`), `cca`
rows (by `ccaID`), `flat` rows (by `ccaID`, members in the app's order). `formatVersion`,
`section` and `exportedAt` are filled on every row; every other column must be blank unless the
row's section uses it (`BAD_BUNDLE_FILE`, naming the line and column).

| Section | Columns it uses | Rules |
|---|---|---|
| `settings` | `scope`, `ccaID`, `ccaName`, `meanMin`, `meanMax`, `sdMin`, `sdMax`, `note` | as the settings file's rows (2g): exactly one `default` row, then `waiver` rows with the effective range |
| `cca` | `ccaID`, `ccaName`, `flatPoints`, `type`, `sport`, `ihgResult`, `ihgCap` | one row per CCA, `ccaID` unique (`DUPLICATE_CCA`); at least one `cca` row |
| `flat` | `ccaID`, `ccaName`, `matric`, `name`, `flatPoints` | as the flat-points file's rows (2e) |

| `cca` column | Type / allowed values |
|---|---|
| `ccaID` | string, unique among the `cca` rows |
| `ccaName` | string |
| `flatPoints` | blank, or a number ≥ 0 (the CCA is flat; its `flat` rows must carry the same value, `FLAT_VALUE_MISMATCH`) |
| `type` | `1x` / `0.5x`, or blank = not set in RH-app (`1x` is assumed, `TYPE_NOT_SET`; never for a flat CCA) |
| `sport` | `Y` / `N`, never blank |
| `ihgResult` | blank, or `1st` / `2nd` / `3rd` / `3rd4th_no_match`; only on a `sport` = `Y` row (`BAD_BUNDLE_FILE`) |
| `ihgCap` | blank, or a whole number ≥ 1 (`BAD_IHG_CAP`, read as blank); only on a `sport` = `Y` row (`BAD_BUNDLE_FILE`) |

`formatVersion` must equal `1` (`BAD_FORMAT_VERSION`). A file is detected by its header (or,
failing that, a `points_bundle_` file name). The bundle is required (`MISSING_BUNDLE_FILE`);
a second one is `DUPLICATE_BUNDLE_FILE`. It takes precedence over the standalone files: beside
a bundle, a standalone settings (2g) or flat-points (2e) file is `DUPLICATE_SETTINGS_FILE` /
`DUPLICATE_FLAT_FILE` and is ignored. A `cca` row with `flatPoints` and no `flat` rows is a
flat CCA with no members.

ccas.csv (spec ≤ v2.2) is retired: `CCAS_FILE_RETIRED`.

### (e) flat-points file — produced by the RH app (JCRC), optional

Older standalone export, recognised but superseded by the bundle (needs a bundle for the CCA
list; beside one it is a duplicate).

Filename: `flat_points_<YYYYMMDD>.csv`. UTF-8, CRLF line endings, RFC 4180 quoting. **One file
covers every flat CCA**; one row per member per flat CCA. Header exactly:

```
formatVersion,ccaID,ccaName,matric,name,flatPoints,exportedAt
```

| Column | Type / allowed values |
|---|---|
| `formatVersion` | integer, must equal `1` |
| `ccaID` | string, must be a `cca` row of the bundle, and must NOT also have a leader file |
| `ccaName` | string |
| `matric` | matric pattern |
| `name` | string |
| `flatPoints` | number ≥ 0, identical on every row of one `ccaID` |
| `exportedAt` | ISO 8601 timestamp (not validated) |

JCRC sets the flat value per CCA in the RH app; the sandbox only **reads** it. It is not a
sandbox setting. A file is detected by its header (or, failing that, a `flat_points_` file
name). The file is optional. A flat CCA's type and level are ignored for the points
(the CCA still needs a `cca` row in the bundle). A flat CCA is **not** mean/SD checked and does
**not** raise `NO_LEADER_FILE`.

### (g) points settings file — produced by the RH app (JCRC)

Older standalone export, recognised but superseded by the bundle (needs a bundle for the CCA
list; beside one it is a duplicate).

Filename: `points_settings_<YYYYMMDD>.csv`. UTF-8, CRLF line endings, RFC 4180 quoting.
Config only: it holds no names of people, no matrics and no scores. Header exactly:

```
formatVersion,scope,ccaID,ccaName,meanMin,meanMax,sdMin,sdMax,note,exportedAt
```

| Column | Type / allowed values |
|---|---|
| `formatVersion` | integer, must equal `1` |
| `scope` | `default` or `waiver` |
| `ccaID` | blank on the `default` row; the waived CCA's id on a `waiver` row |
| `ccaName` | blank on the `default` row; informational on a `waiver` row |
| `meanMin`, `meanMax` | numbers, 0–20, `meanMin` ≤ `meanMax` |
| `sdMin`, `sdMax` | numbers, 0–10, `sdMin` ≤ `sdMax` |
| `note` | blank on the `default` row; the waiver's reason on a `waiver` row |
| `exportedAt` | ISO 8601 timestamp (shown, not validated) |

Exactly **one** `default` row, then zero or more `waiver` rows. Every range value is the
**effective** range (a waiver's blank fields are already filled from the default by the RH
app), so no fallback is applied when reading. A file is detected by its header (or, failing
that, a `points_settings_` file name).

**Effect.** These rows are the bundle's `settings` rows (2d). While a bundle is loaded, the
mean/SD check (7.1) of every leader file uses ONLY these ranges: the `default` row for a CCA
with no waiver row, the waiver row's range for a waived CCA. The sandbox's own `meanSdDefault`
setting is not used for the check and is shown read-only ("From the RH-app bundle"); loading a
scenario does not change it. A waiver row for a `ccaID` not in the bundle's `cca` rows is
ignored (`SETTINGS_UNKNOWN_CCA`). A waiver on a flat CCA is harmless: flat CCAs are not
mean/SD checked.

**Finalise lists is refused until the bundle is loaded**: "Load the RH-app bundle before
finalising." While no usable `settings` rows are loaded, the sandbox uses its own ranges and
shows a note saying so. The rest of the gate is in 6.6.

## 3. Scenario config (JSON)

The scenario JSON holds **settings only, never resident data**.

| Key | Type | Default | Meaning |
|---|---|---|---|
| `meanSdDefault` | `{meanMin, meanMax, sdMin, sdMax}` | `{10, 14, 2, 5}` **PLACEHOLDER** | Hall-wide allowed mean/SD range, inclusive |
| `levels` | `[{name, bonus, multiplier}]` | Unsatisfactory 0 / 0.8, Pass 0 / 1.0, Low Bronze 0.5 / 1.05, High Bronze 0.5 / 1.15, Low Silver 1.5 / 1.25, High Silver 1.5 / 1.5, Low Gold 4 / 1.75, High Gold 4 / 2.0 (bonus / multiplier) **PLACEHOLDER** | CCA levels, keyed by name (unique, non-blank). `bonus` is added once to every member's net (never multiplied); `multiplier` is the outgoing leaders' multiplier (bidding only) |
| `halfCcaBaseFactor` | number | `0.5` | Base factor for `0.5x` CCAs |
| `halfCcaPlacementHalved` | boolean | `false` | Halve the level bonus for `0.5x` CCAs (the key name is kept for old files) |
| `semesterOnlyFactor` | number | `0.5` | Base factor for semester-only members of `1x` CCAs |
| `incomingMultiplier` | `{head, vice_head}` | `{1.2, 1.2}` | Multiplier for incoming roles (staying and bidding) |
| `stackingMode` | `"max"` \| `"additive"` \| `"multiplicative"` | `"max"` | How outgoing and incoming roles combine in the same CCA (bidding) |
| `droppedRoleBase` | number | `8` | Base ceiling for a dropped incoming role |
| `auxTable` | 11 numbers (AUX 0..10) | `[-10,-8,-6,-4,-2,0,2,4,6,8,10]` | AUX count to hall points |
| `auxCap` | integer | `10` | AUX count above this is capped |
| `ihgPoints` | `{1st, 2nd, 3rd, 3rd4th_no_match}` | `{5, 4, 3, 1}` | Points per IHG placement |
| `ihgInSportNet` | boolean | `false` | Add IHG into the sport's net (true) or keep it flat (false) |
| `stayingWeights` | number[] | `[1,1,1,1,0.5,0.25]` | Weight per ranked staying slot |
| `stayingWeightTail` | `"halve"` | `"halve"` | Each position past the array has half the previous position's weight |
| `mergeHalfCcas` | boolean | `true` | Allow pairs of `0.5x` memberships to merge into one slot |
| `headcounts` | `{maleGreen, maleGrey, femaleGreen, femaleGrey, sem2Green, sem2Grey}` | all `0` **PLACEHOLDER** | Must be set before lists are final. `sem2Green` and `sem2Grey` are the headcounts of the sem-2 staying list (both genders together). They replace the single `sem2Spots` of spec v1.x |
| `sem2Mode` | `"separate"` \| `"merged"` | `"separate"` | Sem-2 room-pick mode |
| `sem2Factor` | number | `2` | Bidding multiplier for sem-2 residents in `"merged"` mode |
| `jcrcFullYearOffset` | number | `1` | JCRC (full year) value is H + this (4.6) |
| `jcrcExchangeFactor` | number | `0.75` | JCRC (exchange) value is H × this (4.6) |

Each CCA has one `level` (a name from `levels`, or none) and two optional tweaks,
`bonusOverride` and `multiplierOverride`, that win over the level's numbers for that CCA only.
Type, sport flag, IHG result and cap come from the bundle (set in the RH app on /admin/points).
Each CCA's level and optional tweaks are set in the sandbox (Review step) and saved in the
workspace (3b, 8b); they are never in the scenario config or in a file. The levels THEMSELVES
(names and numbers) are scenario config.

**Migration.** A config or scenario file saved under v1.x has `headcounts.sem2Spots`. When
read, it becomes `sem2Green = sem2Spots` and `sem2Grey = 0`; the `jcrc*` keys take their
defaults when missing. A config saved before levels existed has `placementBonus`,
`outgoingMode` and `outgoingTiers` instead of `levels`. When read, `levels` is built from them:
one level per `outgoingTiers` row (name and multiplier kept) whose bonus is the old
`placementBonus` value for the first metal word in its name (`gold` / `silver` / `bronze`,
any case; otherwise `pass`). With no tiers, the default `levels` are used, their bonuses still
taken from `placementBonus` when it is present. The three old keys are dropped; a config that
already has `levels` is left as it is. The reader reports that `levels` was migrated.

Overrides (6.2), discretion (6.3) and wheel resolutions (5.6) are **resident data**, not
config. They are never part of the scenario JSON.

## 3b. Per-CCA sandbox values (levels)

Each CCA's level is picked in the sandbox (on the Review step) and saved in the workspace
file; it is not read from any input file. One entry per CCA:

| Field | Type / allowed values |
|---|---|
| `ccaID` | a `cca` row of the bundle |
| `level` | null, or the name of one of `levels` (3) |
| `bonusOverride` | null, or a number ≥ 0 (this CCA's members' bonus instead of the level's) |
| `multiplierOverride` | null, or a number > 0 (this CCA's outgoing multiplier instead of the level's) |

| Code | Sev | Meaning |
|---|---|---|
| `LEVEL_NOT_SET` | warning | a non-flat CCA with a leader file has no entry (or one with nothing set): bonus 0 and ×1 are assumed |
| `UNKNOWN_LEVEL` | error | `level` is not one of the `levels`; the CCA is handed to the engine with no level |
| `BAD_LEVEL_TWEAK` | error | a tweak is not a finite number in its range |
| `DUPLICATE_LEVEL_NAME` | error | two `levels` in Settings share a name |
| `LEVEL_UNKNOWN_CCA` | warning | an entry names a CCA that is not in the bundle; the entry is ignored |

A level renamed in Settings carries its CCAs with it (8b); a level removed while CCAs use it is
an error until they are re-picked. Editing a level's bonus or multiplier in Settings clears that
number's tweak on every CCA at that level, so they follow the new value (8b).

## 4. Formulas

Notation: resident `r`, CCA `c`, membership `m = (r, c)` taken from the leader file of `c`
(or, for a flat CCA, from the flat-points file).

### 4.0 Order of evaluation

1. **Per membership** (4.1): final-points override > flat value > normal calculation.
2. **Per resident** (4.2–4.4): staying and bidding from the membership values, plus AUX and IHG.
3. **Discretion** (6.3) is added to every non-JCRC resident, LAST.
4. **H** is taken over the final bidding of all non-JCRC, non-sem-2 residents, and the **JCRC
   residents** get their value from it (4.6), then their own discretion.
5. **Lists** (5) are built from these final values. Penalties (6) re-run steps 1–5 and keep
   every override and discretion entry.

### 4.1 Per-membership values

**Precedence: final-points override > flat value > normal calculation.**

- A membership with a **final-points override** (6.2) has `stayNet = bidNet = finalPoints`.
- A membership of a **flat CCA** (2e) has `stayNet = bidNet = flatPoints`.
- Both are **final**: exactly that value, with no level bonus, no leader multipliers,
  no semester-only or half-CCA factors and no IHG (even when `ihgInSportNet` is on). They are
  **never paired** by half-CCA merging, even in a `0.5x` CCA. They still occupy one slot in the
  staying ranking and take that slot's weight. An IHG row for such a membership is **always
  ignored** (whatever `ihgInSportNet` says, so it is neither in the net nor flat) with the
  warning `IHG_ON_FINAL_CCA`, to avoid counting IHG twice. A flat CCA has no leader file, so a
  tick can never reach one; the guard is in the engine and applies to overridden memberships.
- Everything below describes the **normal calculation**.
- IHG points are added in full whatever `semesterOnly` says.

**effBase**

```
base      = m.basePoints
if m.roleDropped:                     # set only by the penalty action (section 6)
    base  = min(base, droppedRoleBase)
    incomingRole = none               # incoming multiplier is lost
if m.semesterOnly and c.type == "1x":
    base *= semesterOnlyFactor
# a semesterOnly tick on a 0.5x CCA is IGNORED (import warning)
if c.type == "0.5x":
    base *= halfCcaBaseFactor
effBase = base
```

**Multipliers**

```
inMult  = incomingMultiplier[incomingRole]            if incomingRole != none else 1
outMult = c.multiplierOverride ?? levels[c.level].multiplier ?? 1
                                                      if outgoingRole != none else 1
          # shared by every outgoing leader of c
stayMult = inMult                                     # outgoing is never used for staying

if incomingRole != none and outgoingRole != none:
    bidMult = max(inMult, outMult)                    if stackingMode == "max"
            = 1 + (inMult - 1) + (outMult - 1)        if "additive"
            = inMult * outMult                        if "multiplicative"
else:
    bidMult = inMult if incomingRole != none, else outMult if outgoingRole != none, else 1
```

**Level bonus and IHG**

```
bonus     = (c.bonusOverride ?? levels[c.level].bonus ?? 0)
            * (0.5 if c.type == "0.5x" and halfCcaPlacementHalved else 1)
ihgNet    = ihgInSportNet ? sum(ihgPoints[row.placement] for ihg rows of r where row.ccaID == c.ccaID) : 0
```

**Net per membership**

```
stayNet = effBase * stayMult + bonus + ihgNet
bidNet  = effBase * bidMult  + bonus + ihgNet
```

A CCA with **no level** gets bonus 0 and ×1 (import flags it). A level name that is not in
`levels` is an error: the engine refuses to compute (`CCA <id>: unknown level "<name>"`).

### 4.2 Per-resident values

```
auxPoints = auxTable[min(aux, auxCap)]
flatIHG   = sum of ihgPoints over r's IHG rows NOT already counted in some net
```

When `ihgInSportNet` is off, all of r's IHG is flat. When it is on, an IHG row is counted in a
net only if r is a member of that row's `ccaID`; otherwise it stays flat and raises a
warning ("IHG for a non-member"). Placement points are given to **all members** of the CCA
(never multiplied).

### 4.3 Staying points

1. Build slots from `stayNet`. Each membership is one slot, except that when `mergeHalfCcas`
   is on, any set of **disjoint pairs of `0.5x` memberships** (zero or more pairs) may
   each become one merged slot whose value is `stayNet_a + stayNet_b`. Unpaired
   memberships remain their own slots.
2. Choose the pairing that **maximises the weighted total** (step 3), trying every
   pairing (every matching on the resident's `0.5x` memberships, including the empty one).
   If a resident has more than 10 `0.5x` memberships, raise a warning (search size) and
   instead pair them greedily: sort by `stayNet` descending and pair 1st+2nd, 3rd+4th, …
   (an odd one out stays unpaired).
   When several pairings tie on the total (compared at 6 d.p.), pick the one with the
   **fewest pairs**, then the one whose sorted list of pair keys (each pair written as its
   two `ccaID`s in ascending order, joined by `+`) is lowest in lexicographic order, so the
   breakdown is deterministic.
3. Sort slot values descending; slot at position `i` (0-indexed) gets weight
   `w(i) = stayingWeights[i]` if `i < len(stayingWeights)`, else
   `stayingWeights[last] / 2^(i - len + 1)` (halve per position).
4. `staying = Σ w(i) * slot[i] + auxPoints + flatIHG`

Slots are ranked by **net**, never by base alone.

### 4.4 Bidding points

```
bidding = Σ bidNet over all memberships      # every CCA at 100%, no weights, no merging
          + auxPoints + flatIHG
```

### 4.5 Rounding

Compare values rounded to **6 decimal places**; display **3 decimal places**.
Ties are decided on the rounded values. (Published lists round differently: 5.7.)

### 4.6 JCRC residents

`residents.csv` marks each resident `jcrc` = `N` / `FULL` / `EXCHANGE`.

```
H = the highest FINAL bidding points (including discretion) among all residents who are
    NOT JCRC and NOT sem-2, hall-wide (both genders); 0 if there is none

FULL:      staying = bidding = H + jcrcFullYearOffset        (default 1)
EXCHANGE:  staying = bidding = H * jcrcExchangeFactor        (default 0.75)
```

Then that resident's own discretion (6.3) is added to each. A JCRC resident's CCA data is
**ignored** for their totals (no CCA slots, no AUX, no IHG). They are ranked normally by this
value in both lists, and are never counted in H. Their breakdown reads
`JCRC (full year): highest other bidding H + 1` (or `JCRC (exchange): highest other bidding H × 0.75`)
and never names the resident who holds H. A penalty never changes the status of a JCRC resident;
it can change H if it lowers the highest other bidding.

### 4.7 Discretion

JCRC discretion points are applied last, see 6.3.

## 5. Lists

Only residents in residents.csv appear in lists. A resident with no CCA files still appears,
with AUX/IHG points only. Nobody is excluded. Five lists are produced: **male staying, female
staying, sem-2 staying** (the `sem2` list) and **male bidding, female bidding**.

### 5.1 Positions, ranks and order inside ties

Sort descending by points (compared at 6 d.p.). Two numbers are kept for every row:

- **position**: the 1-indexed place in the list, always contiguous (1..N);
- **rank**: the competition rank, `1 + number of residents with strictly greater points`, so
  ties share a rank and the next rank is skipped (1, 2, 2, 4). It stays available internally.

Residents on equal points are ordered by **name** (ascending, plain string comparison), then
by **matric**, so the order is deterministic. That order is a convenience, not a decision:
a tie that straddles a boundary (5.5) is still flagged until it is settled (5.6).

### 5.2 Staying lists (male, female)

- Members: non-sem-2 residents of that gender, sorted by `staying` descending. JCRC residents
  are ranked like everyone else, by their value from 4.6.
- Positions `1..G` (G = `maleGreen` / `femaleGreen`) are **green**; the next `H`
  (`maleGrey` / `femaleGrey`) are **grey**; the rest are **white**.
- Tie flags: 5.5.

### 5.3 Bidding lists (male, female): colour first

- Members: non-sem-2 residents of that gender, plus, in `sem2Mode = "merged"`, **every** sem-2
  resident of that gender (5.4).
- **Order: every green row, then every grey row, then every white row, then removed rows
  (6.1).** Each resident's colour is their **staying** colour (resolved wheel results
  included, 5.6); an inserted sem-2 resident's colour is their sem-2 colour. Inside one colour
  the rows are sorted by `bidding` descending (5.1 tie order). It is NOT one list sorted purely
  by bidding points.
- A sem-2 row is inserted at `bidding × sem2Factor` (the final bidding, discretion included),
  labelled `sem-2`.
- Positions run 1..N across the whole list. The rank continues across colours: a colour's
  first rank is the number of rows above it plus the rank inside the colour.
- A member of a boundary tie group that is not yet settled has a provisional colour (from
  the order in 5.1) and carries the staying list's tie flag.

### 5.4 Sem-2 staying list

- Members: **all** sem-2 residents, both genders together. They have no gender staying list.
- Points: each resident's bidding points (all CCAs at 100%, + AUX, + IHG, + discretion).
- `sem2Green` positions are **green**, the next `sem2Grey` are **grey**, the rest **white**,
  with tie flags (5.5) like the gender lists. There is one shared headcount for both genders.
- `sem2Mode = "separate"`: sem-2 residents appear only here.
  `"merged"`: this list is still produced AND every sem-2 resident is inserted into their
  gender's bidding list, inside the colour that matches their sem-2 colour (5.3).

### 5.5 Tie flags

A tie group spans positions `a..b`. For a boundary after position `B` (`B = G` green/grey,
`B = G + H` grey/white; the sem-2 list uses `sem2Green` and `sem2Grey`), the group straddles it
if `a <= B < b`. Every resident in the group gets status `TIE green/grey` (or `TIE grey/white`)
plus `k of n seats`, where `n = b - a + 1` and `k = B - a + 1` (the number of tied residents
who fit above the boundary). A tie group straddling both boundaries carries both flags. The
flag text is `TIE <boundary> — <k> of <n> seats`. When a boundary is empty (a zero headcount)
the neighbouring bands share the boundary, e.g. `green/white`.

### 5.6 Wheel resolutions

A tie group that straddles a boundary on a **staying list** (male, female or sem-2) is settled
by a wheel spin outside the tool. The user records the wheel's order of **that group's
matrics**:

```
resolution = { list: "maleStaying" | "femaleStaying" | "sem2", order: [matric, ...] }
```

- A resolution **applies** when `order` is exactly the set of matrics of a straddling tie
  group on that list (same members, no repeats). The group is then ordered exactly that way:
  the first `k` take the upper band, the rest the lower one.
- Its flag changes to resolved: the text becomes
  `TIE <boundary> — resolved by wheel (<k> of <n> seats)` and `resolved` is true. Bidding
  colours follow the resolved staying status.
- A resolution whose set no longer matches the current group (the points changed, the
  headcount moved, a member left, or it never straddled a boundary) is **stale**: it is ignored
  and reported, never silently applied. If two resolutions match the same group the later one
  applies and the earlier one is reported stale.
- Resolutions are resident data (workspace file only, 8b).

### 5.7 Published lists

`buildPublishedLists(lists, resolutions?)` makes the lists JCRC publishes:

- Five lists: `maleStaying`, `femaleStaying`, `maleBidding`, `femaleBidding`, `sem2Staying`.
- Rows: `{ no, name, points, band }` with `no` 1..N in list order, `points` rounded **half away
  from zero** to a whole number (12.5 → 13, −12.5 → −13), and `band` green / grey / white.
  Removed residents are excluded. No matric appears anywhere in the output.
- The points column is labelled `Staying Points` (male, female), `Bidding Points` (bidding
  lists) or `Hall Points` (sem-2 list).
- While any boundary tie group on a staying list is unresolved the result is
  `{ ok: false, unresolved: [...] }` (each entry names the list, the boundary and the group's
  names); otherwise `{ ok: true, lists }`.
- **Sorting always uses the exact points; rounding is display only.**

## 6. Penalty action (dropped incoming role)

Applied to one membership of one resident (the resident drops an incoming Head / Vice Head
role).

1. Freeze the **green cut-off** for that resident's gender: the `staying` of the lowest
   green resident (position `G`) **before** the penalty.
2. Set `roleDropped` on that membership and recompute the resident
   (`effBase = min(base, droppedRoleBase)`, incoming multiplier lost).
3. If the resident was green and the new `staying` is **strictly below** the frozen cut-off
   (compared at 6 d.p.), mark them **removed** and promote the top grey resident to green.
   The promotion may itself land in a tie group, which is then flagged as in 5.2. A resident
   at or above the cut-off stays green. The frozen cut-off is **never recomputed**, not
   after a removal and not after further penalties.
   Only green residents can be "removed".
   If the resident was **grey**, recompute them and re-sort the non-green part of the
   list, so they may fall to white. If they were **white**, just recompute.
4. Bidding is recomputed for the resident but marked
   **"informational — rooms may already be picked"**.

### 6.1 Penalty state and list rebuild

1. The frozen green cut-off for a gender is taken from the lists **before any penalty** and
   is reused unchanged for every later penalty.
2. **Penalty state** = the set of dropped memberships (matric + ccaID) plus the set of
   removed matrics (plus the frozen cut-offs). Lists are **rebuilt from scratch** on each
   change: recompute every resident with `roleDropped` on the dropped memberships, exclude
   removed residents from the band counts, sort, then assign bands by headcount. Green and
   grey **keep their sizes**: when a green resident is removed, the top grey moves to green
   and the top white moves to grey.
3. Removed residents appear at the **bottom** of their gender's staying list with status
   `removed` and their recomputed points, and **last** on that gender's bidding list (5.3).
4. Applying a penalty to a membership with `incomingRole = none` is **rejected**, returning
   an error result (not a thrown exception).
5. A penalty on a **sem-2** resident only recomputes their points and re-sorts the sem-2
   list. Nobody is removed and there is no frozen cut-off.
6. On **every bidding list** (male, female) and on the sem-2 list, a resident with a dropped
   role is marked "informational — rooms may already be picked".
7. A penalty recomputes with the same final-points overrides, discretion entries and wheel
   resolutions as the lists it starts from: **penalties keep the discretion** (and the overrides).

### 6.2 Final-points overrides

An override is entered directly in the sandbox (no input file):

```
override = { matric, ccaID, finalPoints, reason }
```

for an EXISTING membership (from a leader file or the flat-points file). It sets that
membership's `stayNet = bidNet = finalPoints` exactly, as in 4.1: no level bonus, multipliers,
halving or IHG, never paired in half-CCA merging, but still ranked and weighted as one slot.
Precedence: **override > flat > normal calculation.** The breakdown reads
`Final points set by JCRC: X — <reason>`. An IHG row for an overridden membership is always
ignored, whatever `ihgInSportNet` says, with the warning `IHG_ON_FINAL_CCA` (4.1).

- `validateOverride` returns `BAD_FINAL_POINTS` (`finalPoints` is not a finite number),
  `MISSING_REASON` (reason empty after trimming, or over 200 characters) or
  `OVERRIDE_UNKNOWN_MEMBERSHIP` (no such membership), checked in that order.
- At most one per `(matric, ccaID)`: setting again **replaces** it.
- It is **stale** (ignored and reported) if its membership disappears after a re-import.
- Overrides are resident data (workspace file only, 8b).

### 6.3 Discretion points

A discretion entry is entered directly in the sandbox:

```
discretion = { matric, stayingDelta, biddingDelta, reason }
```

At most one per resident (setting again **replaces** it). It is applied **last**:
`final staying = computed staying + stayingDelta`, `final bidding = computed bidding +
biddingDelta`, where "computed" includes AUX, IHG and the JCRC rule (4.6). Deltas may be
negative. The sem-2 merged-mode factor multiplies the final bidding (delta included). Penalties
keep it. The breakdown reads `JCRC discretion: +2 staying / −1 bidding — <reason>`.

- `validateDiscretion` returns `BAD_DISCRETION_POINTS` (either delta not a finite number),
  `MISSING_REASON` (as in 6.2) or `DISCRETION_UNKNOWN_RESIDENT`, checked in that order.
- It is **stale** (ignored and reported) if the resident disappears after a re-import.
- Discretion is resident data (workspace file only, 8b).

### 6.4 Review edits

On the Review step JCRC may change a member's base score. An edit is entered directly in the
sandbox (no input file):

```
edit = { matric, ccaID, from, to, reason, at }
```

`from` is the leader file's `basePoints` when the edit was made, `to` the reviewed score, `at`
the time. The reason is optional. **No reviewer is recorded** (no name, initials or `by` field
on edits, log entries or marks).

- `validateReviewEdit` returns `BAD_REVIEW_POINTS` (`to` not a whole number 0–20),
  `MISSING_REASON` (reason over 200 characters; an empty reason is fine), `REVIEW_FLAT_CCA`
  (a flat CCA: its value is set in the RH app), `REVIEW_UNKNOWN_MEMBERSHIP` (no such member in
  that CCA's leader file) or `REVIEW_NO_CHANGE` (`to` equals `from`), checked in that order.
- At most one per `(matric, ccaID)`: setting again **replaces** it. Every edit and every
  removal is kept in a log (`kind` `edit` / `remove`, old → new, reason, time).
- Each edit is judged against the loaded leader files on every import:
  - **applied** while the file's value for that member still equals `from`: the member's
    `basePoints` becomes `to`;
  - **changed** when the file's value is no longer `from` (a corrected file arrived): the edit
    is NOT applied and the file's value is used; it is shown on Review and when a workspace is
    opened, until removed or set again;
  - **stale** when the membership is gone (or a later edit for it replaces this one).
- Precedence: an edit changes `basePoints` BEFORE everything else. The mean/SD check (7.1),
  the IHG ticks and the engine (4) all see the same reviewed scores. A final-points override
  (6.2) still wins at compute; the mean/SD uses the reviewed base, never the override.
- A score edit changes the score only. Roles and semester-only have their own edit kind
  (membership edits, below).
- Edits are resident data (workspace file only, 8b).

**IHG tick edits.** JCRC may tick or untick a member of a **sport** (the bundle's `sport` = `Y`):

```
tickEdit = { matric, ccaID, from, to, reason, at }     from / to are true / false
```

`from` is the leader file's `ihg` tick when the edit was made. The edit is judged like a score
edit: **applied** while the file still has `from` (the member's `ihg` becomes `to`, before the
mean/SD check, the IHG rows and the engine), **changed** when the file's tick moved, **stale** when
the membership is gone or a later edit replaces it. At most one per `(matric, ccaID)`; a tick log
keeps every edit and removal. Validation, in order: `TICK_NOT_SPORT` (the CCA is not a sport),
`REVIEW_FLAT_CCA`, `REVIEW_UNKNOWN_MEMBERSHIP`, `MISSING_REASON` (over 200 characters),
`REVIEW_NO_CHANGE`. A sport with no IHG result or cap may still be ticked. Going over the cap is
allowed (2c, `IHG_OVER_CAP`).

**Flat value edits.** JCRC may change one member's value in a **flat** CCA (for example 12 → 10);
the other members and the CCA's own flat value keep the bundle's value:

```
flatEdit = { matric, ccaID, from, to, reason, at }     from / to are the member's value
```

`from` is the member's flat value in the bundle when the edit was made; the same applied / changed
/ stale judging and one-per-member rule apply, with a flat log. Validation, in order:
`BAD_FLAT_VALUE` (`to` not a finite number of 0 or more), `FLAT_EDIT_NOT_FLAT`,
`REVIEW_UNKNOWN_MEMBERSHIP`, `MISSING_REASON`, `REVIEW_NO_CHANGE`. An edited member is marked on
Review and on Summary, and the edits are counted on the exports (6.6). The edited value is FINAL
for that member like the flat value itself (4.1).

**Membership edits (roles and full year / 1 sem).** JCRC may change a member's outgoing role,
incoming role or semester-only flag in a **non-flat** CCA. These are sandbox-side only: the RH app
is unchanged.

```
membershipEdit = { matric, ccaID, field, from, to, reason, at }
field: outgoingRole | incomingRole | semesterOnly
from / to: a role (none, head, vice_head) for the role fields, true / false for semesterOnly
```

`from` is the leader file's value for that field when the edit was made. The edit is judged like
the others: **applied** while the file still has `from` (that one field of the member's row becomes
`to`), **changed** when the file's value moved, **stale** when the membership is gone or a later
edit for the same key replaces it. At most one per `(matric, ccaID, field)`; a membership log keeps
every edit and removal. Validation, in order: `MEMBERSHIP_FLAT_CCA` (a flat CCA has no roles or
semester flag), `REVIEW_UNKNOWN_MEMBERSHIP`, `BAD_MEMBERSHIP_VALUE` (a role outside the three, or a
non-boolean semesterOnly), `MISSING_REASON` (over 200 characters), `REVIEW_NO_CHANGE`.

Order of application on import: AUX, then score edits, then membership edits, then tick edits, then
flat edits. The engine input, each CCA's outgoing-leader count, the Summary and the penalty tool
all see the edited values. **The mean/SD check (7.1) still uses full scores**: a change to 1 sem
moves the lists (the base is halved after the check, 4.1), not the meter. Edits are refused while
the lists are finalised, so the penalty tool's frozen cut-offs never see a role change.

**The `from` rule.** Every edit kind (score, tick, flat value, membership, AUX in 6.7) stores the source value
it started from and applies only while the source still has it. A corrected file never silently
keeps an old edit: the edit shows as `changed` until removed or set again.

**The vetted lock.** While a CCA's vetted mark counts (6.5), the Review step refuses every change
to that CCA's level, tweaks, scores, roles, full year / 1 sem, flat values and IHG ticks, and says
so ("Vetted · locked. Clear vetted to change the level, tweaks, scores, roles, full year / 1 sem,
flat values or IHG ticks."). If the vetted
CCA's level is no longer in Settings the line adds that vetted must be cleared to pick another
level. Clearing vetted (or a changed file, 6.5) lifts the lock.

### 6.5 Checklist and vetting

The checklist is the **bundle's CCA list** (2d), in review order: by name (case- and
accent-insensitive, numbers in numeric order), then `ccaID`. Without a bundle it is empty. Each
CCA has one status:

| Status | When |
|---|---|
| `present` | its leader file is loaded (even if some rows have errors) |
| `flat` | a flat CCA (2e); it never needs a file |
| `not_submitting` | JCRC marked it "not submitting" (optional note) and no file is loaded |
| `superseded` | marked "not submitting", but a file was loaded: the file wins; clear the mark |
| `missing` | none of the above |

The checklist is complete when it lists at least one CCA and none is `missing`. A "not
submitting" mark suppresses that CCA's `NO_LEADER_FILE` warning and nothing else. A mark for a
`ccaID` the bundle does not list is ignored. Each row also shows the CCA's type, sport flag,
IHG result and cap (blank = "not set in RH-app"), level and flat value.

**Vetting.** Each CCA can be marked vetted on Review. The mark stores a content hash (FNV-1a,
32-bit, 8 lowercase hex characters), the CCA's `vetHash`, kept in the mark's `fileHash` field:

- a CCA **with a leader file**: the hash of the leader file text, exactly as loaded, so CRLF and LF
  copies differ (the report's `fileHash`);
- a **flat** CCA: the hash of `flat|<flat value>|<sorted member matrics, comma-joined>`, built from
  the bundle's rows only. A re-exported bundle (new `exportedAt`) or a renamed CCA keeps it; a
  changed flat value or roster changes it. Per-member flat edits (6.4) are not part of it;
- null for a CCA with neither (not submitting, or no file): it cannot be vetted.

A mark counts (`vetted`) while the hashes match; `file_changed` when the content changed; `gone`
when the CCA has no content to hash or is no longer in the report. Vetted **locks** the CCA (6.4).
Not-submitting CCAs are never vetted and never block Finalise. Unvetted CCAs block only
Finalise. No reviewer is recorded on a mark.

### 6.6 Finalise gate and export header lines

**The gate.** `finaliseBlock` returns the first reason that applies, in this order, or null:

1. No usable bundle: "Load the RH-app bundle before finalising."
2. Anything **not set**, as ONE message built from the groups that have items, for example
   "Set these in the RH app and download the bundle again — type: RHag, Flag; IHG result or cap:
   Touch Rugby (W). Pick a level on the Review step for: Soccer (M)." The groups: a blank `type`
   on a non-flat CCA; a sport with a leader file and no IHG result or no cap; a CCA with a leader
   file and no level. Flat and not-submitting CCAs never count; a CCA with no leader file counts
   for type only.
3. Checklist incomplete (6.5): "Complete the checklist before finalising."
4. Unvetted: "Vet every CCA before finalising (n of N vetted)." N counts every CCA that can be
   vetted: those with a leader file **and flat CCAs** (D1); not-submitting CCAs have nothing to
   vet. A vetted mark whose content changed does not count.
5. Import errors: "Fix the import errors before finalising."

**Export header lines.** Every list export and the comparison export start with comment lines
in this order: `# mean/SD out of range: ...`, `# final-points overrides: N`,
`# discretion adjustments: N`, `# review edits: N` (applied score edits only),
`# IHG tick edits: N`, `# flat value edits: N`, `# AUX edits: N` (applied edits only),
`# role/semester edits: N` (applied membership edits only, a count), `# IHG over cap: ...`, `# levels: ...`, `# level tweaks: ...`, and, only while finalised,
`# finalised: yes · penalties: N`.

- `# IHG over cap:` lists each sport with more members ticked than its cap as `Name (ccaID)`,
  joined with `, `, or `none`: `# IHG over cap: Soccer (C05), Chess (C01)`.

- `# levels:` is grouped by level in Settings order, CCAs by name inside each group (written as
  `ccaID`), `not set` last, `none` when there are no CCAs, all on one line:
  `# levels: Gold: C01, C04; High Silver: C02; not set: C09`. It covers CCAs with a leader file.
- `# level tweaks:` lists each tweaked CCA, joined with ` | `, or `none`:
  `# level tweaks: Soccer (C05): Gold, multiplier 1.31 (level 1.3)`; a bonus tweak reads
  `bonus 2.5 (level 2)`.
- No header line holds a score, a matric or a resident's name.

### 6.7 AUX edits

On the Summary step JCRC may change a resident's AUX **count** (for example 6 → 7). The AUX table
(4.2) still turns the count into points, capped at `auxCap`; the points are not shown or edited
here. A count above the cap is allowed (`AUX_ABOVE_CAP` warns as before).

```
auxEdit = { matric, from, to, reason, at }     from / to are whole-number counts
```

`from` is the residents list's `aux` when the edit was made. Judged like every edit (6.4):
**applied** while the residents list still has `from` (the resident's `aux` becomes `to` before the
engine), **changed** when it moved, **stale** when the resident is gone or a later edit replaces
it; one per matric; the reason is optional (over 200 characters is `MISSING_REASON`); an AUX log
keeps every edit and removal. Validation, in order: `BAD_AUX_EDIT` (`to` not a whole number of 0 or
more), `AUX_UNKNOWN_RESIDENT`, `MISSING_REASON`, `REVIEW_NO_CHANGE`. residents.csv itself is never
changed. With no residents list loaded the edits cannot be judged: they are kept, `auxUnchecked`,
and never called stale. AUX edits are resident data (workspace file only, 8b).

### 6.8 CCA groups

On the Review step JCRC can create named groups (for example portfolios) and move CCAs into them.

```
group = { id, name, ccaIDs }
```

CCAs are A-Z inside a group and ungrouped CCAs come last (`Ungrouped`). A name is trimmed and cut
to 40 characters; it may not be blank (`BLANK_NAME`) or repeat another group's name,
case-insensitively (`DUPLICATE_NAME`); ids are unique (`DUPLICATE_ID`); an unknown group id is
`UNKNOWN_GROUP`. A CCA sits in at most one group. These four are group errors, not import issue codes.

- **Browser storage** (key `rhps.groups.v1`, this computer only) holds **only group ids, names and
  CCA ids**. No resident data, score or file is stored there. Groups are temporary until RH-app
  provides portfolios.
- The **workspace** holds the groups too (8b `groups`).
- **D3:** opening a workspace whose file has at least one group replaces this computer's groups with
  the file's, and the open summary says "Groups from the file replaced this computer's groups". A file
  with no groups (or an older file, `groups: null`) leaves this computer's groups alone.

## 7. Validation

Run on import. The RH app uses the identical mean/SD check.

### 7.1 Mean/SD

Computed over the CCA's **full `basePoints`** (after review edits, 6.4) — leaders included, semester-only members
**unhalved** — using the **population SD (÷N)**. Bounds are inclusive with tolerance
`1e-9`. The range comes from the bundle's `settings` rows (2d): the CCA's `waiver` row if it
has one, else the `default` row. `meanSdDefault` is used only while no usable bundle is loaded
(exploration), and the panel says so.

A mean or SD outside the range does not block anything (7.3).


### 7.2 ERRORS

Block results until each is fixed by re-importing a corrected file.

- unknown matric (not in residents.csv)
- duplicate matric within a leader file
- `basePoints` not an integer in 0–20
- bad enum or Y/N value
- mixed `ccaID` within one file
- `ccaID` not in the bundle
- two files for the same `ccaID`
- wrong `formatVersion` or wrong header
- duplicate matric in residents.csv, or more than one residents.csv
- bad `gender`, `sem2` or `aux` value
- an ihg.csv (retired, `IHG_FILE_RETIRED`)
- no RH-app bundle, more than one bundle, a value in a column its section does not use, an IHG
  column on a `sport` = `N` row, an unknown `section`, no `cca` rows, an `ihgCap` that is not
  a whole number ≥ 1, or the same `ccaID` on two `cca` rows
- a ccas.csv (retired, `CCAS_FILE_RETIRED`)
- a level entry whose `level` is not one of the `levels`, or whose tweak is out of range; two
  `levels` with the same name
- residents.csv: `jcrc` not `N` / `FULL` / `EXCHANGE`, or `jcrc` other than `N` on a `sem2` = `Y` resident
- flat rows: `ccaID` not in the bundle, `ccaID` that also has a leader file, `flatPoints`
  not a number ≥ 0, rows of one `ccaID` with different `flatPoints` (or a value other than the
  `cca` row's), a standalone flat file beside the bundle, and the usual matric checks (bad,
  unknown, duplicate within one `ccaID`)
- points settings file: not exactly one `default` row, a `scope` other than `default` /
  `waiver`, a waiver row without a `ccaID`, a range value that is not a number or is outside
  0–20 (mean) / 0–10 (SD) or has min above max, the same `ccaID` on two waiver rows, a wrong
  `formatVersion`, and a standalone settings file beside the bundle

### 7.3 WARNINGS

Shown, do not block.

- mean or SD outside the CCA's range (allowed; shown on Import and Review)
- a CCA in the bundle with no leader file, unless it is marked "not submitting" (6.5)
- a non-flat CCA whose `type` is blank in the bundle (1x is assumed)
- a non-flat CCA with a leader file and no level picked (bonus 0 and ×1 are assumed)
- a level entry for a CCA that is not in the bundle (the entry is ignored)
- `semesterOnly` on a `0.5x` CCA (the tick is ignored)
- `aux` above `auxCap`
- IHG for a non-member when `ihgInSportNet` is on (engine only)
- a sport with a leader file and no IHG result or cap (its ticks get no IHG points yet)
- `ihg` ticks in a leader file of a CCA that is not a sport in the bundle (ignored)
- a sport with an IHG result and no member ticked
- more leader-file `ihg` ticks than the sport's `ihgCap` (allowed: every ticked member gets the points; untick on the Review step if it is a mistake)
- more than 10 `0.5x` memberships for one resident
- an applied IHG tick edit (6.4) that leaves a sport over its cap is the same `IHG_OVER_CAP` warning
- an IHG row for a flat or overridden membership (the row is always ignored)
- a waiver for a `ccaID` that is not in the bundle (the row is ignored)

### 7.4 Issue codes

Every issue carries `severity`, `code`, `fileName`, and where known `line`,
`column`, `ccaID` and `matric`, plus a plain-English `message`. Line numbers count the header as
line 1. `canCompute` is true when no error remains. Checks that need a
reference file (residents.csv, the bundle) are skipped when that file is missing, so one mistake
raises one issue rather than a cascade. IHG has no file of its own: it is built from the
leader files' ticks and the bundle (2c).

| Code | Sev | Raised when |
|---|---|---|
| `UNRECOGNISED_FILE` | error | header matches no file kind and the file name gives no hint |
| `CSV_SYNTAX` | error | unterminated quote, or a row whose cell count differs from the header |
| `BAD_HEADER` | error | file name says bundle (`points_bundle_*`) / leader (`points_*`) / flat (`flat_points_*`) / residents but the header columns are not exactly right (a residents.csv without the `jcrc` column lands here) |
| `BAD_FORMAT_VERSION` | error | bundle, flat or settings `formatVersion` is not `1`; leader `formatVersion` is not `1` or `2`, or does not match its columns (`ihg` column = `2`, none = `1`) |
| `MIXED_CCA_ID` | error | one leader file contains more than one `ccaID` |
| `DUPLICATE_CCA_FILE` | error | two leader files for the same `ccaID` |
| `MISSING_RESIDENTS_FILE` | error | no residents.csv |
| `MISSING_BUNDLE_FILE` | error | no RH-app bundle |
| `DUPLICATE_BUNDLE_FILE` | error | more than one bundle (the extra copy is ignored; remove the older one) |
| `BAD_BUNDLE_FILE` | error | a bundle value in a column its section does not use, an `ihgResult` / `ihgCap` on a `sport` = `N` row, an unknown `section`, a `cca` row without a `ccaID`, or no `cca` rows at all |
| `BAD_IHG_CAP` | error | a bundle `ihgCap` that is not blank and not a whole number ≥ 1 (read as blank) |
| `CCAS_FILE_RETIRED` | error | a ccas.csv (by its header or a `ccas` file name); its rows are not read |
| `IHG_FILE_RETIRED` | error | an ihg.csv (by its header or an `ihg` file name); its rows are not read |
| `DUPLICATE_RESIDENTS_FILE` | error | more than one residents file |
| `DUPLICATE_FLAT_FILE` | error | a standalone flat-points file beside the bundle, or more than one without a bundle (the extra copy is ignored) |
| `BAD_MATRIC` | error | matric does not match `^A\d{7}[A-Z]$` after uppercasing |
| `UNKNOWN_MATRIC` | error | leader matric not in residents.csv |
| `DUPLICATE_MATRIC_IN_FILE` | error | same matric twice in one leader file, or twice within one `ccaID` of the flat file (the later row is ignored) |
| `DUPLICATE_RESIDENT` | error | same matric twice in residents.csv |
| `BAD_BASE_POINTS` | error | `basePoints` not a whole number 0–20 |
| `BAD_ENUM` | error | bad `outgoingRole` / `incomingRole` / `type` / `ihgResult` value |
| `BAD_YN` | error | `semesterOnly` / `sem2` / `sport` not `Y` or `N` |
| `BAD_GENDER` | error | `gender` not `M` or `F` |
| `BAD_AUX` | error | `aux` not a whole number ≥ 0 |
| `UNKNOWN_CCA` | error | leader file or flat-row `ccaID` not in the bundle |
| `BAD_JCRC` | error | `jcrc` not `N`, `FULL` or `EXCHANGE` |
| `JCRC_AND_SEM2` | error | `jcrc` is `FULL` or `EXCHANGE` and `sem2` is `Y` for the same resident |
| `BAD_FLAT_POINTS` | error | `flatPoints` not a number ≥ 0 |
| `FLAT_VALUE_MISMATCH` | error | rows of one flat `ccaID` carry different `flatPoints`, or a value other than its `cca` row's (or that row's is blank) |
| `FLAT_AND_LEADER_FILE` | error | a `ccaID` has both flat points (member rows, or `flatPoints` on its `cca` row) and a leader file |
| `BAD_FINAL_POINTS` | error | (override entry) `finalPoints` is not a finite number |
| `MISSING_REASON` | error | (override or discretion entry) reason empty or over 200 characters; (review, tick, flat or AUX edit) reason over 200 characters |
| `OVERRIDE_UNKNOWN_MEMBERSHIP` | error | (override entry) no such membership |
| `BAD_DISCRETION_POINTS` | error | (discretion entry) a delta is not a finite number |
| `DISCRETION_UNKNOWN_RESIDENT` | error | (discretion entry) no such resident |
| `BAD_REVIEW_POINTS` | error | (review edit, 6.4) `to` not a whole number 0–20 |
| `REVIEW_FLAT_CCA` | error | (review or tick edit) the CCA is flat |
| `REVIEW_UNKNOWN_MEMBERSHIP` | error | (review, tick or flat edit) no such member in that CCA's leader file (the flat roster for a flat edit) |
| `REVIEW_NO_CHANGE` | error | (review, tick, flat or AUX edit) `to` equals `from` |
| `MEMBERSHIP_FLAT_CCA` | error | (membership edit, 6.4) the CCA is flat: no roles or semester flag |
| `BAD_MEMBERSHIP_VALUE` | error | (membership edit, 6.4) a role not in none / head / vice_head, or a semesterOnly that is not true / false |
| `TICK_NOT_SPORT` | error | (tick edit, 6.4) the CCA is not a sport in the bundle |
| `BAD_FLAT_VALUE` | error | (flat edit, 6.4) `to` is not a finite number of 0 or more |
| `FLAT_EDIT_NOT_FLAT` | error | (flat edit) the CCA is not a flat CCA |
| `BAD_AUX_EDIT` | error | (AUX edit, 6.7) `to` is not a whole number of 0 or more |
| `AUX_UNKNOWN_RESIDENT` | error | (AUX edit) no such resident in residents.csv |
| `IHG_OVER_CAP` | warning | a sport's leader file has more `ihg` ticks than its `ihgCap`; allowed, every ticked member still gets an IHG entry |
| `UNKNOWN_LEVEL` | error | (level entry, 3b) `level` not one of the `levels` |
| `BAD_LEVEL_TWEAK` | error | (level entry, 3b) `bonusOverride` not a number ≥ 0, or `multiplierOverride` not a number > 0 |
| `DUPLICATE_LEVEL_NAME` | error | two `levels` in Settings have the same name |
| `DUPLICATE_CCA` | error | same `ccaID` on two `cca` rows of the bundle (the later row is ignored) |
| `BAD_RANGE` | error | a settings range value (bundle or settings file) is not a number, is outside 0–20 (mean) / 0–10 (SD), or has min above max |
| `BAD_SETTINGS_FILE` | error | settings rows (bundle or settings file) without exactly one `default` row, with a `scope` other than `default` / `waiver`, or a waiver row without a `ccaID` |
| `DUPLICATE_WAIVER` | error | the same `ccaID` on two waiver rows of the settings file (the later row is ignored) |
| `DUPLICATE_SETTINGS_FILE` | error | a standalone settings file beside the bundle, or more than one without a bundle (the extra copy is ignored) |
| `MEAN_SD_OUT_OF_RANGE` | warning | mean or population SD outside the CCA's range (also raised for a leader file with no members) |
| `NO_LEADER_FILE` | warning | a CCA in the bundle has no leader file, is not a flat CCA and is not marked "not submitting" (6.5) |
| `TYPE_NOT_SET` | warning | a non-flat `cca` row with a blank `type` (1x is assumed) |
| `LEVEL_NOT_SET` | warning | (3b) a non-flat CCA with a leader file and no level or tweak picked (bonus 0 and ×1 are assumed) |
| `LEVEL_UNKNOWN_CCA` | warning | (3b) a level entry for a CCA not in the bundle; the entry is ignored |
| `IHG_NOT_SET` | warning | a non-flat `sport` = `Y` CCA with a leader file and a blank `ihgResult` or `ihgCap`; its ticks get no IHG points yet |
| `IHG_TICK_IGNORED` | warning | `ihg` = `Y` ticks in the leader file of a `sport` = `N` CCA; the ticks are ignored |
| `IHG_NO_TICKS` | warning | a sport with an `ihgResult` and a cap whose leader file ticks nobody |
| `SEMESTER_ONLY_ON_HALF_CCA` | warning | `semesterOnly` = `Y` on a `0.5x` CCA (ignored) |
| `AUX_ABOVE_CAP` | warning | `aux` above `auxCap` |
| `IHG_NON_MEMBER` | warning | (engine) IHG entry for a CCA the resident is not in, only when `ihgInSportNet` is on; not raised by file import |
| `MANY_HALF_CCAS` | warning | a resident has more than 10 `0.5x` memberships |
| `SETTINGS_UNKNOWN_CCA` | warning | a waiver names a `ccaID` not in the bundle; the row is ignored |
| `IHG_ON_FINAL_CCA` | warning | an IHG row for a flat or overridden membership; the row is always ignored, whatever `ihgInSportNet` says |

The five entry codes (`BAD_FINAL_POINTS` … `DISCRETION_UNKNOWN_RESIDENT`) are returned by the
engine's `validateOverride` / `validateDiscretion` when an entry is added; they are not raised
by file import. `IHG_ON_FINAL_CCA` is raised by the engine only (every flat or overridden
membership that has an IHG row); file import cannot produce one, because a flat CCA has no
leader file and so no ticks.

The five review codes (`BAD_REVIEW_POINTS`, `MISSING_REASON`, `REVIEW_FLAT_CCA`,
`REVIEW_UNKNOWN_MEMBERSHIP`, `REVIEW_NO_CHANGE`) are returned by `validateReviewEdit` when an
edit is entered (6.4). `validateTickEdit` (`TICK_NOT_SPORT` first), `validateFlatEdit`
(`BAD_FLAT_VALUE`, `FLAT_EDIT_NOT_FLAT`), `validateMembershipEdit` (`MEMBERSHIP_FLAT_CCA` first,
`BAD_MEMBERSHIP_VALUE`) and `validateAuxEdit` (`BAD_AUX_EDIT`,
`AUX_UNKNOWN_RESIDENT`) return theirs the same way (6.4, 6.7). None is raised by file import, which
reports each edit's status (`applied` / `changed` / `stale`) in `report.review` instead. `NO_LEADER_FILE` is not raised for
a CCA marked "not submitting" on the checklist (6.5).

`exportedAt` is not validated. Mean/SD is computed from every valid, non-duplicate leader row,
whether or not the file has other errors.

## 8. Worked examples

All examples assume AUX = 5 (→ 0 points) and no IHG unless stated, `1x` CCAs, default
config. Every value below was independently recomputed; there were no mismatches.

### E1 — Net ranking (staying 68.375)

Resident is a plain member of six `1x` CCAs.

| CCA | base | level (bonus) | net = base + bonus |
|---|---|---|---|
| Handball | 18 | High Gold (+4) | 22 |
| Arts & Graphics | 15 | Low Bronze (+0.5) | 15.5 |
| Welfare | 10 | Low Bronze (+0.5) | 10.5 |
| Unplugged | 9 | Low Silver (+1.5) | 10.5 |
| Rhebels | 8 | High Gold (+4) | 12 |
| Social | 7 | High Gold (+4) | 11 |

Sort by net: 22, 15.5, 12, 11, 10.5, 10.5. Weights 1, 1, 1, 1, 0.5, 0.25:

```
22 + 15.5 + 12 + 11 + 0.5*10.5 + 0.25*10.5
= 60.5 + 5.25 + 2.625 = 68.375
```

`staying = 68.375 + 0 (AUX) = 68.375`.

**Old slide's base-ranked method (wrong).** Rank by base: Handball 18, A&G 15, Welfare 10,
Unplugged 9, Rhebels 8, Social 7, then apply weights to their nets in that order:

```
22 + 15.5 + 10.5 + 10.5 + 0.5*12 + 0.25*11 = 58.5 + 6 + 2.75 = 67.25
```

It is wrong because the weights are meant to reward the resident's *best contributions*:
Rhebels (net 12) and Social (net 11) beat Welfare and Unplugged (10.5) once the level bonus is
added, yet the base order pushes them into the discounted slots. 67.25 < 68.375 because a
lower-value CCA sits in a full-weight slot. Ranking by net is the rule.

### E2 — Incoming Head of Handball (staying 71.975)

Handball: `18 * 1.2 + 4 = 25.6`. Nets: 25.6, 15.5, 12, 11, 10.5, 10.5.

```
25.6 + 15.5 + 12 + 11 + 5.25 + 2.625 = 71.975
```

### E3 — Bidding, incoming Head of Handball (85.1)

`bidMult = 1.2` (only incoming). No weights:

```
25.6 + 15.5 + 10.5 + 10.5 + 12 + 11 = 85.1
```

### E4 — Bidding, outgoing Head of Handball at x2.0 (99.5)

Outgoing Head of Handball at ×2.0 (High Gold). Handball: `18 * 2.0 + 4 = 40`.

```
40 + 15.5 + 10.5 + 10.5 + 12 + 11 = 99.5
```

### E5 — Penalty: E2's resident drops the incoming role (58.375)

`effBase = min(18, 8) = 8`, incoming multiplier lost: Handball net `8 + 4 = 12`.
Nets: 15.5, 12 (Handball), 12 (Rhebels), 11, 10.5, 10.5.

```
15.5 + 12 + 12 + 11 + 5.25 + 2.625 = 58.375
```

If the frozen green cut-off is above 58.375, the resident is removed.

### E6 — Half-CCA merging

`1x` nets: 20, 15, 12, 9. `0.5x` memberships (level bonus not halved):

| CCA | base | effBase (x0.5) | level (bonus) | stayNet |
|---|---|---|---|---|
| P | 16 | 8 | High Gold (+4) | 12 |
| Q | 12 | 6 | Low Bronze (+0.5) | 6.5 |
| R | 10 | 5 | Pass (+0) | 5 |

Weights 1, 1, 1, 1, 0.5, 0.25, 0.125 (position 7 is the tail: 0.25 / 2).

| Pairing | Slots (desc) | Weighted total |
|---|---|---|
| none | 20, 15, 12, 12, 9, 6.5, 5 | 59 + 4.5 + 1.625 + 0.625 = **65.75** |
| P+Q (18.5) | 20, 18.5, 15, 12, 9, 5 | 65.5 + 4.5 + 1.25 = **71.25** |
| P+R (17) | 20, 17, 15, 12, 9, 6.5 | 64 + 4.5 + 1.625 = **70.125** |
| Q+R (11.5) | 20, 15, 12, 12, 11.5, 9 | 59 + 5.75 + 2.25 = **67** |

Chosen pairing: **P+Q = 71.25**.

### E7 — Semester-only member of a 1x Low Silver CCA, base 14

Mean/SD check uses 14 (unhalved). For points: `effBase = 14 * 0.5 = 7`,
`stayNet = 7 + 1.5 = 8.5`.

### E8 — Mean/SD

CCA scores `[20, 20, 15, 12, 10, 8, 5]`, N = 7.

```
sum = 90, mean = 90 / 7 = 12.857
deviations² = 51.020, 51.020, 4.592, 0.735, 8.163, 23.592, 61.735 -> sum 200.857
variance = 200.857 / 7 = 28.694, population SD = 5.357
```

With defaults (mean 10–14, SD 2–5): mean passes; **SD 5.357 > 5 fails** → `MEAN_SD_OUT_OF_RANGE` warning; nothing blocks.

### E9 — Stacking (base 18, High Gold, incoming 1.2 + outgoing 2.0)

| stackingMode | bidMult | bidNet |
|---|---|---|
| max | max(1.2, 2.0) = 2.0 | 18 * 2.0 + 4 = **40** |
| additive | 1 + 0.2 + 1.0 = 2.2 | 18 * 2.2 + 4 = **43.6** |
| multiplicative | 1.2 * 2.0 = 2.4 | 18 * 2.4 + 4 = **47.2** |

### E10 — Ties

Six male residents, staying `[80, 75, 75, 70, 70, 70]`, `maleGreen = 2`, `maleGrey = 2`
(so green = positions 1–2, grey = 3–4, white = 5–6).

| Pos | Points | Rank | Status |
|---|---|---|---|
| 1 | 80 | 1 | green |
| 2 | 75 | 2 | TIE green/grey — 1 of 2 seats |
| 3 | 75 | 2 | TIE green/grey — 1 of 2 seats |
| 4 | 70 | 4 | TIE grey/white — 1 of 3 seats |
| 5 | 70 | 4 | TIE grey/white — 1 of 3 seats |
| 6 | 70 | 4 | TIE grey/white — 1 of 3 seats |

- 75 group spans positions 2–3, boundary B = 2: `n = 2`, `k = 2 - 2 + 1 = 1`.
- 70 group spans positions 4–6, boundary B = 4: `n = 3`, `k = 4 - 4 + 1 = 1`.

### E11 — AUX

- 7 AUX: `auxTable[7] = 4`.
- 12 AUX: capped, `auxTable[min(12, 10)] = auxTable[10] = 10` (and a warning, `aux` above `auxCap`).

### E12 — Sem-2 merged mode

`sem2Mode = "merged"`, `sem2Factor = 2`. A sem-2 resident with bidding 40 appears in their
gender's bidding list at `40 * 2 = 80`, labelled `sem-2`, **inside the colour band matching their
sem-2 colour** (E15). A sem-2 resident is always inserted, whatever their colour.

### E13 — JCRC residents (H = 346)

Highest final bidding among non-JCRC, non-sem-2 residents: **H = 346**. Defaults
`jcrcFullYearOffset = 1`, `jcrcExchangeFactor = 0.75`.

| `jcrc` | staying = bidding |
|---|---|
| `FULL` | 346 + 1 = **347** |
| `EXCHANGE` | 346 × 0.75 = **259.5** |

With discretion `+2 staying / −1 bidding` on the FULL resident: staying 349, bidding 346.
With no non-JCRC residents at all, H = 0 (FULL → 1, EXCHANGE → 0). A JCRC resident's own
bidding is never part of H; another resident's discretion is.

### E14 — Colour-first bidding order

Six male residents, `maleGreen = 2`, `maleGrey = 2`. Staying = base in a plain CCA; C and E are
outgoing leaders at ×2.0, so their bidding is doubled and the others' equals the base.

| Resident | Staying | Bidding | Colour |
|---|---|---|---|
| A | 90 | 90 | green |
| B | 80 | 80 | green |
| C | 70 | 140 | grey |
| D | 60 | 60 | grey |
| E | 50 | 100 | white |
| F | 40 | 40 | white |

Sorted purely by bidding points: C 140, E 100, A 90, B 80, D 60, F 40.
**Colour first: A 90, B 80 | C 140, D 60 | E 100, F 40** (positions 1–6).

### E15 — Sem-2 staying list: green, grey, white (headcounts 3/3)

Eight sem-2 residents with bidding points `[100, 90, 80, 70, 60, 50, 40, 30]`,
`sem2Green = 3`, `sem2Grey = 3`:

| Positions | Points | Colour |
|---|---|---|
| 1–3 | 100, 90, 80 | green |
| 4–6 | 70, 60, 50 | grey |
| 7–8 | 40, 30 | white |

In `"merged"` mode with `sem2Factor = 2`, the male sem-2 resident on 90 is inserted in the male
bidding list at **180**, inside the **green** band; the one on 30 at 60 inside the white band.
A tie group straddling the position-3/4 or 6/7 boundary is flagged like any staying list.

### E16 — Wheel resolution of a "1 of 2 seats" group

Four male residents A 80, B 75, C 75, D 70 (names ascending), `maleGreen = 2`, `maleGrey = 2`.
Without a resolution: B and C both carry `TIE green/grey — 1 of 2 seats`, ordered B, C by name.
The wheel picks C first: resolution `{ list: "maleStaying", order: [C, B] }`.

| Position | Resident | Colour | Flag |
|---|---|---|---|
| 1 | A | green | – |
| 2 | C | green | `TIE green/grey — resolved by wheel (1 of 2 seats)` |
| 3 | B | grey | `TIE green/grey — resolved by wheel (1 of 2 seats)` |
| 4 | D | grey | – |

A resolution `{ order: [B, D] }` matches no straddling group: it is **stale** and ignored.

### E17 — Published rounding

Half away from zero: `12.5 → 13`, `−12.5 → −13`, `112.4999 → 112`, `0.5 → 1`, `2.4999 → 2`.
The list is still sorted by the exact points (12.5 stays above 12.4999).

### E18 — Flat CCA

A resident in four CCAs: Handball (base 18, High Gold), Arts & Graphics (15, Low Bronze), Welfare
(10, Low Bronze) and one **flat CCA with `flatPoints = 12`**. The bundle's `cca` row and the
sandbox's level table say the flat CCA is High Gold, and the resident is an incoming Head there:
both are ignored. Nets: 22, 15.5, 10.5 and a flat 12.

```
staying = 22 + 15.5 + 12 + 10.5 = 60          (sorted 22, 15.5, 12, 10.5; weights 1, 1, 1, 1)
bidding = 22 + 15.5 + 10.5 + 12 = 60          (AUX 5 → 0, no IHG)
```

### E19 — Final-points override

E1's resident with the Rhebels membership overridden to 5 (instead of 12). Nets:
22, 15.5, 11, 10.5, 10.5, 5.

```
staying = 22 + 15.5 + 11 + 10.5 + 0.5*10.5 + 0.25*5 = 59 + 5.25 + 1.25 = 65.5
bidding = 22 + 15.5 + 10.5 + 10.5 + 5 + 11 = 74.5          (E1 bidding is 81.5)
```

### E20 — Discretion

E1's resident with `+2 staying / −1 bidding`:

```
staying = 68.375 + 2 = 70.375
bidding = 81.5   − 1 = 80.5
```

### E21 — Points settings file (waiver ranges)

The bundle's `settings` rows (2d, 2g): `default` 10–14 / 2–5, and a `waiver` row for CCA 9101 with 12–15 /
1.5–5. Leader file for 9101 has mean **14.5** and SD **1.6**.

```
under the default (10–14 / 2–5):  mean 14.5 > 14      → MEAN_SD_OUT_OF_RANGE
under the waiver  (12–15 / 1.5–5): 12 ≤ 14.5 ≤ 15, 1.5 ≤ 1.6 ≤ 5 → ok
```

With the bundle loaded the CCA is `ok`; without it (sandbox's own default range) the
same files raise `MEAN_SD_OUT_OF_RANGE` for 9101.

## 8b. Workspace file

A **workspace** is everything needed to resume a session, saved only as a file the user
downloads explicitly. It is never written to localStorage, sessionStorage or IndexedDB.

```
{ format: "rhps-workspace", version: 4, savedAt, files: [{name, text}], config,
  ccaLevels, review: { edits, log, vetted, notSubmitting, tickEdits, tickLog,
  flatEdits, flatLog, auxEdits, auxLog, membershipEdits, membershipLog }, step,
  finalOverrides, discretion, resolutions, finalised, groups }
```

`files` are the imported CSVs as text; `config` the scenario config; `ccaLevels` the per-CCA
level entries (3b); `review` the Review step's state: `edits` (one active score edit per
matric + ccaID, 6.4), `log` (every edit set or removed, oldest first: the edit fields plus
`kind` `edit` / `remove`; a removal reads from the edited value back to the file value),
`vetted` (ccaID, leader-file hash, time; 6.5) and `notSubmitting` (ccaID, optional note, time;
6.5); `step` the open step (`import`, `checklist`, `review`, `summary`, `results`, `publish`,
`compare`); `finalOverrides`, `discretion` and `resolutions` the entries of 6.2, 6.3 and 5.6;
`finalised` the penalty state or `null`. Version 3 adds `tickEdits` / `tickLog` (6.4), `flatEdits`
/ `flatLog` (6.4), `auxEdits` / `auxLog` (6.7), each log shaped like `log`, and `groups` (6.8:
`[{id, name, ccaIDs}]`, or `null` when the file records none). Version 4 adds `membershipEdits` /
`membershipLog` (6.4): each edit is `{matric, ccaID, field, from, to, reason, at}` with `field` one
of `outgoingRole`, `incomingRole`, `semesterOnly`; a role value outside none / head / vice_head, or a
non-boolean semesterOnly value, makes the file `CORRUPT`. No reviewer is recorded anywhere. The workspace contains
resident data and must be handled like the input files. Moving between steps is not an unsaved
change; every other change to these fields is.

**Version 1 files** (written before the guided workflow) are read and migrated on open:
`meanSdOverrides` is dropped; `ccaLevels` and `review` start empty and `step` is `import`; every
file whose header is the retired ccas.csv or ihg.csv header (2.2 and earlier), or whose name
starts with `ccas` or `ihg` (any case), is dropped, never converted; and the config is migrated
as in section 3. Opening shows up to two notes, each at most once:
- when a file was dropped: "ccas.csv and ihg.csv were removed: load the RH-app bundle and new
  leader files, then pick each CCA's level on the Review step."
- when the config had the old placement bonus and tiers: "The settings' levels were built from
  the old placement bonus and tiers; check them in Settings."

**Version 2 files** are read and migrated to version 3 with empty `tickEdits`, `tickLog`,
`flatEdits`, `flatLog`, `auxEdits`, `auxLog` and `groups: null`. Nothing is lost, so there is no
note. A version 1 file is migrated to 2 and then to 3.

**Version 3 files** are read and migrated to version 4 with empty `membershipEdits` and
`membershipLog`, again with no note. Everything else is kept as it was.

Version 1, 2, 3 and 4 are read; version 4 is written; any other version is `UNSUPPORTED_VERSION`.

**Levels and the level table.** Renaming a level in Settings renames it in every CCA's entry
(only when exactly one level's name changed and the old name was unique among the levels);
removing a level, reordering, a reset or a loaded scenario does not touch the entries (an entry
on a missing level is `UNKNOWN_LEVEL`, 3b). Editing one level's bonus (or multiplier) sets the
bonus (or multiplier) tweak to blank on every CCA at that level, vetted ones included, so they
follow the new value. Vetted CCAs stay vetted. Settings says how many tweaks were cleared, for
example "2 tweaks on Gold were cleared so those CCAs follow the new value".

- **Filename:** `rhps_workspace_<YYYYMMDD-HHmm>.rhps` (local time).
- **Encrypted form** (optional password): a JSON envelope
  `{ format: "rhps-workspace-encrypted", version: 1, kdf: { name: "PBKDF2", hash: "SHA-256",
  iterations: 310000, salt, verifier }, cipher: { name: "AES-GCM", iv }, data }` with `salt`,
  `iv` and `data` base64. The key is the 256-bit PBKDF2 output; `verifier` is the base64 SHA-256
  of `"rhps-workspace-verifier:"` followed by the key bytes, so a wrong password and a damaged
  file can be told apart. Web Crypto only; no dependency. The envelope keeps its own `version: 1`
  (its layout did not change with workspace version 2); the workspace inside carries its own.
- **Reading** returns the workspace or one code: `NOT_A_WORKSPACE` (not JSON, or not one of the
  two formats), `UNSUPPORTED_VERSION`, `PASSWORD_REQUIRED` (encrypted, no password given),
  `WRONG_PASSWORD`, `CORRUPT` (a missing or wrong-shaped field, a damaged ciphertext).
- **Loading** migrates the file and config (above, section 3) and **re-runs the import
  validation on the saved files** with the saved level table, edits and not-submitting marks.
  Final-points overrides, discretion entries and wheel resolutions that no longer match (6.2,
  6.3, 5.6), score, IHG tick, flat value and role / semester edits that are `changed` or `stale` (6.4), AUX edits
  that are `changed` or `stale` (6.7), vetted marks that no longer count (6.5) and level entries
  for CCAs not in the bundle are reported, with the migration notes, and
  never applied silently.
  What cannot be checked yet is **not** reported as stale: with no usable bundle the score edits,
  vetted marks, tick and flat edits and level entries are `unchecked.review`; while the import
  cannot compute the overrides, discretion entries and wheel resolutions are `unchecked.computed`;
  with no residents list the AUX edits are `unchecked.aux`. The open summary then shows one line
  saying they will be checked once the bundle is loaded (or once the import has no errors), and
  for AUX edits a line saying they are unchecked until the residents list is loaded. When the
  file's groups replaced this computer's groups (6.8) it says "Groups from the file replaced this
  computer's groups". Nothing is deleted or applied by this.

## 9. Open items for JCRC

PLACEHOLDER values to confirm:

- `meanSdDefault` — {meanMin 10, meanMax 14, sdMin 2, sdMax 5}
- `levels` — level names, bonuses and multipliers (Unsatisfactory 0 / 0.8 … High Gold 4 / 2.0)
- `headcounts` — maleGreen, maleGrey, femaleGreen, femaleGrey, sem2Green, sem2Grey (all 0 until set)
- `jcrcFullYearOffset` (1) and `jcrcExchangeFactor` (0.75)

Rule decisions to confirm:

- **`droppedRoleBase` rule** — `min(base, 8)` (current) versus setting the base to 8.
- **`semesterOnly` on `0.5x` CCAs** — currently ignored with a warning (alternative: apply both factors).
- **`halfCcaPlacementHalved`** — default `false`; confirm whether `0.5x` CCAs halve their level bonus.
- **Flat CCAs and halving or merging** — a flat CCA is never halved and never paired (it is
  final, 4.1). Confirm whether a flat `0.5x` CCA should ever be halved or merged.
- **Sem-2 room-pick mode** — `"separate"` (default) versus `"merged"` with `sem2Factor` 2.
