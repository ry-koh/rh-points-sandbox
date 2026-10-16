import { describe, expect, it } from 'vitest'
import { DEFAULT_CONFIG } from '../defaults'
import {
  bidMult,
  computeMembership,
  effBase,
  ihgPointsForCca,
  incomingMult,
  outgoingMult,
  placementPoints,
  stayMult,
} from '../membership'
import type { ScenarioConfig } from '../types'
import { deepFreeze, makeCca, makeIhg, makeMembership } from './helpers'

const config = DEFAULT_CONFIG

describe('effBase', () => {
  it('E7: semester-only on a 1x CCA halves the base', () => {
    const m = makeMembership('Silver1x', 14, { semesterOnly: true })
    expect(effBase(m, makeCca('Silver1x', 'silver'), config)).toBe(7)
  })

  it('E7: stayNet of that member is 8.5', () => {
    const m = makeMembership('Silver1x', 14, { semesterOnly: true })
    const result = computeMembership(m, makeCca('Silver1x', 'silver'), [], config)
    expect(result.stayNet).toBe(8.5)
  })

  it('semester-only is ignored on a 0.5x CCA (only the half-CCA factor applies)', () => {
    const m = makeMembership('Half', 14, { semesterOnly: true })
    expect(effBase(m, makeCca('Half', 'pass', '0.5x'), config)).toBe(7)
  })

  it('0.5x CCAs apply the half-CCA base factor', () => {
    const m = makeMembership('Half', 16)
    expect(effBase(m, makeCca('Half', 'gold', '0.5x'), config)).toBe(8)
  })

  it('dropped role caps the base at droppedRoleBase', () => {
    const m = makeMembership('C', 18, { roleDropped: true })
    expect(effBase(m, makeCca('C'), config)).toBe(8)
  })

  it('dropped role never raises a low base', () => {
    const m = makeMembership('C', 5, { roleDropped: true })
    expect(effBase(m, makeCca('C'), config)).toBe(5)
  })
})

describe('multipliers', () => {
  const highGold = makeCca('C', 'gold', '1x', { outgoingTier: 'High Gold' })

  it('incoming role uses the configured multiplier', () => {
    expect(incomingMult(makeMembership('C', 10, { incomingRole: 'head' }), config)).toBe(1.2)
    expect(incomingMult(makeMembership('C', 10, { incomingRole: 'vice_head' }), config)).toBe(1.2)
  })

  it('no incoming role gives 1', () => {
    expect(incomingMult(makeMembership('C', 10), config)).toBe(1)
  })

  it('a dropped role loses the incoming multiplier', () => {
    const m = makeMembership('C', 10, { incomingRole: 'head', roleDropped: true })
    expect(incomingMult(m, config)).toBe(1)
  })

  it('outgoing multiplier comes from the tier table in tier mode', () => {
    const m = makeMembership('C', 10, { outgoingRole: 'head' })
    expect(outgoingMult(m, highGold, config)).toBe(2)
  })

  it('outgoing multiplier comes from the CCA value in manual mode', () => {
    const manual: ScenarioConfig = { ...config, outgoingMode: 'manual' }
    const cca = makeCca('C', 'pass', '1x', { outgoingMultiplier: 1.4, outgoingTier: 'High Gold' })
    expect(outgoingMult(makeMembership('C', 10, { outgoingRole: 'head' }), cca, manual)).toBe(1.4)
  })

  it('no outgoing role gives 1 even when the CCA has a multiplier', () => {
    expect(outgoingMult(makeMembership('C', 10), highGold, config)).toBe(1)
  })

  it('throws when an outgoing leader has no tier in tier mode', () => {
    const m = makeMembership('C', 10, { outgoingRole: 'head' })
    expect(() => outgoingMult(m, makeCca('C'), config)).toThrow(/outgoing/i)
  })

  it('throws when the tier name is unknown', () => {
    const m = makeMembership('C', 10, { outgoingRole: 'head' })
    const cca = makeCca('C', 'pass', '1x', { outgoingTier: 'Platinum' })
    expect(() => outgoingMult(m, cca, config)).toThrow(/Platinum/)
  })

  it('throws when manual mode has no multiplier', () => {
    const manual: ScenarioConfig = { ...config, outgoingMode: 'manual' }
    const m = makeMembership('C', 10, { outgoingRole: 'head' })
    expect(() => outgoingMult(m, makeCca('C'), manual)).toThrow(/outgoing/i)
  })

  it('staying ignores the outgoing role', () => {
    const m = makeMembership('C', 10, { outgoingRole: 'head', incomingRole: 'head' })
    expect(stayMult(m, config)).toBe(1.2)
    expect(stayMult(makeMembership('C', 10, { outgoingRole: 'head' }), config)).toBe(1)
  })

  it('bidding with only an outgoing role uses the outgoing multiplier', () => {
    const m = makeMembership('C', 10, { outgoingRole: 'head' })
    expect(bidMult(m, highGold, config)).toBe(2)
  })

  it('bidding with only an incoming role uses the incoming multiplier', () => {
    const m = makeMembership('C', 10, { incomingRole: 'head' })
    expect(bidMult(m, highGold, config)).toBe(1.2)
  })

  it('bidding with neither role is 1', () => {
    expect(bidMult(makeMembership('C', 10), highGold, config)).toBe(1)
  })

  it('E9: stacking modes with incoming 1.2 and outgoing 2.0 on base 18 Gold', () => {
    const m = makeMembership('C', 18, { incomingRole: 'head', outgoingRole: 'head' })
    const bidNet = (stackingMode: ScenarioConfig['stackingMode']): number =>
      computeMembership(m, highGold, [], { ...config, stackingMode }).bidNet
    expect(bidNet('max')).toBeCloseTo(40, 9)
    expect(bidNet('additive')).toBeCloseTo(43.6, 9)
    expect(bidNet('multiplicative')).toBeCloseTo(47.2, 9)
  })
})

describe('placementPoints', () => {
  it('returns the configured bonus', () => {
    expect(placementPoints(makeCca('C', 'silver'), config)).toBe(1.5)
  })

  it('0.5x CCAs keep the full bonus by default', () => {
    expect(placementPoints(makeCca('C', 'gold', '0.5x'), config)).toBe(4)
  })

  it('0.5x CCAs halve the bonus when halfCcaPlacementHalved is on', () => {
    const halved: ScenarioConfig = { ...config, halfCcaPlacementHalved: true }
    expect(placementPoints(makeCca('C', 'gold', '0.5x'), halved)).toBe(2)
  })

  it('1x CCAs are never halved', () => {
    const halved: ScenarioConfig = { ...config, halfCcaPlacementHalved: true }
    expect(placementPoints(makeCca('C', 'gold'), halved)).toBe(4)
  })
})

describe('IHG in nets', () => {
  const ihg = [makeIhg('C', '1st'), makeIhg('C', '3rd'), makeIhg('Other', '2nd')]

  it('sums every IHG row for the CCA', () => {
    expect(ihgPointsForCca(ihg, 'C', config)).toBe(8)
  })

  it('is 0 for a CCA with no rows', () => {
    expect(ihgPointsForCca(ihg, 'None', config)).toBe(0)
  })

  it('is not added to the net when ihgInSportNet is off', () => {
    const result = computeMembership(makeMembership('C', 10), makeCca('C'), ihg, config)
    expect(result.ihgNet).toBe(0)
    expect(result.stayNet).toBe(10)
  })

  it('is added to both nets, unmultiplied, when ihgInSportNet is on', () => {
    const on: ScenarioConfig = { ...config, ihgInSportNet: true }
    const m = makeMembership('C', 10, { incomingRole: 'head' })
    const result = computeMembership(m, makeCca('C'), ihg, on)
    expect(result.ihgNet).toBe(8)
    expect(result.stayNet).toBeCloseTo(20, 9)
    expect(result.bidNet).toBeCloseTo(20, 9)
  })
})

describe('computeMembership', () => {
  it('reports the intermediate values and half flag', () => {
    const m = makeMembership('C', 16, { incomingRole: 'head' })
    const result = computeMembership(m, makeCca('C', 'gold', '0.5x'), [], config)
    expect(result).toMatchObject({ ccaID: 'C', isHalf: true, effBase: 8, placement: 4 })
    expect(result.stayNet).toBeCloseTo(13.6, 9)
  })

  it('does not mutate frozen inputs', () => {
    const m = deepFreeze(makeMembership('C', 10, { incomingRole: 'head' }))
    const cca = deepFreeze(makeCca('C', 'gold'))
    const ihg = deepFreeze([makeIhg('C', '1st')])
    expect(() => computeMembership(m, cca, ihg, deepFreeze({ ...config }))).not.toThrow()
  })
})
