import { MAX_REASON_LENGTH } from '../../engine'
import type { Action } from '../state/store'

/** Plain words for the AUX editor's problems. */
export const AUX_PROBLEMS = {
  BAD_AUX_EDIT: 'Type a whole number of 0 or more.',
  MISSING_REASON: `The reason can be at most ${MAX_REASON_LENGTH} characters.`,
} as const

interface AuxChange {
  readonly matric: string
  /** residents.csv's count, never the one on screen. */
  readonly fileValue: number
  readonly to: string
  readonly reason: string
  readonly hasEdit: boolean
  readonly at: string
}

/**
 * What to dispatch when a resident's AUX count is saved: an edit from the file count, the edit's
 * removal when the count is back at the file count, or a problem in words.
 */
export function auxAction({ matric, fileValue, to, reason, hasEdit, at }: AuxChange): { readonly action: Action | null; readonly problem: string | null } {
  const count = to.trim() === '' ? Number.NaN : Number(to)
  if (!Number.isInteger(count) || count < 0) return { action: null, problem: AUX_PROBLEMS.BAD_AUX_EDIT }
  if (reason.trim().length > MAX_REASON_LENGTH) return { action: null, problem: AUX_PROBLEMS.MISSING_REASON }
  if (count === fileValue) return { action: hasEdit ? { type: 'removeAuxEdit', matric, at } : null, problem: null }
  return { action: { type: 'setAuxEdit', entry: { matric, from: fileValue, to: count, reason, at } }, problem: null }
}
