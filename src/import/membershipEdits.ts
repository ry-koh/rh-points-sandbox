import type { Role } from '../engine'
import type { Validation } from '../engine/entries'
import type { CheckedLeader } from './checks'
import { judgeEdits, reasonFits, type JudgedEdit } from './editJudge'
import { ROLES } from './parseCommon'
import type { LeaderRow } from './types'

interface MembershipEditBase {
  readonly matric: string
  readonly ccaID: string
  /** Optional: may be empty. */
  readonly reason: string
  readonly at: string
}

/**
 * A member's outgoing role, incoming role or semester-only flag changed on the Review step.
 * `from` is the leader file's value when the edit was made; the edit applies only while the file
 * still says `from` (R1). No reviewer is recorded.
 */
export type MembershipEdit =
  | (MembershipEditBase & { readonly field: 'outgoingRole' | 'incomingRole'; readonly from: Role; readonly to: Role })
  | (MembershipEditBase & { readonly field: 'semesterOnly'; readonly from: boolean; readonly to: boolean })

export type MembershipField = MembershipEdit['field']

/** One line of the membership log: an edit set, or an edit removed. */
export type MembershipLogEntry = MembershipEdit & { readonly kind: 'edit' | 'remove' }

export type CheckedMembershipEdit = JudgedEdit<MembershipEdit, Role | boolean>

export type MembershipEditCode =
  | 'MEMBERSHIP_FLAT_CCA'
  | 'REVIEW_UNKNOWN_MEMBERSHIP'
  | 'BAD_MEMBERSHIP_VALUE'
  | 'MISSING_REASON'
  | 'REVIEW_NO_CHANGE'

export const membershipKey = (entry: Pick<MembershipEdit, 'matric' | 'ccaID' | 'field'>): string =>
  `${entry.matric}|${entry.ccaID}|${entry.field}`

const isRole = (value: unknown): value is Role => (ROLES as readonly unknown[]).includes(value)

/** The field is one of the three, and both values have that field's type. */
function valuesFit(entry: MembershipEdit): boolean {
  const { field, from, to } = entry as { readonly field: unknown; readonly from: unknown; readonly to: unknown }
  if (field === 'semesterOnly') return typeof from === 'boolean' && typeof to === 'boolean'
  if (field === 'outgoingRole' || field === 'incomingRole') return isRole(from) && isRole(to)
  return false
}

/** The leader file's row for the edit's membership, or null when there is none. */
function fileRowOf(checked: readonly CheckedLeader[], entry: Pick<MembershipEdit, 'matric' | 'ccaID'>): LeaderRow | null {
  const leader = checked.find((l) => l.ccaID === entry.ccaID)
  return leader?.rows.find((r) => r.matric === entry.matric) ?? null
}

/** Checked in this order: a flat CCA, the membership, the field and values, the reason, then that it changes something. */
export function validateMembershipEdit(
  checked: readonly CheckedLeader[],
  flatIds: readonly string[],
  entry: MembershipEdit,
): Validation<MembershipEditCode> {
  if (flatIds.includes(entry.ccaID)) return { ok: false, code: 'MEMBERSHIP_FLAT_CCA' }
  if (fileRowOf(checked, entry) === null) return { ok: false, code: 'REVIEW_UNKNOWN_MEMBERSHIP' }
  if (!valuesFit(entry)) return { ok: false, code: 'BAD_MEMBERSHIP_VALUE' }
  if (!reasonFits(entry.reason)) return { ok: false, code: 'MISSING_REASON' }
  if (entry.to === entry.from) return { ok: false, code: 'REVIEW_NO_CHANGE' }
  return { ok: true }
}

function withEdit(row: LeaderRow, edit: MembershipEdit): LeaderRow {
  if (edit.field === 'semesterOnly') return { ...row, semesterOnly: edit.to }
  return edit.field === 'outgoingRole' ? { ...row, outgoingRole: edit.to } : { ...row, incomingRole: edit.to }
}

/**
 * The leader rows with every applied membership edit in place of the file's value, judged per
 * field against the FILE's value (R1). Only the edited field changes. Never mutates.
 */
export function applyMembershipEdits(
  checked: readonly CheckedLeader[],
  edits: readonly MembershipEdit[],
): { readonly checked: CheckedLeader[]; readonly edits: CheckedMembershipEdit[] } {
  const judged = judgeEdits<MembershipEdit, Role | boolean>(edits, membershipKey, (entry) => fileRowOf(checked, entry)?.[entry.field] ?? null)
  const applied = judged.filter((e) => e.status === 'applied').map((e) => e.entry)
  const edited = checked.map((leader): CheckedLeader => {
    const mine = applied.filter((e) => e.ccaID === leader.ccaID)
    if (mine.length === 0) return leader
    const rows = leader.rows.map((r) => mine.filter((e) => e.matric === r.matric).reduce(withEdit, r))
    return { ...leader, rows }
  })
  return { checked: edited, edits: judged }
}
