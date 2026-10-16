import { describe, expect, it } from 'vitest'
import { DEFAULT_CONFIG, computeAll } from '../../engine'
import { deepFreeze } from '../../engine/__tests__/helpers'
import { validateImport } from '../validate'
import type { ImportReport, IssueCode, SourceFile } from '../types'
import {
  FLAT_COLS,
  FLAT_FILE_NAME,
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
  validateImport(files, config, [])
const codesOf = (report: ImportReport): string[] => [...new Set(report.issues.map((i) => i.code))].sort()

/** C1 and C2 have leader files, C3 is a flat CCA with flat points for residents 1..6. */
const flatScenario = (flat: readonly Record<string, string>[] | null = flatRows()) =>
  scenario({ ccas: [...baseCcas(), flatCca()], flat })

describe('a valid flat-points import', () => {
  const report = run(flatScenario())

  it('has no issues: a flat CCA is not mean/SD checked and raises no NO_LEADER_FILE', () => {
    expect(report.issues).toEqual([])
    expect(report.canCompute).toBe(true)
  })

  it('reports the flat CCA as flat, with its value and member count, and no mean/SD', () => {
    const flat = report.perCca.find((c) => c.ccaID === 'C3')
    expect(flat).toMatchObject({ status: 'flat', n: 6, mean: null, sd: null, flatPoints: 12, fileName: FLAT_FILE_NAME })
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

  it('treats the flat file as optional', () => {
    const noFlat = run(scenario({ ccas: [...baseCcas(), flatCca()] }))
    expect(codesOf(noFlat)).toEqual(['NO_LEADER_FILE'])
  })

  it('recognises the file by its header whatever it is called', () => {
    const files = flatScenario().map((f) => (f.name === FLAT_FILE_NAME ? { ...f, name: 'whatever.csv' } : f))
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
    name: 'DUPLICATE_FLAT_FILE',
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
    name: 'BAD_HEADER (flat file name, wrong columns)',
    files: flatScenario().map((f) => (f.name === FLAT_FILE_NAME ? { ...f, text: f.text.replace('flatPoints', 'flat') } : f)),
    codes: ['BAD_HEADER', 'NO_LEADER_FILE'],
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
    const report = run(scenario({ ccas: [...baseCcas(), flatCca('C3'), flatCca('C4')], flat: rows }))
    expect(report.issues).toEqual([])
  })

  it('names the line, ccaID and matric on a bad flat value', () => {
    const [issue] = run(flatScenario(patchRow(flatRows(), 2, { flatPoints: 'x' }))).issues
    expect(issue).toMatchObject({ code: 'BAD_FLAT_POINTS', line: 4, column: 'flatPoints', ccaID: 'C3', matric: matricOf(3) })
  })
})

describe('IHG on a flat membership', () => {
  const ihg = [{ matric: matricOf(1), ccaID: 'C3', placement: '1st' }]

  it('warns IHG_ON_FINAL_CCA when ihgInSportNet is on, and does not block', () => {
    const report = run(scenario({ ccas: [...baseCcas(), flatCca()], flat: flatRows(), ihg }), { ...DEFAULT_CONFIG, ihgInSportNet: true })
    expect(codesOf(report)).toEqual(['IHG_ON_FINAL_CCA'])
    expect(report.canCompute).toBe(true)
    expect(report.issues[0]?.severity).toBe('warning')
  })

  it('is silent when ihgInSportNet is off', () => {
    const report = run(scenario({ ccas: [...baseCcas(), flatCca()], flat: flatRows(), ihg }))
    expect(report.issues).toEqual([])
  })

  it('does not call a flat member a non-member', () => {
    const report = run(scenario({ ccas: [...baseCcas(), flatCca()], flat: flatRows(), ihg }), { ...DEFAULT_CONFIG, ihgInSportNet: true })
    expect(codesOf(report)).not.toContain('IHG_NON_MEMBER')
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
