import type { Validation } from '../engine/entries'
import type { CheckedFlat } from './checks'
import { judgeEdits, reasonFits, type JudgedEdit } from './editJudge'
import { reviewKey } from './review'

/**
 * One member's value in a flat CCA, set on the Review step (e.g. 12 -> 10; the others keep the
 * flat value). `from` is the CCA's flat value for that member when the edit was made; the edit
 * applies only while it still says `from` (R10). No reviewer is recorded.
 */
export interface FlatEdit {
  readonly matric: string
  readonly ccaID: string
  readonly from: number
  readonly to: number
  /** Optional: may be empty. */
  readonly reason: string
  readonly at: string
}

/** One line of the flat log: an edit set, or an edit removed. */
export interface FlatLogEntry extends FlatEdit {
  readonly kind: 'edit' | 'remove'
}

export type CheckedFlatEdit = JudgedEdit<FlatEdit, number>

export type FlatEditCode = 'BAD_FLAT_VALUE' | 'FLAT_EDIT_NOT_FLAT' | 'REVIEW_UNKNOWN_MEMBERSHIP' | 'MISSING_REASON' | 'REVIEW_NO_CHANGE'

/** Finite and 0 or more: the same rule as the bundle's flatPoints (BAD_FLAT_POINTS). */
const isFlatValue = (value: unknown): boolean => typeof value === 'number' && Number.isFinite(value) && value >= 0

/** The member's flat value in the file, or null when the CCA is not flat or the member is not in it. */
function flatValueOf(flats: readonly CheckedFlat[], entry: Pick<FlatEdit, 'matric' | 'ccaID'>): number | null {
  const flat = flats.find((f) => f.ccaID === entry.ccaID)
  return flat?.rows.find((r) => r.matric === entry.matric)?.flatPoints ?? null
}

/** Checked in this order: the new value, the CCA is flat, the membership, the reason, then that it changes something. */
export function validateFlatEdit(flats: readonly CheckedFlat[], entry: FlatEdit): Validation<FlatEditCode> {
  if (!isFlatValue(entry.to)) return { ok: false, code: 'BAD_FLAT_VALUE' }
  if (!flats.some((f) => f.ccaID === entry.ccaID)) return { ok: false, code: 'FLAT_EDIT_NOT_FLAT' }
  if (flatValueOf(flats, entry) === null) return { ok: false, code: 'REVIEW_UNKNOWN_MEMBERSHIP' }
  if (!reasonFits(entry.reason)) return { ok: false, code: 'MISSING_REASON' }
  if (entry.to === entry.from) return { ok: false, code: 'REVIEW_NO_CHANGE' }
  return { ok: true }
}

/**
 * The flat CCAs with every applied edit's value in place of that ONE member's `flatPoints`; the
 * CCA's own value and the other members are unchanged (R10). Never mutates.
 */
export function applyFlatEdits(
  flats: readonly CheckedFlat[],
  edits: readonly FlatEdit[],
): { readonly flats: CheckedFlat[]; readonly edits: CheckedFlatEdit[] } {
  const judged = judgeEdits(edits, reviewKey, (entry) => flatValueOf(flats, entry))
  const values = new Map(judged.filter((e) => e.status === 'applied').map((e) => [reviewKey(e.entry), e.entry.to]))
  const edited = flats.map((flat): CheckedFlat => {
    if (!flat.rows.some((r) => values.has(reviewKey({ matric: r.matric, ccaID: flat.ccaID })))) return flat
    const rows = flat.rows.map((r) => {
      const to = values.get(reviewKey({ matric: r.matric, ccaID: flat.ccaID }))
      return to === undefined ? r : { ...r, flatPoints: to }
    })
    return { ...flat, rows }
  })
  return { flats: edited, edits: judged }
}
