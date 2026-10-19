import { describe, expect, it } from 'vitest'
import { DEFAULT_CONFIG } from '../defaults'
import { hasOldLevelKeys, migrateConfig } from '../migrateConfig'
import { deepFreeze } from './helpers'
import { oldLevelConfig as oldConfig } from './migrateConfigFixtures'

type Rec = Record<string, unknown>

function migrated(raw: Rec): Rec {
  return migrateConfig(deepFreeze(raw)) as Rec
}

describe('DEFAULT_CONFIG.levels', () => {
  it('is the D22 table in that order', () => {
    expect(DEFAULT_CONFIG.levels).toEqual([
      { name: 'Unsatisfactory', bonus: 0, multiplier: 0.8 },
      { name: 'Pass', bonus: 0, multiplier: 1.0 },
      { name: 'Low Bronze', bonus: 0.5, multiplier: 1.05 },
      { name: 'High Bronze', bonus: 0.5, multiplier: 1.15 },
      { name: 'Low Silver', bonus: 1.5, multiplier: 1.25 },
      { name: 'High Silver', bonus: 1.5, multiplier: 1.5 },
      { name: 'Low Gold', bonus: 4, multiplier: 1.75 },
      { name: 'High Gold', bonus: 4, multiplier: 2.0 },
    ])
  })
})

describe('migrateConfig: levels (R43)', () => {
  it('turns the default old config into exactly the default levels', () => {
    expect(migrated(oldConfig()).levels).toEqual(DEFAULT_CONFIG.levels)
  })

  it('takes each level bonus from the old placement bonus of its metal word', () => {
    const levels = migrated(oldConfig({ placementBonus: { pass: 0, bronze: 0.5, silver: 1.5, gold: 5 } }))
      .levels as { name: string; bonus: number }[]
    expect(levels.find((l) => l.name === 'Low Gold')?.bonus).toBe(5)
    expect(levels.find((l) => l.name === 'High Gold')?.bonus).toBe(5)
    expect(levels.find((l) => l.name === 'High Silver')?.bonus).toBe(1.5)
  })

  it('gives a tier without a metal word the pass bonus', () => {
    const tiers = [
      { name: 'Tier A', multiplier: 1.3 },
      { name: 'Tier B', multiplier: 1.6 },
    ]
    expect(migrated(oldConfig({ outgoingTiers: tiers })).levels).toEqual([
      { name: 'Tier A', bonus: 0, multiplier: 1.3 },
      { name: 'Tier B', bonus: 0, multiplier: 1.6 },
    ])
  })

  it('matches the metal word case-insensitively', () => {
    const tiers = [{ name: 'GOLD plus', multiplier: 2.2 }]
    expect(migrated(oldConfig({ outgoingTiers: tiers })).levels).toEqual([
      { name: 'GOLD plus', bonus: 4, multiplier: 2.2 },
    ])
  })

  it('drops placementBonus, outgoingMode and outgoingTiers', () => {
    const result = migrated(oldConfig())
    expect('placementBonus' in result).toBe(false)
    expect('outgoingMode' in result).toBe(false)
    expect('outgoingTiers' in result).toBe(false)
  })

  it('leaves a config that already has levels untouched', () => {
    const levels = [{ name: 'Only', bonus: 2, multiplier: 1.1 }]
    const raw = { ...DEFAULT_CONFIG, levels }
    expect(migrated(raw)).toEqual(raw)
  })

  it('uses the default levels when there are neither levels nor tiers', () => {
    const { outgoingTiers: _tiers, outgoingMode: _mode, placementBonus: _bonus, ...neither } = oldConfig()
    expect(migrated(neither).levels).toEqual(DEFAULT_CONFIG.levels)
  })

  it('reports whether the levels are built from the old keys', () => {
    expect(hasOldLevelKeys(oldConfig())).toBe(true)
    expect(hasOldLevelKeys({ sem2Factor: 3 })).toBe(false)
    expect(hasOldLevelKeys({ ...oldConfig(), levels: DEFAULT_CONFIG.levels })).toBe(false)
    expect(hasOldLevelKeys(null)).toBe(false)
  })

  it('still takes bonuses from placementBonus when there are no tiers', () => {
    const { outgoingTiers: _tiers, ...noTiers } = oldConfig({ placementBonus: { pass: 1, bronze: 2, silver: 3, gold: 6 } })
    const levels = migrated(noTiers).levels as { name: string; bonus: number }[]
    expect(levels.map((l) => l.bonus)).toEqual([1, 1, 2, 2, 3, 3, 6, 6])
  })

  it('never mutates its input', () => {
    const raw = deepFreeze(oldConfig())
    expect(() => migrateConfig(raw)).not.toThrow()
    expect('outgoingTiers' in raw).toBe(true)
  })

  it('returns anything that is not a config unchanged', () => {
    expect(migrateConfig(null)).toBeNull()
    expect(migrateConfig([1])).toEqual([1])
  })
})
