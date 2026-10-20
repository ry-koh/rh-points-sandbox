import { describe, expect, it } from 'vitest'
import { BASE_POINTS_MAX, BASE_POINTS_MIN, MAX_REASON_LENGTH } from '../../engine'
import { deepFreeze } from '../../engine/__tests__/helpers'
import type { CheckedLeader } from '../checks'
import {
  applyReviewEdits,
  checkEditEntries,
  reviewKey,
  reviewOrder,
  validateReviewEdit,
  vettedStatus,
  type ReviewEdit,
  type VettedMark,
} from '../review'
import type { LeaderRow, PerCcaReport } from '../types'
import { matricOf } from './fixtures'

const row = (n: number, basePoints: number, patch: Partial<LeaderRow> = {}): LeaderRow => ({
  line: n + 1,
  ccaID: 'C1',
  ccaName: 'Test CCA One',
  matric: matricOf(n),
  name: `Test Resident ${n}`,
  basePoints,
  semesterOnly: false,
  outgoingRole: 'none',
  incomingRole: 'none',
  ihg: false,
  ...patch,
})

const leaders = (): CheckedLeader[] => [
  {
    fileName: 'points_C1_20270401.csv',
    ccaID: 'C1',
    rows: [row(1, 12), row(2, 14, { semesterOnly: true, outgoingRole: 'head', incomingRole: 'vice_head', ihg: true })],
  },
  { fileName: 'points_C2_20270401.csv', ccaID: 'C2', rows: [row(1, 10, { ccaID: 'C2' })] },
]

const edit = (patch: Partial<ReviewEdit> = {}): ReviewEdit => ({
  matric: matricOf(1),
  ccaID: 'C1',
  from: 12,
  to: 9,
  reason: '',
  at: '2027-04-02T10:00:00.000Z',
  ...patch,
})

describe('validateReviewEdit', () => {
  const check = (entry: ReviewEdit, flatIds: readonly string[] = ['C3']) => validateReviewEdit(leaders(), flatIds, entry)

  it('accepts a whole-number change with an empty reason', () => {
    expect(check(edit())).toEqual({ ok: true })
    expect(check(edit({ reason: 'Leader agreed by email' }))).toEqual({ ok: true })
  })

  it.each([
    ['below the minimum', BASE_POINTS_MIN - 1],
    ['above the maximum', BASE_POINTS_MAX + 1],
    ['not whole', 9.5],
    ['not a number', Number.NaN],
  ])('BAD_REVIEW_POINTS when the new score is %s', (_label, to) => {
    expect(check(edit({ to }))).toEqual({ ok: false, code: 'BAD_REVIEW_POINTS' })
  })

  it('accepts both ends of the range', () => {
    expect(check(edit({ to: BASE_POINTS_MIN }))).toEqual({ ok: true })
    expect(check(edit({ to: BASE_POINTS_MAX }))).toEqual({ ok: true })
  })

  it('MISSING_REASON only when the reason is too long', () => {
    expect(check(edit({ reason: 'x'.repeat(MAX_REASON_LENGTH) }))).toEqual({ ok: true })
    expect(check(edit({ reason: 'x'.repeat(MAX_REASON_LENGTH + 1) }))).toEqual({ ok: false, code: 'MISSING_REASON' })
  })

  it('REVIEW_FLAT_CCA for a flat CCA, before the membership check', () => {
    expect(check(edit({ ccaID: 'C3' }))).toEqual({ ok: false, code: 'REVIEW_FLAT_CCA' })
  })

  it('REVIEW_UNKNOWN_MEMBERSHIP when the member is not in that CCA', () => {
    expect(check(edit({ matric: matricOf(9) }))).toEqual({ ok: false, code: 'REVIEW_UNKNOWN_MEMBERSHIP' })
    expect(check(edit({ ccaID: 'C9' }))).toEqual({ ok: false, code: 'REVIEW_UNKNOWN_MEMBERSHIP' })
  })

  it('REVIEW_NO_CHANGE when the new score equals the old one', () => {
    expect(check(edit({ to: 12 }))).toEqual({ ok: false, code: 'REVIEW_NO_CHANGE' })
  })
})

describe('applyReviewEdits', () => {
  it("sets the score while the file's value still equals `from`", () => {
    const { checked, edits } = applyReviewEdits(deepFreeze(leaders()), deepFreeze([edit()]))
    expect(checked[0]?.rows[0]?.basePoints).toBe(9)
    expect(edits).toEqual([{ entry: edit(), status: 'applied', fileValue: 12 }])
  })

  it('touches no other field, ticks, roles, semester-only and line included', () => {
    const before = leaders()
    const target = edit({ matric: matricOf(2), from: 14, to: 20 })
    const { checked } = applyReviewEdits(deepFreeze(leaders()), [target])
    expect(checked[0]?.rows[1]).toEqual({ ...before[0]?.rows[1], basePoints: 20 })
    expect(checked[0]?.rows[0]).toEqual(before[0]?.rows[0])
    expect(checked[1]).toEqual(before[1])
  })

  it('does not mutate its inputs', () => {
    const input = deepFreeze(leaders())
    expect(() => applyReviewEdits(input, deepFreeze([edit(), edit({ ccaID: 'C2', from: 10, to: 11 })]))).not.toThrow()
    expect(input[0]?.rows[0]?.basePoints).toBe(12)
  })

  it("is 'changed' (not applied) when the file's value moved since the edit", () => {
    const corrected = leaders().map((l, i) => (i === 0 ? { ...l, rows: [row(1, 15), ...l.rows.slice(1)] } : l))
    const { checked, edits } = applyReviewEdits(corrected, [edit()])
    expect(checked[0]?.rows[0]?.basePoints).toBe(15)
    expect(edits).toEqual([{ entry: edit(), status: 'changed', fileValue: 15 }])
  })

  it("is 'stale' when the membership is gone", () => {
    const { checked, edits } = applyReviewEdits(leaders(), [edit({ matric: matricOf(9) }), edit({ ccaID: 'C9' })])
    expect(checked).toEqual(leaders())
    expect(edits.map((e) => [e.status, e.fileValue])).toEqual([['stale', null], ['stale', null]])
  })

  it('applies only the last of several edits for one membership; the earlier ones are stale', () => {
    const first = edit({ to: 5 })
    const last = edit({ to: 7, at: '2027-04-02T11:00:00.000Z' })
    const { checked, edits } = applyReviewEdits(leaders(), [first, last])
    expect(checked[0]?.rows[0]?.basePoints).toBe(7)
    expect(edits.map((e) => e.status)).toEqual(['stale', 'applied'])
  })

  it('an earlier edit never applies when the last one for that membership is changed', () => {
    const { checked, edits } = applyReviewEdits(leaders(), [edit({ to: 5 }), edit({ from: 13, to: 7 })])
    expect(checked[0]?.rows[0]?.basePoints).toBe(12)
    expect(edits.map((e) => e.status)).toEqual(['stale', 'changed'])
  })

  it('with no edits returns the rows as they were', () => {
    expect(applyReviewEdits(leaders(), [])).toEqual({ checked: leaders(), edits: [] })
  })
})

describe('checkEditEntries', () => {
  it('reports each edit against the file values without changing anything', () => {
    expect(checkEditEntries(leaders(), [edit(), edit({ ccaID: 'C2', from: 9, to: 11 })])).toEqual([
      { entry: edit(), status: 'applied', fileValue: 12 },
      { entry: edit({ ccaID: 'C2', from: 9, to: 11 }), status: 'changed', fileValue: 10 },
    ])
  })

  it('keys an edit by matric and CCA', () => {
    expect(reviewKey(edit())).toBe(`${matricOf(1)}|C1`)
  })
})

describe('reviewOrder', () => {
  const cca = (ccaID: string, name: string) => ({ ccaID, name })

  it('sorts by name, case- and accent-insensitive, with numbers in numeric order', () => {
    const ccas = [cca('C1', 'soccer'), cca('C2', 'Band 10'), cca('C3', 'Band 2'), cca('C4', 'Ćheer'), cca('C5', 'Basketball')]
    expect(reviewOrder(ccas).map((c) => c.ccaID)).toEqual(['C3', 'C2', 'C5', 'C4', 'C1'])
  })

  it('breaks a name tie by ccaID', () => {
    const ccas = [cca('C10', 'Soccer'), cca('C9', 'soccer'), cca('C2', 'Soccer')]
    expect(reviewOrder(ccas).map((c) => c.ccaID)).toEqual(['C2', 'C9', 'C10'])
  })

  it('returns a new array and leaves the input alone', () => {
    const ccas = deepFreeze([cca('C2', 'B'), cca('C1', 'A')])
    expect(reviewOrder(ccas).map((c) => c.ccaID)).toEqual(['C1', 'C2'])
    expect(ccas.map((c) => c.ccaID)).toEqual(['C2', 'C1'])
  })
})

describe('vettedStatus', () => {
  const report = (ccaID: string, vetHash: string | null) => ({ ccaID, vetHash }) as Pick<PerCcaReport, 'ccaID' | 'vetHash'>
  const mark = (fileHash: string): VettedMark => ({ ccaID: 'C1', fileHash, at: '2027-04-02T10:00:00.000Z' })

  it("'vetted' while the CCA's content hash is the one vetted (a leader file or a flat CCA's)", () => {
    expect(vettedStatus(mark('0a1b2c3d'), [report('C1', '0a1b2c3d')])).toBe('vetted')
  })

  it("'file_changed' when the leader file or the flat content changed", () => {
    expect(vettedStatus(mark('0a1b2c3d'), [report('C1', 'ffffffff')])).toBe('file_changed')
  })

  it("'gone' when the CCA has neither a leader file nor flat content, whatever the mark says", () => {
    expect(vettedStatus(mark('0a1b2c3d'), [report('C1', null)])).toBe('gone')
    expect(vettedStatus(mark(''), [report('C1', null)])).toBe('gone')
  })

  it("an old mark against '' does not count once a file arrives", () => {
    expect(vettedStatus(mark(''), [report('C1', '0a1b2c3d')])).toBe('file_changed')
  })

  it("'gone' when the CCA is no longer in the report", () => {
    expect(vettedStatus(mark('0a1b2c3d'), [report('C2', '0a1b2c3d')])).toBe('gone')
  })
})
