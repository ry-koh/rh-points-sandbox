import { describe, expect, it } from 'vitest'
import { DEFAULT_CONFIG } from '../../engine'
import { matricOf, scenario } from '../../import/__tests__/fixtures'
import { configDifferences, runSide } from '../compare/compareData'

const files = scenario()
const config = { ...DEFAULT_CONFIG, headcounts: { ...DEFAULT_CONFIG.headcounts, maleGreen: 2 } }

describe('compare runs with the current adjustments', () => {
  it('applies final-points overrides and discretion on a side', () => {
    const plain = runSide(files, config, {})
    const adjusted = runSide(files, config, {
      overrides: [{ matric: matricOf(1), ccaID: 'C1', finalPoints: 0, reason: 'test' }],
      discretion: [{ matric: matricOf(2), stayingDelta: 100, biddingDelta: 100, reason: 'test' }],
    })
    if (!plain.ok || !adjusted.ok) throw new Error('expected both sides to run')
    const of = (run: typeof plain.run, m: string) => run.results.find((r) => r.matric === m)
    expect(of(adjusted.run, matricOf(2))?.bidding.points).toBe((of(plain.run, matricOf(2))?.bidding.points ?? 0) + 100)
    expect(of(adjusted.run, matricOf(1))?.bidding.points).toBeLessThan(of(plain.run, matricOf(1))?.bidding.points ?? 0)
    expect(adjusted.run.overrides.map((o) => o.status)).toEqual(['applied'])
  })

  it('applies wheel resolutions on a side', () => {
    const side = runSide(files, config, { resolutions: [{ list: 'maleStaying', order: ['x', 'y'] }] })
    if (!side.ok) throw new Error('expected the side to run')
    expect(side.run.resolutions.map((r) => r.status)).toEqual(['stale'])
  })
})

describe('configDifferences: levels (R51)', () => {
  const withLevels = (levels: typeof DEFAULT_CONFIG.levels) => ({ ...DEFAULT_CONFIG, levels })
  const base = DEFAULT_CONFIG.levels

  it('names each level number that changed, one row each', () => {
    const b = withLevels(base.map((l) =>
      l.name === 'Low Gold' ? { ...l, bonus: 5 } : l.name === 'High Gold' ? { ...l, multiplier: 2.1 } : l,
    ))
    expect(configDifferences(DEFAULT_CONFIG, b)).toEqual([
      { key: 'levels: Low Gold bonus', a: '4', b: '5' },
      { key: 'levels: High Gold multiplier', a: '2', b: '2.1' },
    ])
  })

  it('names a level added or removed', () => {
    const b = withLevels([...base.filter((l) => l.name !== 'Unsatisfactory'), { name: 'Platinum', bonus: 6, multiplier: 2.5 }])
    expect(configDifferences(DEFAULT_CONFIG, b)).toEqual([
      { key: 'levels: Unsatisfactory', a: 'bonus 0, ×0.8', b: 'removed' },
      { key: 'levels: Platinum', a: 'not a level', b: 'added (bonus 6, ×2.5)' },
    ])
  })

  it('says "levels changed" with both name lists when only the order differs', () => {
    const b = withLevels([...base].reverse())
    const [diff] = configDifferences(DEFAULT_CONFIG, b)
    expect(diff).toMatchObject({ key: 'levels changed', a: base.map((l) => l.name).join(', ') })
  })

  it('keeps the other settings as one row per key', () => {
    expect(configDifferences(DEFAULT_CONFIG, { ...DEFAULT_CONFIG, sem2Factor: 3 })).toEqual([{ key: 'sem2Factor', a: '2', b: '3' }])
  })
})
