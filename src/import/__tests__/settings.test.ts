import { describe, expect, it } from 'vitest'
import { DEFAULT_CONFIG } from '../../engine'
import { parseCsv } from '../csv'
import { detectFileKind } from '../detect'
import { validateImport } from '../validate'
import type { ImportReport, IssueCode, SourceFile } from '../types'
import {
  SETTINGS_FILE_NAME,
  baseCcas,
  leaderRows,
  patchRow,
  scenario,
  settingsDefaultRow,
  settingsFile,
  settingsWaiverRow,
  type Row,
} from './fixtures'

const EXPORTED_AT = '2027-04-01T09:30:00.000Z'

const defaultRow = settingsDefaultRow
const waiverRow = settingsWaiverRow

/** Mean 14.5, population SD 1.58: outside the default 10-14 range, inside the 12-15 / 1.5-5 waiver. */
const E21_SCORES = [11, 14, 14, 15, 15, 15, 15, 17]

const run = (files: readonly SourceFile[], overrides: readonly string[] = []): ImportReport =>
  validateImport(files, DEFAULT_CONFIG, overrides.map((ccaID) => ({ ccaID })))
const codesOf = (report: ImportReport): string[] => [...new Set(report.issues.map((i) => i.code))].sort()
const codeList = (report: ImportReport, code: IssueCode) => report.issues.filter((i) => i.code === code)

/** C1 has the E21 scores; C2 is a normal CCA. The settings file is added by each test. */
const files = (...extra: SourceFile[]): SourceFile[] =>
  scenario({ leaders: { C1: leaderRows('C1', E21_SCORES), C2: leaderRows('C2') }, extra })

const standard = [defaultRow(), waiverRow('C1')]

describe('a points settings file is detected', () => {
  it('by its exact header', () => {
    expect(detectFileKind(parseCsv(settingsFile(standard).text).header)).toBe('settings')
  })

  it('by a points_settings_ name when the header is wrong', () => {
    const bad = { name: SETTINGS_FILE_NAME, text: settingsFile(standard).text.replace('sdMax', 'sdTop') }
    expect(codesOf(run(files(bad)))).toContain('BAD_HEADER')
  })
})

describe('E21: the waiver range applies', () => {
  const withFile = run(files(settingsFile(standard)))
  const withoutFile = run(files())

  it('passes under the settings file and fails under the sandbox default', () => {
    expect(withoutFile.perCca.find((c) => c.ccaID === 'C1')).toMatchObject({ status: 'out_of_range' })
    expect(withFile.perCca.find((c) => c.ccaID === 'C1')).toMatchObject({
      status: 'ok',
      range: { meanMin: 12, meanMax: 15, sdMin: 1.5, sdMax: 5 },
    })
    expect(withFile.canCompute).toBe(true)
    expect(withoutFile.canCompute).toBe(false)
  })

  it('uses the default row for a CCA that has no waiver row', () => {
    expect(withFile.perCca.find((c) => c.ccaID === 'C2')?.range).toEqual({ meanMin: 10, meanMax: 14, sdMin: 2, sdMax: 5 })
  })

  it('reports the loaded settings', () => {
    expect(withFile.settings).toMatchObject({
      fileName: SETTINGS_FILE_NAME,
      exportedAt: EXPORTED_AT,
      defaultRange: { meanMin: 10, meanMax: 14, sdMin: 2, sdMax: 5 },
    })
    expect(withoutFile.settings).toBeNull()
  })
})

describe("the file's default replaces the sandbox default for the check", () => {
  it('uses the file default even when the config says otherwise', () => {
    const narrow = { ...DEFAULT_CONFIG, meanSdDefault: { meanMin: 0, meanMax: 1, sdMin: 0, sdMax: 1 } }
    const report = validateImport(files(settingsFile([defaultRow(), waiverRow('C1')])), narrow, [])
    expect(report.perCca.find((c) => c.ccaID === 'C2')).toMatchObject({ status: 'ok', range: { meanMax: 14 } })
  })

  it('does not consult the config default at all when a settings file is loaded', () => {
    const wide = { ...DEFAULT_CONFIG, meanSdDefault: { meanMin: 0, meanMax: 20, sdMin: 0, sdMax: 10 } }
    const report = validateImport(files(settingsFile([defaultRow({ meanMin: '17', meanMax: '18' })])), wide, [])
    expect(report.perCca.find((c) => c.ccaID === 'C2')?.status).toBe('out_of_range')
  })
})

describe('ccas.csv range columns are ignored while the file is loaded', () => {
  const ccas = patchRow(baseCcas(), 0, { meanMin: '0', meanMax: '1', sdMin: '0', sdMax: '1' })
  const report = run(scenario({ ccas, leaders: { C1: leaderRows('C1', E21_SCORES), C2: leaderRows('C2') }, extra: [settingsFile(standard)] }))

  it('uses the settings ranges, not the ccas.csv ones', () => {
    expect(report.perCca.find((c) => c.ccaID === 'C1')).toMatchObject({ status: 'ok', range: { meanMin: 12, meanMax: 15 } })
  })

  it('warns once, listing the affected CCAs', () => {
    const warnings = codeList(report, 'CCAS_RANGE_IGNORED')
    expect(warnings).toHaveLength(1)
    expect(warnings[0]).toMatchObject({ severity: 'warning' })
    expect(warnings[0]?.message).toContain('C1')
    expect(warnings[0]?.message).not.toContain('C2')
  })

  it('is silent when ccas.csv has no range values', () => {
    expect(codesOf(run(files(settingsFile(standard))))).not.toContain('CCAS_RANGE_IGNORED')
  })

  it('keeps using the ccas.csv ranges when there is no settings file', () => {
    const without = run(scenario({ ccas, leaders: { C1: leaderRows('C1', E21_SCORES), C2: leaderRows('C2') } }))
    expect(without.perCca.find((c) => c.ccaID === 'C1')?.range).toEqual({ meanMin: 0, meanMax: 1, sdMin: 0, sdMax: 1 })
    expect(codesOf(without)).not.toContain('CCAS_RANGE_IGNORED')
  })
})

describe('settings file errors', () => {
  const codesFor = (rows: readonly Row[]): string[] => codesOf(run(files(settingsFile(rows))))

  it('needs exactly one default row: none is BAD_SETTINGS_FILE', () => {
    expect(codesFor([waiverRow('C1')])).toContain('BAD_SETTINGS_FILE')
  })

  it('needs exactly one default row: two is BAD_SETTINGS_FILE', () => {
    expect(codesFor([defaultRow(), defaultRow()])).toContain('BAD_SETTINGS_FILE')
  })

  it('rejects a scope that is neither default nor waiver', () => {
    expect(codesFor([defaultRow(), waiverRow('C1', { scope: 'cca' })])).toContain('BAD_SETTINGS_FILE')
  })

  it('rejects a waiver row with no ccaID', () => {
    expect(codesFor([defaultRow(), waiverRow('', { ccaID: '' })])).toContain('BAD_SETTINGS_FILE')
  })

  it.each([
    ['a non-number', { meanMin: 'low' }],
    ['a blank value', { sdMax: '' }],
    ['a mean above 20', { meanMax: '21' }],
    ['a negative mean', { meanMin: '-1' }],
    ['an SD above 10', { sdMax: '11' }],
    ['a mean minimum above its maximum', { meanMin: '15', meanMax: '12' }],
    ['an SD minimum above its maximum', { sdMin: '6', sdMax: '5' }],
  ])('BAD_RANGE for %s', (_label, patch) => {
    expect(codesFor([defaultRow(), waiverRow('C1', patch)])).toContain('BAD_RANGE')
    expect(codesFor([defaultRow(patch), waiverRow('C1')])).toContain('BAD_RANGE')
  })

  it('BAD_FORMAT_VERSION for another version', () => {
    expect(codesFor([defaultRow({ formatVersion: '2' }), waiverRow('C1')])).toContain('BAD_FORMAT_VERSION')
  })

  it('DUPLICATE_WAIVER when one ccaID appears twice, and the later row is ignored', () => {
    const report = run(files(settingsFile([defaultRow(), waiverRow('C1'), waiverRow('C1', { meanMin: '0', meanMax: '1' })])))
    expect(codesOf(report)).toContain('DUPLICATE_WAIVER')
    expect(report.perCca.find((c) => c.ccaID === 'C1')?.range.meanMin).toBe(12)
  })

  it('DUPLICATE_SETTINGS_FILE for a second file, which is ignored', () => {
    const report = run(files(settingsFile(standard), settingsFile([defaultRow({ meanMax: '19' })], 'points_settings_20270402.csv')))
    expect(codesOf(report)).toContain('DUPLICATE_SETTINGS_FILE')
    expect(report.settings?.defaultRange.meanMax).toBe(14)
  })

  it('blocks results on an error', () => {
    expect(run(files(settingsFile([defaultRow(), defaultRow()]))).canCompute).toBe(false)
  })

  it('a broken settings file does not switch the check to the file', () => {
    const report = run(files(settingsFile([waiverRow('C1')])))
    expect(report.settings).toBeNull()
  })
})

describe('settings file warnings', () => {
  it('SETTINGS_UNKNOWN_CCA for a waiver the ccas list does not have, which is ignored', () => {
    const report = run(files(settingsFile([...standard, waiverRow('C9')])))
    const unknown = codeList(report, 'SETTINGS_UNKNOWN_CCA')
    expect(unknown).toHaveLength(1)
    expect(unknown[0]).toMatchObject({ severity: 'warning', ccaID: 'C9' })
    expect(report.canCompute).toBe(true)
    expect(report.perCca.map((c) => c.ccaID)).not.toContain('C9')
  })

  it('ignores a waiver on a flat CCA without error', () => {
    const report = run(files(settingsFile(standard)))
    expect(report.issues.filter((i) => i.severity === 'error')).toEqual([])
  })
})
