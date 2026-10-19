import { BASE_POINTS_MAX, BASE_POINTS_MIN, MAX_REASON_LENGTH } from '../engine'
import type { Validation } from '../engine/entries'
import type { CheckedLeader } from './checks'
import type { PerCcaReport } from './types'

/**
 * A reviewed score set on the Review step (spec 6.4). `from` is the leader file's value when the
 * edit was made; the edit applies only while the file still says `from`. No reviewer is recorded.
 */
export interface ReviewEdit {
  readonly matric: string
  readonly ccaID: string
  readonly from: number
  readonly to: number
  /** Optional: may be empty. */
  readonly reason: string
  readonly at: string
}

/** One line of the review log: an edit set, or an edit removed. */
export interface ReviewLogEntry extends ReviewEdit {
  readonly kind: 'edit' | 'remove'
}

/** A CCA marked vetted, against the hash of the leader file it was vetted on (spec 6.5). */
export interface VettedMark {
  readonly ccaID: string
  readonly fileHash: string
  readonly at: string
}

/** A CCA marked "not submitting" on the checklist; the note is optional. */
export interface NotSubmittingMark {
  readonly ccaID: string
  readonly note: string
  readonly at: string
}

/** applied: in use; changed: the file's value moved since the edit; stale: the membership is gone (or a later edit replaces it). */
export type ReviewEditStatus = 'applied' | 'changed' | 'stale'

export interface CheckedReviewEdit {
  readonly entry: ReviewEdit
  readonly status: ReviewEditStatus
  /** The leader file's current value; null when the membership is gone. */
  readonly fileValue: number | null
}

export type ReviewEditCode =
  | 'BAD_REVIEW_POINTS'
  | 'MISSING_REASON'
  | 'REVIEW_FLAT_CCA'
  | 'REVIEW_UNKNOWN_MEMBERSHIP'
  | 'REVIEW_NO_CHANGE'

export const reviewKey = (entry: Pick<ReviewEdit, 'matric' | 'ccaID'>): string => `${entry.matric}|${entry.ccaID}`

const isReviewScore = (value: unknown): boolean =>
  typeof value === 'number' && Number.isInteger(value) && value >= BASE_POINTS_MIN && value <= BASE_POINTS_MAX

/** The reason may be empty; it only has to fit. */
const reasonFits = (reason: unknown): boolean => typeof reason === 'string' && reason.trim().length <= MAX_REASON_LENGTH

/** The leader file's value for the edit's membership, or null when there is none. */
function fileValueOf(checked: readonly CheckedLeader[], entry: Pick<ReviewEdit, 'matric' | 'ccaID'>): number | null {
  const leader = checked.find((l) => l.ccaID === entry.ccaID)
  return leader?.rows.find((r) => r.matric === entry.matric)?.basePoints ?? null
}

/** Checked in this order: the new score, the reason, a flat CCA, the membership, then that it changes something. */
export function validateReviewEdit(
  checked: readonly CheckedLeader[],
  flatIds: readonly string[],
  entry: ReviewEdit,
): Validation<ReviewEditCode> {
  if (!isReviewScore(entry.to)) return { ok: false, code: 'BAD_REVIEW_POINTS' }
  if (!reasonFits(entry.reason)) return { ok: false, code: 'MISSING_REASON' }
  if (flatIds.includes(entry.ccaID)) return { ok: false, code: 'REVIEW_FLAT_CCA' }
  if (fileValueOf(checked, entry) === null) return { ok: false, code: 'REVIEW_UNKNOWN_MEMBERSHIP' }
  if (entry.to === entry.from) return { ok: false, code: 'REVIEW_NO_CHANGE' }
  return { ok: true }
}

/**
 * Judges each edit against the leader files. Only the LAST edit per membership counts (earlier
 * ones are stale); it is applied while the file's value equals `from`, changed when the file's
 * value moved, stale when the membership is gone. A sibling of the engine's `checkEntries`,
 * which cannot express `changed`.
 */
export function checkEditEntries(checked: readonly CheckedLeader[], edits: readonly ReviewEdit[]): CheckedReviewEdit[] {
  const lastAt = new Map(edits.map((entry, i) => [reviewKey(entry), i]))
  return edits.map((entry, i): CheckedReviewEdit => {
    const fileValue = fileValueOf(checked, entry)
    if (fileValue === null || lastAt.get(reviewKey(entry)) !== i) return { entry, status: 'stale', fileValue }
    return { entry, status: fileValue === entry.from ? 'applied' : 'changed', fileValue }
  })
}

/**
 * The leader rows with every applied edit's score in place of the file's (spec 6.4). Only
 * `basePoints` changes; ticks, roles and semester-only are never edited. Never mutates.
 */
export function applyReviewEdits(
  checked: readonly CheckedLeader[],
  edits: readonly ReviewEdit[],
): { readonly checked: CheckedLeader[]; readonly edits: CheckedReviewEdit[] } {
  const judged = checkEditEntries(checked, edits)
  const scores = new Map(judged.filter((e) => e.status === 'applied').map((e) => [reviewKey(e.entry), e.entry.to]))
  const edited = checked.map((leader): CheckedLeader => {
    if (!leader.rows.some((r) => scores.has(reviewKey({ matric: r.matric, ccaID: leader.ccaID })))) return leader
    const rows = leader.rows.map((r) => {
      const to = scores.get(reviewKey({ matric: r.matric, ccaID: leader.ccaID }))
      return to === undefined ? r : { ...r, basePoints: to }
    })
    return { ...leader, rows }
  })
  return { checked: edited, edits: judged }
}

/** CCAs by name (case- and accent-insensitive, numbers in numeric order), then ccaID; a new array. */
export function reviewOrder<T extends { readonly ccaID: string; readonly name: string }>(ccas: readonly T[]): T[] {
  return [...ccas].sort(
    (a, b) =>
      a.name.localeCompare(b.name, 'en', { numeric: true, sensitivity: 'base' }) ||
      a.ccaID.localeCompare(b.ccaID, 'en', { numeric: true }),
  )
}

export type VettedStatus = 'vetted' | 'file_changed' | 'gone'

/**
 * A vetted mark counts while the CCA's leader file hashes to the vetted value. `gone` when the
 * CCA is no longer in the report or has no leader file: only a CCA with a file can be vetted (D25).
 */
export function vettedStatus(mark: VettedMark, perCca: readonly Pick<PerCcaReport, 'ccaID' | 'fileHash'>[]): VettedStatus {
  const fileHash = perCca.find((c) => c.ccaID === mark.ccaID)?.fileHash ?? null
  if (fileHash === null) return 'gone'
  return fileHash === mark.fileHash ? 'vetted' : 'file_changed'
}
