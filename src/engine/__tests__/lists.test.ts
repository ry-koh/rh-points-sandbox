import { describe, expect, it } from 'vitest'
import { buildLists } from '../lists'
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
  const result = lists(rows, configWith({ maleGreen: 1, femaleGreen: 1, sem2Spots: 1 }))

  it('puts each gender on its own staying list, best first', () => {
    expect(ids(result.maleStaying)).toEqual(['M2', 'M1'])
    expect(ids(result.femaleStaying)).toEqual(['F1'])
  })

  it('keeps sem-2 residents off the staying lists and (separate mode) the bidding lists', () => {
    expect(ids(result.maleBidding)).toEqual(['M2', 'M1'])
    expect(ids(result.femaleBidding)).toEqual(['F1'])
  })

  it('ranks sem-2 residents of both genders together by bidding points', () => {
    expect(ids(result.sem2)).toEqual(['S1', 'S2'])
    expect(result.sem2.map((r) => r.status)).toEqual(['spot', 'no spot'])
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

describe('sem-2 list', () => {
  const rows: RowSpec[] = [
    { id: 'S1', gender: 'M', sem2: true, base: 14 },
    { id: 'S2', gender: 'F', sem2: true, base: 12 },
    { id: 'S3', gender: 'M', sem2: true, base: 12 },
    { id: 'S4', gender: 'F', sem2: true, base: 5 },
  ]
  const { sem2 } = lists(rows, configWith({ sem2Spots: 2 }))

  it('shares the spots across both genders by position', () => {
    expect(sem2.map((r) => r.status)).toEqual(['spot', 'spot', 'no spot', 'no spot'])
  })

  it('flags a tie group straddling the spot boundary', () => {
    expect(sem2.map((r) => r.rank)).toEqual([1, 2, 2, 4])
    expect(sem2[1]?.tieFlags.map((f) => f.text)).toEqual(['TIE spot/no spot — 1 of 2 seats'])
    expect(sem2[2]?.tieFlags.map((f) => f.text)).toEqual(['TIE spot/no spot — 1 of 2 seats'])
  })

  it('with zero spots nobody has a spot', () => {
    const none = lists(rows, configWith({ sem2Spots: 0 })).sem2
    expect(none.every((r) => r.status === 'no spot')).toBe(true)
  })
})

describe('E12: sem-2 merged mode', () => {
  const rows: RowSpec[] = [
    { id: 'N1', gender: 'M', base: 80 },
    { id: 'N2', gender: 'M', base: 10 },
    { id: 'SP', gender: 'M', sem2: true, base: 40 },
    { id: 'SN', gender: 'M', sem2: true, base: 30 },
    { id: 'SF', gender: 'F', sem2: true, base: 50 },
  ]
  const cfg = configWith({ sem2Spots: 2 }, { sem2Mode: 'merged' })
  const result = lists(rows, cfg)
  const row = (id: string): ListRow | undefined => result.maleBidding.find((r) => r.matric === id)

  it('inserts spot-holders at bidding x sem2Factor, labelled "sem-2"', () => {
    expect(row('SP')?.points).toBe(80)
    expect(row('SP')?.labels).toContain(SEM2_LABEL)
    expect(row('SP')?.status).toBeNull()
  })

  it('does not insert sem-2 residents without a spot', () => {
    expect(row('SN')).toBeUndefined()
  })

  it('adds spot-holders only to their own gender list', () => {
    expect(ids(result.femaleBidding)).toEqual(['SF'])
    expect(result.femaleBidding[0]?.points).toBe(100)
  })

  it('shares a rank with a normal resident on the same points', () => {
    expect(row('N1')?.rank).toBe(1)
    expect(row('SP')?.rank).toBe(1)
    expect(row('N2')?.rank).toBe(3)
  })

  it('still produces the sem-2 list and keeps sem-2 off the staying lists', () => {
    expect(ids(result.sem2)).toEqual(['SF', 'SP', 'SN'])
    expect(ids(result.maleStaying)).toEqual(['N1', 'N2'])
  })
})

describe('merged sem-2 mode with a tie group straddling the spot boundary', () => {
  const rows: RowSpec[] = [
    { id: 'S1', gender: 'M', sem2: true, base: 40 },
    { id: 'S2', gender: 'M', sem2: true, base: 30 },
    { id: 'S3', gender: 'M', sem2: true, base: 30 },
    { id: 'S4', gender: 'M', sem2: true, base: 10 },
  ]
  const { maleBidding, sem2 } = lists(rows, configWith({ sem2Spots: 2 }, { sem2Mode: 'merged' }))

  it('inserts every member of the straddling tie group, with its flag', () => {
    expect(ids(maleBidding).sort()).toEqual(['S1', 'S2', 'S3'])
    const tied = maleBidding.filter((r) => r.matric !== 'S1')
    for (const row of tied) {
      expect(row.tieFlags.map((f) => f.text)).toEqual(['TIE spot/no spot — 1 of 2 seats'])
      expect(row.labels).toContain(SEM2_LABEL)
    }
  })

  it('keeps the sem-2 list statuses position-based', () => {
    expect(sem2.map((r) => r.status)).toEqual(['spot', 'spot', 'no spot', 'no spot'])
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
