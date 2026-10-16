import { describe, expect, it } from 'vitest'
import { ABSENT, NO_STATUS, compareLists, compareRuns } from '../compare'
import { computeAll } from '../pipeline'
import type { ListRow } from '../types'
import { configWith, deepFreeze, makeInput } from './helpers'

const input = makeInput([
  { id: 'M1', base: 20 },
  { id: 'M2', base: 15 },
  { id: 'M3', base: 12 },
  { id: 'M4', base: 10 },
  { id: 'S1', sem2: true, base: 9 },
])
const runA = computeAll(input, configWith({ maleGreen: 1, maleGrey: 2 }))
const runB = computeAll(input, configWith({ maleGreen: 3, maleGrey: 0 }))

describe('compareRuns', () => {
  const result = compareRuns(runA, runB)

  it('counts status moves per list', () => {
    expect(result.maleStaying.moves).toEqual([{ from: 'grey', to: 'green', count: 2 }])
  })

  it('reports every resident with both sides', () => {
    const m2 = result.maleStaying.rows.find((r) => r.matric === 'M2')
    expect(m2).toMatchObject({
      name: 'M2', statusA: 'grey', statusB: 'green', rankA: 2, rankB: 2, rankDelta: 0,
      pointsA: 15, pointsB: 15, pointsDelta: 0, changed: true,
    })
  })

  it('marks residents whose status, rank and points are equal as unchanged', () => {
    const m1 = result.maleStaying.rows.find((r) => r.matric === 'M1')
    expect(m1?.changed).toBe(false)
  })

  it('compares all five lists', () => {
    expect(Object.keys(result).sort()).toEqual(['femaleBidding', 'femaleStaying', 'maleBidding', 'maleStaying', 'sem2'])
    expect(result.sem2.rows).toHaveLength(1)
  })

  it('does not mutate its inputs', () => {
    expect(() => compareRuns(deepFreeze(runA), deepFreeze(runB))).not.toThrow()
  })
})

describe('compareLists', () => {
  const row = (matric: string, rank: number, points: number, status: ListRow['status']): ListRow => ({
    position: rank, rank, matric, name: `Test ${matric}`, points, status, tieFlags: [], labels: [],
    result: runA.results[0] as ListRow['result'],
  })

  it('treats residents missing from one side as absent', () => {
    const result = compareLists([row('X', 1, 10, 'green')], [row('Y', 1, 12, 'grey')])
    expect(result.rows).toEqual([
      expect.objectContaining({ matric: 'X', statusA: 'green', statusB: ABSENT, rankB: null, rankDelta: null, pointsDelta: null, changed: true }),
      expect.objectContaining({ matric: 'Y', statusA: ABSENT, statusB: 'grey', rankA: null, changed: true }),
    ])
    expect(result.moves).toEqual([
      { from: 'green', to: ABSENT, count: 1 },
      { from: ABSENT, to: 'grey', count: 1 },
    ])
  })

  it('gives signed deltas: rank B minus rank A, points B minus points A', () => {
    const [r] = compareLists([row('X', 5, 10, 'white')], [row('X', 2, 12.5, 'white')]).rows
    expect(r).toMatchObject({ rankDelta: -3, pointsDelta: 2.5, changed: true })
  })

  it('ignores point differences below 6 decimal places', () => {
    const [r] = compareLists([row('X', 1, 10, 'green')], [row('X', 1, 10.0000001, 'green')]).rows
    expect(r?.changed).toBe(false)
  })

  it('shows a missing status as "none"', () => {
    const [r] = compareLists([row('X', 1, 10, null)], [row('X', 1, 10, null)]).rows
    expect(r?.statusA).toBe(NO_STATUS)
  })

  it('sorts moves by count, largest first', () => {
    const a = [row('A', 1, 1, 'green'), row('B', 2, 1, 'green'), row('C', 3, 1, 'grey')]
    const b = [row('A', 1, 1, 'grey'), row('B', 2, 1, 'grey'), row('C', 3, 1, 'white')]
    expect(compareLists(a, b).moves.map((m) => m.count)).toEqual([2, 1])
  })
})
