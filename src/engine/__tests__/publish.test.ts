import { describe, expect, it } from 'vitest'
import { applyPenalty, createPenaltyState } from '../penalty'
import { computeAll } from '../pipeline'
import { buildPublishedLists } from '../publish'
import type { WheelResolution } from '../types'
import { configWith, deepFreeze, makeInput, type RowSpec } from './helpers'

function published(rows: readonly RowSpec[], config = configWith({}), options: Parameters<typeof computeAll>[2] = {}) {
  const { lists } = computeAll(makeInput(rows), config, options)
  return { lists, result: buildPublishedLists(lists, options?.resolutions) }
}

describe('E17: rounding is half away from zero, display only', () => {
  const rows: RowSpec[] = [
    { id: 'A', base: 112.4999 },
    { id: 'B', base: 12.5 },
    { id: 'C', base: -12.5 },
  ]
  const { lists, result } = published(rows, configWith({ maleGreen: 3 }))

  it('rounds 112.4999 to 112, 12.5 to 13 and -12.5 to -13', () => {
    if (!result.ok) throw new Error('expected ok')
    expect(result.lists.maleStaying.rows.map((r) => r.points)).toEqual([112, 13, -13])
  })

  it('rounds 0.5 up and 2.4999 down', () => {
    const r = published([{ id: 'A', base: 2.4999 }, { id: 'B', base: 0.5 }], configWith({ maleGreen: 2 })).result
    if (!r.ok) throw new Error('expected ok')
    expect(r.lists.maleStaying.rows.map((x) => x.points)).toEqual([2, 1])
  })

  it('sorts by the exact points, not the rounded ones', () => {
    const r = published([{ id: 'A', base: 12.4999 }, { id: 'B', base: 12.5 }], configWith({ maleGreen: 2 })).result
    if (!r.ok) throw new Error('expected ok')
    expect(r.lists.maleStaying.rows.map((x) => x.name)).toEqual(['B', 'A'])
    expect(r.lists.maleStaying.rows.map((x) => x.points)).toEqual([13, 12])
  })

  it('leaves the underlying lists exact', () => {
    expect(lists.maleStaying.map((r) => r.points)).toEqual([112.4999, 12.5, -12.5])
  })
})

describe('shape of the published lists', () => {
  const rows: RowSpec[] = [
    { id: 'A9900001Z', name: 'Ann', base: 30 },
    { id: 'A9900002Z', name: 'Ben', base: 20, gender: 'F' },
    { id: 'A9900003Z', name: 'Cat', base: 10, sem2: true },
  ]
  const { result } = published(rows, configWith({ maleGreen: 1, femaleGreen: 1, sem2Green: 1 }))

  it('has the five lists with the right points headers', () => {
    if (!result.ok) throw new Error('expected ok')
    expect(Object.keys(result.lists).sort()).toEqual([
      'femaleBidding', 'femaleStaying', 'maleBidding', 'maleStaying', 'sem2Staying',
    ])
    expect(result.lists.maleStaying.pointsLabel).toBe('Staying Points')
    expect(result.lists.femaleStaying.pointsLabel).toBe('Staying Points')
    expect(result.lists.maleBidding.pointsLabel).toBe('Bidding Points')
    expect(result.lists.femaleBidding.pointsLabel).toBe('Bidding Points')
    expect(result.lists.sem2Staying.pointsLabel).toBe('Hall Points')
  })

  it('has rows {no, name, points, band} and nothing else', () => {
    if (!result.ok) throw new Error('expected ok')
    expect(result.lists.maleStaying.rows).toEqual([{ no: 1, name: 'Ann', points: 30, band: 'green' }])
    expect(result.lists.sem2Staying.rows).toEqual([{ no: 1, name: 'Cat', points: 10, band: 'green' }])
  })

  it('never contains a matric', () => {
    expect(JSON.stringify(result)).not.toMatch(/A99000/)
  })
})

describe('numbering and exclusions', () => {
  it('numbers rows 1..N in list order, bidding rows keep their colour first order', () => {
    const rows: RowSpec[] = [
      { id: 'A', base: 90 },
      { id: 'B', base: 80 },
      { id: 'C', base: 70, outgoing: 'head' },
      { id: 'D', base: 60 },
    ]
    const cfg = configWith({ maleGreen: 2, maleGrey: 1 }, { outgoingMode: 'manual' })
    const { lists } = computeAll(makeInput(rows, { outgoingMultiplier: 2 }), cfg)
    const result = buildPublishedLists(lists)
    if (!result.ok) throw new Error('expected ok')
    expect(result.lists.maleBidding.rows.map((r) => r.no)).toEqual([1, 2, 3, 4])
    expect(result.lists.maleBidding.rows.map((r) => [r.name, r.band])).toEqual([
      ['A', 'green'], ['B', 'green'], ['C', 'grey'], ['D', 'white'],
    ])
  })

  it('excludes removed residents', () => {
    const rows: RowSpec[] = [
      { id: 'M1', base: 20, incoming: 'head' },
      { id: 'M2', base: 15, incoming: 'head' },
      { id: 'M3', base: 10 },
    ]
    const input = makeInput(rows)
    const cfg = configWith({ maleGreen: 2 })
    const initial = createPenaltyState(computeAll(input, cfg).lists)
    const applied = applyPenalty(input, cfg, initial, { matric: 'M2', ccaID: 'X' })
    if (!applied.ok) throw new Error(applied.error)
    const { lists } = computeAll(input, cfg, { penaltyState: applied.state })
    const result = buildPublishedLists(lists)
    if (!result.ok) throw new Error('expected ok')
    expect(result.lists.maleStaying.rows.map((r) => r.name)).toEqual(['M1', 'M3'])
    expect(result.lists.maleBidding.rows.map((r) => r.name)).toEqual(['M1', 'M3'])
  })

  it('does not mutate frozen lists', () => {
    const { lists } = computeAll(makeInput([{ id: 'M1', base: 1 }]), configWith({}))
    expect(() => buildPublishedLists(deepFreeze(lists))).not.toThrow()
  })
})

describe('blocking while a boundary tie is unresolved', () => {
  const rows: RowSpec[] = [
    { id: 'A', base: 80 },
    { id: 'B', base: 75 },
    { id: 'C', base: 75 },
    { id: 'D', base: 70 },
  ]
  const cfg = configWith({ maleGreen: 2, maleGrey: 2 })

  it('returns ok:false with each unresolved group once', () => {
    const { result } = published(rows, cfg)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.unresolved).toEqual([
      { list: 'maleStaying', boundary: 'green/grey', names: ['B', 'C'] },
    ])
  })

  it('is ok once the wheel resolved the group', () => {
    const res: WheelResolution = { list: 'maleStaying', order: ['C', 'B'] }
    const { result } = published(rows, cfg, { resolutions: [res] })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.lists.maleStaying.rows.map((r) => r.name)).toEqual(['A', 'C', 'B', 'D'])
  })

  it('blocks on an unresolved sem-2 tie too', () => {
    const { result } = published(
      [{ id: 'S1', sem2: true, base: 5 }, { id: 'S2', sem2: true, base: 5 }],
      configWith({ sem2Green: 1 }),
    )
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.unresolved.map((u) => u.list)).toEqual(['sem2'])
  })

  it('does not block on a tie that does not straddle a boundary', () => {
    const { result } = published([{ id: 'A', base: 5 }, { id: 'B', base: 5 }], configWith({ maleGreen: 2 }))
    expect(result.ok).toBe(true)
  })
})
