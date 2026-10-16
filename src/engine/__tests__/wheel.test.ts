import { describe, expect, it } from 'vitest'
import { computeAll } from '../pipeline'
import type { ListRow, WheelResolution } from '../types'
import { configWith, deepFreeze, makeInput, type RowSpec } from './helpers'

const ids = (rows: readonly ListRow[]): string[] => rows.map((r) => r.matric)

// E16: A 80, B 75, C 75, D 70; green 2, grey 2.
const ROWS: RowSpec[] = [
  { id: 'A', base: 80 },
  { id: 'B', base: 75 },
  { id: 'C', base: 75 },
  { id: 'D', base: 70 },
]
const cfg = configWith({ maleGreen: 2, maleGrey: 2 })
const input = makeInput(ROWS)
const wheel: WheelResolution = { list: 'maleStaying', order: ['C', 'B'] }

describe('E16: without a resolution', () => {
  const { maleStaying, maleBidding } = computeAll(input, cfg).lists

  it('orders the tie by name and flags it unresolved', () => {
    expect(ids(maleStaying)).toEqual(['A', 'B', 'C', 'D'])
    expect(maleStaying[1]?.tieFlags).toEqual([
      { boundary: 'green/grey', k: 1, n: 2, text: 'TIE green/grey — 1 of 2 seats' },
    ])
    expect(maleStaying[1]?.tieFlags[0]?.resolved).toBeUndefined()
  })

  it('gives the bidding list the provisional colours', () => {
    expect(ids(maleBidding)).toEqual(['A', 'B', 'C', 'D'])
  })
})

describe('E16: with the wheel order [C, B]', () => {
  const out = computeAll(input, cfg, { resolutions: [wheel] })
  const { maleStaying, maleBidding } = out.lists

  it('orders the group exactly that way, first k in the upper band', () => {
    expect(ids(maleStaying)).toEqual(['A', 'C', 'B', 'D'])
    expect(maleStaying.map((r) => r.status)).toEqual(['green', 'green', 'grey', 'grey'])
    expect(maleStaying.map((r) => r.position)).toEqual([1, 2, 3, 4])
  })

  it('keeps the shared competition rank', () => {
    expect(maleStaying.map((r) => r.rank)).toEqual([1, 2, 2, 4])
  })

  it('changes the flag to "resolved by wheel"', () => {
    for (const row of [maleStaying[1], maleStaying[2]]) {
      expect(row?.tieFlags).toEqual([
        {
          boundary: 'green/grey',
          k: 1,
          n: 2,
          text: 'TIE green/grey — resolved by wheel (1 of 2 seats)',
          resolved: true,
        },
      ])
    }
  })

  it('makes the bidding colours follow the resolved staying status', () => {
    expect(ids(maleBidding)).toEqual(['A', 'C', 'B', 'D'])
    expect(maleBidding.map((r) => r.status)).toEqual(['green', 'green', 'grey', 'grey'])
  })

  it('reports the resolution as applied', () => {
    expect(out.resolutions).toEqual([{ entry: wheel, status: 'applied' }])
  })
})

describe('stale resolutions', () => {
  it('ignores and reports a resolution whose set does not match the group', () => {
    const stale: WheelResolution = { list: 'maleStaying', order: ['B', 'D'] }
    const out = computeAll(input, cfg, { resolutions: [stale] })
    expect(ids(out.lists.maleStaying)).toEqual(['A', 'B', 'C', 'D'])
    expect(out.resolutions).toEqual([{ entry: stale, status: 'stale' }])
  })

  it('goes stale when the points change so the group no longer ties', () => {
    const moved = makeInput([{ id: 'A', base: 80 }, { id: 'B', base: 76 }, { id: 'C', base: 75 }, { id: 'D', base: 70 }])
    const out = computeAll(moved, cfg, { resolutions: [wheel] })
    expect(ids(out.lists.maleStaying)).toEqual(['A', 'B', 'C', 'D'])
    expect(out.resolutions[0]?.status).toBe('stale')
  })

  it('goes stale when the headcounts move the boundary off the group', () => {
    // Green 3 and no grey: the only boundary is after position 3, so B and C (2-3) no longer straddle it.
    const out = computeAll(input, configWith({ maleGreen: 3, maleGrey: 0 }), { resolutions: [wheel] })
    expect(out.resolutions[0]?.status).toBe('stale')
  })

  it('is stale for a tie group that does not straddle a boundary', () => {
    const rows = makeInput([{ id: 'A', base: 80 }, { id: 'B', base: 60 }, { id: 'C', base: 60 }])
    const out = computeAll(rows, configWith({ maleGreen: 1, maleGrey: 0 }), {
      resolutions: [{ list: 'maleStaying', order: ['C', 'B'] }],
    })
    expect(out.resolutions[0]?.status).toBe('stale')
    expect(ids(out.lists.maleStaying)).toEqual(['A', 'B', 'C'])
  })

  it('is stale for the wrong list, or an order with a repeated matric', () => {
    const wrongList: WheelResolution = { list: 'femaleStaying', order: ['C', 'B'] }
    const repeated: WheelResolution = { list: 'maleStaying', order: ['C', 'B', 'B'] }
    const out = computeAll(input, cfg, { resolutions: [wrongList, repeated] })
    expect(out.resolutions.map((r) => r.status)).toEqual(['stale', 'stale'])
  })

  it('applies the later of two resolutions for the same group and reports the earlier as stale', () => {
    const first: WheelResolution = { list: 'maleStaying', order: ['B', 'C'] }
    const out = computeAll(input, cfg, { resolutions: [first, wheel] })
    expect(ids(out.lists.maleStaying)).toEqual(['A', 'C', 'B', 'D'])
    expect(out.resolutions.map((r) => r.status)).toEqual(['stale', 'applied'])
  })
})

describe('wheel resolutions on other lists', () => {
  it('settles a group on the female staying list', () => {
    const rows = makeInput([
      { id: 'F1', gender: 'F', base: 50 },
      { id: 'F2', gender: 'F', base: 50 },
      { id: 'F3', gender: 'F', base: 10 },
    ])
    const res: WheelResolution = { list: 'femaleStaying', order: ['F2', 'F1'] }
    const out = computeAll(rows, configWith({ femaleGreen: 1 }), { resolutions: [res] })
    expect(ids(out.lists.femaleStaying)).toEqual(['F2', 'F1', 'F3'])
    expect(out.lists.femaleStaying[0]?.status).toBe('green')
    expect(out.resolutions[0]?.status).toBe('applied')
  })

  it('settles a group on the sem-2 list and the merged bidding colours follow it', () => {
    const rows = makeInput([
      { id: 'S1', sem2: true, base: 50 },
      { id: 'S2', sem2: true, base: 50 },
      { id: 'S3', sem2: true, base: 10 },
    ])
    const res: WheelResolution = { list: 'sem2', order: ['S2', 'S1'] }
    const cfg2 = configWith({ sem2Green: 1, sem2Grey: 1 }, { sem2Mode: 'merged' })
    const out = computeAll(rows, cfg2, { resolutions: [res] })
    expect(ids(out.lists.sem2)).toEqual(['S2', 'S1', 'S3'])
    expect(out.lists.sem2.map((r) => r.status)).toEqual(['green', 'grey', 'white'])
    expect(out.lists.maleBidding.map((r) => [r.matric, r.status])).toEqual([
      ['S2', 'green'],
      ['S1', 'grey'],
      ['S3', 'white'],
    ])
  })

  it('orders a group straddling both boundaries by one resolution', () => {
    const rows = makeInput([{ id: 'A', base: 50 }, { id: 'B', base: 50 }, { id: 'C', base: 50 }])
    const res: WheelResolution = { list: 'maleStaying', order: ['C', 'A', 'B'] }
    const out = computeAll(rows, configWith({ maleGreen: 1, maleGrey: 1 }), { resolutions: [res] })
    expect(ids(out.lists.maleStaying)).toEqual(['C', 'A', 'B'])
    expect(out.lists.maleStaying.map((r) => r.status)).toEqual(['green', 'grey', 'white'])
    expect(out.lists.maleStaying[1]?.tieFlags.map((f) => f.resolved)).toEqual([true, true])
  })

  it('does not mutate frozen inputs', () => {
    expect(() =>
      computeAll(deepFreeze(makeInput(ROWS)), deepFreeze(cfg), { resolutions: deepFreeze([wheel]) }),
    ).not.toThrow()
  })
})
