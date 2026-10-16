import { bandAt, bandBoundaries, rankDescending, straddleFlags } from './ranking'
import type {
  Band,
  Checked,
  Gender,
  ListRow,
  Lists,
  Resident,
  ResidentResult,
  RowStatus,
  ScenarioConfig,
  TieFlag,
  WheelList,
  WheelResolution,
} from './types'

export const LABEL_SEM2 = 'sem-2'
export const LABEL_INFORMATIONAL = 'informational — rooms may already be picked'

/** Colour order of a bidding list: green, grey, white, then removed (spec 5.3). */
const BIDDING_ORDER: readonly RowStatus[] = ['green', 'grey', 'white', 'removed']

export interface PenaltyView {
  /** Matrics removed from the staying bands. */
  readonly removed: ReadonlySet<string>
  /** Matrics with at least one dropped role. */
  readonly dropped: ReadonlySet<string>
}

const NO_PENALTY: PenaltyView = { removed: new Set(), dropped: new Set() }

interface Entry {
  readonly resident: Resident
  readonly result: ResidentResult
}

interface Candidate {
  readonly matric: string
  readonly name: string
  readonly result: ResidentResult
  readonly points: number
  readonly status: RowStatus
  readonly tieFlags: readonly TieFlag[]
  readonly labels: readonly string[]
}

const matricOf = (entry: Entry): string => entry.resident.matric

/** Equal points are ordered by name, then matric (spec 5.1). The NUL keeps "Amy" before "Amy B". */
const nameKey = (name: string, matric: string): string => `${name}\u0000${matric}`
const entryKey = (entry: Entry): string => nameKey(entry.resident.name, matricOf(entry))
const candidateKey = (c: Candidate): string => nameKey(c.name, c.matric)

function toRow(candidate: Candidate, position: number, rank: number): ListRow {
  return { ...candidate, position, rank }
}

function candidateOf(
  entry: Entry,
  points: number,
  status: RowStatus,
  tieFlags: readonly TieFlag[],
  labels: readonly string[],
): Candidate {
  const { matric, name } = entry.resident
  return { matric, name, result: entry.result, points, status, tieFlags, labels }
}

function infoLabels(entry: Entry, penalty: PenaltyView): string[] {
  return penalty.dropped.has(matricOf(entry)) ? [LABEL_INFORMATIONAL] : []
}

/* ------------------------------ wheel resolutions ------------------------------ */

const groupKey = (list: WheelList, matrics: readonly string[]): string =>
  `${list}|${[...matrics].sort().join(',')}`

/** A resolution is usable when its order has no repeats; it matches a group by matric set. */
const hasNoRepeats = (resolution: WheelResolution): boolean =>
  new Set(resolution.order).size === resolution.order.length

/** Looks up the wheel order for a straddling group and remembers which resolutions were used. */
class ResolutionBook {
  private readonly used = new Set<number>()
  private readonly latest = new Map<string, number>()

  constructor(private readonly resolutions: readonly WheelResolution[]) {
    resolutions.forEach((resolution, index) => {
      if (hasNoRepeats(resolution)) this.latest.set(groupKey(resolution.list, resolution.order), index)
    })
  }

  /** The wheel order for this group, if a resolution matches it exactly. */
  orderFor(list: WheelList, matrics: readonly string[]): readonly string[] | null {
    const index = this.latest.get(groupKey(list, matrics))
    if (index === undefined) return null
    this.used.add(index)
    return this.resolutions[index]?.order ?? null
  }

  statuses(): Checked<WheelResolution>[] {
    return this.resolutions.map((entry, index) => ({
      entry,
      status: this.used.has(index) ? 'applied' : 'stale',
    }))
  }
}

function resolvedFlag(flag: TieFlag): TieFlag {
  return {
    ...flag,
    text: `TIE ${flag.boundary} — resolved by wheel (${flag.k} of ${flag.n} seats)`,
    resolved: true,
  }
}

interface Banding {
  readonly list: WheelList
  readonly green: number
  readonly grey: number
}

/**
 * Sorts, then bands by headcount. A tie group that straddles a boundary is reordered by the
 * wheel resolution that matches it, if any, and its flags become "resolved by wheel".
 */
function bandedRows(
  entries: readonly Entry[],
  pointsOf: (entry: Entry) => number,
  banding: Banding,
  book: ResolutionBook,
  rowFor: (entry: Entry, band: Band, flags: readonly TieFlag[]) => Candidate,
): ListRow[] {
  const { green, grey, list } = banding
  const boundaries = bandBoundaries(green, grey)
  const ranked = rankDescending(entries, pointsOf, entryKey)
  const rows: ListRow[] = []
  for (let start = 0; start < ranked.length; ) {
    const first = ranked[start]
    if (!first) break
    const group = ranked.filter((r) => r.groupStart === first.groupStart)
    const flags = straddleFlags(first.groupStart, first.groupEnd, boundaries)
    const wheel = flags.length > 0 ? book.orderFor(list, group.map((g) => matricOf(g.item))) : null
    const items = wheel
      ? wheel.flatMap((matric) => group.filter((g) => matricOf(g.item) === matric).map((g) => g.item))
      : group.map((g) => g.item)
    const shown = wheel ? flags.map(resolvedFlag) : flags
    items.forEach((item, offset) => {
      const position = first.groupStart + offset
      rows.push(toRow(rowFor(item, bandAt(position, green, grey), shown), position, first.groupStart))
    })
    start += group.length
  }
  return rows
}

/* --------------------------------- staying lists -------------------------------- */

function removedStayingRows(entries: readonly Entry[], offset: number): ListRow[] {
  return rankDescending(entries, (e) => e.result.staying.points, entryKey).map((r) =>
    toRow(
      candidateOf(r.item, r.item.result.staying.points, 'removed', [], []),
      offset + r.position,
      offset + r.rank,
    ),
  )
}

/** Active residents are banded by headcount; removed residents sit at the bottom. */
function stayingRows(
  entries: readonly Entry[],
  banding: Banding,
  book: ResolutionBook,
  penalty: PenaltyView,
): ListRow[] {
  const isRemoved = (e: Entry): boolean => penalty.removed.has(matricOf(e))
  const active = bandedRows(
    entries.filter((e) => !isRemoved(e)),
    (e) => e.result.staying.points,
    banding,
    book,
    (entry, band, flags) => candidateOf(entry, entry.result.staying.points, band, flags, []),
  )
  return [...active, ...removedStayingRows(entries.filter(isRemoved), active.length)]
}

/** Sem-2 is a staying list: points are the bidding points, banded by sem2Green / sem2Grey. */
function sem2Rows(
  entries: readonly Entry[],
  config: ScenarioConfig,
  book: ResolutionBook,
  penalty: PenaltyView,
): ListRow[] {
  const { sem2Green, sem2Grey } = config.headcounts
  return bandedRows(
    entries,
    (e) => e.result.bidding.points,
    { list: 'sem2', green: sem2Green, grey: sem2Grey },
    book,
    (entry, band, flags) => candidateOf(entry, entry.result.bidding.points, band, flags, infoLabels(entry, penalty)),
  )
}

/* -------------------------------- bidding lists --------------------------------- */

function biddingRows(
  entries: readonly Entry[],
  staying: readonly ListRow[],
  sem2Inserts: readonly ListRow[],
  config: ScenarioConfig,
  penalty: PenaltyView,
): ListRow[] {
  const stayingOf = new Map(staying.map((row) => [row.matric, row]))
  const own = entries.map((entry): Candidate => {
    const row = stayingOf.get(matricOf(entry))
    return candidateOf(
      entry,
      entry.result.bidding.points,
      row?.status ?? 'white',
      row?.tieFlags ?? [],
      infoLabels(entry, penalty),
    )
  })
  const inserted = sem2Inserts.map(
    (row): Candidate => ({
      matric: row.matric,
      name: row.name,
      result: row.result,
      points: row.points * config.sem2Factor,
      status: row.status,
      tieFlags: row.tieFlags,
      labels: [LABEL_SEM2, ...row.labels],
    }),
  )
  return colourFirst([...own, ...inserted])
}

/**
 * Green, then grey, then white, then removed; each colour by bidding points (spec 5.3).
 * Positions run 1..N across the colours; a colour's ranks continue from the rows above it.
 */
function colourFirst(candidates: readonly Candidate[]): ListRow[] {
  const rows: ListRow[] = []
  for (const status of BIDDING_ORDER) {
    const above = rows.length
    const inColour = candidates.filter((c) => c.status === status)
    for (const r of rankDescending(inColour, (c) => c.points, candidateKey)) {
      rows.push(toRow(r.item, above + r.position, above + r.rank))
    }
  }
  return rows
}

function entriesFor(
  results: readonly ResidentResult[],
  residents: readonly Resident[],
): Entry[] {
  const byMatric = new Map(results.map((result) => [result.matric, result]))
  return residents.flatMap((resident) => {
    const result = byMatric.get(resident.matric)
    return result ? [{ resident, result }] : []
  })
}

interface GenderLists {
  readonly staying: ListRow[]
  readonly bidding: ListRow[]
}

function genderLists(
  entries: readonly Entry[],
  gender: Gender,
  sem2Rows: readonly ListRow[],
  config: ScenarioConfig,
  book: ResolutionBook,
  penalty: PenaltyView,
): GenderLists {
  const { headcounts } = config
  const [green, grey] =
    gender === 'M'
      ? [headcounts.maleGreen, headcounts.maleGrey]
      : [headcounts.femaleGreen, headcounts.femaleGrey]
  const list: WheelList = gender === 'M' ? 'maleStaying' : 'femaleStaying'
  const own = entries.filter((e) => !e.resident.sem2 && e.resident.gender === gender)
  const staying = stayingRows(own, { list, green, grey }, book, penalty)
  const merged = config.sem2Mode === 'merged'
  const genderOf = new Map(entries.map((e) => [matricOf(e), e.resident]))
  const inserts = merged ? sem2Rows.filter((row) => genderOf.get(row.matric)?.gender === gender) : []
  return { staying, bidding: biddingRows(own, staying, inserts, config, penalty) }
}

export interface BuiltLists {
  readonly lists: Lists
  readonly resolutions: readonly Checked<WheelResolution>[]
}

export function buildLists(
  results: readonly ResidentResult[],
  residents: readonly Resident[],
  config: ScenarioConfig,
  penalty: PenaltyView = NO_PENALTY,
  resolutions: readonly WheelResolution[] = [],
): BuiltLists {
  const book = new ResolutionBook(resolutions)
  const entries = entriesFor(results, residents)
  const sem2 = sem2Rows(
    entries.filter((e) => e.resident.sem2),
    config,
    book,
    penalty,
  )
  const male = genderLists(entries, 'M', sem2, config, book, penalty)
  const female = genderLists(entries, 'F', sem2, config, book, penalty)
  return {
    lists: {
      maleStaying: male.staying,
      femaleStaying: female.staying,
      maleBidding: male.bidding,
      femaleBidding: female.bidding,
      sem2,
    },
    resolutions: book.statuses(),
  }
}
