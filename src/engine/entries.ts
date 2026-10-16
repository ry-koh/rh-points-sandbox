import { MAX_REASON_LENGTH } from './defaults'
import type { Checked } from './types'

export type Validation<Code extends string> =
  | { readonly ok: true }
  | { readonly ok: false; readonly code: Code }

export const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value)

/** A reason is required: non-empty after trimming, at most MAX_REASON_LENGTH characters (spec 6.2, 6.3). */
export const reasonIsValid = (reason: unknown): boolean =>
  typeof reason === 'string' &&
  reason.trim().length > 0 &&
  reason.trim().length <= MAX_REASON_LENGTH

/** Adds `entry`, replacing the earlier entry with the same key (in place). */
export function upsertBy<T>(list: readonly T[], entry: T, keyOf: (item: T) => string): T[] {
  const key = keyOf(entry)
  const at = list.findIndex((item) => keyOf(item) === key)
  return at < 0 ? [...list, entry] : list.map((item, i) => (i === at ? entry : item))
}

/**
 * Marks each entry applied or stale. An entry is stale when `isCurrent` is false (what it
 * refers to is gone). When several entries share a key the LAST applies and the earlier ones
 * are reported stale.
 */
export function checkEntries<T>(
  entries: readonly T[],
  keyOf: (entry: T) => string,
  isCurrent: (entry: T) => boolean,
): Checked<T>[] {
  const seen = new Set<string>()
  const lastFirst = [...entries].reverse().map((entry): Checked<T> => {
    const key = keyOf(entry)
    const applied = isCurrent(entry) && !seen.has(key)
    if (applied) seen.add(key)
    return { entry, status: applied ? 'applied' : 'stale' }
  })
  return lastFirst.reverse()
}
