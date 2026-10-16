import { describe, expect, it } from 'vitest'
import { bandAt, bandBoundaries, rankDescending, spotBoundaries, straddleFlags } from '../ranking'
import { deepFreeze } from './helpers'

interface Item {
  readonly id: string
  readonly points: number
}

function rank(points: readonly number[]): ReturnType<typeof rankDescending<Item>> {
  const items = points.map((p, i) => ({ id: `R${i}`, points: p }))
  return rankDescending(items, (item) => item.points, (item) => item.id)
}

describe('rankDescending', () => {
  it('uses competition ranking: 1, 2, 2, 4', () => {
    const ranked = rank([80, 75, 75, 70])
    expect(ranked.map((r) => r.rank)).toEqual([1, 2, 2, 4])
    expect(ranked.map((r) => r.position)).toEqual([1, 2, 3, 4])
  })

  it('sorts descending regardless of input order', () => {
    expect(rank([70, 80, 75]).map((r) => r.item.points)).toEqual([80, 75, 70])
  })

  it('treats values equal at 6 decimal places as tied', () => {
    const ranked = rank([70.0000001, 70, 60])
    expect(ranked.map((r) => r.rank)).toEqual([1, 1, 3])
  })

  it('does not tie values that differ at 6 decimal places', () => {
    expect(rank([70.00001, 70]).map((r) => r.rank)).toEqual([1, 2])
  })

  it('records the first and last position of each tie group', () => {
    const ranked = rank([80, 75, 75, 70, 70, 70])
    expect(ranked.map((r) => [r.groupStart, r.groupEnd])).toEqual([
      [1, 1],
      [2, 3],
      [2, 3],
      [4, 6],
      [4, 6],
      [4, 6],
    ])
  })

  it('orders tied items by the tie key so output is deterministic', () => {
    const items = [
      { id: 'b', points: 5 },
      { id: 'a', points: 5 },
    ]
    const ranked = rankDescending(items, (i) => i.points, (i) => i.id)
    expect(ranked.map((r) => r.item.id)).toEqual(['a', 'b'])
  })

  it('handles an empty list and does not mutate the input', () => {
    expect(rank([])).toEqual([])
    const frozen = deepFreeze([{ id: 'a', points: 1 }])
    expect(() => rankDescending(frozen, (i) => i.points, (i) => i.id)).not.toThrow()
  })
})

describe('bandAt', () => {
  it('assigns green, grey and white by headcount', () => {
    const bands = [1, 2, 3, 4, 5].map((position) => bandAt(position, 2, 2))
    expect(bands).toEqual(['green', 'green', 'grey', 'grey', 'white'])
  })

  it('G = 0 means nobody is green', () => {
    expect([1, 2, 3].map((p) => bandAt(p, 0, 2))).toEqual(['grey', 'grey', 'white'])
  })

  it('H = 0 means nobody is grey', () => {
    expect([1, 2, 3].map((p) => bandAt(p, 2, 0))).toEqual(['green', 'green', 'white'])
  })

  it('G = 0 and H = 0 makes everybody white', () => {
    expect(bandAt(1, 0, 0)).toBe('white')
  })

  it('headcounts larger than the population keep everyone green', () => {
    expect([1, 2, 3].map((p) => bandAt(p, 10, 10))).toEqual(['green', 'green', 'green'])
  })
})

describe('bandBoundaries', () => {
  it('has a green/grey and a grey/white boundary', () => {
    expect(bandBoundaries(2, 2)).toEqual([
      { after: 2, label: 'green/grey' },
      { after: 4, label: 'grey/white' },
    ])
  })

  it('skips the green boundary when G = 0', () => {
    expect(bandBoundaries(0, 2)).toEqual([{ after: 2, label: 'grey/white' }])
  })

  it('joins green straight to white when H = 0', () => {
    expect(bandBoundaries(2, 0)).toEqual([{ after: 2, label: 'green/white' }])
  })

  it('has no boundary when G = 0 and H = 0', () => {
    expect(bandBoundaries(0, 0)).toEqual([])
  })

  it('has a single spot/no spot boundary for sem-2', () => {
    expect(spotBoundaries(3)).toEqual([{ after: 3, label: 'spot/no spot' }])
    expect(spotBoundaries(0)).toEqual([])
  })
})

describe('straddleFlags', () => {
  const boundaries = bandBoundaries(2, 2)

  it('flags a group straddling green/grey with k of n seats', () => {
    const [flag] = straddleFlags(2, 3, boundaries)
    expect(flag).toEqual({
      boundary: 'green/grey',
      k: 1,
      n: 2,
      text: 'TIE green/grey — 1 of 2 seats',
    })
  })

  it('flags a group straddling grey/white', () => {
    const [flag] = straddleFlags(4, 6, boundaries)
    expect(flag?.text).toBe('TIE grey/white — 1 of 3 seats')
  })

  it('a group straddling both boundaries carries both flags', () => {
    const flags = straddleFlags(1, 3, bandBoundaries(1, 1))
    expect(flags.map((f) => f.text)).toEqual([
      'TIE green/grey — 1 of 3 seats',
      'TIE grey/white — 2 of 3 seats',
    ])
  })

  it('does not flag a group that ends exactly at a boundary', () => {
    expect(straddleFlags(1, 2, boundaries)).toEqual([])
  })

  it('does not flag a group that starts right after a boundary', () => {
    expect(straddleFlags(3, 4, boundaries)).toEqual([])
  })

  it('does not flag a single resident', () => {
    expect(straddleFlags(2, 2, boundaries)).toEqual([])
  })

  it('does not flag when headcounts exceed the population', () => {
    expect(straddleFlags(1, 3, bandBoundaries(10, 10))).toEqual([])
  })

  it('flags the sem-2 spot boundary', () => {
    const [flag] = straddleFlags(2, 3, spotBoundaries(2))
    expect(flag?.text).toBe('TIE spot/no spot — 1 of 2 seats')
  })
})
