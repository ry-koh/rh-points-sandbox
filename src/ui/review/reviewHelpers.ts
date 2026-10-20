import type { FlatLogEntry, ReviewLogEntry, TickLogEntry } from '../../import'
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
