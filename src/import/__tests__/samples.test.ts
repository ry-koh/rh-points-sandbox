import { readdirSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { DEFAULT_CONFIG, computeAll, type ListRow, type PipelineInput, type ScenarioConfig } from '../../engine'
import { validateImport } from '../validate'
import type { SourceFile } from '../types'

// Vitest runs from the project root, so sample paths are relative to it.
const VALID_DIR = 'samples/valid'
const BROKEN_DIR = 'samples/broken'
const SEM2_GREEN = 3
const SEM2_GREY = 3
const GREY = 4

function loadCsvFiles(dir: string): SourceFile[] {
  return readdirSync(dir)
    .filter((name) => name.endsWith('.csv'))
    .sort()
    .map((name) => ({ name, text: readFileSync(`${dir}/${name}`, 'utf8') }))
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
  const report = validateImport(files, DEFAULT_CONFIG)

  it('has no errors', () => {
    expect(report.issues.filter((issue) => issue.severity === 'error')).toEqual([])
    expect(report.canCompute).toBe(true)
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
    expect(files.some((f) => f.name.startsWith('flat_points_'))).toBe(true)
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
    const report = validateImport(loadCsvFiles(dir), DEFAULT_CONFIG)
    const codes = [...new Set(report.issues.map((issue) => issue.code))].sort()
    expect(codes).toEqual(expectedCodes(dir))
  })
})
