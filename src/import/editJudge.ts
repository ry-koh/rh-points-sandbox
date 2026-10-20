import { MAX_REASON_LENGTH } from '../engine'

/** applied: in use; changed: the source value moved since the edit; stale: the target is gone (or a later edit replaces it). */
export type EditStatus = 'applied' | 'changed' | 'stale'

export interface JudgedEdit<E, V> {
  readonly entry: E
  readonly status: EditStatus
  /** The source's current value; null when the target is gone. */
  readonly current: V | null
}

/** The reason may be empty; it only has to fit. */
export const reasonFits = (reason: unknown): boolean => typeof reason === 'string' && reason.trim().length <= MAX_REASON_LENGTH

/**
 * Judges each edit against its source. Only the LAST edit per key counts (earlier ones are
 * stale); it is applied while the source's value equals `from`, changed when the value moved,
 * stale when there is no value. Never mutates.
 */
export function judgeEdits<E extends { readonly from: V }, V>(
  edits: readonly E[],
  keyOf: (entry: E) => string,
  currentOf: (entry: E) => V | null,
): JudgedEdit<E, V>[] {
  const lastAt = new Map(edits.map((entry, i) => [keyOf(entry), i]))
  return edits.map((entry, i): JudgedEdit<E, V> => {
    const current = currentOf(entry)
    if (current === null || lastAt.get(keyOf(entry)) !== i) return { entry, status: 'stale', current }
    return { entry, status: current === entry.from ? 'applied' : 'changed', current }
  })
}
