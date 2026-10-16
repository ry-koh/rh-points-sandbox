import type { Checked, ListRow, Lists, TieFlag, WheelList, WheelResolution } from '../../engine'

/** The three staying lists a wheel result can settle (spec 5.6). */
export const WHEEL_LISTS: readonly WheelList[] = ['maleStaying', 'femaleStaying', 'sem2']

export const isWheelList = (list: string): list is WheelList => (WHEEL_LISTS as readonly string[]).includes(list)

/** One tie group that straddles a band boundary on a staying list. */
export interface TieGroup {
  readonly list: WheelList
  /** Rows in their current order (the wheel order once resolved). */
  readonly rows: readonly ListRow[]
  readonly flags: readonly TieFlag[]
  readonly resolved: boolean
}

export const groupMatrics = (group: TieGroup): string[] => group.rows.map((r) => r.matric)

/** Every boundary tie group on the staying lists, in list order. */
export function tieGroups(lists: Lists): TieGroup[] {
  return WHEEL_LISTS.flatMap((list) => {
    const byRank = new Map<number, ListRow[]>()
    for (const row of lists[list]) {
      if (row.tieFlags.length === 0 || row.status === 'removed') continue
      byRank.set(row.rank, [...(byRank.get(row.rank) ?? []), row])
    }
    return [...byRank.values()].map((rows): TieGroup => {
      const flags = rows[0]?.tieFlags ?? []
      return { list, rows, flags, resolved: flags.every((f) => f.resolved === true) }
    })
  })
}

/** The group a row belongs to on a list, if it is in a boundary tie. */
export function groupOf(lists: Lists, list: string, matric: string): TieGroup | null {
  if (!isWheelList(list)) return null
  return tieGroups(lists).find((g) => g.list === list && g.rows.some((r) => r.matric === matric)) ?? null
}

/** A copy of `items` with the item at `index` moved by `delta` places; unchanged at the ends. */
export function moveItem<T>(items: readonly T[], index: number, delta: number): T[] {
  const target = index + delta
  if (index < 0 || index >= items.length || target < 0 || target >= items.length) return [...items]
  const next = [...items]
  const [moved] = next.splice(index, 1)
  if (moved !== undefined) next.splice(target, 0, moved)
  return next
}

/** "green/grey" → green: the band the first k of the group go to. */
export const upperColour = (boundary: string): string => boundary.split('/')[0] ?? boundary

export const seatsText = (flag: TieFlag): string => `${flag.k} of ${flag.n} go to ${upperColour(flag.boundary)}`

/** Wheel results the engine reported as stale (they no longer match any tie group). */
export const staleResolutions = (checked: readonly Checked<WheelResolution>[] | undefined): WheelResolution[] =>
  (checked ?? []).filter((c) => c.status === 'stale').map((c) => c.entry)
