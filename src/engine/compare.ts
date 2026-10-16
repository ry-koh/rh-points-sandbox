import { roundForCompare } from './merge'
import type { ListRow, Lists, PipelineResult } from './types'

/** Status used when a resident is on only one side of a comparison. */
export const ABSENT = 'absent'
/** Status used for rows without one (e.g. sem-2 rows inserted into a bidding list). */
export const NO_STATUS = 'none'

export interface StatusMove {
  readonly from: string
  readonly to: string
  readonly count: number
}

export interface CompareRow {
  readonly matric: string
  readonly name: string
  readonly statusA: string
  readonly statusB: string
  readonly rankA: number | null
  readonly rankB: number | null
  /** rankB − rankA: negative means the resident moved up. */
  readonly rankDelta: number | null
  readonly pointsA: number | null
  readonly pointsB: number | null
  /** pointsB − pointsA. */
  readonly pointsDelta: number | null
  readonly changed: boolean
}

export interface ListComparison {
  readonly moves: readonly StatusMove[]
  readonly rows: readonly CompareRow[]
}

export type Comparison = Readonly<Record<keyof Lists, ListComparison>>

const LIST_KEYS: readonly (keyof Lists)[] = ['maleStaying', 'femaleStaying', 'maleBidding', 'femaleBidding', 'sem2']

const statusOf = (row: ListRow | undefined): string => (row ? (row.status ?? NO_STATUS) : ABSENT)
const both = (a: number | undefined, b: number | undefined): number | null =>
  a === undefined || b === undefined ? null : b - a

function compareRow(matric: string, a: ListRow | undefined, b: ListRow | undefined): CompareRow {
  const statusA = statusOf(a)
  const statusB = statusOf(b)
  const rankDelta = both(a?.rank, b?.rank)
  const pointsDelta = both(a?.points, b?.points)
  const pointsMoved = pointsDelta === null || roundForCompare(pointsDelta) !== 0
  return {
    matric,
    name: a?.name ?? b?.name ?? '',
    statusA,
    statusB,
    rankA: a?.rank ?? null,
    rankB: b?.rank ?? null,
    rankDelta,
    pointsA: a?.points ?? null,
    pointsB: b?.points ?? null,
    pointsDelta,
    changed: statusA !== statusB || rankDelta !== 0 || pointsMoved,
  }
}

function countMoves(rows: readonly CompareRow[]): StatusMove[] {
  const counts = new Map<string, StatusMove>()
  for (const row of rows) {
    if (row.statusA === row.statusB) continue
    const key = `${row.statusA}→${row.statusB}`
    const count = (counts.get(key)?.count ?? 0) + 1
    counts.set(key, { from: row.statusA, to: row.statusB, count })
  }
  return [...counts.values()].sort((x, y) => y.count - x.count)
}

/** Resident-by-resident comparison of one list under two runs (A first, then B-only rows). */
export function compareLists(a: readonly ListRow[], b: readonly ListRow[]): ListComparison {
  const byA = new Map(a.map((row) => [row.matric, row]))
  const byB = new Map(b.map((row) => [row.matric, row]))
  const matrics = [...byA.keys(), ...[...byB.keys()].filter((m) => !byA.has(m))]
  const rows = matrics.map((matric) => compareRow(matric, byA.get(matric), byB.get(matric)))
  return { moves: countMoves(rows), rows }
}

/** Compares all five lists of two computeAll results on the same data. */
export function compareRuns(a: PipelineResult, b: PipelineResult): Comparison {
  const entries = LIST_KEYS.map((key) => [key, compareLists(a.lists[key], b.lists[key])] as const)
  return Object.fromEntries(entries) as Record<keyof Lists, ListComparison>
}
