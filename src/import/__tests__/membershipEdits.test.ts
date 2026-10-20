import { describe, expect, it } from 'vitest'
import { MAX_REASON_LENGTH } from '../../engine'
import { deepFreeze } from '../../engine/__tests__/helpers'
import type { CheckedLeader } from '../checks'
import { applyMembershipEdits, membershipKey, validateMembershipEdit, type MembershipEdit } from '../membershipEdits'
import type { LeaderRow } from '../types'
import { matricOf } from './fixtures'

const row = (n: number, patch: Partial<LeaderRow> = {}, ccaID = 'C1'): LeaderRow => ({
  line: n + 1,
  ccaID,
  ccaName: `Test CCA ${ccaID}`,
  matric: matricOf(n),
  name: `Test Resident ${n}`,
  basePoints: 12,
  semesterOnly: false,
  outgoingRole: 'none',
  incomingRole: 'none',
  ihg: false,
  ...patch,
})

const leaders = (): CheckedLeader[] => [
  { fileName: 'points_C1_20270401.csv', ccaID: 'C1', rows: [row(1), row(2, { outgoingRole: 'head', incomingRole: 'vice_head' })] },
  { fileName: 'points_C2_20270401.csv', ccaID: 'C2', rows: [row(1, {}, 'C2')] },
]

const AT = '2027-04-02T10:00:00.000Z'

const roleEdit = (patch: Partial<Extract<MembershipEdit, { from: string }>> = {}): MembershipEdit => ({
  matric: matricOf(1), ccaID: 'C1', field: 'outgoingRole', from: 'none', to: 'head', reason: '', at: AT, ...patch,
})

const semEdit = (patch: Partial<Extract<MembershipEdit, { field: 'semesterOnly' }>> = {}): MembershipEdit => ({
  matric: matricOf(1), ccaID: 'C1', field: 'semesterOnly', from: false, to: true, reason: '', at: AT, ...patch,
})

/** An entry as it might arrive from a damaged source: any field may hold anything. */
const loose = (patch: Record<string, unknown>): MembershipEdit => ({ ...roleEdit(), ...patch }) as unknown as MembershipEdit

describe('membershipKey', () => {
  it('is matric|ccaID|field', () => {
    expect(membershipKey(semEdit())).toBe(`${matricOf(1)}|C1|semesterOnly`)
  })
})

describe('validateMembershipEdit', () => {
  const check = (entry: MembershipEdit) => validateMembershipEdit(leaders(), ['F1'], entry)

  it('accepts a role or semester-only change with an empty reason', () => {
    expect(check(roleEdit())).toEqual({ ok: true })
    expect(check(roleEdit({ field: 'incomingRole', to: 'vice_head', reason: 'Took over in March' }))).toEqual({ ok: true })
    expect(check(semEdit())).toEqual({ ok: true })
  })

  it('MEMBERSHIP_FLAT_CCA for a flat CCA', () => {
    expect(check(roleEdit({ ccaID: 'F1' }))).toEqual({ ok: false, code: 'MEMBERSHIP_FLAT_CCA' })
  })

  it('REVIEW_UNKNOWN_MEMBERSHIP when the member or the CCA is not in a file', () => {
    expect(check(roleEdit({ matric: matricOf(9) }))).toEqual({ ok: false, code: 'REVIEW_UNKNOWN_MEMBERSHIP' })
    expect(check(roleEdit({ ccaID: 'C9' }))).toEqual({ ok: false, code: 'REVIEW_UNKNOWN_MEMBERSHIP' })
  })

  it('BAD_MEMBERSHIP_VALUE for a role not in ROLES, a non-boolean semester flag, a mismatched type or an unknown field', () => {
    expect(check(loose({ to: 'captain' }))).toEqual({ ok: false, code: 'BAD_MEMBERSHIP_VALUE' })
    expect(check(loose({ from: 'captain' }))).toEqual({ ok: false, code: 'BAD_MEMBERSHIP_VALUE' })
    expect(check(loose({ field: 'semesterOnly', from: false, to: 'Y' }))).toEqual({ ok: false, code: 'BAD_MEMBERSHIP_VALUE' })
    expect(check(loose({ field: 'semesterOnly', from: 'none', to: true }))).toEqual({ ok: false, code: 'BAD_MEMBERSHIP_VALUE' })
    expect(check(loose({ field: 'incomingRole', from: 'none', to: true }))).toEqual({ ok: false, code: 'BAD_MEMBERSHIP_VALUE' })
    expect(check(loose({ field: 'basePoints', from: 12, to: 14 }))).toEqual({ ok: false, code: 'BAD_MEMBERSHIP_VALUE' })
  })

  it('MISSING_REASON only when the reason is too long', () => {
    expect(check(roleEdit({ reason: 'x'.repeat(MAX_REASON_LENGTH) }))).toEqual({ ok: true })
    expect(check(roleEdit({ reason: 'x'.repeat(MAX_REASON_LENGTH + 1) }))).toEqual({ ok: false, code: 'MISSING_REASON' })
  })

  it('REVIEW_NO_CHANGE when to equals from', () => {
    expect(check(roleEdit({ to: 'none' }))).toEqual({ ok: false, code: 'REVIEW_NO_CHANGE' })
    expect(check(semEdit({ to: false }))).toEqual({ ok: false, code: 'REVIEW_NO_CHANGE' })
  })

  it('checks in order: flat, membership, value, reason, change', () => {
    const long = 'x'.repeat(MAX_REASON_LENGTH + 1)
    expect(check(loose({ ccaID: 'F1', matric: matricOf(9), to: 'captain', reason: long }))).toEqual({ ok: false, code: 'MEMBERSHIP_FLAT_CCA' })
    expect(check(loose({ matric: matricOf(9), to: 'captain', reason: long }))).toEqual({ ok: false, code: 'REVIEW_UNKNOWN_MEMBERSHIP' })
    expect(check(loose({ to: 'captain', reason: long }))).toEqual({ ok: false, code: 'BAD_MEMBERSHIP_VALUE' })
    expect(check(roleEdit({ to: 'none', reason: long }))).toEqual({ ok: false, code: 'MISSING_REASON' })
  })
})

describe('applyMembershipEdits', () => {
  it("applies while the FILE's value equals from, changing only that field", () => {
    const out = applyMembershipEdits(leaders(), [roleEdit(), semEdit(), roleEdit({ matric: matricOf(2), field: 'incomingRole', from: 'vice_head', to: 'none' })])
    expect(out.edits.map((e) => [e.status, e.current])).toEqual([
      ['applied', 'none'],
      ['applied', false],
      ['applied', 'vice_head'],
    ])
    const [first, second] = out.checked[0]?.rows ?? []
    expect(first).toEqual({ ...leaders()[0]?.rows[0], outgoingRole: 'head', semesterOnly: true })
    expect(second).toEqual({ ...leaders()[0]?.rows[1], incomingRole: 'none' })
  })

  it('changed when the file now says something else; the file value stands (R1)', () => {
    const out = applyMembershipEdits(leaders(), [roleEdit({ matric: matricOf(2), from: 'vice_head', to: 'none' })])
    expect(out.edits[0]).toMatchObject({ status: 'changed', current: 'head' })
    expect(out.checked).toEqual(leaders())
  })

  it('stale when the membership is gone', () => {
    const out = applyMembershipEdits(leaders(), [roleEdit({ matric: matricOf(9) }), semEdit({ ccaID: 'C9' })])
    expect(out.edits.map((e) => [e.status, e.current])).toEqual([
      ['stale', null],
      ['stale', null],
    ])
    expect(out.checked).toEqual(leaders())
  })

  it('the last edit per membership and field wins; other fields are separate keys', () => {
    const out = applyMembershipEdits(leaders(), [
      roleEdit({ reason: 'first' }),
      semEdit(),
      roleEdit({ to: 'vice_head', reason: 'second' }),
    ])
    expect(out.edits.map((e) => e.status)).toEqual(['stale', 'applied', 'applied'])
    expect(out.checked[0]?.rows[0]).toMatchObject({ outgoingRole: 'vice_head', semesterOnly: true })
  })

  it('leaves untouched leaders and rows as the same objects and never mutates', () => {
    const input = deepFreeze(leaders())
    const edits = deepFreeze([roleEdit()])
    const out = applyMembershipEdits(input, edits)
    expect(out.checked[1]).toBe(input[1])
    expect(out.checked[0]?.rows[1]).toBe(input[0]?.rows[1])
    expect(input[0]?.rows[0]?.outgoingRole).toBe('none')
  })
})
