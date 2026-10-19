import { describe, expect, it } from 'vitest'
import { buildLists } from '../lists'
import { applyPenalty, createPenaltyState } from '../penalty'
import { computeAll } from '../pipeline'
import type { ListRow, Lists } from '../types'
import { configWith, deepFreeze, makeInput, type RowSpec } from './helpers'

const SEM2_LABEL = 'sem-2'

function lists(rows: readonly RowSpec[], cfg = configWith({})): Lists {
  return computeAll(makeInput(rows), cfg).lists
}

const ids = (rows: readonly ListRow[]): string[] => rows.map((r) => r.matric)

describe('E10: ties on the male staying list', () => {
  const rows = [80, 75, 75, 70, 70, 70].map((base, i) => ({ id: `M${i + 1}`, base }))
  const { maleStaying } = lists(rows, configWith({ maleGreen: 2, maleGrey: 2 }))

  it('ranks 1, 2, 2, 4, 4, 4', () => {
    expect(maleStaying.map((r) => r.rank)).toEqual([1, 2, 2, 4, 4, 4])
    expect(maleStaying.map((r) => r.position)).toEqual([1, 2, 3, 4, 5, 6])
  })

  it('bands by headcount', () => {
    expect(maleStaying.map((r) => r.status)).toEqual([
      'green', 'green', 'grey', 'grey', 'white', 'white',
    ])
  })

  it('flags "TIE green/grey 1 of 2 seats" on the 75s', () => {
    expect(maleStaying[0]?.tieFlags).toEqual([])
    expect(maleStaying[1]?.tieFlags.map((f) => f.text)).toEqual(['TIE green/grey — 1 of 2 seats'])
    expect(maleStaying[2]?.tieFlags.map((f) => f.text)).toEqual(['TIE green/grey — 1 of 2 seats'])
  })

  it('flags "TIE grey/white 1 of 3 seats" on the 70s', () => {
    for (const row of maleStaying.slice(3)) {
      expect(row.tieFlags.map((f) => f.text)).toEqual(['TIE grey/white — 1 of 3 seats'])
    }
  })
})

describe('splitting by gender and sem-2', () => {
  const rows: RowSpec[] = [
    { id: 'M1', gender: 'M', base: 10 },
    { id: 'M2', gender: 'M', base: 12 },
    { id: 'F1', gender: 'F', base: 11 },
    { id: 'S1', gender: 'M', sem2: true, base: 15 },
    { id: 'S2', gender: 'F', sem2: true, base: 9 },
  ]
  const result = lists(rows, configWith({ maleGreen: 1, femaleGreen: 1, sem2Green: 1 }))

  it('puts each gender on its own staying list, best first', () => {
    expect(ids(result.maleStaying)).toEqual(['M2', 'M1'])
    expect(ids(result.femaleStaying)).toEqual(['F1'])
  })

  it('keeps sem-2 residents off the staying lists and (separate mode) the bidding lists', () => {
    expect(ids(result.maleBidding)).toEqual(['M2', 'M1'])
    expect(ids(result.femaleBidding)).toEqual(['F1'])
  })

  it('ranks sem-2 residents of both genders together by bidding points, as a staying list', () => {
    expect(ids(result.sem2)).toEqual(['S1', 'S2'])
    expect(result.sem2.map((r) => r.status)).toEqual(['green', 'white'])
  })

  it('uses the female headcounts for the female list', () => {
    expect(result.femaleStaying[0]?.status).toBe('green')
    expect(result.maleStaying.map((r) => r.status)).toEqual(['green', 'white'])
  })
})

describe('residents with no CCAs', () => {
  it('are still listed with AUX points only', () => {
    const result = lists([{ id: 'M1', base: 10 }, { id: 'M2', aux: 7 }])
    const row = result.maleStaying.find((r) => r.matric === 'M2')
    expect(row?.points).toBe(4)
    expect(result.maleBidding.find((r) => r.matric === 'M2')?.points).toBe(4)
  })
})

describe('bidding lists', () => {
  const rows = [80, 75, 75, 70].map((base, i) => ({ id: `M${i + 1}`, base }))
  const { maleBidding } = lists(rows, configWith({ maleGreen: 1, maleGrey: 2 }))

  it('are sorted by bidding points with competition ranking', () => {
    expect(maleBidding.map((r) => r.rank)).toEqual([1, 2, 2, 4])
  })

  it('show the staying status and tie flags for information', () => {
    expect(maleBidding.map((r) => r.status)).toEqual(['green', 'grey', 'grey', 'white'])
    expect(maleBidding[1]?.tieFlags).toEqual([])
  })

  it('carry a reference to the resident breakdown', () => {
    expect(maleBidding[0]?.result.matric).toBe('M1')
    expect(maleBidding[0]?.result.bidding.points).toBe(80)
  })
})

describe('E14: colour-first bidding order', () => {
  // Staying = base; bidding = base, doubled for the outgoing heads C and E.
  const rows: RowSpec[] = [
    { id: 'A', base: 90 },
    { id: 'B', base: 80 },
    { id: 'C', base: 70, outgoing: 'head' },
    { id: 'D', base: 60 },
    { id: 'E', base: 50, outgoing: 'head' },
    { id: 'F', base: 40 },
  ]
  const input = makeInput(rows, { multiplierOverride: 2 })
  const cfg = configWith({ maleGreen: 2, maleGrey: 2 })
  const { maleStaying, maleBidding } = computeAll(input, cfg).lists

  it('has the staying order and bands of the example', () => {
    expect(ids(maleStaying)).toEqual(['A', 'B', 'C', 'D', 'E', 'F'])
    expect(maleStaying.map((r) => r.status)).toEqual(['green', 'green', 'grey', 'grey', 'white', 'white'])
  })

  it('lists green, then grey, then white, each by bidding points', () => {
    expect(ids(maleBidding)).toEqual(['A', 'B', 'C', 'D', 'E', 'F'])
    expect(maleBidding.map((r) => r.points)).toEqual([90, 80, 140, 60, 100, 40])
    expect(maleBidding.map((r) => r.status)).toEqual(['green', 'green', 'grey', 'grey', 'white', 'white'])
  })

  it('is not the order of a pure bidding-points sort', () => {
    const pure = [...maleBidding].sort((x, y) => y.points - x.points).map((r) => r.matric)
    expect(pure).toEqual(['C', 'E', 'A', 'B', 'D', 'F'])
    expect(ids(maleBidding)).not.toEqual(pure)
  })

  it('numbers positions 1..N and continues the rank across colours', () => {
    expect(maleBidding.map((r) => r.position)).toEqual([1, 2, 3, 4, 5, 6])
    expect(maleBidding.map((r) => r.rank)).toEqual([1, 2, 3, 4, 5, 6])
  })
})

describe('order inside a tie: name, then matric', () => {
  const rows: RowSpec[] = [
    { id: 'M9', name: 'Zed', base: 10 },
    { id: 'M3', name: 'Amy', base: 10 },
    { id: 'M1', name: 'Amy', base: 10 },
    { id: 'M5', name: 'Bob', base: 10 },
  ]
  const result = lists(rows)

  it('orders equal points by name then matric, with contiguous positions and a shared rank', () => {
    expect(ids(result.maleStaying)).toEqual(['M1', 'M3', 'M5', 'M9'])
    expect(result.maleStaying.map((r) => r.position)).toEqual([1, 2, 3, 4])
    expect(result.maleStaying.map((r) => r.rank)).toEqual([1, 1, 1, 1])
  })
})

describe('E15: sem-2 staying list with green and grey headcounts 3/3', () => {
  const rows: RowSpec[] = [100, 90, 80, 70, 60, 50, 40, 30].map((base, i) => ({
    id: `S${i + 1}`,
    gender: i === 1 ? 'M' : 'F',
    sem2: true,
    base,
  }))
  const { sem2 } = lists(rows, configWith({ sem2Green: 3, sem2Grey: 3 }))

  it('is green, grey, white by position, both genders together', () => {
    expect(sem2.map((r) => r.status)).toEqual([
      'green', 'green', 'green', 'grey', 'grey', 'grey', 'white', 'white',
    ])
    expect(ids(sem2)).toEqual(['S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7', 'S8'])
  })

  it('flags a tie group straddling green/grey and grey/white like a gender list', () => {
    const tied = lists(
      [100, 80, 80, 80, 60, 60, 60, 10].map((base, i) => ({ id: `S${i + 1}`, sem2: true, base })),
      configWith({ sem2Green: 2, sem2Grey: 3 }),
    ).sem2
    expect(tied[1]?.tieFlags.map((f) => f.text)).toEqual(['TIE green/grey — 1 of 3 seats'])
    expect(tied[5]?.tieFlags.map((f) => f.text)).toEqual(['TIE grey/white — 1 of 3 seats'])
    expect(tied[0]?.tieFlags).toEqual([])
  })
})

describe('E12: sem-2 merged mode inserts every sem-2 resident inside their colour band', () => {
  const rows: RowSpec[] = [
    { id: 'N1', gender: 'M', base: 80 },
    { id: 'N2', gender: 'M', base: 10 },
    { id: 'SP', gender: 'M', sem2: true, base: 40 },
    { id: 'SN', gender: 'M', sem2: true, base: 30 },
    { id: 'SF', gender: 'F', sem2: true, base: 50 },
  ]
  // Sem-2 list: SF 50 green, SP 40 grey, SN 30 white. Male staying: N1 green, N2 white.
  const cfg = configWith({ maleGreen: 1, sem2Green: 1, sem2Grey: 1 }, { sem2Mode: 'merged' })
  const result = lists(rows, cfg)
  const row = (id: string): ListRow | undefined => result.maleBidding.find((r) => r.matric === id)

  it('inserts at bidding x sem2Factor, labelled "sem-2", with the sem-2 colour', () => {
    expect(row('SP')?.points).toBe(80)
    expect(row('SP')?.labels).toContain(SEM2_LABEL)
    expect(row('SP')?.status).toBe('grey')
    expect(row('SN')?.points).toBe(60)
    expect(row('SN')?.status).toBe('white')
  })

  it('orders colour first: green, grey, white', () => {
    expect(ids(result.maleBidding)).toEqual(['N1', 'SP', 'SN', 'N2'])
  })

  it('adds sem-2 residents only to their own gender list', () => {
    expect(ids(result.femaleBidding)).toEqual(['SF'])
    expect(result.femaleBidding[0]?.points).toBe(100)
    expect(result.femaleBidding[0]?.status).toBe('green')
  })

  it('still produces the sem-2 list and keeps sem-2 off the staying lists', () => {
    expect(ids(result.sem2)).toEqual(['SF', 'SP', 'SN'])
    expect(ids(result.maleStaying)).toEqual(['N1', 'N2'])
  })

  it('applies the factor to the final bidding, discretion included', () => {
    const out = computeAll(makeInput(rows), cfg, {
      discretion: [{ matric: 'SP', stayingDelta: 0, biddingDelta: 5, reason: 'test' }],
    }).lists
    expect(out.maleBidding.find((r) => r.matric === 'SP')?.points).toBe(90)
  })
})

describe('removed residents come last on the bidding list', () => {
  it('puts a removed resident after the white band', () => {
    const rows: RowSpec[] = [
      { id: 'M1', base: 20, incoming: 'head' },
      { id: 'M2', base: 15, incoming: 'head' },
      { id: 'M3', base: 10 },
    ]
    const input = makeInput(rows)
    const cfg = configWith({ maleGreen: 2, maleGrey: 0 })
    const initial = createPenaltyState(computeAll(input, cfg).lists)
    const penalised = applyPenalty(input, cfg, initial, { matric: 'M2', ccaID: 'X' })
    if (!penalised.ok) throw new Error(penalised.error)
    const out = computeAll(input, cfg, { penaltyState: penalised.state }).lists
    expect(ids(out.maleBidding).at(-1)).toBe('M2')
    expect(out.maleBidding.at(-1)?.status).toBe('removed')
  })
})

describe('buildLists directly', () => {
  it('does not mutate frozen inputs', () => {
    const input = makeInput([{ id: 'M1', base: 10 }])
    const { results } = computeAll(input, configWith({}))
    expect(() =>
      buildLists(deepFreeze([...results]), deepFreeze([...input.residents]), configWith({})),
    ).not.toThrow()
  })
})
