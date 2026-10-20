import { MAX_REASON_LENGTH } from '../../engine'
import type { FlatEditCode, FlatLogEntry, ReviewLogEntry, TickLogEntry } from '../../import'
import type { Action } from '../state/store'

export type EditKind = 'score' | 'IHG tick' | 'flat value'

/** One line of the merged Review log: values are already written as words or numbers. */
export interface MergedLogLine {
  readonly what: EditKind
  readonly ccaID: string
  readonly matric: string
  readonly from: string
  readonly to: string
  readonly reason: string
  readonly at: string
  readonly kind: 'edit' | 'remove'
}

const tickWords = (ticked: boolean): string => (ticked ? 'ticked' : 'not ticked')

interface Tagged {
  readonly line: MergedLogLine
  readonly order: number
}

/** Score, tick and flat log lines in one list, newest first (R21). Lines with the same time keep the latest-made first. */
export function mergeEditLogs(
  scores: readonly ReviewLogEntry[],
  ticks: readonly TickLogEntry[],
  flats: readonly FlatLogEntry[],
): MergedLogLine[] {
  const lines: MergedLogLine[] = [
    ...scores.map((e): MergedLogLine => ({ ...e, what: 'score', from: String(e.from), to: String(e.to) })),
    ...ticks.map((e): MergedLogLine => ({ ...e, what: 'IHG tick', from: tickWords(e.from), to: tickWords(e.to) })),
    ...flats.map((e): MergedLogLine => ({ ...e, what: 'flat value', from: String(e.from), to: String(e.to) })),
  ]
  const tagged: Tagged[] = lines.map((line, order) => ({ line, order }))
  tagged.sort((a, b) => b.line.at.localeCompare(a.line.at) || b.order - a.order)
  return tagged.map((t) => t.line)
}

interface TickChange {
  readonly matric: string
  readonly ccaID: string
  /** The LEADER FILE's tick, never the one on screen (R7). */
  readonly fileTick: boolean
  readonly to: boolean
  readonly reason: string
  readonly hasEdit: boolean
  readonly at: string
}

/**
 * What to dispatch when a tick box or its reason changes: an edit from the file's tick, the
 * edit's removal when the box is back at the file's tick, or null when there is nothing to do.
 */
export function tickAction({ matric, ccaID, fileTick, to, reason, hasEdit, at }: TickChange): Action | null {
  if (to === fileTick) return hasEdit ? { type: 'removeTickEdit', matric, ccaID, at } : null
  return { type: 'setTickEdit', entry: { matric, ccaID, from: fileTick, to, reason, at } }
}

/** Plain words for the flat-edit problems shown under a member's value. */
export const FLAT_PROBLEMS: Readonly<Record<Exclude<FlatEditCode, 'REVIEW_NO_CHANGE'>, string>> = {
  BAD_FLAT_VALUE: 'Use a number that is 0 or more.',
  FLAT_EDIT_NOT_FLAT: 'This CCA is not a flat-points CCA any more.',
  REVIEW_UNKNOWN_MEMBERSHIP: 'This member is not in the RH-app bundle any more.',
  MISSING_REASON: 'The reason is too long.',
}

interface FlatChange {
  readonly matric: string
  readonly ccaID: string
  /** The RH-APP (bundle) value, never the one on screen. */
  readonly fileValue: number
  /** The value as typed. */
  readonly to: string
  readonly reason: string
  readonly hasEdit: boolean
  readonly at: string
}

/**
 * What to dispatch when a flat member's value or reason is saved: an edit from the RH-app value,
 * the edit's removal when the value is back at the RH-app value, or a problem in words.
 */
export function flatAction({ matric, ccaID, fileValue, to, reason, hasEdit, at }: FlatChange): { readonly action: Action | null; readonly problem: string | null } {
  const value = to.trim() === '' ? Number.NaN : Number(to)
  if (!Number.isFinite(value) || value < 0) return { action: null, problem: FLAT_PROBLEMS.BAD_FLAT_VALUE }
  if (reason.trim().length > MAX_REASON_LENGTH) return { action: null, problem: FLAT_PROBLEMS.MISSING_REASON }
  if (value === fileValue) return { action: hasEdit ? { type: 'removeFlatEdit', matric, ccaID, at } : null, problem: null }
  return { action: { type: 'setFlatEdit', entry: { matric, ccaID, from: fileValue, to: value, reason, at } }, problem: null }
}
