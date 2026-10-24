import type { Validation } from '../engine/entries'
import { judgeEdits, reasonFits, type JudgedEdit } from './editJudge'
import type { ResidentRow } from './types'

/**
 * A resident's AUX COUNT set on the Summary step (e.g. 6 -> 7); the AUX table still turns it into
 * points with its cap. `from` is the imported count (the bundle's with a version-2 bundle, else residents.csv's) when the edit was made; the edit applies
 * only while the file still says `from` (R11). No reviewer is recorded.
 */
export interface AuxEdit {
  readonly matric: string
  readonly from: number
  readonly to: number
  /** Optional: may be empty. */
  readonly reason: string
  readonly at: string
}

/** One line of the AUX log: an edit set, or an edit removed. */
export interface AuxLogEntry extends AuxEdit {
  readonly kind: 'edit' | 'remove'
}

export type CheckedAuxEdit = JudgedEdit<AuxEdit, number>

export type AuxEditCode = 'BAD_AUX_EDIT' | 'AUX_UNKNOWN_RESIDENT' | 'MISSING_REASON' | 'REVIEW_NO_CHANGE'

/** A whole number of 0 or more: the same rule as residents.csv's aux. Above the cap is allowed. */
const isAuxCount = (value: unknown): boolean => typeof value === 'number' && Number.isInteger(value) && value >= 0

const auxKey = (entry: Pick<AuxEdit, 'matric'>): string => entry.matric

function auxOf(rows: readonly ResidentRow[], entry: Pick<AuxEdit, 'matric'>): number | null {
  return rows.find((r) => r.matric === entry.matric)?.aux ?? null
}

/** Checked in this order: the new count, the resident, the reason, then that it changes something. */
export function validateAuxEdit(rows: readonly ResidentRow[], entry: AuxEdit): Validation<AuxEditCode> {
  if (!isAuxCount(entry.to)) return { ok: false, code: 'BAD_AUX_EDIT' }
  if (auxOf(rows, entry) === null) return { ok: false, code: 'AUX_UNKNOWN_RESIDENT' }
  if (!reasonFits(entry.reason)) return { ok: false, code: 'MISSING_REASON' }
  if (entry.to === entry.from) return { ok: false, code: 'REVIEW_NO_CHANGE' }
  return { ok: true }
}

/** The resident rows with every applied edit's count in place of the file's `aux`; nothing else changes and no cap is applied. Never mutates. */
export function applyAuxEdits(
  rows: readonly ResidentRow[],
  edits: readonly AuxEdit[],
): { readonly rows: ResidentRow[]; readonly edits: CheckedAuxEdit[] } {
  const judged = judgeEdits(edits, auxKey, (entry) => auxOf(rows, entry))
  const counts = new Map(judged.filter((e) => e.status === 'applied').map((e) => [auxKey(e.entry), e.entry.to]))
  const edited = rows.map((r) => {
    const to = counts.get(r.matric)
    return to === undefined ? r : { ...r, aux: to }
  })
  return { rows: edited, edits: judged }
}
