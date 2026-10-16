import { describe, expect, it } from 'vitest'
import { DEFAULT_CONFIG, MAX_EXHAUSTIVE_HALVES } from '../defaults'
import { auxPoints, computeResident } from '../resident'
import type { Cca, IhgEntry, Membership, ResidentResult, ScenarioConfig } from '../types'
import {
  ccaMap,
  deepFreeze,
  e1Ccas,
  e1Memberships,
  makeCca,
  makeIhg,
  makeMembership,
  makeResident,
} from './helpers'

const config = DEFAULT_CONFIG

function e1Result(
  handball: Partial<Membership> = {},
  cfg: ScenarioConfig = config,
): ResidentResult {
  const ccas = e1Ccas().map((cca) =>
    cca.ccaID === 'Handball' ? { ...cca, outgoingTier: 'High Gold' } : cca,
  )
  return computeResident(makeResident(), e1Memberships(handball), ccaMap(ccas), [], cfg)
}

describe('spec examples at resident level', () => {
  it('E1: staying 68.375 when slots are ranked by net', () => {
    expect(e1Result().staying.points).toBeCloseTo(68.375, 9)
  })

  it('E2: staying 71.975 with incoming Head of Handball', () => {
    expect(e1Result({ incomingRole: 'head' }).staying.points).toBeCloseTo(71.975, 9)
  })

  it('E3: bidding 85.1 with incoming Head of Handball', () => {
    expect(e1Result({ incomingRole: 'head' }).bidding.points).toBeCloseTo(85.1, 9)
  })

  it('E4: bidding 99.5 with outgoing Head of Handball at x2.0', () => {
    expect(e1Result({ outgoingRole: 'head' }).bidding.points).toBeCloseTo(99.5, 9)
  })

  it('E5: staying 58.375 after the incoming role is dropped', () => {
    const result = e1Result({ incomingRole: 'head', roleDropped: true })
    expect(result.staying.points).toBeCloseTo(58.375, 9)
  })

  it('E11: AUX 7 gives 4 points and AUX 12 is capped to 10 points', () => {
    expect(auxPoints(7, config)).toBe(4)
    expect(auxPoints(12, config)).toBe(10)
  })

  it('E11: AUX points are added to staying and bidding', () => {
    const result = computeResident(
      makeResident({ aux: 7 }),
      e1Memberships(),
      ccaMap(e1Ccas()),
      [],
      config,
    )
    expect(result.staying.points).toBeCloseTo(72.375, 9)
    expect(result.bidding.points).toBeCloseTo(4 + 10.5 + 15.5 + 10.5 + 12 + 11 + 22, 9)
  })
})

describe('breakdown', () => {
  it('lists slots in order with weight and contribution', () => {
    const { slots, slotTotal, auxPoints: aux } = e1Result().staying
    expect(slots.map((s) => s.value)).toEqual([22, 15.5, 12, 11, 10.5, 10.5])
    expect(slots.map((s) => s.weight)).toEqual([1, 1, 1, 1, 0.5, 0.25])
    expect(slots[4]?.contribution).toBe(5.25)
    expect(slotTotal).toBeCloseTo(68.375, 9)
    expect(aux).toBe(0)
  })

  it('reports the merged halves and per-CCA bid contributions', () => {
    const fullCcas = [20, 15, 12, 9].map((base) => ({ id: `F${base}`, base }))
    const ccas = [
      makeCca('P', 'gold', '0.5x'),
      makeCca('Q', 'bronze', '0.5x'),
      ...fullCcas.map(({ id }) => makeCca(id)),
    ]
    const result = computeResident(
      makeResident(),
      [
        ...fullCcas.map(({ id, base }) => makeMembership(id, base)),
        makeMembership('P', 16),
        makeMembership('Q', 12),
      ],
      ccaMap(ccas),
      [],
      config,
    )
    expect(result.staying.points).toBeCloseTo(70, 9)
    expect(result.staying.mergedPairs).toEqual([['P', 'Q']])
    expect(result.staying.usedGreedyPairing).toBe(false)
    expect(result.bidding.contributions).toContainEqual({ ccaID: 'P', bidNet: 12 })
    expect(result.bidding.contributions).toContainEqual({ ccaID: 'Q', bidNet: 6.5 })
  })

  it('exposes the per-membership results', () => {
    expect(e1Result().memberships).toHaveLength(6)
  })
})

describe('residents with no memberships', () => {
  it('still get AUX points', () => {
    const result = computeResident(makeResident({ aux: 7 }), [], {}, [], config)
    expect(result.staying.points).toBe(4)
    expect(result.bidding.points).toBe(4)
    expect(result.warnings).toEqual([])
  })
})

describe('IHG handling', () => {
  const ccas = ccaMap([makeCca('C')])
  const run = (ihg: readonly IhgEntry[], cfg: ScenarioConfig): ResidentResult =>
    computeResident(makeResident(), [makeMembership('C', 10)], ccas, ihg, cfg)
  const on: ScenarioConfig = { ...config, ihgInSportNet: true }

  it('is flat in both totals when ihgInSportNet is off', () => {
    const result = run([makeIhg('C', '1st')], config)
    expect(result.staying.flatIHG).toBe(5)
    expect(result.staying.points).toBe(15)
    expect(result.bidding.points).toBe(15)
  })

  it('is counted in the sport net, not flat, when ihgInSportNet is on', () => {
    const result = run([makeIhg('C', '1st')], on)
    expect(result.staying.flatIHG).toBe(0)
    expect(result.staying.points).toBe(15)
    expect(result.memberships[0]?.ihgNet).toBe(5)
  })

  it('stays flat for a non-member and warns when ihgInSportNet is on', () => {
    const result = run([makeIhg('Other', '2nd')], on)
    expect(result.staying.flatIHG).toBe(4)
    expect(result.staying.points).toBe(14)
    expect(result.warnings.map((w) => w.code)).toEqual(['IHG_NON_MEMBER'])
    expect(result.warnings[0]?.ccaID).toBe('Other')
  })

  it('does not warn for a non-member when ihgInSportNet is off', () => {
    expect(run([makeIhg('Other', '2nd')], config).warnings).toEqual([])
  })

  it('ignores IHG rows of other residents', () => {
    const other: IhgEntry = { matric: 'A9999999Z', ccaID: 'C', placement: '1st' }
    expect(run([other], config).staying.flatIHG).toBe(0)
  })
})

describe('warnings', () => {
  it('semesterOnly on a 0.5x CCA', () => {
    const result = computeResident(
      makeResident(),
      [makeMembership('H', 10, { semesterOnly: true })],
      ccaMap([makeCca('H', 'pass', '0.5x')]),
      [],
      config,
    )
    expect(result.warnings.map((w) => w.code)).toEqual(['SEMESTER_ONLY_ON_HALF_CCA'])
    expect(result.staying.points).toBe(5)
  })

  it('aux above the cap', () => {
    const result = computeResident(makeResident({ aux: 12 }), [], {}, [], config)
    expect(result.warnings.map((w) => w.code)).toEqual(['AUX_ABOVE_CAP'])
  })

  it('aux exactly at the cap does not warn', () => {
    expect(computeResident(makeResident({ aux: 10 }), [], {}, [], config).warnings).toEqual([])
  })

  it('more than the exhaustive limit of half-CCA memberships', () => {
    const count = MAX_EXHAUSTIVE_HALVES + 1
    const ids = Array.from({ length: count }, (_, i) => `H${i}`)
    const result = computeResident(
      makeResident(),
      ids.map((id) => makeMembership(id, 10)),
      ccaMap(ids.map((id) => makeCca(id, 'pass', '0.5x'))),
      [],
      config,
    )
    expect(result.warnings.map((w) => w.code)).toEqual(['TOO_MANY_HALF_CCAS'])
    expect(result.staying.usedGreedyPairing).toBe(true)
  })
})

describe('guards and immutability', () => {
  it('throws when a membership references an unknown CCA', () => {
    expect(() =>
      computeResident(makeResident(), [makeMembership('Missing', 10)], {}, [], config),
    ).toThrow(/Missing/)
  })

  it('throws when auxTable has no entry for the capped aux', () => {
    expect(() => auxPoints(3, { ...config, auxTable: [0] })).toThrow(/auxTable/)
  })

  it('only counts memberships of the resident', () => {
    const stray = makeMembership('C', 20, { matric: 'A9999999Z' })
    const result = computeResident(
      makeResident(),
      [makeMembership('C', 10), stray],
      ccaMap([makeCca('C')]),
      [],
      config,
    )
    expect(result.staying.points).toBe(10)
  })

  it('does not mutate any input', () => {
    const ccas: Readonly<Record<string, Cca>> = deepFreeze(ccaMap(e1Ccas()))
    expect(() =>
      computeResident(
        deepFreeze(makeResident()),
        deepFreeze([...e1Memberships({ incomingRole: 'head' })]),
        ccas,
        deepFreeze([makeIhg('Handball', '1st')]),
        deepFreeze({ ...config }),
      ),
    ).not.toThrow()
  })
})
