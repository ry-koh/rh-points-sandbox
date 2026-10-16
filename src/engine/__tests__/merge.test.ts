import { describe, expect, it } from 'vitest'
import { DEFAULT_CONFIG, MAX_EXHAUSTIVE_HALVES } from '../defaults'
import {
  chooseSlots,
  enumeratePairings,
  roundForCompare,
  slotWeight,
  weighSlots,
} from '../merge'
import type { ScenarioConfig, Slot } from '../types'
import { deepFreeze } from './helpers'

const config = DEFAULT_CONFIG

function slot(id: string, value: number): Slot {
  return { ccaIDs: [id], value }
}

function slots(values: readonly number[]): Slot[] {
  return values.map((value, i) => slot(`s${i}`, value))
}

const E6_FIXED = slots([20, 15, 12, 9])
const E6_HALVES = [slot('P', 12), slot('Q', 6.5), slot('R', 5)]

describe('roundForCompare', () => {
  it('rounds to 6 decimal places', () => {
    expect(roundForCompare(1.00000049)).toBe(1)
    expect(roundForCompare(1.0000006)).toBe(1.000001)
  })
})

describe('slotWeight', () => {
  it('uses the configured array first', () => {
    expect([0, 3, 4, 5].map((i) => slotWeight(i, config))).toEqual([1, 1, 0.5, 0.25])
  })

  it('halves per position past the array (7th = 0.125, 8th = 0.0625)', () => {
    expect(slotWeight(6, config)).toBe(0.125)
    expect(slotWeight(7, config)).toBe(0.0625)
  })

  it('is 0 when no weights are configured', () => {
    expect(slotWeight(0, { ...config, stayingWeights: [] })).toBe(0)
  })
})

describe('weighSlots', () => {
  it('sorts descending and records weight and contribution', () => {
    const result = weighSlots(slots([5, 20, 10]), config)
    expect(result.slots.map((s) => s.value)).toEqual([20, 10, 5])
    expect(result.slots[1]).toMatchObject({ weight: 1, contribution: 10 })
    expect(result.total).toBe(35)
  })

  it('applies the tail weights', () => {
    const result = weighSlots(slots([8, 7, 6, 5, 4, 3, 2, 1]), config)
    expect(result.total).toBeCloseTo(8 + 7 + 6 + 5 + 2 + 0.75 + 0.25 + 0.0625, 9)
  })

  it('orders equal values by ccaID so output is deterministic', () => {
    const result = weighSlots([slot('b', 1), slot('a', 1)], config)
    expect(result.slots.map((s) => s.ccaIDs[0])).toEqual(['a', 'b'])
  })

  it('does not mutate its input', () => {
    const input = deepFreeze(slots([1, 2, 3]))
    expect(() => weighSlots(input, config)).not.toThrow()
  })
})

describe('enumeratePairings', () => {
  it('has only the empty pairing for 0 or 1 halves', () => {
    expect(enumeratePairings([])).toEqual([[]])
    expect(enumeratePairings(['A'])).toEqual([[]])
  })

  it('has 4 pairings for 3 halves (none + 3 single pairs)', () => {
    expect(enumeratePairings(['P', 'Q', 'R'])).toHaveLength(4)
  })

  it('has 10 pairings for 4 halves', () => {
    expect(enumeratePairings(['A', 'B', 'C', 'D'])).toHaveLength(10)
  })

  it('writes each pair with ids ascending', () => {
    const flat = enumeratePairings(['B', 'A']).flat()
    expect(flat).toEqual([['A', 'B']])
  })
})

describe('E6: half-CCA merging', () => {
  const total = (values: readonly number[]): number =>
    weighSlots(slots(values), config).total

  it('the four pairing totals are 65.75, 71.25, 70.125 and 67', () => {
    expect(total([20, 15, 12, 9, 12, 6.5, 5])).toBeCloseTo(65.75, 9)
    expect(total([20, 15, 12, 9, 18.5, 5])).toBeCloseTo(71.25, 9)
    expect(total([20, 15, 12, 9, 17, 6.5])).toBeCloseTo(70.125, 9)
    expect(total([20, 15, 12, 9, 11.5, 12])).toBeCloseTo(67, 9)
  })

  it('chooses P+Q = 71.25', () => {
    const choice = chooseSlots(E6_FIXED, E6_HALVES, config)
    expect(choice.total).toBeCloseTo(71.25, 9)
    expect(choice.pairs).toEqual([['P', 'Q']])
    expect(choice.greedy).toBe(false)
    expect(choice.slots.find((s) => s.ccaIDs.length === 2)?.ccaIDs).toEqual(['P', 'Q'])
  })

  it('does not pair when mergeHalfCcas is off', () => {
    const off: ScenarioConfig = { ...config, mergeHalfCcas: false }
    const choice = chooseSlots(E6_FIXED, E6_HALVES, off)
    expect(choice.pairs).toEqual([])
    expect(choice.total).toBeCloseTo(65.75, 9)
  })
})

describe('chooseSlots with few halves', () => {
  it('0 halves: slots are just the fixed ones', () => {
    const choice = chooseSlots(slots([3, 2, 1]), [], config)
    expect(choice.pairs).toEqual([])
    expect(choice.total).toBe(6)
  })

  it('1 half: stays unpaired', () => {
    const choice = chooseSlots(slots([3, 2, 1]), [slot('H', 4)], config)
    expect(choice.pairs).toEqual([])
    expect(choice.total).toBe(10)
  })

  it('3 halves: at most one pair, the third stays on its own', () => {
    const choice = chooseSlots(E6_FIXED, E6_HALVES, config)
    expect(choice.slots).toHaveLength(6)
  })

  it('does not pair when pairing lowers the total', () => {
    const choice = chooseSlots([], [slot('A', 3), slot('B', 3)], config)
    expect(choice.pairs).toEqual([])
    expect(choice.total).toBe(6)
  })

  it('does not mutate frozen inputs', () => {
    expect(() =>
      chooseSlots(deepFreeze(slots([1])), deepFreeze([slot('A', 1), slot('B', 2)]), config),
    ).not.toThrow()
  })
})

describe('tie-break determinism', () => {
  const tens = slots([10, 10, 10, 10])

  it('prefers fewer pairs when totals tie', () => {
    const halves = ['A', 'B', 'C', 'D'].map((id) => slot(id, 2))
    const choice = chooseSlots([], halves, config)
    expect(choice.pairs).toEqual([])
  })

  it('picks the lowest pair keys among equal-size pairings', () => {
    const halves = ['A', 'B', 'C', 'D'].map((id) => slot(id, 4))
    const choice = chooseSlots(tens, halves, config)
    expect(choice.total).toBeCloseTo(46, 9)
    expect(choice.pairs).toEqual([
      ['A', 'B'],
      ['C', 'D'],
    ])
  })

  it('is independent of input order', () => {
    const forward = ['A', 'B', 'C', 'D'].map((id) => slot(id, 4))
    const reversed = [...forward].reverse()
    expect(chooseSlots(tens, reversed, config)).toEqual(chooseSlots(tens, forward, config))
  })

  it('picks A+B over A+C and B+C when one pair is best', () => {
    const halves = ['C', 'A', 'B'].map((id) => slot(id, 4))
    expect(chooseSlots(tens, halves, config).pairs).toEqual([['A', 'B']])
  })
})

describe('greedy pairing above the exhaustive limit', () => {
  const count = MAX_EXHAUSTIVE_HALVES + 2
  const halves = Array.from({ length: count }, (_, i) => slot(`H${String(i).padStart(2, '0')}`, count - i))

  it('pairs by value descending: 1st+2nd, 3rd+4th, ...', () => {
    const choice = chooseSlots([], halves, config)
    expect(choice.greedy).toBe(true)
    expect(choice.pairs.slice(0, 2)).toEqual([
      ['H00', 'H01'],
      ['H02', 'H03'],
    ])
    expect(choice.pairs).toHaveLength(count / 2)
  })

  it('leaves an odd one out unpaired', () => {
    const odd = halves.slice(0, count - 1)
    const choice = chooseSlots([], odd, config)
    expect(choice.greedy).toBe(true)
    expect(choice.slots).toHaveLength(Math.ceil(odd.length / 2))
  })

  it('exactly at the limit is still exhaustive', () => {
    const atLimit = halves.slice(0, MAX_EXHAUSTIVE_HALVES)
    expect(chooseSlots([], atLimit, config).greedy).toBe(false)
  })
})
