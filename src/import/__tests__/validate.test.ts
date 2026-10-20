import { describe, expect, it } from 'vitest'
import { DEFAULT_CONFIG, MAX_EXHAUSTIVE_HALVES, computeAll, type ScenarioConfig } from '../../engine'
import { RETIRED_CCAS_COLUMNS, RETIRED_IHG_COLUMNS } from '../detect'
import { fnv1a32 } from '../hash'
import type { AuxEdit } from '../auxEdits'
import type { FlatEdit } from '../flatEdits'
import type { MembershipEdit } from '../membershipEdits'
import type { ReviewEdit } from '../review'
import type { IhgTickEdit } from '../tickEdits'
import { validateImport } from '../validate'
import type { CcaLevelEntry, ImportReport, IssueCode, SandboxInput, SourceFile } from '../types'
import { deepFreeze } from '../../engine/__tests__/helpers'
import {
  BASE_SCORES,
  DEMO_LEVELS,
  LEADER_COLS,
  LEADER_V1_COLS,
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
const retiredIhgFile: SourceFile = { name: 'ihg.csv', text: toCsv(RETIRED_IHG_COLUMNS, [{ matric: matricOf(1), ccaID: 'C1', placement: '1st' }]) }

const v1Rows = (rows: ReturnType<typeof leaderRows>) => rows.map((row) => ({ ...row, formatVersion: '1' }))
/** A leader file with the formatVersion-1 header (10 columns, no ihg). */
const v1File = (ccaID: string, rows: ReturnType<typeof leaderRows>): SourceFile => ({
  name: leaderFileName(ccaID),
  text: toCsv(LEADER_V1_COLS, rows),
})
/** The base scenario with C1's leader file replaced by the given file. */
const withC1File = (file: SourceFile): SourceFile[] => scenario({ leaders: { C2: leaderRows('C2') }, extra: [file] })

/** C1 as a sport with a result and a cap (C2 stays a non-sport). */
const sportC1 = (patch: Record<string, string> = {}) => patchRow(baseCcas(), 0, { sport: 'Y', ihgResult: '1st', ihgCap: '3', ...patch })
const ticked = (ccaID: string, ihg: number[]) => leaderRows(ccaID, BASE_SCORES, { ihg })

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
  { name: 'BAD_FORMAT_VERSION (v2 header, formatVersion 1)', files: scenario({ leaders: { C1: patchRow(c1, -1, { formatVersion: '1' }), C2: leaderRows('C2') } }), codes: ['BAD_FORMAT_VERSION'], blocks: true },
  { name: 'BAD_FORMAT_VERSION (v1 header, formatVersion 2)', files: withC1File(v1File('C1', patchRow(v1Rows(c1), 0, { formatVersion: '2' }))), codes: ['BAD_FORMAT_VERSION'], blocks: true },
  { name: 'BAD_FORMAT_VERSION (formatVersion 3)', files: scenario({ leaders: { C1: patchRow(c1, -1, { formatVersion: '3' }), C2: leaderRows('C2') } }), codes: ['BAD_FORMAT_VERSION'], blocks: true },
  { name: 'MIXED_CCA_ID', files: scenario({ leaders: { ...lastOf({ ccaID: 'C2' }), C2: leaderRows('C2') } }), codes: ['MIXED_CCA_ID'], blocks: true },
  { name: 'DUPLICATE_CCA_FILE', files: scenario({ extra: [{ name: 'points_C1_20270402.csv', text: toCsv(LEADER_COLS, c1) }] }), codes: ['DUPLICATE_CCA_FILE'], blocks: true },
  { name: 'MISSING_RESIDENTS_FILE', files: scenario({ residents: null }), codes: ['MISSING_RESIDENTS_FILE'], blocks: true },
  { name: 'MISSING_BUNDLE_FILE', files: scenario({ bundle: null }), codes: ['MISSING_BUNDLE_FILE'], blocks: true },
  { name: 'DUPLICATE_BUNDLE_FILE', files: scenario({ extra: [bundleFile(bundleRows(baseCcas()), 'points_bundle_20270402.csv')] }), codes: ['DUPLICATE_BUNDLE_FILE'], blocks: true },
  { name: 'CCAS_FILE_RETIRED (the old header)', files: scenario({ extra: [{ name: 'ccas.csv', text: retiredCcasText }] }), codes: ['CCAS_FILE_RETIRED'], blocks: true },
  { name: 'CCAS_FILE_RETIRED (the old header, any name)', files: scenario({ extra: [{ name: 'old.csv', text: retiredCcasText }] }), codes: ['CCAS_FILE_RETIRED'], blocks: true },
  { name: 'CCAS_FILE_RETIRED (the old name)', files: scenario({ extra: [{ name: 'CCAS_2026.csv', text: 'foo,bar\n' }] }), codes: ['CCAS_FILE_RETIRED'], blocks: true },
  { name: 'DUPLICATE_RESIDENTS_FILE', files: scenario({ extra: [duplicateResidentsFile] }), codes: ['DUPLICATE_RESIDENTS_FILE'], blocks: true },
  { name: 'IHG_FILE_RETIRED (the old header)', files: scenario({ extra: [retiredIhgFile] }), codes: ['IHG_FILE_RETIRED'], blocks: true },
  { name: 'IHG_FILE_RETIRED (the old name)', files: scenario({ extra: [{ name: 'IHG_2026.csv', text: 'foo,bar\n' }] }), codes: ['IHG_FILE_RETIRED'], blocks: true },
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
  { name: 'IHG_OVER_CAP', files: scenario({ ccas: sportC1({ ihgCap: '1' }), leaders: { C1: ticked('C1', [0, 1]), C2: leaderRows('C2') } }), codes: ['IHG_OVER_CAP'], blocks: false },
  { name: 'IHG_NOT_SET (warning)', files: scenario({ ccas: sportC1({ ihgResult: '' }), leaders: { C1: ticked('C1', [0]), C2: leaderRows('C2') } }), codes: ['IHG_NOT_SET'], blocks: false },
  { name: 'IHG_TICK_IGNORED (warning)', files: scenario({ leaders: { C1: ticked('C1', [0]), C2: leaderRows('C2') } }), codes: ['IHG_TICK_IGNORED'], blocks: false },
  { name: 'IHG_NO_TICKS (warning)', files: scenario({ ccas: sportC1() }), codes: ['IHG_NO_TICKS'], blocks: false },
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

  it('reads a formatVersion-1 leader file (no ihg column) with no ticks', () => {
    const report = run(withC1File(v1File('C1', v1Rows(c1))))
    expect(report.issues).toEqual([])
    expect(report.input?.memberships.filter((m) => m.ccaID === 'C1')).toHaveLength(6)
    expect(report.input?.ihg).toEqual([])
    expect(report.perCca.map((c) => c.ihgTicked)).toEqual([0, 0])
  })
})

describe("IHG from the leader files' ticks", () => {
  const resultOf = (report: ImportReport, n: number, config: ScenarioConfig = DEFAULT_CONFIG) => {
    if (!report.input) throw new Error('expected an engine input')
    return computeAll(report.input, config).results.find((r) => r.matric === matricOf(n))
  }
  const c1Of = (result: ReturnType<typeof resultOf>) => result?.memberships.find((m) => m.ccaID === 'C1')

  it('builds one IHG entry per ticked member of a sport with a result and a cap', () => {
    const report = run(scenario({ ccas: sportC1(), leaders: { C1: ticked('C1', [0, 2]), C2: leaderRows('C2') } }))
    expect(report.issues).toEqual([])
    expect(report.input?.ihg).toEqual([
      { matric: matricOf(1), ccaID: 'C1', placement: '1st' },
      { matric: matricOf(3), ccaID: 'C1', placement: '1st' },
    ])
    expect(report.perCca.map((c) => [c.ccaID, c.ihgTicked])).toEqual([['C1', 2], ['C2', 0]])
  })

  it('6 ticked, cap 5 -> warning, 6 IHG entries, canCompute true', () => {
    const over = run(scenario({ ccas: sportC1({ ihgCap: '5' }), leaders: { C1: ticked('C1', [0, 1, 2, 3, 4, 5]), C2: leaderRows('C2') } }))
    expect(over.issues[0]).toMatchObject({ severity: 'warning', code: 'IHG_OVER_CAP', fileName: leaderFileName('C1'), ccaID: 'C1' })
    expect(over.canCompute).toBe(true)
    expect(over.input?.ihg).toHaveLength(6)
    expect(over.input?.ihg.every((e) => e.ccaID === 'C1' && e.placement === '1st')).toBe(true)
  })

  it('the three other warnings compute with no IHG for that CCA', () => {
    const notSet = run(scenario({ ccas: sportC1({ ihgCap: '' }), leaders: { C1: ticked('C1', [0]), C2: leaderRows('C2') } }))
    const ignored = run(scenario({ leaders: { C1: ticked('C1', [0]), C2: leaderRows('C2') } }))
    const noTicks = run(scenario({ ccas: sportC1() }))
    for (const report of [notSet, ignored, noTicks]) {
      expect(report.canCompute).toBe(true)
      expect(report.input?.ihg).toEqual([])
    }
  })

  it('two sports, one player ticked in both: two IHG entries whose points sum', () => {
    const ccas = sportC1().map((c) => (c.ccaID === 'C2' ? { ...c, sport: 'Y', ihgResult: '2nd', ihgCap: '3' } : c))
    const report = run(scenario({ ccas, leaders: { C1: ticked('C1', [0]), C2: ticked('C2', [0]) } }))
    expect(report.issues).toEqual([])
    expect(report.input?.ihg).toEqual([
      { matric: matricOf(1), ccaID: 'C1', placement: '1st' },
      { matric: matricOf(1), ccaID: 'C2', placement: '2nd' },
    ])
    expect(resultOf(report, 1)?.bidding.flatIHG).toBe(5 + 4)
    expect(resultOf(report, 1)?.staying.flatIHG).toBe(5 + 4)
  })

  it("ihgInSportNet adds the result's points into that sport's net instead of flat", () => {
    const report = run(scenario({ ccas: sportC1(), leaders: { C1: ticked('C1', [0]), C2: leaderRows('C2') } }))
    const off = resultOf(report, 1)
    const on = resultOf(report, 1, { ...DEFAULT_CONFIG, ihgInSportNet: true })
    expect(off?.bidding.flatIHG).toBe(5)
    expect(on?.bidding.flatIHG).toBe(0)
    expect(c1Of(on)?.ihgNet).toBe(5)
    expect(c1Of(on)?.bidNet).toBeCloseTo((c1Of(off)?.bidNet ?? Number.NaN) + 5, 9)
  })

  it('a ticked semester-only member gets the full IHG points (R47)', () => {
    const rows = patchRow(ticked('C1', [0]), 0, { semesterOnly: 'Y' })
    const report = run(scenario({ ccas: sportC1(), leaders: { C1: rows, C2: leaderRows('C2') } }))
    expect(report.issues).toEqual([])
    expect(resultOf(report, 1)?.bidding.flatIHG).toBe(5)
    const inNet = c1Of(resultOf(report, 1, { ...DEFAULT_CONFIG, ihgInSportNet: true }))
    expect(inNet?.ihgNet).toBe(5)
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

  it('IHG_FILE_RETIRED tells the user to remove the file, and its rows are never read', () => {
    const report = run(scenario({ extra: [retiredIhgFile] }))
    expect(report.issues[0]?.message).toBe(
      "ihg.csv: ihg.csv is no longer used: IHG results come from the RH-app bundle and the sport's head ticks who gets the points in the RH app. Remove this file.",
    )
    expect(report.input).toBeUndefined()
  })

  it('names the version mismatch and the unsupported version', () => {
    const v2AsV1 = run(scenario({ leaders: { C1: patchRow(c1, 0, { formatVersion: '1' }), C2: leaderRows('C2') } }))
    expect(v2AsV1.issues[0]?.message).toBe(
      'points_C1_20270401.csv line 2: formatVersion "1" does not match this file\'s columns: a file with an ihg column is version 2.',
    )
    const v1AsV2 = run(withC1File(v1File('C1', patchRow(v1Rows(c1), 0, { formatVersion: '2' }))))
    expect(v1AsV2.issues[0]?.message).toContain('a file without an ihg column is version 1')
    const v3 = run(scenario({ leaders: { C1: patchRow(c1, 0, { formatVersion: '3' }), C2: leaderRows('C2') } }))
    expect(v3.issues[0]?.message).toContain('formatVersion "3" is not supported; this tool reads versions 1 and 2.')
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

describe('review edits and not-submitting marks', () => {
  const reviewEdit = (patch: Partial<ReviewEdit> = {}): ReviewEdit => ({
    matric: matricOf(6), ccaID: 'C1', from: 18, to: 12, reason: '', at: '2027-04-02T10:00:00.000Z', ...patch,
  })
  const withEdits = (...edits: ReviewEdit[]): Partial<SandboxInput> => ({ ccaLevels: DEMO_LEVELS, edits })
  const c1Score = (report: ImportReport, n: number) =>
    report.input?.memberships.find((m) => m.ccaID === 'C1' && m.matric === matricOf(n))?.basePoints

  it('an edit changes perCca.mean and input.memberships together', () => {
    const before = run(scenario())
    const after = run(scenario(), DEFAULT_CONFIG, withEdits(reviewEdit()))
    expect(c1Score(before, 6)).toBe(18)
    expect(c1Score(after, 6)).toBe(12)
    expect(after.perCca[0]?.mean).toBeCloseTo((8 + 10 + 12 + 14 + 16 + 12) / 6, 9)
    expect(after.perCca[0]?.mean).not.toBeCloseTo(before.perCca[0]?.mean ?? 0, 6)
    expect(after.review.edits).toEqual([{ entry: reviewEdit(), status: 'applied', fileValue: 18 }])
  })

  it("an edit whose file value changed is reported, not applied", () => {
    const corrected = scenario({ leaders: { C1: patchRow(c1, -1, { basePoints: '17' }), C2: leaderRows('C2') } })
    const report = run(corrected, DEFAULT_CONFIG, withEdits(reviewEdit()))
    expect(c1Score(report, 6)).toBe(17)
    expect(report.review.edits).toEqual([{ entry: reviewEdit(), status: 'changed', fileValue: 17 }])
  })

  it('an edit for a membership that is gone is stale', () => {
    const report = run(scenario({ leaders: { C2: leaderRows('C2') } }), DEFAULT_CONFIG, withEdits(reviewEdit()))
    expect(report.review.edits.map((e) => e.status)).toEqual(['stale'])
  })

  it('an edit never changes a tick', () => {
    const files = scenario({ ccas: sportC1(), leaders: { C1: ticked('C1', [5]), C2: leaderRows('C2') } })
    const report = run(files, DEFAULT_CONFIG, withEdits(reviewEdit()))
    expect(c1Score(report, 6)).toBe(12)
    expect(report.input?.ihg).toEqual([{ matric: matricOf(6), ccaID: 'C1', placement: '1st' }])
    expect(report.perCca[0]?.ihgTicked).toBe(1)
  })

  it('not-submitting suppresses NO_LEADER_FILE for that CCA only', () => {
    const files = scenario({ ccas: [...baseCcas(), { ccaID: 'C4', ccaName: 'Test CCA Four', type: '1x' }], leaders: { C1: c1 } })
    const sandbox = { ccaLevels: DEMO_LEVELS, notSubmitting: ['C2'] }
    const noFile = (report: ImportReport) => report.issues.filter((i) => i.code === 'NO_LEADER_FILE').map((i) => i.ccaID)
    expect(noFile(run(files))).toEqual(['C2', 'C4'])
    expect(noFile(run(files, DEFAULT_CONFIG, sandbox))).toEqual(['C4'])
  })

  it("reports each CCA's leader-file hash, null without one, and the flat ids", () => {
    const files = scenario({ ccas: [...baseCcas(), flatCca('C3')], flat: flatRows('C3'), leaders: { C1: c1 } })
    const report = run(files)
    const c1Text = files.find((f) => f.name === leaderFileName('C1'))?.text ?? ''
    expect(report.perCca.map((c) => [c.ccaID, c.fileHash])).toEqual([['C1', fnv1a32(c1Text)], ['C2', null], ['C3', null]])
    expect(report.review).toMatchObject({ edits: [], flatIds: ['C3'], tickEdits: [], flatEdits: [], auxEdits: [], membershipEdits: [], auxUnchecked: false })
  })

  it('a changed leader file changes the hash; a re-downloaded bundle does not', () => {
    const hashOf = (files: readonly SourceFile[]) => run(files).perCca[0]?.fileHash
    const base = scenario()
    expect(hashOf(withText(base, leaderFileName('C1'), (t) => t.replace(',8,', ',9,')))).not.toBe(hashOf(base))
    expect(hashOf(withText(base, 'points_bundle_20270401.csv', (t) => t.replaceAll('2027-04-01T09:30', '2027-04-05T09:30')))).toBe(hashOf(base))
  })

  it('a frozen sandbox input is not mutated', () => {
    const sandbox = deepFreeze({ ccaLevels: DEMO_LEVELS, edits: [reviewEdit(), reviewEdit({ ccaID: 'C9' })], notSubmitting: ['C2'] })
    expect(() => run(deepFreeze(scenario({ leaders: { C1: c1 } })), DEFAULT_CONFIG, sandbox)).not.toThrow()
    expect(sandbox.edits[0]).toEqual(reviewEdit())
  })
})

describe('tick, flat and AUX edits', () => {
  const AT = '2027-04-02T10:00:00.000Z'
  const tickEdit = (n: number, to = true): IhgTickEdit => ({ matric: matricOf(n), ccaID: 'C1', from: !to, to, reason: '', at: AT })
  const flatEdit = (n: number, to: number, from = 12): FlatEdit => ({ matric: matricOf(n), ccaID: 'C3', from, to, reason: '', at: AT })
  const auxEdit = (n: number, to: number, from = 5): AuxEdit => ({ matric: matricOf(n), from, to, reason: '', at: AT })
  const flatScenario = (flat = flatRows('C3'), value = '12') =>
    scenario({ ccas: [...baseCcas(), flatCca('C3', value)], flat, leaders: { C1: c1 } })

  it('a tick edit pushing a sport over its cap -> IHG_OVER_CAP warning AND an entry for every tick', () => {
    const files = scenario({ ccas: sportC1({ ihgCap: '2' }), leaders: { C1: ticked('C1', [0, 1]), C2: leaderRows('C2') } })
    const report = run(files, DEFAULT_CONFIG, { ccaLevels: DEMO_LEVELS, tickEdits: [tickEdit(3)] })
    expect(report.issues.filter((i) => i.code === 'IHG_OVER_CAP')).toHaveLength(1)
    expect(report.canCompute).toBe(true)
    expect(report.input?.ihg.map((e) => e.matric)).toEqual([matricOf(1), matricOf(2), matricOf(3)])
    expect(report.perCca[0]?.ihgTicked).toBe(3)
    expect(report.review.tickEdits).toEqual([{ entry: tickEdit(3), status: 'applied', current: false }])
  })

  it('a tick edit whose file tick moved is changed and not applied', () => {
    const files = scenario({ ccas: sportC1(), leaders: { C1: ticked('C1', [2]), C2: leaderRows('C2') } })
    const report = run(files, DEFAULT_CONFIG, { ccaLevels: DEMO_LEVELS, tickEdits: [tickEdit(3)] })
    expect(report.review.tickEdits.map((e) => e.status)).toEqual(['changed'])
    expect(report.input?.ihg.map((e) => e.matric)).toEqual([matricOf(3)])
  })

  it('a flat edit changes ONE engine membership and the flat table', () => {
    const report = run(flatScenario(), DEFAULT_CONFIG, { ccaLevels: DEMO_LEVELS, flatEdits: [flatEdit(2, 10)] })
    const flatOf = (n: number) => report.input?.memberships.find((m) => m.ccaID === 'C3' && m.matric === matricOf(n))?.flatPoints
    expect(flatOf(2)).toBe(10)
    expect([1, 3, 4, 5, 6].map(flatOf)).toEqual([12, 12, 12, 12, 12])
    expect(report.perCca.find((c) => c.ccaID === 'C3')?.flatPoints).toBe(12)
    expect(report.review.flatEdits).toEqual([{ entry: flatEdit(2, 10), status: 'applied', current: 12 }])
    const table = report.review.flats.find((f) => f.ccaID === 'C3')
    expect(table?.flatPoints).toBe(12)
    expect(table?.rows[1]).toEqual({ matric: matricOf(2), name: 'Test Resident 002', fileValue: 12, value: 10 })
    expect(table?.rows[0]).toMatchObject({ fileValue: 12, value: 12 })
  })

  it('a flat edit is changed when the bundle value moves, stale when the member is gone', () => {
    const moved = run(flatScenario(flatRows('C3', '11'), '11'), DEFAULT_CONFIG, { ccaLevels: DEMO_LEVELS, flatEdits: [flatEdit(2, 10)] })
    expect(moved.review.flatEdits.map((e) => e.status)).toEqual(['changed'])
    expect(moved.input?.memberships.find((m) => m.ccaID === 'C3' && m.matric === matricOf(2))?.flatPoints).toBe(11)
    const gone = run(flatScenario(flatRows('C3', '12', 1)), DEFAULT_CONFIG, { ccaLevels: DEMO_LEVELS, flatEdits: [flatEdit(2, 10)] })
    expect(gone.review.flatEdits.map((e) => e.status)).toEqual(['stale'])
  })

  it('an AUX edit above the cap -> AUX_ABOVE_CAP naming the edited value, and the engine sees it', () => {
    const report = run(scenario(), DEFAULT_CONFIG, { ccaLevels: DEMO_LEVELS, auxEdits: [auxEdit(4, 14)] })
    const above = report.issues.filter((i) => i.code === 'AUX_ABOVE_CAP')
    expect(above).toHaveLength(1)
    expect(above[0]).toMatchObject({ severity: 'warning', matric: matricOf(4) })
    expect(above[0]?.message).toContain(`has 14 AUX; only ${DEFAULT_CONFIG.auxCap} count`)
    expect(report.input?.residents.find((r) => r.matric === matricOf(4))?.aux).toBe(14)
    expect(report.review.auxEdits).toEqual([{ entry: auxEdit(4, 14), status: 'applied', current: 5 }])
    expect(report.review.auxUnchecked).toBe(false)
  })

  it('an AUX edit on a resident missing from a re-dropped residents.csv is stale', () => {
    const report = run(scenario({ residents: baseResidents(3) }), DEFAULT_CONFIG, { ccaLevels: DEMO_LEVELS, auxEdits: [auxEdit(4, 7)] })
    expect(report.review.auxEdits.map((e) => e.status)).toEqual(['stale'])
  })

  it('no residents file -> AUX edits unchecked, never stale', () => {
    const report = run(scenario({ residents: null }), DEFAULT_CONFIG, { ccaLevels: DEMO_LEVELS, auxEdits: [auxEdit(4, 7)] })
    expect(report.review.auxUnchecked).toBe(true)
    expect(report.review.auxEdits).toEqual([])
  })

  it('vetHash: leader hash for a leader CCA, a content hash for a flat CCA, null otherwise', () => {
    const report = run(flatScenario())
    const c1Text = flatScenario().find((f) => f.name === leaderFileName('C1'))?.text ?? ''
    const sorted = [1, 2, 3, 4, 5, 6].map(matricOf).sort().join(',')
    expect(report.perCca.map((c) => [c.ccaID, c.vetHash])).toEqual([
      ['C1', fnv1a32(c1Text)],
      ['C2', null],
      ['C3', fnv1a32(`flat|12|${sorted}`)],
    ])
    expect(report.perCca.find((c) => c.ccaID === 'C3')?.fileHash).toBeNull()
  })

  it('a flat vetHash survives a re-exported bundle but not a new member or a new value', () => {
    const hashOf = (files: readonly SourceFile[]) => run(files).perCca.find((c) => c.ccaID === 'C3')?.vetHash
    const base = flatScenario()
    const reExported = withText(base, 'points_bundle_20270401.csv', (t) => t.replaceAll('2027-04-01T09:30', '2027-04-05T09:30'))
    expect(reExported).not.toEqual(base)
    expect(hashOf(reExported)).toBe(hashOf(base))
    const renamed = flatScenario(patchRow(flatRows('C3'), 0, { name: 'Another Name' }))
    expect(hashOf(renamed)).toBe(hashOf(base))
    expect(hashOf(flatScenario(flatRows('C3', '12', 7)))).not.toBe(hashOf(base))
    expect(hashOf(flatScenario(flatRows('C3', '10'), '10'))).not.toBe(hashOf(base))
  })

  it('a flat edit does not change the flat vetHash', () => {
    const hashOf = (report: ImportReport) => report.perCca.find((c) => c.ccaID === 'C3')?.vetHash
    expect(hashOf(run(flatScenario(), DEFAULT_CONFIG, { ccaLevels: DEMO_LEVELS, flatEdits: [flatEdit(2, 10)] }))).toBe(hashOf(run(flatScenario())))
  })
})

describe('membership edits', () => {
  const AT = '2027-04-02T10:00:00.000Z'
  const memberEdit = (patch: Partial<MembershipEdit> = {}): MembershipEdit =>
    ({ matric: matricOf(6), ccaID: 'C1', field: 'outgoingRole', from: 'none', to: 'head', reason: '', at: AT, ...patch }) as MembershipEdit
  const withMembership = (...membershipEdits: MembershipEdit[]): Partial<SandboxInput> => ({ ...levelsWith(entry('C1', { level: 'High Gold', multiplierOverride: 1.4 })), membershipEdits })
  const c1Net = (report: ImportReport, n = 6) => {
    if (!report.input) throw new Error('expected an engine input')
    const { results } = computeAll(report.input, DEFAULT_CONFIG)
    return results.find((r) => r.matric === matricOf(n))?.memberships.find((m) => m.ccaID === 'C1')
  }
  const plain = run(scenario(), DEFAULT_CONFIG, withMembership())

  it('an outgoing-role edit none -> head raises outgoingLeaders and gives that member the outgoing multiplier in bidding (R3)', () => {
    const report = run(scenario(), DEFAULT_CONFIG, withMembership(memberEdit()))
    expect(report.issues).toEqual([])
    expect(plain.perCca[0]?.outgoingLeaders).toBe(0)
    expect(report.perCca[0]?.outgoingLeaders).toBe(1)
    const bonus = (c1Net(plain)?.bidNet ?? Number.NaN) - 18
    expect(c1Net(report)?.bidNet).toBeCloseTo(18 * 1.4 + bonus, 9)
    expect(report.input?.memberships.find((m) => m.matric === matricOf(6) && m.ccaID === 'C1')?.outgoingRole).toBe('head')
    expect(report.review.membershipEdits).toEqual([{ entry: memberEdit(), status: 'applied', current: 'none' }])
  })

  it('a semester-only edit halves the base in the lists but leaves the mean and SD on full scores (R5)', () => {
    const report = run(scenario(), DEFAULT_CONFIG, withMembership(memberEdit({ field: 'semesterOnly', from: false, to: true } as Partial<MembershipEdit>)))
    expect(report.perCca[0]?.mean).toBe(plain.perCca[0]?.mean)
    expect(report.perCca[0]?.sd).toBe(plain.perCca[0]?.sd)
    expect((c1Net(plain)?.stayNet ?? Number.NaN) - (c1Net(report)?.stayNet ?? Number.NaN)).toBeCloseTo(9, 9)
  })

  it('an incoming-role edit applies the incoming multiplier', () => {
    const report = run(scenario(), DEFAULT_CONFIG, withMembership(memberEdit({ field: 'incomingRole' })))
    const gain = (c1Net(report)?.stayNet ?? Number.NaN) - (c1Net(plain)?.stayNet ?? Number.NaN)
    expect(gain).toBeCloseTo(18 * (DEFAULT_CONFIG.incomingMultiplier.head - 1), 9)
    expect(report.perCca[0]?.outgoingLeaders).toBe(0)
  })

  it("an edit whose file value moved is changed and not applied: the head's file stands (R1)", () => {
    const files = scenario({ leaders: { C1: patchRow(c1, -1, { outgoingRole: 'vice_head' }), C2: leaderRows('C2') } })
    const report = run(files, DEFAULT_CONFIG, withMembership(memberEdit()))
    expect(report.review.membershipEdits.map((e) => [e.status, e.current])).toEqual([['changed', 'vice_head']])
    expect(report.input?.memberships.find((m) => m.matric === matricOf(6) && m.ccaID === 'C1')?.outgoingRole).toBe('vice_head')
  })

  it('an edit on a flat CCA has no membership in a leader file, so it is stale and changes nothing', () => {
    const files = scenario({ ccas: [...baseCcas(), flatCca('C3')], flat: flatRows('C3') })
    const report = run(files, DEFAULT_CONFIG, withMembership(memberEdit({ ccaID: 'C3', matric: matricOf(2) })))
    expect(report.review.membershipEdits.map((e) => e.status)).toEqual(['stale'])
    expect(report.input?.memberships.find((m) => m.matric === matricOf(2) && m.ccaID === 'C3')?.outgoingRole).toBe('none')
  })

  it('a score edit and a membership edit on the same member both apply', () => {
    const scoreEdit: ReviewEdit = { matric: matricOf(6), ccaID: 'C1', from: 18, to: 12, reason: '', at: AT }
    const report = run(scenario(), DEFAULT_CONFIG, { ...withMembership(memberEdit()), edits: [scoreEdit] })
    expect(report.input?.memberships.find((m) => m.matric === matricOf(6) && m.ccaID === 'C1')).toMatchObject({ basePoints: 12, outgoingRole: 'head' })
  })

  it('no membership edits -> an empty list', () => {
    expect(run(scenario()).review.membershipEdits).toEqual([])
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
