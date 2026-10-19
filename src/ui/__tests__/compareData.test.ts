import { describe, expect, it } from 'vitest'
import { DEFAULT_CONFIG } from '../../engine'
import { matricOf, scenario } from '../../import/__tests__/fixtures'
import { runSide } from '../compare/compareData'

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
