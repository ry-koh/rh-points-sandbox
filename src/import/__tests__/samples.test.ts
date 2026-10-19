import { readdirSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { DEFAULT_CONFIG, computeAll, type ListRow, type PipelineInput, type ScenarioConfig } from '../../engine'
import { validateImport } from '../validate'
import type { CcaLevelEntry, SourceFile } from '../types'
import { DEMO_LEVELS } from './fixtures'

// Vitest runs from the project root, so sample paths are relative to it.
const VALID_DIR = 'samples/valid'
const BROKEN_DIR = 'samples/broken'
const SEM2_GREEN = 3
const SEM2_GREY = 3
const GREY = 4
/** The one broken case that is about the level table itself, so it runs with no levels. */
const NO_LEVELS_CASE = 'level-not-set'

function loadCsvFiles(dir: string): SourceFile[] {
  return readdirSync(dir)
    .filter((name) => name.endsWith('.csv'))
    .sort()
    .map((name) => ({ name, text: readFileSync(`${dir}/${name}`, 'utf8') }))
}

/** The sandbox's level table for the valid sample (entered in the sandbox, never an input file). */
function demoLevels(dir: string): CcaLevelEntry[] {
  const parsed: unknown = JSON.parse(readFileSync(`${dir}/demo-levels.json`, 'utf8'))
  if (!Array.isArray(parsed)) throw new Error(`${dir}/demo-levels.json must be an array`)
  return parsed as CcaLevelEntry[]
}

function expectedCodes(dir: string): string[] {
  const parsed: unknown = JSON.parse(readFileSync(`${dir}/expected.json`, 'utf8'))
  const codes = (parsed as { codes?: unknown }).codes
  if (!Array.isArray(codes)) throw new Error(`${dir}/expected.json needs a "codes" array`)
  return codes.map(String).sort()
}

function firstTieGroupStart(rows: readonly ListRow[]): number | null {
  const tied = rows.find((row) => rows.filter((other) => other.rank === row.rank).length > 1)
  return tied ? tied.rank : null
}

function configAroundTie(input: PipelineInput): ScenarioConfig {
  const { lists } = computeAll(input, DEFAULT_CONFIG)
  const start = firstTieGroupStart(lists.maleStaying)
  if (start === null) throw new Error('valid samples must contain a male tie group')
  return {
    ...DEFAULT_CONFIG,
    headcounts: {
      maleGreen: start,
      maleGrey: GREY,
      femaleGreen: 6,
      femaleGrey: GREY,
      sem2Green: SEM2_GREEN,
      sem2Grey: SEM2_GREY,
    },
  }
}

describe('samples/valid', () => {
  const files = loadCsvFiles(VALID_DIR)
  const ccaLevels = demoLevels(VALID_DIR)
  const report = validateImport(files, DEFAULT_CONFIG, { ccaLevels })

  it('has no errors', () => {
    expect(report.issues.filter((issue) => issue.severity === 'error')).toEqual([])
    expect(report.canCompute).toBe(true)
  })

  it('holds the bundle and a level for every non-flat CCA, and no retired or standalone files', () => {
    expect(report.bundle?.fileName).toBe('points_bundle_20270401.csv')
    expect(report.issues.map((i) => i.code)).not.toContain('LEVEL_NOT_SET')
    expect(ccaLevels).toHaveLength(12)
    expect(files.filter((f) => /^(ccas|points_settings_|flat_points_)/.test(f.name))).toEqual([])
  })

  it('marks six CCAs as sports, with their IHG result and a cap of 3', () => {
    const sports = (report.bundle?.ccas ?? []).filter((c) => c.isSport)
    expect(sports.map((c) => [c.ccaID, c.ihgResult, c.ihgCap])).toEqual([
      ['C01', '1st', 3], ['C02', '2nd', 3], ['C04', '3rd', 3], ['C05', '3rd4th_no_match', 3], ['C06', '2nd', 3], ['C08', '1st', 3],
    ])
  })

  it('has 80 residents and 13 CCAs: 12 with a points file each and one flat CCA', () => {
    expect(report.input?.residents).toHaveLength(80)
    expect(report.input?.ccas).toHaveLength(13)
    expect(report.perCca.filter((cca) => cca.status === 'ok')).toHaveLength(12)
    expect(report.perCca.filter((cca) => cca.status === 'flat')).toHaveLength(1)
  })

  it('has 2 male and 1 female full-year JCRC residents and 1 exchange resident', () => {
    const jcrc = (report.input?.residents ?? []).filter((r) => r.jcrc !== 'N')
    expect(jcrc.filter((r) => r.jcrc === 'FULL' && r.gender === 'M')).toHaveLength(2)
    expect(jcrc.filter((r) => r.jcrc === 'FULL' && r.gender === 'F')).toHaveLength(1)
    expect(jcrc.filter((r) => r.jcrc === 'EXCHANGE')).toHaveLength(1)
  })

  it('has one flat CCA with about eight members and no leader file', () => {
    const flat = report.perCca.find((cca) => cca.status === 'flat')
    expect(flat?.n).toBe(8)
    expect(flat?.flatPoints).toBe(9)
    expect(report.bundle?.ccas.find((c) => c.ccaID === flat?.ccaID)?.flatPoints).toBe(9)
  })

  it('runs through the engine into five non-empty lists with ties and a merged half-CCA', () => {
    if (!report.input) throw new Error('expected an engine input')
    const config = configAroundTie(report.input)
    const { lists, results } = computeAll(report.input, config)
    for (const list of Object.values(lists)) expect(list.length).toBeGreaterThan(0)
    expect(new Set(lists.sem2.map((row) => row.status))).toEqual(new Set(['green', 'grey', 'white']))
    const flagged = Object.values(lists).flat().some((row) => row.tieFlags.length > 0)
    expect(flagged).toBe(true)
    expect(results.some((r) => r.staying.mergedPairs.length > 0)).toBe(true)
  })
})

describe('samples/broken', () => {
  const folders = readdirSync(BROKEN_DIR).sort()

  it('has at least one case', () => {
    expect(folders.length).toBeGreaterThan(0)
  })

  it.each(folders)('%s produces exactly its expected codes', (folder) => {
    const dir = `${BROKEN_DIR}/${folder}`
    const ccaLevels = folder === NO_LEVELS_CASE ? [] : DEMO_LEVELS
    const report = validateImport(loadCsvFiles(dir), DEFAULT_CONFIG, { ccaLevels })
    const codes = [...new Set(report.issues.map((issue) => issue.code))].sort()
    expect(codes).toEqual(expectedCodes(dir))
  })
})

describe('samples/', () => {
  it('has no ccas.csv anywhere (the file is retired)', () => {
    const names = readdirSync('samples', { recursive: true }).map((path) => path.split(/[\\/]/).pop())
    expect(names.filter((name) => name === 'ccas.csv')).toEqual([])
    expect(names).toContain('points_bundle_20270401.csv')
  })
})
