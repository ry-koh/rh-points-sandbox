import { describe, expect, it } from 'vitest'
import { createPenaltyState } from '../penalty'
import { computeAll } from '../pipeline'
import { configWith, makeInput, type RowSpec } from './helpers'

const config = configWith({ maleGreen: 1, maleGrey: 1, femaleGreen: 1, sem2Green: 1 })

const ROWS: RowSpec[] = [
  { id: 'M1', base: 14, incoming: 'head' },
  { id: 'M2', base: 12, extra: [['Y', 6]] },
  { id: 'M3', aux: 12 },
  { id: 'F1', gender: 'F', base: 9 },
  { id: 'S1', gender: 'F', sem2: true, base: 13 },
]
const input = makeInput(ROWS)

describe('computeAll', () => {
  const output = computeAll(input, config)

  it('returns one result per resident, in input order', () => {
    expect(output.results.map((r) => r.matric)).toEqual(['M1', 'M2', 'M3', 'F1', 'S1'])
  })

  it('returns all five lists', () => {
    expect(Object.keys(output.lists).sort()).toEqual([
      'femaleBidding',
      'femaleStaying',
      'maleBidding',
      'maleStaying',
      'sem2',
    ])
    expect(output.lists.maleStaying.map((r) => r.matric)).toEqual(['M2', 'M1', 'M3'])
    expect(output.lists.sem2.map((r) => r.matric)).toEqual(['S1'])
  })

  it('collects every resident warning in one flat list', () => {
    expect(output.warnings.map((w) => [w.code, w.matric])).toEqual([['AUX_ABOVE_CAP', 'M3']])
  })

  it('computes the same staying points as the per-resident engine', () => {
    expect(output.results[0]?.staying.points).toBeCloseTo(16.8, 9)
    expect(output.results[1]?.staying.points).toBe(18)
  })

  it('gives an identical result when run twice', () => {
    expect(computeAll(input, config)).toEqual(output)
  })

  it('applies a penalty state by dropping the roles in it', () => {
    const base = createPenaltyState(output.lists)
    const state = { ...base, applied: [{ matric: 'M1', ccaID: 'X' }] }
    const penalised = computeAll(input, config, { penaltyState: state })
    expect(penalised.results[0]?.staying.points).toBe(8)
    expect(output.results[0]?.staying.points).toBeCloseTo(16.8, 9)
  })

  it('handles an empty dataset', () => {
    const empty = computeAll({ residents: [], ccas: [], memberships: [], ihg: [] }, config)
    expect(empty.results).toEqual([])
    expect(empty.lists.maleStaying).toEqual([])
    expect(empty.warnings).toEqual([])
  })
})
