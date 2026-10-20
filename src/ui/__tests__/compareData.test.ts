import { describe, expect, it } from 'vitest'
import { DEFAULT_CONFIG, compareRuns } from '../../engine'
import { matricOf, scenario } from '../../import/__tests__/fixtures'
import { buildComparisonCsv, configDifferences, runSide } from '../compare/compareData'
import { entryCounts } from '../export/exportCsv'

const files = scenario()
const config = { ...DEFAULT_CONFIG, headcounts: { ...DEFAULT_CONFIG.headcounts, maleGreen: 2 } }

describe('the comparison CSV carries the review, levels and tweaks lines', () => {
  it('after the entry lines, with the workspace levels and no resident in a header line', () => {
    const side = runSide(files, config, {})
    if (!side.ok) throw new Error('expected the side to run')
    const perCca = [
      { ccaID: 'C1', name: 'Test CCA One', fileName: 'a.csv', status: 'ok' as const, level: 'High Gold', bonusOverride: null, multiplierOverride: 1.31 },
      { ccaID: 'C2', name: 'Test CCA Two', fileName: 'b.csv', status: 'ok' as const, level: null, bonusOverride: null, multiplierOverride: null },
    ]
    const levels = [{ name: 'High Gold', bonus: 4, multiplier: 1.3 }]
    const counts = { ...entryCounts(null), reviewEdits: 3, tickEdits: 1, membershipEdits: 2, ihgOverCap: ['Test CCA One (C1)'] }
    const csv = buildComparisonCsv(compareRuns(side.run, side.run), [], { a: 'A', b: 'B' }, counts, { perCca, levels })
    const header = csv.split('\n').filter((line) => line.startsWith('#'))
    expect(header.slice(3)).toEqual([
      '# review edits: 3',
      '# IHG tick edits: 1',
      '# flat value edits: 0',
      '# AUX edits: 0',
      '# role/semester edits: 2',
      '# IHG over cap: Test CCA One (C1)',
      '# levels: High Gold: C1; not set: C2',
      '# level tweaks: Test CCA One (C1): High Gold, multiplier 1.31 (level 1.3)',
      '# A: A · B: B',
    ])
    expect(header.join('\n')).not.toMatch(/A99\d{5}Z/)
  })
})

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
