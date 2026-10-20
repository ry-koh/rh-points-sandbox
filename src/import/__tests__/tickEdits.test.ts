import { describe, expect, it } from 'vitest'
import { MAX_REASON_LENGTH } from '../../engine'
import { deepFreeze } from '../../engine/__tests__/helpers'
import type { CheckedLeader } from '../checks'
import { applyTickEdits, validateTickEdit, type IhgTickEdit } from '../tickEdits'
import type { BundleCca, LeaderRow } from '../types'
import { matricOf } from './fixtures'

const row = (n: number, ihg: boolean, ccaID = 'S1'): LeaderRow => ({
  line: n + 1,
  ccaID,
  ccaName: `Test CCA ${ccaID}`,
  matric: matricOf(n),
  name: `Test Resident ${n}`,
  basePoints: 12,
  semesterOnly: false,
  outgoingRole: 'none',
  incomingRole: 'none',
  ihg,
})

const leaders = (): CheckedLeader[] => [
  { fileName: 'points_S1_20270401.csv', ccaID: 'S1', rows: [row(1, true), row(2, false)] },
  { fileName: 'points_C1_20270401.csv', ccaID: 'C1', rows: [row(1, false, 'C1')] },
]

const cca = (ccaID: string, patch: Partial<BundleCca> = {}): BundleCca => ({
  ccaID,
  ccaName: `Test CCA ${ccaID}`,
  flatPoints: null,
  type: '1x',
  isSport: false,
  ihgResult: null,
  ihgCap: null,
  ...patch,
})

const bundle = (): BundleCca[] => [
  cca('S1', { isSport: true, ihgResult: '1st', ihgCap: 5 }),
  cca('S2', { isSport: true }),
  cca('C1'),
  cca('F1', { isSport: true, flatPoints: 12 }),
]

const edit = (patch: Partial<IhgTickEdit> = {}): IhgTickEdit => ({
  matric: matricOf(1),
  ccaID: 'S1',
  from: true,
  to: false,
  reason: '',
  at: '2027-04-02T10:00:00.000Z',
  ...patch,
})

describe('validateTickEdit', () => {
  const check = (entry: IhgTickEdit) => validateTickEdit(leaders(), bundle(), ['F1'], entry)

  it('accepts an untick or a tick on a sport, with an empty reason', () => {
    expect(check(edit())).toEqual({ ok: true })
    expect(check(edit({ matric: matricOf(2), from: false, to: true, reason: 'Played every match' }))).toEqual({ ok: true })
  })

  it('accepts a sport with no IHG result or cap yet (IHG_NOT_SET still warns later)', () => {
    const checked = [...leaders(), { fileName: 'points_S2_20270401.csv', ccaID: 'S2', rows: [row(3, false, 'S2')] }]
    expect(validateTickEdit(checked, bundle(), ['F1'], edit({ ccaID: 'S2', matric: matricOf(3), from: false, to: true }))).toEqual({ ok: true })
  })

  it('TICK_NOT_SPORT when the bundle says sport N, or does not list the CCA', () => {
    expect(check(edit({ ccaID: 'C1', from: false, to: true }))).toEqual({ ok: false, code: 'TICK_NOT_SPORT' })
    expect(check(edit({ ccaID: 'C9' }))).toEqual({ ok: false, code: 'TICK_NOT_SPORT' })
  })

  it('REVIEW_FLAT_CCA for a flat sport', () => {
    expect(check(edit({ ccaID: 'F1' }))).toEqual({ ok: false, code: 'REVIEW_FLAT_CCA' })
  })

  it('REVIEW_UNKNOWN_MEMBERSHIP when the member is not in the file', () => {
    expect(check(edit({ matric: matricOf(9) }))).toEqual({ ok: false, code: 'REVIEW_UNKNOWN_MEMBERSHIP' })
  })

  it('MISSING_REASON only when the reason is too long', () => {
    expect(check(edit({ reason: 'x'.repeat(MAX_REASON_LENGTH) }))).toEqual({ ok: true })
    expect(check(edit({ reason: 'x'.repeat(MAX_REASON_LENGTH + 1) }))).toEqual({ ok: false, code: 'MISSING_REASON' })
  })

  it('REVIEW_NO_CHANGE when to equals from', () => {
    expect(check(edit({ to: true }))).toEqual({ ok: false, code: 'REVIEW_NO_CHANGE' })
  })

  it('checks in order: sport, flat, membership, reason, change', () => {
    const long = 'x'.repeat(MAX_REASON_LENGTH + 1)
    expect(check(edit({ ccaID: 'C1', reason: long, to: true }))).toEqual({ ok: false, code: 'TICK_NOT_SPORT' })
    expect(check(edit({ ccaID: 'F1', matric: matricOf(9), reason: long }))).toEqual({ ok: false, code: 'REVIEW_FLAT_CCA' })
    expect(check(edit({ matric: matricOf(9), reason: long, to: true }))).toEqual({ ok: false, code: 'REVIEW_UNKNOWN_MEMBERSHIP' })
    expect(check(edit({ reason: long, to: true }))).toEqual({ ok: false, code: 'MISSING_REASON' })
  })
})

describe('applyTickEdits', () => {
  it("applies while the FILE's tick equals from, changing only ihg", () => {
    const out = applyTickEdits(leaders(), [edit(), edit({ matric: matricOf(2), from: false, to: true })])
    expect(out.edits.map((e) => [e.status, e.current])).toEqual([
      ['applied', true],
      ['applied', false],
    ])
    const s1 = out.checked.find((l) => l.ccaID === 'S1')
    expect(s1?.rows.map((r) => r.ihg)).toEqual([false, true])
    expect(s1?.rows[0]).toEqual({ ...leaders()[0]?.rows[0], ihg: false })
  })

  it('changed when the file now says something else; the file tick stands', () => {
    const out = applyTickEdits(leaders(), [edit({ from: false, to: true })])
    expect(out.edits[0]).toMatchObject({ status: 'changed', current: true })
    expect(out.checked).toEqual(leaders())
  })

  it('stale when the membership is gone', () => {
    const out = applyTickEdits(leaders(), [edit({ matric: matricOf(9) }), edit({ ccaID: 'S9' })])
    expect(out.edits.map((e) => [e.status, e.current])).toEqual([
      ['stale', null],
      ['stale', null],
    ])
    expect(out.checked).toEqual(leaders())
  })

  it('the last edit per membership wins', () => {
    const out = applyTickEdits(leaders(), [edit({ reason: 'first' }), edit({ to: true, reason: 'second' })])
    expect(out.edits.map((e) => e.status)).toEqual(['stale', 'applied'])
    expect(out.checked[0]?.rows[0]?.ihg).toBe(true)
  })

  it('leaves untouched leaders as the same objects and never mutates', () => {
    const input = deepFreeze(leaders())
    const edits = deepFreeze([edit()])
    const out = applyTickEdits(input, edits)
    expect(out.checked[1]).toBe(input[1])
    expect(input[0]?.rows[0]?.ihg).toBe(true)
  })
})
