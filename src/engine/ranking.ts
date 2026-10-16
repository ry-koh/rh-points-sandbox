import { roundForCompare } from './merge'
import type { Band, TieFlag } from './types'

export interface RankedItem<T> {
  readonly item: T
  readonly position: number
  readonly rank: number
  readonly groupStart: number
  readonly groupEnd: number
}

/** A tie group straddles a boundary when it spans positions on both sides of `after`. */
export interface Boundary {
  readonly after: number
  readonly label: string
}

/**
 * Sorts by points descending with competition ranking (1, 2, 2, 4).
 * Equality is decided at COMPARE_DECIMALS; tied items are ordered by `tieKey` only so
 * the output is deterministic (they keep a shared rank).
 */
export function rankDescending<T>(
  items: readonly T[],
  pointsOf: (item: T) => number,
  tieKey: (item: T) => string,
): RankedItem<T>[] {
  const sorted = items
    .map((item) => ({ item, value: roundForCompare(pointsOf(item)), key: tieKey(item) }))
    .sort((a, b) => b.value - a.value || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0))
  const ranked: RankedItem<T>[] = []
  let start = 0
  while (start < sorted.length) {
    let end = start
    while (sorted[end + 1]?.value === sorted[start]?.value) end += 1
    for (let i = start; i <= end; i += 1) {
      const entry = sorted[i]
      if (entry) {
        ranked.push({
          item: entry.item,
          position: i + 1,
          rank: start + 1,
          groupStart: start + 1,
          groupEnd: end + 1,
        })
      }
    }
    start = end + 1
  }
  return ranked
}

export function bandAt(position: number, green: number, grey: number): Band {
  if (position <= green) return 'green'
  return position <= green + grey ? 'grey' : 'white'
}

/** Boundaries between non-empty bands (an empty grey band joins green straight to white). */
export function bandBoundaries(green: number, grey: number): Boundary[] {
  const boundaries: Boundary[] = []
  if (green > 0) {
    boundaries.push({ after: green, label: grey > 0 ? 'green/grey' : 'green/white' })
  }
  if (grey > 0) boundaries.push({ after: green + grey, label: 'grey/white' })
  return boundaries
}

/** One flag per boundary the tie group (positions groupStart..groupEnd) straddles. */
export function straddleFlags(
  groupStart: number,
  groupEnd: number,
  boundaries: readonly Boundary[],
): TieFlag[] {
  const size = groupEnd - groupStart + 1
  return boundaries
    .filter(({ after }) => groupStart <= after && after < groupEnd)
    .map(({ after, label }) => {
      const seats = after - groupStart + 1
      return {
        boundary: label,
        k: seats,
        n: size,
        text: `TIE ${label} — ${seats} of ${size} seats`,
      }
    })
}
