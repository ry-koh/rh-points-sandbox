import { describe, expect, it } from 'vitest'
import { DEFAULT_CONFIG, MAX_EXHAUSTIVE_HALVES, computeAll, type ScenarioConfig } from '../../engine'
import { RETIRED_CCAS_COLUMNS } from '../detect'
import { validateImport } from '../validate'
import type { CcaLevelEntry, ImportReport, IssueCode, SandboxInput, SourceFile } from '../types'
import { deepFreeze } from '../../engine/__tests__/helpers'
import {
  BASE_SCORES,
  DEMO_LEVELS,
  LEADER_COLS,
  baseCcas,
  baseResidents,
  bundleFile,
  bundleRows,
  flatCca,
  flatRows,
  leaderFileName,
  leaderRows,
  matricOf,
  patchRow,
  scenario,
  settingsDefaultRow,
  settingsWaiverRow,
  toCsv,
} from './fixtures'

const run = (
  files: readonly SourceFile[],
  config: ScenarioConfig = DEFAULT_CONFIG,
  sandbox: Partial<SandboxInput> = { ccaLevels: DEMO_LEVELS },
): ImportReport => validateImport(files, config, sandbox)

const codesOf = (report: ImportReport): string[] =>
  [...new Set(report.issues.map((issue) => issue.code))].sort()

const withText = (
  files: readonly SourceFile[],
  name: string,
  edit: (text: string) => string,
): SourceFile[] => files.map((f) => (f.name === name ? { ...f, text: edit(f.text) } : f))

const entry = (ccaID: string, patch: Partial<CcaLevelEntry> = {}): CcaLevelEntry => ({
  ccaID, level: null, bonusOverride: null, multiplierOverride: null, ...patch,
})

/** DEMO_LEVELS with the given entries replacing (or added to) the demo ones. */
const levelsWith = (...entries: CcaLevelEntry[]): Partial<SandboxInput> => ({
  ccaLevels: [...DEMO_LEVELS.filter((d) => !entries.some((e) => e.ccaID === d.ccaID)), ...entries],
})

const c1 = leaderRows('C1')
const lastOf = (patch: Record<string, string>): { C1: ReturnType<typeof leaderRows> } => ({
  C1: patchRow(c1, -1, patch),
})
const duplicateResidentsFile: SourceFile = {
  name: 'residents_old.csv',
  text: scenario().find((f) => f.name === 'residents.csv')?.text ?? '',
}
const twoHighGolds: ScenarioConfig = {
  ...DEFAULT_CONFIG,
  levels: [...DEFAULT_CONFIG.levels, { name: 'High Gold', bonus: 5, multiplier: 2.1 }],
}
const retiredCcasText = toCsv(RETIRED_CCAS_COLUMNS, [{ ccaID: 'C1', ccaName: 'Test CCA One', type: '1x', placement: 'gold' }])

interface Case {
  readonly name: string
  readonly files: SourceFile[]
  readonly codes: IssueCode[]
  readonly blocks: boolean
  readonly config?: ScenarioConfig
  readonly sandbox?: Partial<SandboxInput>
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
  { name: 'MISSING_BUNDLE_FILE', files: scenario({ bundle: null }), codes: ['MISSING_BUNDLE_FILE'], blocks: true },
  { name: 'DUPLICATE_BUNDLE_FILE', files: scenario({ extra: [bundleFile(bundleRows(baseCcas()), 'points_bundle_20270402.csv')] }), codes: ['DUPLICATE_BUNDLE_FILE'], blocks: true },
  { name: 'CCAS_FILE_RETIRED (the old header)', files: scenario({ extra: [{ name: 'ccas.csv', text: retiredCcasText }] }), codes: ['CCAS_FILE_RETIRED'], blocks: true },
  { name: 'CCAS_FILE_RETIRED (the old header, any name)', files: scenario({ extra: [{ name: 'old.csv', text: retiredCcasText }] }), codes: ['CCAS_FILE_RETIRED'], blocks: true },
  { name: 'CCAS_FILE_RETIRED (the old name)', files: scenario({ extra: [{ name: 'CCAS_2026.csv', text: 'foo,bar\n' }] }), codes: ['CCAS_FILE_RETIRED'], blocks: true },
  { name: 'DUPLICATE_RESIDENTS_OR_IHG_FILE', files: scenario({ extra: [duplicateResidentsFile] }), codes: ['DUPLICATE_RESIDENTS_OR_IHG_FILE'], blocks: true },
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
  { name: 'UNKNOWN_LEVEL', files: scenario(), sandbox: levelsWith(entry('C1', { level: 'Platinum' })), codes: ['UNKNOWN_LEVEL'], blocks: true },
  { name: 'BAD_LEVEL_TWEAK (multiplier)', files: scenario(), sandbox: levelsWith(entry('C1', { level: 'High Gold', multiplierOverride: -2 })), codes: ['BAD_LEVEL_TWEAK'], blocks: true },
  { name: 'BAD_LEVEL_TWEAK (bonus)', files: scenario(), sandbox: levelsWith(entry('C1', { level: 'High Gold', bonusOverride: Number.NaN })), codes: ['BAD_LEVEL_TWEAK'], blocks: true },
  { name: 'DUPLICATE_LEVEL_NAME', files: scenario(), config: twoHighGolds, codes: ['DUPLICATE_LEVEL_NAME'], blocks: true },
  { name: 'LEVEL_UNKNOWN_CCA (warning)', files: scenario(), sandbox: levelsWith(entry('C9', { level: 'Pass' })), codes: ['LEVEL_UNKNOWN_CCA'], blocks: false },
  { name: 'LEVEL_NOT_SET (warning, empty table)', files: scenario(), sandbox: {}, codes: ['LEVEL_NOT_SET'], blocks: false },
  { name: 'TYPE_NOT_SET (warning)', files: scenario({ ccas: patchRow(baseCcas(), 0, { type: '' }) }), codes: ['TYPE_NOT_SET'], blocks: false },
  { name: 'DUPLICATE_CCA', files: scenario({ ccas: [...baseCcas(), ...baseCcas().slice(0, 1)] }), codes: ['DUPLICATE_CCA'], blocks: true },
  { name: 'BAD_RANGE', files: scenario({ settings: [settingsDefaultRow(), settingsWaiverRow('C1', { meanMin: 'low' })] }), codes: ['BAD_RANGE'], blocks: true },
  { name: 'MEAN_SD_OUT_OF_RANGE', files: scenario({ leaders: { C1: leaderRows('C1', [20, 20, 20, 20, 20, 20]), C2: leaderRows('C2') } }), codes: ['MEAN_SD_OUT_OF_RANGE'], blocks: false },
  { name: 'NO_LEADER_FILE (warning)', files: scenario({ leaders: { C1: c1 } }), codes: ['NO_LEADER_FILE'], blocks: false },
  { name: 'SEMESTER_ONLY_ON_HALF_CCA (warning)', files: scenario({ leaders: { C1: c1, C2: patchRow(leaderRows('C2'), -1, { semesterOnly: 'Y' }) } }), codes: ['SEMESTER_ONLY_ON_HALF_CCA'], blocks: false },
  { name: 'AUX_ABOVE_CAP (warning)', files: scenario({ residents: patchRow(baseResidents(), -1, { aux: '12' }) }), codes: ['AUX_ABOVE_CAP'], blocks: false },
  { name: 'IHG_NON_MEMBER (warning, ihgInSportNet on)', files: scenario({ ihg: [{ matric: matricOf(10), ccaID: 'C1', placement: '1st' }] }), codes: ['IHG_NON_MEMBER'], blocks: false, config: { ...DEFAULT_CONFIG, ihgInSportNet: true } },
]

describe('one issue code per mistake', () => {
  it.each(CASES)('$name', ({ files, codes, blocks, config, sandbox }) => {
    const report = run(files, config, sandbox)
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
    const wide = { meanMin: '0', meanMax: '20', sdMin: '0', sdMax: '10' }
    const settings = [settingsDefaultRow(), settingsWaiverRow('C1', wide)]
    expect(run(scenario({ settings, leaders: { C1: rows, C2: leaderRows('C2') } })).issues).toEqual([])
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
    expect(codesOf(run(files))).toEqual(['DUPLICATE_RESIDENTS_OR_IHG_FILE'])
  })

  it('says where an unknown CCA should have been listed: the bundle', () => {
    const report = run(scenario({ leaders: { C1: c1, C2: leaderRows('C2'), C9: leaderRows('C9') } }))
    expect(report.issues[0]?.message).toContain('is not listed in points_bundle_20270401.csv')
  })

  it('CCAS_FILE_RETIRED tells the user to remove the file, and its rows are never read', () => {
    const report = run(scenario({ extra: [{ name: 'ccas.csv', text: retiredCcasText }] }))
    expect(report.issues[0]?.message).toBe(
      'ccas.csv: ccas.csv is no longer used: CCA types come from the RH-app bundle and levels are set on the Review step. Remove this file.',
    )
    expect(report.perCca.map((c) => c.ccaID)).toEqual(['C1', 'C2'])
  })
})

describe('mean/SD ranges', () => {
  it("uses a CCA's waiver row, and the default row for every other CCA", () => {
    const report = run(scenario({ settings: [settingsDefaultRow(), settingsWaiverRow('C1', { meanMax: '12' })] }))
    expect(report.perCca[0]?.range).toEqual({ meanMin: 12, meanMax: 12, sdMin: 1.5, sdMax: 5 })
    expect(report.perCca[0]?.status).toBe('out_of_range')
    expect(report.perCca[1]?.range).toEqual(DEFAULT_CONFIG.meanSdDefault)
  })

  it('a waiver range lets otherwise failing scores pass', () => {
    const scores = [20, 20, 15, 12, 10, 8, 5]
    const files = scenario({ leaders: { C1: leaderRows('C1', scores), C2: leaderRows('C2') } })
    expect(codesOf(run(files))).toEqual(['MEAN_SD_OUT_OF_RANGE'])
    const settings = [settingsDefaultRow(), settingsWaiverRow('C1', { meanMin: '10', meanMax: '14', sdMin: '2', sdMax: '6' })]
    const withWaiver = scenario({ settings, leaders: { C1: leaderRows('C1', scores), C2: leaderRows('C2') } })
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

describe('levels and tweaks come from the sandbox table', () => {
  const head = { ...lastOf({ outgoingRole: 'head' }), C2: leaderRows('C2') }
  const c1Of = (report: ImportReport) => report.input?.ccas.find((c) => c.ccaID === 'C1')
  const netOf = (report: ImportReport, n: number) => {
    if (!report.input) throw new Error('expected an engine input')
    const { results } = computeAll(report.input, DEFAULT_CONFIG)
    return results.find((r) => r.matric === matricOf(n))?.memberships.find((m) => m.ccaID === 'C1')
  }

  it('input.ccas carries type from the bundle, ranges from the waivers and level / overrides from the table', () => {
    const settings = [settingsDefaultRow(), settingsWaiverRow('C1')]
    const report = run(scenario({ settings }), DEFAULT_CONFIG, levelsWith(entry('C1', { level: 'Low Gold', bonusOverride: 2 })))
    expect(report.issues).toEqual([])
    expect(report.input?.ccas).toEqual([
      { ccaID: 'C1', ccaName: 'Test CCA One', type: '1x', level: 'Low Gold', bonusOverride: 2, multiplierOverride: null, meanMin: 12, meanMax: 15, sdMin: 1.5, sdMax: 5 },
      { ccaID: 'C2', ccaName: 'Test CCA Two', type: '0.5x', level: 'Low Bronze', bonusOverride: null, multiplierOverride: null, meanMin: null, meanMax: null, sdMin: null, sdMax: null },
    ])
    expect(report.perCca[0]).toMatchObject({ type: '1x', isSport: false, level: 'Low Gold', bonusOverride: 2, multiplierOverride: null, outgoingLeaders: 0 })
  })

  it('a multiplier tweak is what an outgoing head gets in bidding', () => {
    const report = run(scenario({ leaders: head }), DEFAULT_CONFIG, levelsWith(entry('C1', { level: 'High Gold', multiplierOverride: 1.4 })))
    expect(report.issues).toEqual([])
    expect(c1Of(report)).toMatchObject({ level: 'High Gold', multiplierOverride: 1.4 })
    expect(report.perCca[0]?.outgoingLeaders).toBe(1)
    expect(netOf(report, 6)?.bidNet).toBeCloseTo(18 * 1.4 + 4, 9)
  })

  it("a bonus tweak replaces the level's bonus for every member", () => {
    const plain = netOf(run(scenario(), DEFAULT_CONFIG, levelsWith(entry('C1', { level: 'Pass' }))), 1)?.stayNet ?? Number.NaN
    const tweaked = netOf(run(scenario(), DEFAULT_CONFIG, levelsWith(entry('C1', { level: 'Pass', bonusOverride: 3 }))), 1)?.stayNet
    expect(tweaked).toBeCloseTo(plain + 3, 9)
  })

  it('an outgoing leader with no level is only LEVEL_NOT_SET, a warning', () => {
    const report = run(scenario({ leaders: head }), DEFAULT_CONFIG, levelsWith(entry('C1')))
    expect(codesOf(report)).toEqual(['LEVEL_NOT_SET'])
    expect(report.canCompute).toBe(true)
    expect(c1Of(report)).toMatchObject({ level: null, bonusOverride: null, multiplierOverride: null })
  })

  it('UNKNOWN_LEVEL names the CCA and the levels in Settings', () => {
    const [issue] = run(scenario(), DEFAULT_CONFIG, levelsWith(entry('C1', { level: 'Platinum' }))).issues
    expect(issue).toMatchObject({ severity: 'error', code: 'UNKNOWN_LEVEL', ccaID: 'C1' })
    expect(issue?.message).toMatch(/"Platinum" is not one of the levels in Settings \(Unsatisfactory, .*High Gold\)/)
  })

  it('a level removed from Settings while an entry names it is UNKNOWN_LEVEL and blocks compute, never an engine throw', () => {
    const config = { ...DEFAULT_CONFIG, levels: DEFAULT_CONFIG.levels.filter((l) => l.name !== 'High Gold') }
    const report = run(scenario(), config)
    expect(codesOf(report)).toEqual(['UNKNOWN_LEVEL'])
    expect(report.canCompute).toBe(false)
    expect(report.input).toBeUndefined()
    expect(report.perCca[0]?.level).toBeNull()
  })

  it('LEVEL_NOT_SET only for a non-flat CCA that has a points file', () => {
    const ccas = [...baseCcas(), flatCca(), { ccaID: 'C4', ccaName: 'Test CCA Four', type: '1x' }]
    const report = run(scenario({ ccas, flat: flatRows() }), DEFAULT_CONFIG, {})
    const notSet = report.issues.filter((i) => i.code === 'LEVEL_NOT_SET')
    expect(notSet.map((i) => [i.ccaID, i.severity])).toEqual([['C1', 'warning'], ['C2', 'warning']])
  })

  it('TYPE_NOT_SET assumes 1x, and is not raised for a flat CCA', () => {
    const report = run(scenario({ ccas: patchRow(baseCcas(), 0, { type: '' }) }))
    expect(report.issues.map((i) => [i.code, i.ccaID, i.severity])).toEqual([['TYPE_NOT_SET', 'C1', 'warning']])
    expect(c1Of(report)?.type).toBe('1x')
    expect(report.perCca[0]?.type).toBeNull()
    const flatBlank = run(scenario({ ccas: [...baseCcas(), { ...flatCca(), type: '' }], flat: flatRows() }))
    expect(flatBlank.issues).toEqual([])
  })

  it('an entry for a flat CCA is ignored without an issue', () => {
    const report = run(scenario({ ccas: [...baseCcas(), flatCca()], flat: flatRows() }), DEFAULT_CONFIG, levelsWith(entry('C3', { level: 'Pass' })))
    expect(report.issues).toEqual([])
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

  it('does not mutate its inputs, the sandbox values included', () => {
    const sandbox = deepFreeze({ ccaLevels: [...DEMO_LEVELS, entry('C9', { level: 'Platinum', bonusOverride: -1 })] })
    expect(() => run(deepFreeze([...files]), deepFreeze({ ...DEFAULT_CONFIG }), sandbox)).not.toThrow()
  })
})
