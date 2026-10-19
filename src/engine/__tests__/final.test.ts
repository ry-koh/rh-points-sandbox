import { describe, expect, it } from 'vitest'
import { validateDiscretion, upsertDiscretion } from '../discretion'
import { upsertOverride, validateOverride } from '../overrides'
import { applyPenalty, createPenaltyState } from '../penalty'
import { computeAll } from '../pipeline'
import type { Cca, Discretion, FinalOverride, Membership, PipelineInput } from '../types'
import {
  TEST_MATRIC,
  configWith,
  deepFreeze,
  e1Ccas,
  e1Memberships,
  makeCca,
  makeIhg,
  makeMembership,
  makeResident,
} from './helpers'

const cfg = configWith({})

function input(ccas: readonly Cca[], memberships: readonly Membership[], ihg = [] as PipelineInput['ihg']): PipelineInput {
  return { residents: [makeResident()], ccas, memberships, ihg }
}
const flat = (ccaID: string, value: number, extra: Partial<Membership> = {}): Membership =>
  makeMembership(ccaID, 0, { flatPoints: value, ...extra })

function mine(data: PipelineInput, config = cfg, options: Parameters<typeof computeAll>[2] = {}) {
  const out = computeAll(data, config, options)
  const result = out.results[0]
  if (!result) throw new Error('no result')
  return { out, result }
}

describe('E18: a flat CCA is final', () => {
  const ccas = [makeCca('Handball', 'High Gold'), makeCca('Arts', 'Low Bronze'), makeCca('Welfare', 'Low Bronze'), makeCca('Flat', 'High Gold')]
  const base = [makeMembership('Handball', 18), makeMembership('Arts', 15), makeMembership('Welfare', 10)]
  // The flat CCA is ccas.csv Gold and the resident is an incoming Head there: both are ignored.
  const data = input(ccas, [...base, flat('Flat', 12, { incomingRole: 'head' })])

  it('gives staying 60 and bidding 60', () => {
    const { result } = mine(data)
    expect(result.staying.points).toBe(60)
    expect(result.bidding.points).toBe(60)
  })

  it('has no level bonus, multiplier, halving or IHG on the flat membership', () => {
    const half = [makeCca('Flat', 'High Gold', '0.5x')]
    const { result } = mine(input(half, [flat('Flat', 12, { incomingRole: 'head', semesterOnly: true, outgoingRole: 'head' })]))
    const membership = result.memberships[0]
    expect(membership?.stayNet).toBe(12)
    expect(membership?.bidNet).toBe(12)
    expect(membership?.levelBonus).toBe(0)
    expect(membership?.isHalf).toBe(false)
  })

  it('says "Flat points (set by JCRC)" in the breakdown', () => {
    const { result } = mine(data)
    expect(result.memberships.find((m) => m.ccaID === 'Flat')?.final).toEqual({
      kind: 'flat',
      value: 12,
      reason: null,
      text: 'Flat points (set by JCRC)',
    })
    expect(result.memberships.find((m) => m.ccaID === 'Handball')?.final).toBeNull()
  })

  it('is never paired by half-CCA merging, even in 0.5x CCAs', () => {
    const halves = [makeCca('F1', 'Pass', '0.5x'), makeCca('F2', 'Pass', '0.5x')]
    const { result } = mine(input(halves, [flat('F1', 12), flat('F2', 6)]))
    expect(result.staying.mergedPairs).toEqual([])
    expect(result.staying.slots.map((s) => s.value)).toEqual([12, 6])
  })

  it('still occupies one slot, with that slot weight', () => {
    const ccas5 = ['A', 'B', 'C', 'D', 'E'].map((id) => makeCca(id))
    const { result } = mine(input(ccas5, ['A', 'B', 'C', 'D', 'E'].map((id) => flat(id, 10))))
    expect(result.staying.points).toBe(10 + 10 + 10 + 10 + 5)
  })

  it.each([true, false])('always ignores an IHG row for a flat CCA, with a warning (ihgInSportNet %s)', (inNet) => {
    const withIhg = input(ccas, [...base, flat('Flat', 12)], [makeIhg('Flat', '1st')])
    const { out, result } = mine(withIhg, configWith({}, { ihgInSportNet: inNet }))
    expect(result.staying.points).toBe(60)
    expect(result.bidding.points).toBe(60)
    expect(result.staying.flatIHG).toBe(0)
    expect(out.warnings.map((w) => [w.code, w.ccaID])).toEqual([['IHG_ON_FINAL_CCA', 'Flat']])
  })

  it('still counts IHG for a normal CCA next to a flat one', () => {
    const withIhg = input(ccas, [...base, flat('Flat', 12)], [makeIhg('Flat', '1st'), makeIhg('Handball', '2nd')])
    const { result } = mine(withIhg, configWith({}, { ihgInSportNet: false }))
    expect(result.bidding.points).toBe(64)
  })

  it('counts a sem-2 resident in a flat CCA normally', () => {
    const sem2 = { ...input([makeCca('Flat')], [flat('Flat', 12)]), residents: [makeResident({ sem2: true })] }
    const out = computeAll(sem2, configWith({ sem2Green: 1 }))
    expect(out.lists.sem2[0]?.points).toBe(12)
    expect(out.lists.sem2[0]?.status).toBe('green')
  })
})

describe('E19: final-points overrides', () => {
  const data = input(e1Ccas(), e1Memberships())
  const override: FinalOverride = { matric: TEST_MATRIC, ccaID: 'Rhebels', finalPoints: 5, reason: 'withdrawn' }

  it('sets the membership to the exact value: staying 65.5, bidding 74.5', () => {
    const { result } = mine(data, cfg, { overrides: [override] })
    expect(result.staying.points).toBe(65.5)
    expect(result.bidding.points).toBe(74.5)
  })

  it('writes the reason into the breakdown', () => {
    const { result } = mine(data, cfg, { overrides: [override] })
    expect(result.memberships.find((m) => m.ccaID === 'Rhebels')?.final?.text).toBe(
      'Final points set by JCRC: 5 — withdrawn',
    )
  })

  it('beats a flat value and the normal calculation', () => {
    const flatData = input([makeCca('Flat')], [flat('Flat', 12)])
    const { result } = mine(flatData, cfg, {
      overrides: [{ matric: TEST_MATRIC, ccaID: 'Flat', finalPoints: 3, reason: 'r' }],
    })
    expect(result.staying.points).toBe(3)
    expect(result.memberships[0]?.final?.kind).toBe('override')
  })

  it('has no level bonus, multiplier or halving on the overridden membership', () => {
    const halved = input([makeCca('H', 'High Gold', '0.5x')], [makeMembership('H', 20, { incomingRole: 'head', semesterOnly: true })])
    const { result } = mine(halved, cfg, { overrides: [{ matric: TEST_MATRIC, ccaID: 'H', finalPoints: 7, reason: 'r' }] })
    expect(result.memberships[0]).toMatchObject({ stayNet: 7, bidNet: 7, levelBonus: 0, isHalf: false })
  })

  it('is excluded from half-CCA pairing but still ranked and weighted', () => {
    const halves = [makeCca('P', 'Pass', '0.5x'), makeCca('Q', 'Pass', '0.5x'), makeCca('R', 'Pass', '0.5x')]
    const ms = [makeMembership('P', 20), makeMembership('Q', 20), makeMembership('R', 20)]
    const { result } = mine(input(halves, ms), cfg, {
      overrides: [{ matric: TEST_MATRIC, ccaID: 'P', finalPoints: 50, reason: 'r' }],
    })
    expect(result.staying.mergedPairs.flat()).not.toContain('P')
    expect(result.staying.slots.map((s) => s.value)[0]).toBe(50)
  })

  it('ignores an IHG row for the overridden membership, with a warning', () => {
    const withIhg = input(e1Ccas(), e1Memberships(), [makeIhg('Rhebels', '1st')])
    for (const inNet of [true, false]) {
      const { out, result } = mine(withIhg, configWith({}, { ihgInSportNet: inNet }), { overrides: [override] })
      expect(result.bidding.points).toBe(74.5)
      expect(out.warnings.map((w) => w.code)).toEqual(['IHG_ON_FINAL_CCA'])
    }
  })

  it('reports an applied override as applied and a vanished membership as stale', () => {
    const stale: FinalOverride = { matric: TEST_MATRIC, ccaID: 'Gone', finalPoints: 1, reason: 'r' }
    const { out, result } = mine(data, cfg, { overrides: [override, stale] })
    expect(out.overrides.map((o) => [o.entry.ccaID, o.status])).toEqual([
      ['Rhebels', 'applied'],
      ['Gone', 'stale'],
    ])
    expect(result.staying.points).toBe(65.5)
  })

  it('replaces the earlier entry for the same (matric, ccaID)', () => {
    const list = upsertOverride([override], { ...override, finalPoints: 9 })
    expect(list).toEqual([{ ...override, finalPoints: 9 }])
    expect(upsertOverride(list, { ...override, ccaID: 'Social' })).toHaveLength(2)
  })

  it('does not mutate its inputs', () => {
    const frozen = deepFreeze(input(e1Ccas(), e1Memberships()))
    expect(() => computeAll(frozen, deepFreeze(cfg), { overrides: deepFreeze([override]) })).not.toThrow()
    expect(() => upsertOverride(deepFreeze([override]), override)).not.toThrow()
  })
})

describe('validateOverride', () => {
  const data = input(e1Ccas(), e1Memberships())
  const good: FinalOverride = { matric: TEST_MATRIC, ccaID: 'Rhebels', finalPoints: 5, reason: 'ok' }

  it('accepts a good entry, including 0 and negative numbers', () => {
    expect(validateOverride(data, good)).toEqual({ ok: true })
    expect(validateOverride(data, { ...good, finalPoints: 0 })).toEqual({ ok: true })
    expect(validateOverride(data, { ...good, finalPoints: -3.5 })).toEqual({ ok: true })
  })

  it('rejects a points value that is not a finite number', () => {
    for (const finalPoints of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
      expect(validateOverride(data, { ...good, finalPoints })).toEqual({ ok: false, code: 'BAD_FINAL_POINTS' })
    }
  })

  it('rejects an empty or over-long reason', () => {
    expect(validateOverride(data, { ...good, reason: '   ' })).toEqual({ ok: false, code: 'MISSING_REASON' })
    expect(validateOverride(data, { ...good, reason: 'x'.repeat(201) })).toEqual({ ok: false, code: 'MISSING_REASON' })
    expect(validateOverride(data, { ...good, reason: 'x'.repeat(200) })).toEqual({ ok: true })
  })

  it('rejects an unknown membership', () => {
    expect(validateOverride(data, { ...good, ccaID: 'Nope' })).toEqual({ ok: false, code: 'OVERRIDE_UNKNOWN_MEMBERSHIP' })
    expect(validateOverride(data, { ...good, matric: 'A9999999Z' })).toEqual({ ok: false, code: 'OVERRIDE_UNKNOWN_MEMBERSHIP' })
  })

  it('checks the points first, then the reason, then the membership', () => {
    expect(validateOverride(data, { matric: 'x', ccaID: 'y', finalPoints: Number.NaN, reason: '' }).ok).toBe(false)
    expect(validateOverride(data, { matric: 'x', ccaID: 'y', finalPoints: Number.NaN, reason: '' })).toEqual({ ok: false, code: 'BAD_FINAL_POINTS' })
    expect(validateOverride(data, { matric: 'x', ccaID: 'y', finalPoints: 1, reason: '' })).toEqual({ ok: false, code: 'MISSING_REASON' })
  })
})

describe('E20: discretion points', () => {
  const data = input(e1Ccas(), e1Memberships())
  const entry: Discretion = { matric: TEST_MATRIC, stayingDelta: 2, biddingDelta: -1, reason: 'service' }

  it('adds the deltas last: staying 70.375, bidding 80.5', () => {
    const { result } = mine(data, cfg, { discretion: [entry] })
    expect(result.staying.points).toBe(70.375)
    expect(result.bidding.points).toBe(80.5)
  })

  it('leaves the computed points unchanged without discretion (68.375 / 81.5)', () => {
    const { result } = mine(data)
    expect(result.staying.points).toBe(68.375)
    expect(result.bidding.points).toBe(81.5)
  })

  it('accepts negative staying and positive bidding deltas', () => {
    const { result } = mine(data, cfg, { discretion: [{ ...entry, stayingDelta: -8.375, biddingDelta: 0.5 }] })
    expect(result.staying.points).toBe(60)
    expect(result.bidding.points).toBe(82)
  })

  it('writes the breakdown line', () => {
    const { result } = mine(data, cfg, { discretion: [entry] })
    expect(result.discretion?.text).toBe('JCRC discretion: +2 staying / −1 bidding — service')
  })

  it('reports applied and stale entries', () => {
    const gone: Discretion = { ...entry, matric: 'A9999999Z' }
    const { out } = mine(data, cfg, { discretion: [entry, gone] })
    expect(out.discretion.map((d) => d.status)).toEqual(['applied', 'stale'])
  })

  it('is kept through a penalty', () => {
    const memberships = [makeMembership('Handball', 18, { incomingRole: 'head' })]
    const pen = input([makeCca('Handball', 'High Gold')], memberships)
    const config = configWith({ maleGreen: 1 })
    const options = { discretion: [entry] }
    const initial = createPenaltyState(computeAll(pen, config, options).lists)
    const applied = applyPenalty(pen, config, initial, { matric: TEST_MATRIC, ccaID: 'Handball' }, options)
    if (!applied.ok) throw new Error(applied.error)
    const after = computeAll(pen, config, { ...options, penaltyState: applied.state })
    // dropped role: base 8 + gold 4 = 12, plus the +2 staying discretion
    expect(after.results[0]?.staying.points).toBe(14)
  })

  it('replaces the earlier entry for the same resident', () => {
    const list = upsertDiscretion([entry], { ...entry, stayingDelta: 9 })
    expect(list).toEqual([{ ...entry, stayingDelta: 9 }])
    expect(upsertDiscretion(list, { ...entry, matric: 'B' })).toHaveLength(2)
  })

  it('does not mutate its inputs', () => {
    const frozen = deepFreeze(input(e1Ccas(), e1Memberships()))
    expect(() => computeAll(frozen, deepFreeze(cfg), { discretion: deepFreeze([entry]) })).not.toThrow()
    expect(() => upsertDiscretion(deepFreeze([entry]), entry)).not.toThrow()
  })
})

describe('validateDiscretion', () => {
  const data = input(e1Ccas(), e1Memberships())
  const good: Discretion = { matric: TEST_MATRIC, stayingDelta: 1, biddingDelta: -1, reason: 'ok' }

  it('accepts good entries, including zero deltas', () => {
    expect(validateDiscretion(data, good)).toEqual({ ok: true })
    expect(validateDiscretion(data, { ...good, stayingDelta: 0, biddingDelta: 0 })).toEqual({ ok: true })
  })

  it('rejects a delta that is not a finite number', () => {
    expect(validateDiscretion(data, { ...good, stayingDelta: Number.NaN })).toEqual({ ok: false, code: 'BAD_DISCRETION_POINTS' })
    expect(validateDiscretion(data, { ...good, biddingDelta: Number.POSITIVE_INFINITY })).toEqual({ ok: false, code: 'BAD_DISCRETION_POINTS' })
  })

  it('rejects an empty or over-long reason', () => {
    expect(validateDiscretion(data, { ...good, reason: '' })).toEqual({ ok: false, code: 'MISSING_REASON' })
    expect(validateDiscretion(data, { ...good, reason: 'x'.repeat(201) })).toEqual({ ok: false, code: 'MISSING_REASON' })
  })

  it('rejects an unknown resident', () => {
    expect(validateDiscretion(data, { ...good, matric: 'A9999999Z' })).toEqual({ ok: false, code: 'DISCRETION_UNKNOWN_RESIDENT' })
  })
})
