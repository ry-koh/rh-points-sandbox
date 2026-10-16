import { bandAt, bandBoundaries, rankDescending, spotBoundaries, straddleFlags } from './ranking'
import type {
  Gender,
  ListRow,
  Lists,
  Resident,
  ResidentResult,
  RowStatus,
  ScenarioConfig,
  TieFlag,
} from './types'

export const LABEL_SEM2 = 'sem-2'
export const LABEL_INFORMATIONAL = 'informational — rooms may already be picked'

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

function rankRows(candidates: readonly Candidate[]): ListRow[] {
  return rankDescending(candidates, (c) => c.points, (c) => c.matric).map((r) =>
    toRow(r.item, r.position, r.rank),
  )
}

function infoLabels(entry: Entry, penalty: PenaltyView): string[] {
  return penalty.dropped.has(matricOf(entry)) ? [LABEL_INFORMATIONAL] : []
}

function activeStayingRows(entries: readonly Entry[], green: number, grey: number): ListRow[] {
  const boundaries = bandBoundaries(green, grey)
  return rankDescending(entries, (e) => e.result.staying.points, matricOf).map((r) =>
    toRow(
      candidateOf(
        r.item,
        r.item.result.staying.points,
        bandAt(r.position, green, grey),
        straddleFlags(r.groupStart, r.groupEnd, boundaries),
        [],
      ),
      r.position,
      r.rank,
    ),
  )
}

function removedStayingRows(entries: readonly Entry[], offset: number): ListRow[] {
  return rankDescending(entries, (e) => e.result.staying.points, matricOf).map((r) =>
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
  green: number,
  grey: number,
  penalty: PenaltyView,
): ListRow[] {
  const isRemoved = (e: Entry): boolean => penalty.removed.has(matricOf(e))
  const active = activeStayingRows(entries.filter((e) => !isRemoved(e)), green, grey)
  return [...active, ...removedStayingRows(entries.filter(isRemoved), active.length)]
}

function sem2Rows(entries: readonly Entry[], spots: number, penalty: PenaltyView): ListRow[] {
  const boundaries = spotBoundaries(spots)
  return rankDescending(entries, (e) => e.result.bidding.points, matricOf).map((r) =>
    toRow(
      candidateOf(
        r.item,
        r.item.result.bidding.points,
        r.position <= spots ? 'spot' : 'no spot',
        straddleFlags(r.groupStart, r.groupEnd, boundaries),
        infoLabels(r.item, penalty),
      ),
      r.position,
      r.rank,
    ),
  )
}

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
      row?.status ?? null,
      row?.tieFlags ?? [],
      infoLabels(entry, penalty),
    )
  })
  const inserted = sem2Inserts.map(
    (row): Candidate => ({
      matric: row.matric,
      name: row.name,
      result: row.result,
      points: row.result.bidding.points * config.sem2Factor,
      status: null,
      tieFlags: row.tieFlags,
      labels: [LABEL_SEM2, ...row.labels],
    }),
  )
  return rankRows([...own, ...inserted])
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
  sem2Spots: readonly ListRow[],
  config: ScenarioConfig,
  penalty: PenaltyView,
): GenderLists {
  const { headcounts } = config
  const [green, grey] =
    gender === 'M'
      ? [headcounts.maleGreen, headcounts.maleGrey]
      : [headcounts.femaleGreen, headcounts.femaleGrey]
  const own = entries.filter((e) => !e.resident.sem2 && e.resident.gender === gender)
  const staying = stayingRows(own, green, grey, penalty)
  const merged = config.sem2Mode === 'merged'
  const genderOf = new Map(entries.map((e) => [matricOf(e), e.resident]))
  const inserts = merged
    ? sem2Spots.filter((row) => genderOf.get(row.matric)?.gender === gender)
    : []
  return { staying, bidding: biddingRows(own, staying, inserts, config, penalty) }
}

export function buildLists(
  results: readonly ResidentResult[],
  residents: readonly Resident[],
  config: ScenarioConfig,
  penalty: PenaltyView = NO_PENALTY,
): Lists {
  const entries = entriesFor(results, residents)
  const sem2 = sem2Rows(
    entries.filter((e) => e.resident.sem2),
    config.headcounts.sem2Spots,
    penalty,
  )
  const withSpot = sem2.filter((row) => row.status === 'spot')
  const male = genderLists(entries, 'M', withSpot, config, penalty)
  const female = genderLists(entries, 'F', withSpot, config, penalty)
  return {
    maleStaying: male.staying,
    femaleStaying: female.staying,
    maleBidding: male.bidding,
    femaleBidding: female.bidding,
    sem2,
  }
}
