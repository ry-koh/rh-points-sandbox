# RH Hall Points Spec — v1.1

Authoritative rules for the Raffles Hall AY26-27 points system. Where this document and the
CLAUDE.md summary differ, this document wins. Every number below is a **config variable**
(section 3); none may be hardcoded outside the defaults config.

Values marked **PLACEHOLDER** are not confirmed by JCRC (see section 9).

## 1. Overview

```
RH app (CCA leaders)  ->  CSV export  ->  email to portfolio head  ->  vetted
      ->  sandbox (JCRC)  ->  5 lists
```

1. CCA leaders allocate base points (whole numbers 0–20) to members in the RH app. The app
   checks the CCA's mean/SD range in the browser and only then lets the leader export.
   Points are never sent to or stored on the RH-app server.
2. The leader emails the CSV to their portfolio head, who vets it.
3. JCRC loads all vetted CSVs plus its own files (residents, IHG, CCA settings) into the
   offline sandbox, adjusts the scenario config, and gets five lists:
   **male staying, male bidding, female staying, female bidding, sem-2 bidding**.

The **matric number** is the join key across every file.

## 2. Input file formats

All files are UTF-8 CSV with a header row and exact column names (case-sensitive, any
column order, no extra columns). Matric is normalised to uppercase (after trimming
whitespace) and must match `^A\d{7}[A-Z]$`. Y/N fields accept only `Y` or `N`.

### (a) Leader export — produced by the RH app

Filename: `points_<ccaID>_<YYYYMMDD>.csv`. One file per CCA.

| Column | Type / allowed values |
|---|---|
| `formatVersion` | integer, must equal `1` |
| `ccaID` | string, must exist in ccas.csv, identical on every row |
| `ccaName` | string |
| `matric` | matric pattern above |
| `name` | string |
| `basePoints` | integer 0–20 |
| `semesterOnly` | `Y` / `N` |
| `outgoingRole` | `none` / `head` / `vice_head` |
| `incomingRole` | `none` / `head` / `vice_head` |
| `exportedAt` | ISO 8601 timestamp |

### (b) residents.csv — JCRC

| Column | Type / allowed values |
|---|---|
| `matric` | matric pattern, unique |
| `name` | string |
| `gender` | `M` / `F` |
| `sem2` | `Y` / `N` |
| `aux` | integer ≥ 0 |

### (c) ihg.csv — JCRC / Sports

| Column | Type / allowed values |
|---|---|
| `matric` | matric pattern |
| `ccaID` | string (the sport's ccaID) |
| `placement` | `1st` / `2nd` / `3rd` / `3rd4th_no_match` |

A resident may have several rows; their IHG points are summed.

### (d) ccas.csv — JCRC

| Column | Type / allowed values |
|---|---|
| `ccaID` | string, unique |
| `ccaName` | string |
| `type` | `1x` / `0.5x` |
| `placement` | `pass` / `bronze` / `silver` / `gold` |
| `outgoingTier` | blank, or a tier name from `outgoingTiers` |
| `outgoingMultiplier` | blank, or a number > 0 |
| `meanMin`, `meanMax`, `sdMin`, `sdMax` | blank, or a number |

A **blank range field means "use the default"** (`meanSdDefault`). That is how a waiver is
stored: a waived CCA simply carries its own non-blank override values. Each of the four
fields falls back independently.

## 3. Scenario config (JSON)

The scenario JSON holds **settings only, never resident data**.

| Key | Type | Default | Meaning |
|---|---|---|---|
| `meanSdDefault` | `{meanMin, meanMax, sdMin, sdMax}` | `{10, 14, 2, 5}` **PLACEHOLDER** | Hall-wide allowed mean/SD range, inclusive |
| `placementBonus` | `{pass, bronze, silver, gold}` | `{0, 0.5, 1.5, 4}` | Flat points per placement level |
| `halfCcaBaseFactor` | number | `0.5` | Base factor for `0.5x` CCAs |
| `halfCcaPlacementHalved` | boolean | `false` | Halve the placement bonus for `0.5x` CCAs |
| `semesterOnlyFactor` | number | `0.5` | Base factor for semester-only members of `1x` CCAs |
| `incomingMultiplier` | `{head, vice_head}` | `{1.2, 1.2}` | Multiplier for incoming roles (staying and bidding) |
| `outgoingMode` | `"tier"` \| `"manual"` | `"tier"` | Where the outgoing multiplier comes from |
| `outgoingTiers` | `[{name, multiplier}]` | Unsatisfactory 0.8, Pass 1.0, Low Bronze 1.05, High Bronze 1.15, Low Silver 1.25, High Silver 1.5, Low Gold 1.75, High Gold 2.0 **PLACEHOLDER** | Tier table for `"tier"` mode |
| `stackingMode` | `"max"` \| `"additive"` \| `"multiplicative"` | `"max"` | How outgoing and incoming roles combine in the same CCA (bidding) |
| `droppedRoleBase` | number | `8` | Base ceiling for a dropped incoming role |
| `auxTable` | 11 numbers (AUX 0..10) | `[-10,-8,-6,-4,-2,0,2,4,6,8,10]` | AUX count to hall points |
| `auxCap` | integer | `10` | AUX count above this is capped |
| `ihgPoints` | `{1st, 2nd, 3rd, 3rd4th_no_match}` | `{5, 4, 3, 1}` | Points per IHG placement |
| `ihgInSportNet` | boolean | `false` | Add IHG into the sport's net (true) or keep it flat (false) |
| `stayingWeights` | number[] | `[1,1,1,1,0.5,0.25]` | Weight per ranked staying slot |
| `stayingWeightTail` | `"halve"` | `"halve"` | Each position past the array has half the previous position's weight |
| `mergeHalfCcas` | boolean | `true` | Allow pairs of `0.5x` memberships to merge into one slot |
| `headcounts` | `{maleGreen, maleGrey, femaleGreen, femaleGrey, sem2Spots}` | all `0` **PLACEHOLDER** | Must be set before lists are final |
| `sem2Mode` | `"separate"` \| `"merged"` | `"separate"` | Sem-2 room-pick mode |
| `sem2Factor` | number | `2` | Bidding multiplier for sem-2 residents in `"merged"` mode |

Per-CCA values live in ccas.csv (type, placement, outgoing tier/multiplier, range overrides).
`outgoingMode` selects which of `outgoingTier` / `outgoingMultiplier` is read.

## 4. Formulas

Notation: resident `r`, CCA `c`, membership `m = (r, c)` taken from the leader file of `c`.

### 4.1 Per-membership values

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
outMult = outgoing multiplier of c                    if outgoingRole != none else 1
          # tier mode: outgoingTiers[c.outgoingTier]; manual mode: c.outgoingMultiplier
          # shared by every outgoing leader of c
stayMult = inMult                                     # outgoing is never used for staying

if incomingRole != none and outgoingRole != none:
    bidMult = max(inMult, outMult)                    if stackingMode == "max"
            = 1 + (inMult - 1) + (outMult - 1)        if "additive"
            = inMult * outMult                        if "multiplicative"
else:
    bidMult = inMult if incomingRole != none, else outMult if outgoingRole != none, else 1
```

**Placement and IHG**

```
placement = placementBonus[c.placement]
            * (0.5 if c.type == "0.5x" and halfCcaPlacementHalved else 1)
ihgNet    = ihgInSportNet ? sum(ihgPoints[row.placement] for ihg rows of r where row.ccaID == c.ccaID) : 0
```

**Net per membership**

```
stayNet = effBase * stayMult + placement + ihgNet
bidNet  = effBase * bidMult  + placement + ihgNet
```

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
Ties are decided on the rounded values.

## 5. Lists

Only residents in residents.csv appear in lists. A resident with no CCA files still appears,
with AUX/IHG points only. Nobody is excluded.

### 5.1 Competition ranking

Sort descending by points (rounded value). `rank = 1 + number of residents with strictly
greater points`, so ties share a rank and the next rank is skipped (1, 2, 2, 4).
Position is the 1-indexed place in the sorted order (tied residents occupy consecutive
positions).

### 5.2 Staying lists (male, female)

- Members: non-sem-2 residents of that gender, sorted by `staying` descending.
- Positions `1..G` (G = `maleGreen` / `femaleGreen`) are **green**; the next `H`
  (`maleGrey` / `femaleGrey`) are **grey**; the rest are **white**.
- **Tie flag.** A tie group spans positions `a..b`. For a boundary after position `B`
  (`B = G` green/grey, `B = G + H` grey/white), the group straddles it if `a <= B < b`.
  Every resident in the group gets status `TIE green/grey` (or `TIE grey/white`) plus
  `k of n seats`, where `n = b - a + 1` and `k = B - a + 1` (the number of tied residents
  who fit above the boundary). A tie group straddling both boundaries carries both flags.
  Ties are not broken by the tool.

### 5.3 Bidding lists (male, female)

- All non-sem-2 residents of that gender, sorted by `bidding` descending, competition
  ranking, with their staying status (green/grey/white, plus any tie flag) shown for
  information.
- In `sem2Mode = "merged"`, sem-2 residents **with a spot** (5.4) of that gender are
  inserted using `bidding * sem2Factor`, labelled `sem-2`.

### 5.4 Sem-2 list

- All sem-2 residents (both genders), ranked by `bidding` descending, competition ranking.
  Sem-2 residents have no staying list.
- The top `sem2Spots` positions get a spot; a tie group straddling the boundary is flagged
  `TIE spot/no spot` (the sem-2 flag) with `k of n seats`, using the same rule as 5.2.
- In `"separate"` mode this is the only place sem-2 residents appear. In `"merged"` mode it is
  still produced, and spot-holders are also inserted into their gender's bidding list.

Ties are never broken automatically; they are settled by a wheel spin outside the tool.

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

## 7. Validation

Run on import. The RH app uses the identical mean/SD check.

### 7.1 Mean/SD

Computed over the CCA's **full `basePoints`** — leaders included, semester-only members
**unhalved** — using the **population SD (÷N)**. Bounds are inclusive with tolerance
`1e-9`. The range is the CCA's override fields, else `meanSdDefault`; each of the four
range fields falls back to `meanSdDefault` independently.

### 7.2 ERRORS

Block results until each is fixed by re-importing, or explicitly overridden. Every
override is listed on the outputs.

- mean/SD out of range
- unknown matric (not in residents.csv)
- duplicate matric within a leader file
- `basePoints` not an integer in 0–20
- bad enum or Y/N value
- mixed `ccaID` within one file
- `ccaID` not in ccas.csv
- two files for the same `ccaID`
- wrong `formatVersion` or wrong header
- an outgoing leader in a CCA whose outgoing tier/multiplier is blank for the active `outgoingMode`
- duplicate matric in residents.csv
- bad `gender`, `sem2` or `aux` value
- ihg.csv `matric` not in residents.csv
- ihg.csv `ccaID` not in ccas.csv
- an `outgoingTier` name in ccas.csv that is not in `outgoingTiers`
- an `outgoingMultiplier` in ccas.csv that is not a positive number

### 7.3 WARNINGS

Shown, do not block.

- a CCA in ccas.csv with no leader file
- `semesterOnly` on a `0.5x` CCA (the tick is ignored)
- `aux` above `auxCap`
- IHG for a non-member when `ihgInSportNet` is on
- more than 10 `0.5x` memberships for one resident

## 8. Worked examples

All examples assume AUX = 5 (→ 0 points) and no IHG unless stated, `1x` CCAs, default
config. Every value below was independently recomputed; there were no mismatches.

### E1 — Net ranking (staying 68.375)

Resident is a plain member of six `1x` CCAs.

| CCA | base | placement | net = base + bonus |
|---|---|---|---|
| Handball | 18 | Gold (4) | 22 |
| Arts & Graphics | 15 | Bronze (0.5) | 15.5 |
| Welfare | 10 | Bronze (0.5) | 10.5 |
| Unplugged | 9 | Silver (1.5) | 10.5 |
| Rhebels | 8 | Gold (4) | 12 |
| Social | 7 | Gold (4) | 11 |

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
Rhebels (net 12) and Social (net 11) beat Welfare and Unplugged (10.5) once placement is
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

Handball: `18 * 2.0 + 4 = 40`.

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

`1x` nets: 20, 15, 12, 9. `0.5x` memberships (placement not halved):

| CCA | base | effBase (x0.5) | placement | stayNet |
|---|---|---|---|---|
| P | 16 | 8 | gold 4 | 12 |
| Q | 12 | 6 | bronze 0.5 | 6.5 |
| R | 10 | 5 | pass 0 | 5 |

Weights 1, 1, 1, 1, 0.5, 0.25, 0.125 (position 7 is the tail: 0.25 / 2).

| Pairing | Slots (desc) | Weighted total |
|---|---|---|
| none | 20, 15, 12, 12, 9, 6.5, 5 | 59 + 4.5 + 1.625 + 0.625 = **65.75** |
| P+Q (18.5) | 20, 18.5, 15, 12, 9, 5 | 65.5 + 4.5 + 1.25 = **71.25** |
| P+R (17) | 20, 17, 15, 12, 9, 6.5 | 64 + 4.5 + 1.625 = **70.125** |
| Q+R (11.5) | 20, 15, 12, 12, 11.5, 9 | 59 + 5.75 + 2.25 = **67** |

Chosen pairing: **P+Q = 71.25**.

### E7 — Semester-only member of a 1x Silver CCA, base 14

Mean/SD check uses 14 (unhalved). For points: `effBase = 14 * 0.5 = 7`,
`stayNet = 7 + 1.5 = 8.5`.

### E8 — Mean/SD

CCA scores `[20, 20, 15, 12, 10, 8, 5]`, N = 7.

```
sum = 90, mean = 90 / 7 = 12.857
deviations² = 51.020, 51.020, 4.592, 0.735, 8.163, 23.592, 61.735 -> sum 200.857
variance = 200.857 / 7 = 28.694, population SD = 5.357
```

With defaults (mean 10–14, SD 2–5): mean passes; **SD 5.357 > 5 fails** → ERROR.

### E9 — Stacking (base 18, Gold, incoming 1.2 + outgoing 2.0)

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

`sem2Mode = "merged"`, `sem2Factor = 2`. A sem-2 resident with bidding 40 and a sem-2 spot
appears in their gender's bidding list at `40 * 2 = 80`, labelled `sem-2`.

## 9. Open items for JCRC

PLACEHOLDER values to confirm:

- `meanSdDefault` — {meanMin 10, meanMax 14, sdMin 2, sdMax 5}
- `outgoingTiers` — tier names and multipliers (Unsatisfactory 0.8 … High Gold 2.0)
- `headcounts` — maleGreen, maleGrey, femaleGreen, femaleGrey, sem2Spots (all 0 until set)

Rule decisions to confirm:

- **`droppedRoleBase` rule** — `min(base, 8)` (current) versus setting the base to 8.
- **`semesterOnly` on `0.5x` CCAs** — currently ignored with a warning (alternative: apply both factors).
- **`halfCcaPlacementHalved`** — default `false`; confirm whether `0.5x` CCAs halve their placement bonus.
- **Sem-2 room-pick mode** — `"separate"` (default) versus `"merged"` with `sem2Factor` 2.
