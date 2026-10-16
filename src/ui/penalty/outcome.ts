import type { ListRow, Lists, Resident } from '../../engine'

const stayingOf = (lists: Lists, resident: Resident): readonly ListRow[] =>
  resident.gender === 'M' ? lists.maleStaying : lists.femaleStaying

const statusIn = (rows: readonly ListRow[], matric: string): string =>
  rows.find((r) => r.matric === matric)?.status ?? 'not listed'

/**
 * Plain-words outcome of a penalty, read off the engine's lists before and after
 * (nothing is recalculated here).
 */
export function describeOutcome(resident: Resident, before: Lists, after: Lists, newlyRemoved: boolean): string {
  if (resident.sem2) return 'Sem-2 list re-sorted only'
  const was = stayingOf(before, resident)
  const now = stayingOf(after, resident)
  if (newlyRemoved) {
    const promoted = now
      .filter((r) => r.status === 'green' && statusIn(was, r.matric) !== 'green')
      .map((r) => r.name)
    if (promoted.length === 0) return 'Removed'
    return `Removed — ${promoted.join(', ')} ${promoted.length === 1 ? 'moves' : 'move'} to green`
  }
  const from = statusIn(was, resident.matric)
  const to = statusIn(now, resident.matric)
  return from === to ? `Stays ${to}` : `Moves from ${from} to ${to}`
}
