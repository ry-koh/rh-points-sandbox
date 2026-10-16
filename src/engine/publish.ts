import { roundForCompare } from './merge'
import type { Band, ListRow, Lists, WheelList, WheelResolution } from './types'

export interface PublishedRow {
  readonly no: number
  readonly name: string
  /** Whole number, rounded half away from zero. */
  readonly points: number
  readonly band: Band
}

export interface PublishedList {
  readonly pointsLabel: 'Staying Points' | 'Bidding Points' | 'Hall Points'
  readonly rows: readonly PublishedRow[]
}

export interface PublishedLists {
  readonly maleStaying: PublishedList
  readonly femaleStaying: PublishedList
  readonly maleBidding: PublishedList
  readonly femaleBidding: PublishedList
  readonly sem2Staying: PublishedList
}

/** A boundary tie group still waiting for the wheel. */
export interface UnresolvedTie {
  readonly list: WheelList
  readonly boundary: string
  readonly names: readonly string[]
}

export type PublishResult =
  | { readonly ok: true; readonly lists: PublishedLists }
  | { readonly ok: false; readonly unresolved: readonly UnresolvedTie[] }

const STAYING_KEYS: readonly WheelList[] = ['maleStaying', 'femaleStaying', 'sem2']

/** Half away from zero on the compared value: 12.5 gives 13, -12.5 gives -13 (spec 5.7). */
export function roundHalfAwayFromZero(value: number): number {
  const compared = roundForCompare(value)
  const rounded = Math.floor(Math.abs(compared) + 0.5)
  return compared < 0 ? -rounded : rounded
}

const hasMatching = (resolutions: readonly WheelResolution[], list: WheelList, matrics: readonly string[]): boolean =>
  resolutions.some(
    (r) =>
      r.list === list &&
      r.order.length === matrics.length &&
      matrics.every((m) => r.order.includes(m)),
  )

/**
 * Every boundary tie group not yet settled. A group counts as settled only when its flag says
 * "resolved by wheel" and, when `resolutions` is given, a matching resolution exists.
 */
function unresolvedTies(lists: Lists, resolutions: readonly WheelResolution[] | undefined): UnresolvedTie[] {
  return STAYING_KEYS.flatMap((list) => {
    const rows = lists[list]
    const groups = new Map<string, ListRow[]>()
    for (const row of rows) {
      for (const flag of row.tieFlags) {
        const key = `${row.rank}|${flag.boundary}`
        groups.set(key, [...(groups.get(key) ?? []), row])
      }
    }
    return [...groups.entries()].flatMap(([key, members]) => {
      const flag = members[0]?.tieFlags.find((f) => `${members[0]?.rank}|${f.boundary}` === key)
      const settled =
        flag?.resolved === true &&
        (resolutions === undefined || hasMatching(resolutions, list, members.map((m) => m.matric)))
      if (settled || !flag) return []
      return [{ list, boundary: flag.boundary, names: members.map((m) => m.name) }]
    })
  })
}

function publishList(rows: readonly ListRow[], pointsLabel: PublishedList['pointsLabel']): PublishedList {
  const shown = rows.flatMap((row) =>
    row.status === 'removed' ? [] : [{ name: row.name, points: roundHalfAwayFromZero(row.points), band: row.status }],
  )
  return { pointsLabel, rows: shown.map((row, index): PublishedRow => ({ no: index + 1, ...row })) }
}

/**
 * The lists JCRC publishes (spec 5.7): five lists of {no, name, points, band}, no matric,
 * removed residents left out. Blocked until every boundary tie group is resolved. Sorting
 * was done on the exact points; rounding here is display only.
 */
export function buildPublishedLists(
  lists: Lists,
  resolutions?: readonly WheelResolution[],
): PublishResult {
  const unresolved = unresolvedTies(lists, resolutions)
  if (unresolved.length > 0) return { ok: false, unresolved }
  return {
    ok: true,
    lists: {
      maleStaying: publishList(lists.maleStaying, 'Staying Points'),
      femaleStaying: publishList(lists.femaleStaying, 'Staying Points'),
      maleBidding: publishList(lists.maleBidding, 'Bidding Points'),
      femaleBidding: publishList(lists.femaleBidding, 'Bidding Points'),
      sem2Staying: publishList(lists.sem2, 'Hall Points'),
    },
  }
}
