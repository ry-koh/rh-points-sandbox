import type { Validation } from '../engine/entries'
import type { CheckedLeader } from './checks'
import { judgeEdits, reasonFits, type JudgedEdit } from './editJudge'
import { reviewKey } from './review'
import type { BundleCca } from './types'

/**
 * An IHG tick set or cleared on the Review step. `from` is the leader file's tick when the edit
 * was made; the edit applies only while the file still says `from` (R5). No reviewer is recorded.
 */
export interface IhgTickEdit {
  readonly matric: string
  readonly ccaID: string
  readonly from: boolean
  readonly to: boolean
  /** Optional: may be empty. */
  readonly reason: string
  readonly at: string
}

/** One line of the tick log: an edit set, or an edit removed. */
export interface TickLogEntry extends IhgTickEdit {
  readonly kind: 'edit' | 'remove'
}

export type CheckedTickEdit = JudgedEdit<IhgTickEdit, boolean>

export type TickEditCode = 'TICK_NOT_SPORT' | 'REVIEW_FLAT_CCA' | 'REVIEW_UNKNOWN_MEMBERSHIP' | 'MISSING_REASON' | 'REVIEW_NO_CHANGE'

/** The leader file's tick for the edit's membership, or null when there is none. */
function fileTickOf(checked: readonly CheckedLeader[], entry: Pick<IhgTickEdit, 'matric' | 'ccaID'>): boolean | null {
  const leader = checked.find((l) => l.ccaID === entry.ccaID)
  return leader?.rows.find((r) => r.matric === entry.matric)?.ihg ?? null
}

/**
 * Checked in this order: the bundle marks the CCA as a sport, it is not flat, the membership,
 * the reason, then that it changes something. A sport with no IHG result or cap may be ticked.
 */
export function validateTickEdit(
  checked: readonly CheckedLeader[],
  bundleCcas: readonly BundleCca[],
  flatIds: readonly string[],
  entry: IhgTickEdit,
): Validation<TickEditCode> {
  if (!bundleCcas.some((c) => c.ccaID === entry.ccaID && c.isSport)) return { ok: false, code: 'TICK_NOT_SPORT' }
  if (flatIds.includes(entry.ccaID)) return { ok: false, code: 'REVIEW_FLAT_CCA' }
  if (fileTickOf(checked, entry) === null) return { ok: false, code: 'REVIEW_UNKNOWN_MEMBERSHIP' }
  if (!reasonFits(entry.reason)) return { ok: false, code: 'MISSING_REASON' }
  if (entry.to === entry.from) return { ok: false, code: 'REVIEW_NO_CHANGE' }
  return { ok: true }
}

/**
 * The leader rows with every applied tick edit in place of the file's tick, judged against the
 * FILE's tick (R5). Only `ihg` changes. Never mutates.
 */
export function applyTickEdits(
  checked: readonly CheckedLeader[],
  edits: readonly IhgTickEdit[],
): { readonly checked: CheckedLeader[]; readonly edits: CheckedTickEdit[] } {
  const judged = judgeEdits(edits, reviewKey, (entry) => fileTickOf(checked, entry))
  const ticks = new Map(judged.filter((e) => e.status === 'applied').map((e) => [reviewKey(e.entry), e.entry.to]))
  const edited = checked.map((leader): CheckedLeader => {
    if (!leader.rows.some((r) => ticks.has(reviewKey({ matric: r.matric, ccaID: leader.ccaID })))) return leader
    const rows = leader.rows.map((r) => {
      const to = ticks.get(reviewKey({ matric: r.matric, ccaID: leader.ccaID }))
      return to === undefined ? r : { ...r, ihg: to }
    })
    return { ...leader, rows }
  })
  return { checked: edited, edits: judged }
}
