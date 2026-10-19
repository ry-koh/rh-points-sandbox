import { describe, expect, it } from 'vitest'
import { DEFAULT_CONFIG, MAX_EXHAUSTIVE_HALVES, type ScenarioConfig } from '../../engine'
import { validateImport } from '../validate'
import type { ImportReport, IssueCode, SourceFile } from '../types'
import { deepFreeze } from '../../engine/__tests__/helpers'
import {
  BASE_SCORES,
  LEADER_COLS,
  baseCcas,
  baseResidents,
  leaderFileName,
  leaderRows,
  matricOf,
  patchRow,
  scenario,
  toCsv,
} from './fixtures'

const run = (
  files: readonly SourceFile[],
  config: ScenarioConfig = DEFAULT_CONFIG,
): ImportReport => validateImport(files, config)

const codesOf = (report: ImportReport): string[] =>
  [...new Set(report.issues.map((issue) => issue.code))].sort()

const withText = (
  files: readonly SourceFile[],
  name: string,
  edit: (text: string) => string,
): SourceFile[] => files.map((f) => (f.name === name ? { ...f, text: edit(f.text) } : f))

const c1 = leaderRows('C1')
const lastOf = (patch: Record<string, string>): { C1: ReturnType<typeof leaderRows> } => ({
  C1: patchRow(c1, -1, patch),
})
const duplicateResidentsFile: SourceFile = {
  name: 'residents_old.csv',
  text: scenario().find((f) => f.name === 'residents.csv')?.text ?? '',
}

interface Case {
  readonly name: string
  readonly files: SourceFile[]
  readonly codes: IssueCode[]
  readonly blocks: boolean
  readonly config?: ScenarioConfig
}

const CASES: Case[] = [
  { name: 'UNRECOGNISED_FILE', files: scenario({ extra: [{ name: 'notes.csv', text: 'foo,bar\n1,2\n' }] }), codes: ['UNRECOGNISED_FILE'], blocks: true },
  { name: 'CSV_SYNTAX (unterminated quote)', files: withText(scenario(), leaderFileName('C1'), (t) => `${t}1,C1,"Test\n`), codes: ['CSV_SYNTAX'], blocks: true },
  { name: 'CSV_SYNTAX (wrong cell count)', files: withText(scenario(), 'residents.csv', (t) => `${t}A9900011Z,Test Resident 011,M\n`), codes: ['CSV_SYNTAX'], blocks: true },
  { name: 'BAD_HEADER', files: withText(scenario(), leaderFileName('C1'), (t) => t.replace('basePoints', 'basePoint')), codes: ['BAD_HEADER', 'NO_LEADER_FILE'], blocks: true },
  { name: 'BAD_FORMAT_VERSION', files: scenario({ leaders: { C1: patchRow(c1, -1, { formatVersion: '2' }), C2: leaderRows('C2') } }), codes: ['BAD_FORMAT_VERSION'], blocks: true },
  { name: 'MIXED_CCA_ID', files: scenario({ leaders: { ...lastOf({ ccaID: 'C2' }), C2: leaderRows('C2') } }), codes: ['MIXED_CCA_ID'], blocks: true },
  { name: 'DUPLICATE_CCA_FILE', files: scenario({ extra: [{ name: 'points_C1_20270402.csv', text: toCsv(LEADER_COLS, c1) }] }), codes: ['DUPLICATE_CCA_FILE'], blocks: true },
  { name: 'MISSING_RESIDENTS_FILE', files: scenario({ residents: null }), codes: ['MISSING_RESIDENTS_FILE'], blocks: true },
  { name: 'MISSING_CCAS_FILE', files: scenario({ ccas: null }), codes: ['MISSING_CCAS_FILE'], blocks: true },
  { name: 'DUPLICATE_RESIDENTS_OR_CCAS_FILE', files: scenario({ extra: [duplicateResidentsFile] }), codes: ['DUPLICATE_RESIDENTS_OR_CCAS_FILE'], blocks: true },
  { name: 'BAD_MATRIC', files: scenario({ leaders: { ...lastOf({ matric: 'XYZ' }), C2: leaderRows('C2') } }), codes: ['BAD_MATRIC'], blocks: true },
  { name: 'UNKNOWN_MATRIC', files: scenario({ leaders: { ...lastOf({ matric: matricOf(99) }), C2: leaderRows('C2') } }), codes: ['UNKNOWN_MATRIC'], blocks: true },
  { name: 'DUPLICATE_MATRIC_IN_FILE', files: scenario({ leaders: { C1: [...c1, ...c1.slice(0, 1)], C2: leaderRows('C2') } }), codes: ['DUPLICATE_MATRIC_IN_FILE'], blocks: true },
  { name: 'DUPLICATE_RESIDENT', files: scenario({ residents: [...baseResidents(), ...baseResidents().slice(-1)] }), codes: ['DUPLICATE_RESIDENT'], blocks: true },
  { name: 'BAD_BASE_POINTS', files: scenario({ leaders: { ...lastOf({ basePoints: '21' }), C2: leaderRows('C2') } }), codes: ['BAD_BASE_POINTS'], blocks: true },
  { name: 'BAD_ENUM', files: scenario({ leaders: { ...lastOf({ outgoingRole: 'captain' }), C2: leaderRows('C2') } }), codes: ['BAD_ENUM'], blocks: true },
  { name: 'BAD_YN', files: scenario({ leaders: { ...lastOf({ semesterOnly: 'yes' }), C2: leaderRows('C2') } }), codes: ['BAD_YN'], blocks: true },
  { name: 'BAD_GENDER', files: scenario({ residents: patchRow(baseResidents(), -1, { gender: 'X' }) }), codes: ['BAD_GENDER'], blocks: true },
  { name: 'BAD_AUX', files: scenario({ residents: patchRow(baseResidents(), -1, { aux: '-1' }) }), codes: ['BAD_AUX'], blocks: true },
  { name: 'UNKNOWN_CCA', files: scenario({ leaders: { C1: c1, C2: leaderRows('C2'), C9: leaderRows('C9') } }), codes: ['UNKNOWN_CCA'], blocks: true },
  { name: 'IHG_UNKNOWN_MATRIC', files: scenario({ ihg: [{ matric: matricOf(99), ccaID: 'C1', placement: '1st' }] }), codes: ['IHG_UNKNOWN_MATRIC'], blocks: true },
  { name: 'IHG_UNKNOWN_CCA', files: scenario({ ihg: [{ matric: matricOf(1), ccaID: 'C9', placement: '2nd' }] }), codes: ['IHG_UNKNOWN_CCA'], blocks: true },
  { name: 'UNKNOWN_TIER', files: scenario({ ccas: patchRow(baseCcas(), 0, { outgoingTier: 'Platinum' }) }), codes: ['UNKNOWN_TIER'], blocks: true },
  { name: 'BAD_MANUAL_MULTIPLIER', files: scenario({ ccas: patchRow(baseCcas(), 0, { outgoingMultiplier: '-2' }) }), codes: ['BAD_MANUAL_MULTIPLIER'], blocks: true },
  { name: 'MISSING_OUTGOING_MULTIPLIER', files: scenario({ leaders: { ...lastOf({ outgoingRole: 'head' }), C2: leaderRows('C2') } }), codes: ['MISSING_OUTGOING_MULTIPLIER'], blocks: true },
  { name: 'DUPLICATE_CCA', files: scenario({ ccas: [...baseCcas(), ...baseCcas().slice(0, 1)] }), codes: ['DUPLICATE_CCA'], blocks: true },
  { name: 'BAD_RANGE', files: scenario({ ccas: patchRow(baseCcas(), 0, { meanMin: 'low' }) }), codes: ['BAD_RANGE'], blocks: true },
  { name: 'MEAN_SD_OUT_OF_RANGE', files: scenario({ leaders: { C1: leaderRows('C1', [20, 20, 20, 20, 20, 20]), C2: leaderRows('C2') } }), codes: ['MEAN_SD_OUT_OF_RANGE'], blocks: false },
  { name: 'NO_LEADER_FILE (warning)', files: scenario({ leaders: { C1: c1 } }), codes: ['NO_LEADER_FILE'], blocks: false },
  { name: 'SEMESTER_ONLY_ON_HALF_CCA (warning)', files: scenario({ leaders: { C1: c1, C2: patchRow(leaderRows('C2'), -1, { semesterOnly: 'Y' }) } }), codes: ['SEMESTER_ONLY_ON_HALF_CCA'], blocks: false },
  { name: 'AUX_ABOVE_CAP (warning)', files: scenario({ residents: patchRow(baseResidents(), -1, { aux: '12' }) }), codes: ['AUX_ABOVE_CAP'], blocks: false },
  { name: 'IHG_NON_MEMBER (warning, ihgInSportNet on)', files: scenario({ ihg: [{ matric: matricOf(10), ccaID: 'C1', placement: '1st' }] }), codes: ['IHG_NON_MEMBER'], blocks: false, config: { ...DEFAULT_CONFIG, ihgInSportNet: true } },
]

describe('one issue code per mistake', () => {
  it.each(CASES)('$name', ({ files, codes, blocks, config }) => {
    const report = run(files, config)
    expect(codesOf(report)).toEqual([...codes].sort())
    expect(report.canCompute).toBe(!blocks)
  })
})

describe('a valid import', () => {
  const report = run(scenario())

  it('has no issues and can compute', () => {
    expect(report.issues).toEqual([])
    expect(report.canCompute).toBe(true)
  })

  it('builds the engine input', () => {
    expect(report.input?.residents).toHaveLength(10)
    expect(report.input?.ccas.map((c) => c.ccaID)).toEqual(['C1', 'C2'])
    expect(report.input?.memberships).toHaveLength(12)
    expect(report.input?.ihg).toEqual([])
  })

  it('reports mean, SD and range per CCA', () => {
    const [first] = report.perCca
    expect(first).toMatchObject({ ccaID: 'C1', name: 'Test CCA One', n: 6, status: 'ok' })
    expect(first?.fileName).toBe(leaderFileName('C1'))
    expect(first?.mean).toBeCloseTo(13, 9)
    expect(first?.sd).toBeCloseTo(3.416, 3)
    expect(first?.range).toEqual(DEFAULT_CONFIG.meanSdDefault)
  })

  it('accepts lowercase matrics and normalises them', () => {
    const lower = baseResidents().map((r) => ({ ...r, matric: (r.matric ?? '').toLowerCase() }))
    const result = run(scenario({ residents: lower }))
    expect(result.issues).toEqual([])
    expect(result.input?.residents[0]?.matric).toBe(matricOf(1))
  })

  it('includes a valid IHG file and treats the file as optional', () => {
    const ihg = [{ matric: matricOf(1), ccaID: 'C1', placement: '3rd4th_no_match' }]
    expect(run(scenario({ ihg })).input?.ihg).toHaveLength(1)
    expect(run(scenario()).canCompute).toBe(true)
  })

  it('does not warn about IHG non-members when ihgInSportNet is off', () => {
    const ihg = [{ matric: matricOf(10), ccaID: 'C1', placement: '1st' }]
    expect(run(scenario({ ihg })).issues).toEqual([])
  })
})

describe('issue details', () => {
  it('describes a bad score in plain English with file, line and matric', () => {
    const files = scenario({ leaders: { C1: patchRow(c1, 3, { basePoints: '21' }), C2: leaderRows('C2') } })
    const [issue] = run(files).issues
    expect(issue).toMatchObject({
      severity: 'error',
      code: 'BAD_BASE_POINTS',
      fileName: leaderFileName('C1'),
      line: 5,
      column: 'basePoints',
      ccaID: 'C1',
      matric: matricOf(4),
    })
    expect(issue?.message).toBe(
      'points_C1_20270401.csv line 5: basePoints "21" must be a whole number from 0 to 20.',
    )
  })

  it.each(['7.5', 'abc', '-1', '', '21'])('rejects basePoints "%s"', (value) => {
    const files = scenario({ leaders: { C1: patchRow(c1, -1, { basePoints: value }), C2: leaderRows('C2') } })
    expect(codesOf(run(files))).toEqual(['BAD_BASE_POINTS'])
  })

  it.each(['0', '20'])('accepts basePoints "%s" at the ends of the range', (value) => {
    const rows = patchRow(c1, 0, { basePoints: value })
    const wide = { meanMin: '0', meanMax: '20', sdMin: '0', sdMax: '20' }
    const ccas = patchRow(baseCcas(), 0, wide)
    expect(run(scenario({ ccas, leaders: { C1: rows, C2: leaderRows('C2') } })).issues).toEqual([])
  })

  it('MEAN_SD_OUT_OF_RANGE is a warning that names the CCA', () => {
    const files = scenario({ leaders: { C1: leaderRows('C1', [20, 20, 20, 20, 20, 20]), C2: leaderRows('C2') } })
    const [issue] = run(files).issues
    expect(issue).toMatchObject({ severity: 'warning', code: 'MEAN_SD_OUT_OF_RANGE', ccaID: 'C1' })
  })

  it('treats a leader file with no members as out of range', () => {
    const files = scenario({ leaders: { C1: [], C2: leaderRows('C2') } })
    expect(codesOf(run(files))).toEqual(['MEAN_SD_OUT_OF_RANGE'])
  })

  it('rejects a second IHG file', () => {
    const ihg = { name: 'ihg.csv', text: 'matric,ccaID,placement\n' }
    const files = scenario({ extra: [ihg, { ...ihg, name: 'ihg_old.csv' }] })
    expect(codesOf(run(files))).toEqual(['DUPLICATE_RESIDENTS_OR_CCAS_FILE'])
  })
})

describe('mean/SD ranges', () => {
  it('falls back to the default field by field', () => {
    const ccas = patchRow(baseCcas(), 0, { meanMax: '12' })
    const report = run(scenario({ ccas }))
    expect(report.perCca[0]?.range).toEqual({ ...DEFAULT_CONFIG.meanSdDefault, meanMax: 12 })
    expect(report.perCca[0]?.status).toBe('out_of_range')
  })

  it('a waiver range lets otherwise failing scores pass', () => {
    const scores = [20, 20, 15, 12, 10, 8, 5]
    const files = scenario({ leaders: { C1: leaderRows('C1', scores), C2: leaderRows('C2') } })
    expect(codesOf(run(files))).toEqual(['MEAN_SD_OUT_OF_RANGE'])
    const waived = patchRow(baseCcas(), 0, { sdMax: '6' })
    const withWaiver = scenario({ ccas: waived, leaders: { C1: leaderRows('C1', scores), C2: leaderRows('C2') } })
    expect(run(withWaiver).issues).toEqual([])
  })

  it('marks CCAs without a leader file as missing_file', () => {
    const report = run(scenario({ leaders: { C1: c1 } }))
    expect(report.perCca.map((c) => c.status)).toEqual(['ok', 'missing_file'])
    expect(report.perCca[1]).toMatchObject({ fileName: null, n: 0, mean: null, sd: null })
  })
})

describe('out of range', () => {
  const failing = scenario({ leaders: { C1: leaderRows('C1', [20, 20, 20, 20, 20, 20]), C2: leaderRows('C2') } })

  it('lists out-of-range CCAs in report.outOfRange with mean, sd, range and fileName', () => {
    const report = run(failing)
    expect(report.canCompute).toBe(true)
    expect(report.perCca[0]?.status).toBe('out_of_range')
    expect(report.outOfRange).toEqual([
      {
        ccaID: 'C1',
        name: 'Test CCA One',
        fileName: leaderFileName('C1'),
        mean: 20,
        sd: 0,
        range: DEFAULT_CONFIG.meanSdDefault,
      },
    ])
  })

  it('lists nothing when every CCA is in range', () => {
    expect(run(scenario()).outOfRange).toEqual([])
  })

  it('does not hide other errors in the same import', () => {
    const files = scenario({
      leaders: { C1: leaderRows('C1', [20, 20, 20, 20, 20, 20]), C2: patchRow(leaderRows('C2'), -1, { matric: matricOf(99) }) },
    })
    const report = run(files)
    expect(report.canCompute).toBe(false)
    expect(report.outOfRange).toHaveLength(1)
  })
})

describe('outgoingMode', () => {
  const tierOnly = scenario({
    ccas: patchRow(baseCcas(), 0, { outgoingTier: 'High Gold' }),
    leaders: { ...lastOf({ outgoingRole: 'head' }), C2: leaderRows('C2') },
  })
  const manualOnly = scenario({
    ccas: patchRow(baseCcas(), 0, { outgoingMultiplier: '1.5' }),
    leaders: { ...lastOf({ outgoingRole: 'head' }), C2: leaderRows('C2') },
  })
  const manual: ScenarioConfig = { ...DEFAULT_CONFIG, outgoingMode: 'manual' }

  it('tier mode needs the tier, not the multiplier', () => {
    expect(run(tierOnly).issues).toEqual([])
    expect(codesOf(run(manualOnly))).toEqual(['MISSING_OUTGOING_MULTIPLIER'])
  })

  it('switching to manual mode re-validates the columns', () => {
    expect(codesOf(run(tierOnly, manual))).toEqual(['MISSING_OUTGOING_MULTIPLIER'])
    expect(run(manualOnly, manual).issues).toEqual([])
  })

  it('does not require outgoing values when nobody is an outgoing leader', () => {
    expect(run(scenario(), manual).issues).toEqual([])
  })
})

describe('half-CCA warning', () => {
  it('warns when a resident is in more than the exhaustive limit of 0.5x CCAs', () => {
    const ids = Array.from({ length: MAX_EXHAUSTIVE_HALVES + 1 }, (_, i) => `H${String(i).padStart(2, '0')}`)
    const ccas = ids.map((ccaID) => ({ ...baseCcas()[1], ccaID, ccaName: `Test CCA ${ccaID}` }))
    const leaders = Object.fromEntries(ids.map((id) => [id, leaderRows(id, BASE_SCORES)]))
    const report = run(scenario({ ccas, leaders }))
    const warnings = report.issues.filter((i) => i.code === 'MANY_HALF_CCAS')
    expect(warnings).toHaveLength(6)
    expect(warnings[0]).toMatchObject({ severity: 'warning', matric: matricOf(1) })
    expect(report.canCompute).toBe(true)
  })
})

describe('purity', () => {
  const files = scenario({ leaders: { C1: leaderRows('C1', [20, 20, 20, 20, 20, 20]), C2: leaderRows('C2') } })

  it('gives the same report for the same input', () => {
    expect(run(files, DEFAULT_CONFIG)).toEqual(run(files, DEFAULT_CONFIG))
  })

  it('does not mutate its inputs', () => {
    expect(() => run(deepFreeze([...files]), deepFreeze({ ...DEFAULT_CONFIG }))).not.toThrow()
  })
})
