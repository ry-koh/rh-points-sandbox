import { describe, expect, it } from 'vitest'
import { computeAll } from '../pipeline'
import type { ResidentResult } from '../types'
import { configWith, deepFreeze, makeInput, type RowSpec } from './helpers'

const cfg = configWith({})

function run(rows: readonly RowSpec[], config = cfg, options: Parameters<typeof computeAll>[2] = {}) {
  const out = computeAll(makeInput(rows), config, options)
  const of = (id: string): ResidentResult => {
    const found = out.results.find((r) => r.matric === id)
    if (!found) throw new Error(`no result for ${id}`)
    return found
  }
  return { out, of }
}

describe('E13: JCRC residents take their value from the highest other bidding (H = 346)', () => {
  const rows: RowSpec[] = [
    { id: 'P', base: 346 },
    { id: 'Q', base: 100, gender: 'F' },
    { id: 'JF', base: 5, jcrc: 'FULL' },
    { id: 'JE', gender: 'F', base: 5, jcrc: 'EXCHANGE' },
  ]
  const { of } = run(rows)

  it('FULL is H + 1 in both staying and bidding', () => {
    expect(of('JF').staying.points).toBe(347)
    expect(of('JF').bidding.points).toBe(347)
  })

  it('EXCHANGE is H x 0.75, fractional values kept', () => {
    expect(of('JE').staying.points).toBe(259.5)
    expect(of('JE').bidding.points).toBe(259.5)
  })

  it('leaves non-JCRC residents alone', () => {
    expect(of('P').staying.points).toBe(346)
    expect(of('Q').bidding.points).toBe(100)
  })

  it('uses the configured offset and factor', () => {
    const custom = run(rows, configWith({}, { jcrcFullYearOffset: 5, jcrcExchangeFactor: 0.5 }))
    expect(custom.of('JF').staying.points).toBe(351)
    expect(custom.of('JE').bidding.points).toBe(173)
  })
})

describe('JCRC edge cases', () => {
  it('H is 0 when there is no non-JCRC resident', () => {
    const { of } = run([
      { id: 'J1', jcrc: 'FULL' },
      { id: 'J2', jcrc: 'EXCHANGE' },
    ])
    expect(of('J1').staying.points).toBe(1)
    expect(of('J2').bidding.points).toBe(0)
  })

  it('ignores JCRC residents and sem-2 residents when taking H', () => {
    const { of } = run([
      { id: 'P', base: 50 },
      { id: 'S', sem2: true, base: 1000 },
      { id: 'J1', jcrc: 'FULL' },
      { id: 'J2', jcrc: 'FULL', gender: 'F' },
    ])
    expect(of('J1').bidding.points).toBe(51)
    expect(of('J2').bidding.points).toBe(51)
  })

  it('includes the other residents discretion in H, and the JCRC resident own discretion last', () => {
    const { of } = run(
      [
        { id: 'P', base: 346 },
        { id: 'J', jcrc: 'FULL' },
      ],
      cfg,
      {
        discretion: [
          { matric: 'P', stayingDelta: 0, biddingDelta: 10, reason: 'r' },
          { matric: 'J', stayingDelta: 2, biddingDelta: -1, reason: 'r' },
        ],
      },
    )
    expect(of('P').bidding.points).toBe(356)
    expect(of('J').bidding.points).toBe(356 + 1 - 1)
    expect(of('J').staying.points).toBe(356 + 1 + 2)
  })

  it('does not let a JCRC resident discretion raise H for another JCRC resident', () => {
    const { of } = run(
      [
        { id: 'P', base: 10 },
        { id: 'J1', jcrc: 'FULL' },
        { id: 'J2', jcrc: 'FULL' },
      ],
      cfg,
      { discretion: [{ matric: 'J1', stayingDelta: 100, biddingDelta: 100, reason: 'r' }] },
    )
    expect(of('J1').bidding.points).toBe(111)
    expect(of('J2').bidding.points).toBe(11)
  })

  it('ignores the JCRC resident own CCA data, AUX and IHG', () => {
    const { of } = run([
      { id: 'P', base: 20 },
      { id: 'J', jcrc: 'FULL', base: 99, incoming: 'head', aux: 0, extra: [['Y', 50]] },
    ])
    expect(of('J').staying.points).toBe(21)
    expect(of('J').bidding.points).toBe(21)
  })

  it('writes a breakdown that does not name the resident holding H', () => {
    const { of } = run([
      { id: 'HOLDER-OF-H', base: 30 },
      { id: 'J', jcrc: 'FULL' },
      { id: 'E', jcrc: 'EXCHANGE' },
    ])
    expect(of('J').jcrc?.note).toBe('JCRC (full year): highest other bidding H + 1')
    expect(of('E').jcrc?.note).toBe('JCRC (exchange): highest other bidding H × 0.75')
    expect(of('J').jcrc?.h).toBe(30)
    expect(JSON.stringify(of('J').jcrc)).not.toContain('HOLDER-OF-H')
  })

  it('ranks JCRC residents normally by their value in both lists', () => {
    const { out } = run([
      { id: 'P', base: 346 },
      { id: 'R', base: 100 },
      { id: 'J', jcrc: 'FULL' },
    ])
    expect(out.lists.maleStaying.map((r) => r.matric)).toEqual(['J', 'P', 'R'])
    expect(out.lists.maleBidding.map((r) => r.matric)).toEqual(['J', 'P', 'R'])
  })

  it('does not mutate frozen inputs', () => {
    const input = deepFreeze(makeInput([{ id: 'P', base: 10 }, { id: 'J', jcrc: 'FULL' }]))
    expect(() => computeAll(input, deepFreeze(cfg), deepFreeze({ discretion: [] }))).not.toThrow()
  })
})
