import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { DEFAULT_CONFIG, type ScenarioConfig } from '../../engine'
import { OLD_LEVEL_KEYS, goldBonus, oldLevelConfig, tiers } from '../../engine/__tests__/migrateConfigFixtures'
import { readConfig } from '../state/configShape'
import { parseScenarioFile, readScenarioList, serialiseScenario, type Scenario } from '../state/scenarios'
import { SCENARIOS_KEY, loadScenarios, saveScenarios, type SettingsStore } from '../state/settingsStorage'

const MATRIC = /^A\d{7}[A-Z]$/

const config: ScenarioConfig = {
  ...DEFAULT_CONFIG,
  stackingMode: 'additive',
  headcounts: { ...DEFAULT_CONFIG.headcounts, maleGreen: 40, femaleGreen: 42 },
}
const scenario: Scenario = { id: 'id-1', name: 'More greens', note: 'JCRC draft', savedAt: '2027-04-01T09:00:00.000Z', config }

function strings(value: unknown): string[] {
  if (typeof value === 'string') return [value]
  if (Array.isArray(value)) return value.flatMap(strings)
  if (value && typeof value === 'object') return [...Object.keys(value), ...Object.values(value).flatMap(strings)]
  return []
}

function sampleNames(): string[] {
  const [, ...lines] = readFileSync('samples/valid/residents.csv', 'utf8').trim().split('\n')
  return lines.map((line) => line.split(',')[1] ?? '').filter(Boolean)
}

function memoryStore(): SettingsStore & { data: Record<string, string> } {
  const data: Record<string, string> = {}
  return { data, getItem: (k) => data[k] ?? null, setItem: (k, v) => { data[k] = v } }
}

describe('scenario files', () => {
  it('round-trips through serialise and parse', () => {
    const parsed = parseScenarioFile(serialiseScenario(scenario), 'fallback')
    expect(parsed).toEqual({ ok: true, file: { version: 1, name: 'More greens', note: 'JCRC draft', savedAt: scenario.savedAt, config } })
  })

  it('never contains a matric or a sample resident name', () => {
    const json = serialiseScenario(scenario)
    const all = strings(JSON.parse(json))
    expect(all.filter((s) => MATRIC.test(s))).toEqual([])
    const names = sampleNames()
    expect(names.length).toBeGreaterThan(0)
    expect(names.filter((name) => json.includes(name))).toEqual([])
  })

  it('reports corrupt JSON in plain English', () => {
    const parsed = parseScenarioFile('{oops', 'x')
    expect(parsed.ok).toBe(false)
    expect(!parsed.ok && parsed.error).toMatch(/not a scenario file/)
  })

  it('migrates an old scenario file: sem2Spots becomes sem2Green with sem2Grey 0', () => {
    const old = {
      version: 1,
      name: 'Old',
      config: { sem2Factor: 3, headcounts: { maleGreen: 40, maleGrey: 10, femaleGreen: 42, femaleGrey: 10, sem2Spots: 15 } },
    }
    const parsed = parseScenarioFile(JSON.stringify(old), 'x')
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    expect(parsed.file.config.headcounts).toEqual({
      maleGreen: 40, maleGrey: 10, femaleGreen: 42, femaleGrey: 10, sem2Green: 15, sem2Grey: 0,
    })
    expect(parsed.file.config.sem2Factor).toBe(3)
    expect(parsed.file.config.jcrcExchangeFactor).toBe(DEFAULT_CONFIG.jcrcExchangeFactor)
  })

  it('builds levels from an old scenario file with a placement bonus and tiers (R43)', () => {
    const oldConfig = oldLevelConfig({
      ...goldBonus(5),
      ...tiers([{ name: 'Tier A', multiplier: 1.3 }, { name: 'Gold B', multiplier: 1.6 }]),
    })
    const read = readConfig(oldConfig)
    expect(read).toMatchObject({ ok: true, migrated: ['levels'], defaulted: [] })
    const parsed = parseScenarioFile(JSON.stringify({ version: 1, name: 'AY26 strict', config: oldConfig }), 'x')
    if (!parsed.ok) throw new Error('expected the old scenario to load')
    expect(parsed.file.config.levels).toEqual([
      { name: 'Tier A', bonus: 0, multiplier: 1.3 },
      { name: 'Gold B', bonus: 5, multiplier: 1.6 },
    ])
    expect(OLD_LEVEL_KEYS.filter((key) => key in parsed.file.config)).toEqual([])
  })

  it('reports no migration for a scenario that already has levels', () => {
    expect(readConfig(config)).toMatchObject({ ok: true, migrated: [] })
  })

  it('rejects a scenario whose levels repeat a name or have a blank one', () => {
    const level = { name: 'Gold', bonus: 4, multiplier: 2 }
    expect(readConfig({ ...config, levels: [level, level] }).ok).toBe(false)
    expect(readConfig({ ...config, levels: [{ ...level, name: '  ' }] }).ok).toBe(false)
    expect(readConfig({ ...config, levels: [{ ...level, bonus: Number.NaN }] }).ok).toBe(false)
  })

  it('migrates old scenarios kept in storage too', () => {
    const store = memoryStore()
    const old = [{ id: 'a', name: 'Old', config: { headcounts: { maleGreen: 1, maleGrey: 1, femaleGreen: 1, femaleGrey: 1, sem2Spots: 4 } } }]
    store.data[SCENARIOS_KEY] = JSON.stringify(old)
    expect(loadScenarios(store)[0]?.config.headcounts).toMatchObject({ sem2Green: 4, sem2Grey: 0 })
  })

  it('rejects other versions and non-objects', () => {
    expect(parseScenarioFile(JSON.stringify({ version: 2, config }), 'x').ok).toBe(false)
    expect(parseScenarioFile('[1,2,3]', 'x').ok).toBe(false)
  })

  it('ignores unknown keys and fills missing keys from the defaults', () => {
    const partial = { version: 1, name: 'Partial', config: { sem2Factor: 3, somethingElse: true, residents: ['A1234567Z'] } }
    const parsed = parseScenarioFile(JSON.stringify(partial), 'x')
    expect(parsed.ok && parsed.file.config).toEqual({ ...DEFAULT_CONFIG, sem2Factor: 3 })
    expect(parsed.ok && 'somethingElse' in parsed.file.config).toBe(false)
  })

  it('names a setting with the wrong format', () => {
    const parsed = parseScenarioFile(JSON.stringify({ version: 1, config: { stackingMode: 'sum', auxCap: 'ten' } }), 'x')
    expect(!parsed.ok && parsed.error).toBe('These settings have the wrong format: stackingMode, auxCap.')
  })

  it('uses the file name when the name is missing', () => {
    const parsed = parseScenarioFile(JSON.stringify({ version: 1, config: {} }), 'my-file')
    expect(parsed.ok && parsed.file.name).toBe('my-file')
  })
})

describe('scenario storage', () => {
  it('stores scenarios under rhps.scenarios.v1 and reads them back', () => {
    const store = memoryStore()
    expect(saveScenarios([scenario], store)).toBe(true)
    expect(Object.keys(store.data)).toEqual([SCENARIOS_KEY])
    expect(loadScenarios(store)).toEqual([scenario])
  })

  it('keeps settings only, even if extra data sneaks onto a scenario object', () => {
    const store = memoryStore()
    const leaky = { ...scenario, residents: [{ matric: 'A9900001Z', name: 'Test Resident 001' }] } as Scenario
    saveScenarios([leaky], store)
    expect(store.data[SCENARIOS_KEY]).not.toContain('A9900001Z')
    expect(store.data[SCENARIOS_KEY]).not.toContain('Test Resident')
  })

  it('drops malformed stored entries and survives corrupt storage', () => {
    expect(readScenarioList([{ id: 1 }, null, scenario])).toEqual([scenario])
    const store = memoryStore()
    store.data[SCENARIOS_KEY] = '{not json'
    expect(loadScenarios(store)).toEqual([])
    expect(loadScenarios(null)).toEqual([])
  })
})
