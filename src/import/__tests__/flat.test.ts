import { describe, expect, it } from 'vitest'
import { DEFAULT_CONFIG, computeAll } from '../../engine'
import { deepFreeze } from '../../engine/__tests__/helpers'
import { parseCsv } from '../csv'
import { parseFlat } from '../parseFlat'
import { validateImport } from '../validate'
import type { ImportReport, IssueCode, SourceFile } from '../types'
import {
  BUNDLE_FILE_NAME,
  DEMO_LEVELS,
  FLAT_COLS,
  baseCcas,
  baseResidents,
  flatCca,
  flatRows,
  leaderRows,
  matricOf,
  patchRow,
  scenario,
  toCsv,
} from './fixtures'

const run = (files: readonly SourceFile[], config = DEFAULT_CONFIG): ImportReport =>
  validateImport(files, config, { ccaLevels: DEMO_LEVELS })
const codesOf = (report: ImportReport): string[] => [...new Set(report.issues.map((i) => i.code))].sort()

/** C1 and C2 have leader files; C3 is a flat CCA whose member rows (residents 1..6) are in the bundle. */
const flatScenario = (flat: readonly Record<string, string>[] = flatRows()) =>
  scenario({ ccas: [...baseCcas(), flatCca('C3', flat[0]?.flatPoints ?? '12')], flat })

describe('a valid flat-points import', () => {
  const report = run(flatScenario())

  it('has no issues: a flat CCA is not mean/SD checked and raises no NO_LEADER_FILE', () => {
    expect(report.issues).toEqual([])
    expect(report.canCompute).toBe(true)
  })

  it('reports the flat CCA as flat, with its value and member count, and no mean/SD', () => {
    const flat = report.perCca.find((c) => c.ccaID === 'C3')
    expect(flat).toMatchObject({ status: 'flat', n: 6, mean: null, sd: null, flatPoints: 12, fileName: BUNDLE_FILE_NAME })
  })

  it('assembles flat memberships for the engine', () => {
    const rows = report.input?.memberships.filter((m) => m.ccaID === 'C3') ?? []
    expect(rows).toHaveLength(6)
    expect(rows[0]).toMatchObject({ matric: matricOf(1), flatPoints: 12, roleDropped: false })
    expect(report.input?.memberships.filter((m) => m.ccaID === 'C1').every((m) => m.flatPoints === undefined)).toBe(true)
  })

  it('feeds the engine: a flat membership is worth exactly its value', () => {
    if (!report.input) throw new Error('no input')
    const { results } = computeAll(report.input, DEFAULT_CONFIG)
    const first = results.find((r) => r.matric === matricOf(1))
    expect(first?.memberships.find((m) => m.ccaID === 'C3')).toMatchObject({ stayNet: 12, bidNet: 12 })
  })

  it('accepts a decimal flat value and a zero', () => {
    expect(run(flatScenario(flatRows('C3', '12.5'))).issues).toEqual([])
    expect(run(flatScenario(flatRows('C3', '0'))).issues).toEqual([])
  })

  it('a flat CCA with no member rows is still flat, with no members and no NO_LEADER_FILE', () => {
    const noFlat = run(scenario({ ccas: [...baseCcas(), flatCca()] }))
    expect(noFlat.issues).toEqual([])
    expect(noFlat.perCca.find((c) => c.ccaID === 'C3')).toMatchObject({ status: 'flat', n: 0 })
  })

  it('recognises the bundle by its header whatever it is called', () => {
    const files = flatScenario().map((f) => (f.name === BUNDLE_FILE_NAME ? { ...f, name: 'whatever.csv' } : f))
    expect(run(files).issues).toEqual([])
  })

  it('does not mutate its inputs', () => {
    expect(() => run(deepFreeze(flatScenario()))).not.toThrow()
  })
})

interface Case {
  readonly name: string
  readonly files: SourceFile[]
  readonly codes: IssueCode[]
}

const CASES: Case[] = [
  { name: 'UNKNOWN_CCA', files: scenario({ flat: flatRows('C9') }), codes: ['UNKNOWN_CCA'] },
  {
    name: 'FLAT_AND_LEADER_FILE',
    files: scenario({ ccas: [...baseCcas(), flatCca()], flat: [...flatRows(), ...flatRows('C1')] }),
    codes: ['FLAT_AND_LEADER_FILE'],
  },
  { name: 'BAD_FLAT_POINTS (negative)', files: flatScenario(patchRow(flatRows(), -1, { flatPoints: '-1' })), codes: ['BAD_FLAT_POINTS'] },
  { name: 'BAD_FLAT_POINTS (text)', files: flatScenario(patchRow(flatRows(), -1, { flatPoints: 'lots' })), codes: ['BAD_FLAT_POINTS'] },
  { name: 'BAD_FLAT_POINTS (blank)', files: flatScenario(patchRow(flatRows(), -1, { flatPoints: '' })), codes: ['BAD_FLAT_POINTS'] },
  { name: 'FLAT_VALUE_MISMATCH', files: flatScenario(patchRow(flatRows(), -1, { flatPoints: '13' })), codes: ['FLAT_VALUE_MISMATCH'] },
  {
    name: 'DUPLICATE_FLAT_FILE (a standalone flat file beside the bundle)',
    files: [...flatScenario(), { name: 'flat_points_20270402.csv', text: toCsv(FLAT_COLS, flatRows()) }],
    codes: ['DUPLICATE_FLAT_FILE'],
  },
  { name: 'BAD_MATRIC', files: flatScenario(patchRow(flatRows(), -1, { matric: 'XYZ' })), codes: ['BAD_MATRIC'] },
  { name: 'UNKNOWN_MATRIC', files: flatScenario(patchRow(flatRows(), -1, { matric: matricOf(99) })), codes: ['UNKNOWN_MATRIC'] },
  {
    name: 'DUPLICATE_MATRIC_IN_FILE (within one ccaID)',
    files: flatScenario([...flatRows(), ...flatRows().slice(0, 1)]),
    codes: ['DUPLICATE_MATRIC_IN_FILE'],
  },
  { name: 'BAD_FORMAT_VERSION', files: flatScenario(patchRow(flatRows(), 0, { formatVersion: '2' })), codes: ['BAD_FORMAT_VERSION'] },
  {
    name: 'BAD_HEADER (bundle name, wrong columns)',
    files: flatScenario().map((f) => (f.name === BUNDLE_FILE_NAME ? { ...f, text: f.text.replace('flatPoints', 'flat') } : f)),
    codes: ['BAD_HEADER'],
  },
]

describe('one issue code per flat mistake', () => {
  it.each(CASES)('$name', ({ files, codes }) => {
    const report = run(files)
    expect(codesOf(report)).toEqual([...codes].sort())
    expect(report.canCompute).toBe(false)
  })

  it('does not report the same matric twice across different flat CCAs', () => {
    const rows = [...flatRows('C3'), ...flatRows('C4', '9')]
    const report = run(scenario({ ccas: [...baseCcas(), flatCca('C3'), flatCca('C4', '9')], flat: rows }))
    expect(report.issues).toEqual([])
  })

  it('names the line, ccaID and matric on a bad flat value', () => {
    const [issue] = run(flatScenario(patchRow(flatRows(), 2, { flatPoints: 'x' }))).issues
    expect(issue).toMatchObject({ code: 'BAD_FLAT_POINTS', line: 8, column: 'flatPoints', ccaID: 'C3', matric: matricOf(3) })
  })
})

describe('the jcrc column in residents.csv', () => {
  it('reads N, FULL and EXCHANGE', () => {
    const residents = patchRow(patchRow(baseResidents(), 0, { jcrc: 'FULL' }), 1, { jcrc: 'EXCHANGE' })
    const report = run(scenario({ residents }))
    expect(report.issues).toEqual([])
    expect(report.input?.residents.slice(0, 3).map((r) => r.jcrc)).toEqual(['FULL', 'EXCHANGE', 'N'])
  })

  it('BAD_JCRC for any other value', () => {
    for (const jcrc of ['Y', 'full', '', 'yes']) {
      const report = run(scenario({ residents: patchRow(baseResidents(), -1, { jcrc }) }))
      expect(codesOf(report)).toEqual(['BAD_JCRC'])
      expect(report.canCompute).toBe(false)
    }
  })

  it('JCRC_AND_SEM2 for a JCRC resident who is also sem-2', () => {
    for (const jcrc of ['FULL', 'EXCHANGE']) {
      const report = run(scenario({ residents: patchRow(baseResidents(), -1, { jcrc, sem2: 'Y' }) }))
      expect(codesOf(report)).toEqual(['JCRC_AND_SEM2'])
      expect(report.canCompute).toBe(false)
    }
  })

  it('a sem-2 resident with jcrc N is fine', () => {
    expect(run(scenario({ residents: patchRow(baseResidents(), -1, { sem2: 'Y' }) })).issues).toEqual([])
  })

  it('a residents.csv without the jcrc column is a BAD_HEADER', () => {
    const files = scenario().map((f) =>
      f.name === 'residents.csv'
        ? { ...f, text: f.text.split('\n').map((line) => line.replace(/,[^,]*$/, '')).join('\n') }
        : f,
    )
    expect(codesOf(run(files))).toEqual(['BAD_HEADER'])
  })

  it('a JCRC resident may still appear in leader files', () => {
    const residents = patchRow(baseResidents(), 0, { jcrc: 'FULL' })
    const report = run(scenario({ residents, leaders: { C1: leaderRows('C1'), C2: leaderRows('C2') } }))
    expect(report.issues).toEqual([])
  })
})

describe('the standalone flat-points file parser', () => {
  it('BAD_FORMAT_VERSION once for a file in another version; seenKeys still lists the CCA', () => {
    const rows = flatRows().map((row) => ({ ...row, formatVersion: '2' }))
    const result = parseFlat('flat_points_20270401.csv', parseCsv(toCsv(FLAT_COLS, rows)))
    expect(result.issues.map((i) => i.code)).toEqual(['BAD_FORMAT_VERSION'])
    expect(result.seenKeys).toEqual(['C3'])
  })
})
