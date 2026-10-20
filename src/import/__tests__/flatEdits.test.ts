import { describe, expect, it } from 'vitest'
import { MAX_REASON_LENGTH } from '../../engine'
import { deepFreeze } from '../../engine/__tests__/helpers'
import type { CheckedFlat } from '../checks'
import { applyFlatEdits, validateFlatEdit, type FlatEdit } from '../flatEdits'
import type { FlatRow } from '../types'
import { matricOf } from './fixtures'

const row = (n: number, ccaID: string, flatPoints: number): FlatRow => ({
  line: n + 1,
  ccaID,
  ccaName: `Test CCA ${ccaID}`,
  matric: matricOf(n),
  name: `Test Resident ${n}`,
  flatPoints,
})

const flats = (): CheckedFlat[] => [
  { fileName: 'points_bundle_20270401.csv', ccaID: 'F1', flatPoints: 12, rows: [row(1, 'F1', 12), row(2, 'F1', 12)] },
  { fileName: 'points_bundle_20270401.csv', ccaID: 'F2', flatPoints: 6, rows: [row(1, 'F2', 6)] },
]

const edit = (patch: Partial<FlatEdit> = {}): FlatEdit => ({
  matric: matricOf(1),
  ccaID: 'F1',
  from: 12,
  to: 10,
  reason: '',
  at: '2027-04-02T10:00:00.000Z',
  ...patch,
})

describe('validateFlatEdit', () => {
  const check = (entry: FlatEdit) => validateFlatEdit(flats(), entry)

  it('accepts 0, decimals and values above the flat value, with an empty reason', () => {
    expect(check(edit())).toEqual({ ok: true })
    expect(check(edit({ to: 0 }))).toEqual({ ok: true })
    expect(check(edit({ to: 10.5, reason: 'Joined late' }))).toEqual({ ok: true })
    expect(check(edit({ to: 15 }))).toEqual({ ok: true })
  })

  it.each([
    ['negative', -1],
    ['not a number', Number.NaN],
    ['infinite', Number.POSITIVE_INFINITY],
  ])('BAD_FLAT_VALUE when the new value is %s', (_label, to) => {
    expect(check(edit({ to }))).toEqual({ ok: false, code: 'BAD_FLAT_VALUE' })
  })

  it('FLAT_EDIT_NOT_FLAT when the CCA is not flat', () => {
    expect(check(edit({ ccaID: 'C1' }))).toEqual({ ok: false, code: 'FLAT_EDIT_NOT_FLAT' })
  })

  it('REVIEW_UNKNOWN_MEMBERSHIP when the member is not in that flat CCA', () => {
    expect(check(edit({ ccaID: 'F2', matric: matricOf(2), from: 6 }))).toEqual({ ok: false, code: 'REVIEW_UNKNOWN_MEMBERSHIP' })
  })

  it('MISSING_REASON only when the reason is too long', () => {
    expect(check(edit({ reason: 'x'.repeat(MAX_REASON_LENGTH) }))).toEqual({ ok: true })
    expect(check(edit({ reason: 'x'.repeat(MAX_REASON_LENGTH + 1) }))).toEqual({ ok: false, code: 'MISSING_REASON' })
  })

  it('REVIEW_NO_CHANGE when to equals from', () => {
    expect(check(edit({ to: 12 }))).toEqual({ ok: false, code: 'REVIEW_NO_CHANGE' })
  })

  it('checks in order: value, flat, membership, reason, change', () => {
    const long = 'x'.repeat(MAX_REASON_LENGTH + 1)
    expect(check(edit({ to: -1, ccaID: 'C1' }))).toEqual({ ok: false, code: 'BAD_FLAT_VALUE' })
    expect(check(edit({ ccaID: 'C1', reason: long }))).toEqual({ ok: false, code: 'FLAT_EDIT_NOT_FLAT' })
    expect(check(edit({ matric: matricOf(9), reason: long, to: 12 }))).toEqual({ ok: false, code: 'REVIEW_UNKNOWN_MEMBERSHIP' })
    expect(check(edit({ reason: long, to: 12 }))).toEqual({ ok: false, code: 'MISSING_REASON' })
  })
})

describe('applyFlatEdits', () => {
  it("replaces ONE member's value; the CCA value and the other members keep the flat value", () => {
    const out = applyFlatEdits(flats(), [edit()])
    expect(out.edits[0]).toMatchObject({ status: 'applied', current: 12 })
    const f1 = out.flats[0]
    expect(f1?.flatPoints).toBe(12)
    expect(f1?.rows.map((r) => r.flatPoints)).toEqual([10, 12])
    expect(out.flats[1]).toEqual(flats()[1])
  })

  it('changed when the CCA value moved (12 -> 11); the new value stands', () => {
    const moved = flats().map((f) => (f.ccaID === 'F1' ? { ...f, flatPoints: 11, rows: f.rows.map((r) => ({ ...r, flatPoints: 11 })) } : f))
    const out = applyFlatEdits(moved, [edit()])
    expect(out.edits[0]).toMatchObject({ status: 'changed', current: 11 })
    expect(out.flats).toEqual(moved)
  })

  it('stale when the member is gone or the CCA is no longer flat', () => {
    const out = applyFlatEdits(flats(), [edit({ matric: matricOf(9) }), edit({ ccaID: 'C1' })])
    expect(out.edits.map((e) => [e.status, e.current])).toEqual([
      ['stale', null],
      ['stale', null],
    ])
    expect(out.flats).toEqual(flats())
  })

  it('the last edit per membership wins', () => {
    const out = applyFlatEdits(flats(), [edit({ to: 10 }), edit({ to: 8 })])
    expect(out.edits.map((e) => e.status)).toEqual(['stale', 'applied'])
    expect(out.flats[0]?.rows[0]?.flatPoints).toBe(8)
  })

  it('leaves untouched CCAs as the same objects and never mutates', () => {
    const input = deepFreeze(flats())
    const out = applyFlatEdits(input, deepFreeze([edit()]))
    expect(out.flats[1]).toBe(input[1])
    expect(input[0]?.rows[0]?.flatPoints).toBe(12)
  })
})
