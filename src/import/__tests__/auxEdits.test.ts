import { describe, expect, it } from 'vitest'
import { MAX_REASON_LENGTH } from '../../engine'
import { deepFreeze } from '../../engine/__tests__/helpers'
import { applyAuxEdits, validateAuxEdit, type AuxEdit } from '../auxEdits'
import type { ResidentRow } from '../types'
import { matricOf } from './fixtures'

const resident = (n: number, aux: number): ResidentRow => ({
  line: n + 1,
  matric: matricOf(n),
  name: `Test Resident ${n}`,
  gender: 'M',
  sem2: false,
  aux,
  jcrc: 'N',
})

const rows = (): ResidentRow[] => [resident(1, 6), resident(2, 3)]

const edit = (patch: Partial<AuxEdit> = {}): AuxEdit => ({
  matric: matricOf(1),
  from: 6,
  to: 7,
  reason: '',
  at: '2027-04-02T10:00:00.000Z',
  ...patch,
})

describe('validateAuxEdit', () => {
  const check = (entry: AuxEdit) => validateAuxEdit(rows(), entry)

  it('accepts a whole number of 0 or more, above the cap too, with an empty reason', () => {
    expect(check(edit())).toEqual({ ok: true })
    expect(check(edit({ to: 0 }))).toEqual({ ok: true })
    expect(check(edit({ to: 14, reason: 'Extra AUX approved' }))).toEqual({ ok: true })
  })

  it.each([
    ['negative', -1],
    ['not whole', 6.5],
    ['not a number', Number.NaN],
  ])('BAD_AUX_EDIT when the new count is %s', (_label, to) => {
    expect(check(edit({ to }))).toEqual({ ok: false, code: 'BAD_AUX_EDIT' })
  })

  it('AUX_UNKNOWN_RESIDENT when the matric is not in the residents file', () => {
    expect(check(edit({ matric: matricOf(9) }))).toEqual({ ok: false, code: 'AUX_UNKNOWN_RESIDENT' })
  })

  it('MISSING_REASON only when the reason is too long', () => {
    expect(check(edit({ reason: 'x'.repeat(MAX_REASON_LENGTH) }))).toEqual({ ok: true })
    expect(check(edit({ reason: 'x'.repeat(MAX_REASON_LENGTH + 1) }))).toEqual({ ok: false, code: 'MISSING_REASON' })
  })

  it('REVIEW_NO_CHANGE when to equals from', () => {
    expect(check(edit({ to: 6 }))).toEqual({ ok: false, code: 'REVIEW_NO_CHANGE' })
  })

  it('checks in order: count, resident, reason, change', () => {
    const long = 'x'.repeat(MAX_REASON_LENGTH + 1)
    expect(check(edit({ to: -1, matric: matricOf(9) }))).toEqual({ ok: false, code: 'BAD_AUX_EDIT' })
    expect(check(edit({ matric: matricOf(9), reason: long }))).toEqual({ ok: false, code: 'AUX_UNKNOWN_RESIDENT' })
    expect(check(edit({ reason: long, to: 6 }))).toEqual({ ok: false, code: 'MISSING_REASON' })
  })
})

describe('applyAuxEdits', () => {
  it('replaces only aux, uncapped (the engine caps it)', () => {
    const out = applyAuxEdits(rows(), [edit({ to: 14 })])
    expect(out.edits[0]).toMatchObject({ status: 'applied', current: 6 })
    expect(out.rows[0]).toEqual({ ...rows()[0], aux: 14 })
    expect(out.rows[1]).toEqual(rows()[1])
  })

  it('changed when the file now says another count; the file count stands', () => {
    const out = applyAuxEdits([resident(1, 7)], [edit()])
    expect(out.edits[0]).toMatchObject({ status: 'changed', current: 7 })
    expect(out.rows[0]?.aux).toBe(7)
  })

  it('stale when the resident is gone', () => {
    const out = applyAuxEdits(rows(), [edit({ matric: matricOf(9) })])
    expect(out.edits[0]).toMatchObject({ status: 'stale', current: null })
    expect(out.rows).toEqual(rows())
  })

  it('the last edit per resident wins', () => {
    const out = applyAuxEdits(rows(), [edit({ to: 7 }), edit({ to: 8 })])
    expect(out.edits.map((e) => e.status)).toEqual(['stale', 'applied'])
    expect(out.rows[0]?.aux).toBe(8)
  })

  it('leaves untouched rows as the same objects and never mutates', () => {
    const input = deepFreeze(rows())
    const out = applyAuxEdits(input, deepFreeze([edit()]))
    expect(out.rows[1]).toBe(input[1])
    expect(input[0]?.aux).toBe(6)
  })
})
