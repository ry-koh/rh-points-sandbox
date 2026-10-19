import { describe, expect, it } from 'vitest'
import { DEFAULT_CONFIG } from '../../engine'
import { deepFreeze } from '../../engine/__tests__/helpers'
import { parseCsv } from '../csv'
import { parseBundle } from '../parseBundle'
import { validateImport } from '../validate'
import type { BundleRow, ImportReport, SourceFile } from '../types'
import {
  BUNDLE_FILE_NAME,
  DEMO_LEVELS,
  FLAT_COLS,
  baseCcas,
  bundleCcaRow,
  bundleFile,
  bundleRows,
  flatCca,
  flatRows,
  leaderRows,
  scenario,
  settingsDefaultRow,
  settingsFile,
  settingsWaiverRow,
  toCsv,
  type Row,
} from './fixtures'

const parse = (rows: readonly Row[]) => parseBundle(BUNDLE_FILE_NAME, parseCsv(bundleFile(rows).text))
const codesOf = (issues: readonly { readonly code: string }[]): string[] => [...new Set(issues.map((i) => i.code))].sort()
const ccaRowsOf = (rows: readonly BundleRow[]) => rows.flatMap((r) => (r.section === 'cca' ? [r.row] : []))
const run = (files: readonly SourceFile[]): ImportReport => validateImport(files, DEFAULT_CONFIG, { ccaLevels: DEMO_LEVELS })

const sport = (patch: Row = {}): Row => ({ ccaID: 'C5', ccaName: 'Test Sport', type: '1x', sport: 'Y', ihgResult: '1st', ihgCap: '12', ...patch })

describe('parseBundle: a clean bundle', () => {
  const result = parse(bundleRows([...baseCcas(), sport(), flatCca()], [settingsDefaultRow(), settingsWaiverRow('C1')], flatRows()))

  it('has no issues', () => {
    expect(result.issues).toEqual([])
  })

  it('splits the rows into their sections, in file order', () => {
    expect(result.rows.map((r) => r.section)).toEqual(['settings', 'settings', 'cca', 'cca', 'cca', 'cca', ...Array(6).fill('flat')])
  })

  it('reads every cca column; blank IHG columns and a blank flat value are null', () => {
    expect(ccaRowsOf(result.rows)).toEqual([
      { line: 4, ccaID: 'C1', ccaName: 'Test CCA One', flatPoints: null, type: '1x', isSport: false, ihgResult: null, ihgCap: null },
      { line: 5, ccaID: 'C2', ccaName: 'Test CCA Two', flatPoints: null, type: '0.5x', isSport: false, ihgResult: null, ihgCap: null },
      { line: 6, ccaID: 'C5', ccaName: 'Test Sport', flatPoints: null, type: '1x', isSport: true, ihgResult: '1st', ihgCap: 12 },
      { line: 7, ccaID: 'C3', ccaName: 'Test Flat C3', flatPoints: 12, type: '1x', isSport: false, ihgResult: null, ihgCap: null },
    ])
  })

  it('lists the cca ids in first-seen order', () => {
    expect(result.seenKeys).toEqual(['C1', 'C2', 'C5', 'C3'])
  })

  it('accepts a sport with a blank result and cap, and a blank type', () => {
    const blanks = parse(bundleRows([sport({ ihgResult: '', ihgCap: '', type: '' })]))
    expect(blanks.issues).toEqual([])
    expect(ccaRowsOf(blanks.rows)[0]).toMatchObject({ type: null, isSport: true, ihgResult: null, ihgCap: null })
  })

  it('reads LF-only text the same as CRLF', () => {
    const text = bundleFile(bundleRows(baseCcas())).text
    const crlf = parseBundle(BUNDLE_FILE_NAME, parseCsv(text.replaceAll('\n', '\r\n')))
    expect(parseBundle(BUNDLE_FILE_NAME, parseCsv(text))).toEqual(crlf)
  })

  it('does not mutate its input', () => {
    const csv = deepFreeze(parseCsv(bundleFile(bundleRows(baseCcas())).text))
    expect(() => parseBundle(BUNDLE_FILE_NAME, csv)).not.toThrow()
  })
})

describe('parseBundle: column rules per section (R14, R58)', () => {
  it('BAD_BUNDLE_FILE for a value in a column the section does not use, naming the line and column', () => {
    const result = parse(bundleRows(baseCcas(), [settingsDefaultRow()], [{ ...flatRows()[0], type: '1x' } as Row]))
    expect(result.issues).toEqual([
      expect.objectContaining({ code: 'BAD_BUNDLE_FILE', line: 5, column: 'type', ccaID: 'C3', severity: 'error' }),
    ])
  })

  it('BAD_BUNDLE_FILE for a settings value on a cca row', () => {
    const result = parse([settingsDefaultRow({ section: 'settings' }), { ...bundleCcaRow(baseCcas()[0] ?? {}), meanMin: '10' }])
    expect(result.issues).toEqual([expect.objectContaining({ code: 'BAD_BUNDLE_FILE', column: 'meanMin', line: 3 })])
  })

  it('BAD_BUNDLE_FILE for an unknown section', () => {
    const result = parse([...bundleRows(baseCcas()), { ...bundleCcaRow(sport()), section: 'ccas' }])
    expect(result.issues).toEqual([expect.objectContaining({ code: 'BAD_BUNDLE_FILE', column: 'section', line: 5 })])
    expect(result.issues[0]?.message).toContain('section "ccas" must be one of: settings, cca, flat.')
  })

  it('BAD_BUNDLE_FILE for an IHG column on a sport = N row; the values are dropped', () => {
    const result = parse(bundleRows([sport({ sport: 'N', ihgResult: '', ihgCap: '12' })]))
    expect(result.issues).toEqual([expect.objectContaining({ code: 'BAD_BUNDLE_FILE', column: 'ihgCap', line: 3, ccaID: 'C5' })])
    expect(ccaRowsOf(result.rows)[0]).toMatchObject({ isSport: false, ihgResult: null, ihgCap: null })
    const both = parse(bundleRows([sport({ sport: 'N' })]))
    expect(both.issues.map((i) => i.column)).toEqual(['ihgResult', 'ihgCap'])
  })

  it.each(['0', '12.5', '-3', 'ten'])('BAD_IHG_CAP for "%s"; the row is kept with no cap', (cap) => {
    const result = parse(bundleRows([sport({ ihgCap: cap })]))
    expect(codesOf(result.issues)).toEqual(['BAD_IHG_CAP'])
    expect(ccaRowsOf(result.rows)[0]).toMatchObject({ ihgResult: '1st', ihgCap: null })
  })

  it('BAD_YN for a blank or unknown sport, BAD_ENUM for a bad type or result', () => {
    expect(codesOf(parse(bundleRows([sport({ sport: '' })])).issues)).toContain('BAD_YN')
    expect(codesOf(parse(bundleRows([sport({ type: '2x' })])).issues)).toEqual(['BAD_ENUM'])
    expect(codesOf(parse(bundleRows([sport({ ihgResult: '4th' })])).issues)).toEqual(['BAD_ENUM'])
    expect(ccaRowsOf(parse(bundleRows([sport({ type: '2x' })])).rows)).toEqual([])
  })

  it('BAD_FLAT_POINTS for a bad flat value on a cca row', () => {
    expect(codesOf(parse(bundleRows([flatCca('C3', 'lots')])).issues)).toEqual(['BAD_FLAT_POINTS'])
  })

  it('BAD_BUNDLE_FILE for a cca row with no ccaID', () => {
    const result = parse(bundleRows([...baseCcas(), { ccaName: 'Nameless', type: '1x' }]))
    expect(result.issues).toEqual([expect.objectContaining({ code: 'BAD_BUNDLE_FILE', column: 'ccaID' })])
  })
})

describe('parseBundle: file-level rules', () => {
  it('BAD_BUNDLE_FILE when there are no cca rows at all', () => {
    const result = parse(bundleRows([]))
    expect(result.issues).toEqual([
      { severity: 'error', code: 'BAD_BUNDLE_FILE', fileName: BUNDLE_FILE_NAME, message: `${BUNDLE_FILE_NAME}: there are no cca rows; the bundle must list the CCAs.` },
    ])
  })

  it('DUPLICATE_CCA for a second cca row with one id; the later row is ignored', () => {
    const result = parse(bundleRows([...baseCcas(), { ...baseCcas()[0], type: '0.5x' }]))
    expect(codesOf(result.issues)).toEqual(['DUPLICATE_CCA'])
    expect(ccaRowsOf(result.rows).map((r) => [r.ccaID, r.type])).toEqual([['C1', '1x'], ['C2', '0.5x']])
  })

  it('BAD_FORMAT_VERSION once, whatever the section, and nothing else', () => {
    const rows = bundleRows(baseCcas()).map((row) => ({ ...row, formatVersion: '2' }))
    expect(parse(rows).issues.map((i) => i.code)).toEqual(['BAD_FORMAT_VERSION'])
  })

  it('BAD_SETTINGS_FILE without exactly one default row, with the settings file wording', () => {
    const two = parse(bundleRows(baseCcas(), [settingsDefaultRow(), settingsDefaultRow()]))
    expect(two.issues.map((i) => i.message)).toEqual([
      `${BUNDLE_FILE_NAME}: there are 2 default rows (scope "default"); exactly one is needed.`,
    ])
    expect(codesOf(parse(bundleRows(baseCcas(), [])).issues)).toEqual(['BAD_SETTINGS_FILE'])
  })

  it('settings rows keep the settings rules: DUPLICATE_WAIVER, BAD_RANGE and the scope check', () => {
    const settings = [settingsDefaultRow(), settingsWaiverRow('C1'), settingsWaiverRow('C1'), settingsWaiverRow('C2', { meanMin: 'low' }), settingsWaiverRow('C2', { scope: 'cca' })]
    expect(codesOf(parse(bundleRows(baseCcas(), settings)).issues)).toEqual(['BAD_RANGE', 'BAD_SETTINGS_FILE', 'DUPLICATE_WAIVER'])
  })
})

describe('the bundle in an import', () => {
  const codes = (report: ImportReport): string[] => codesOf(report.issues)

  it('reports the bundle: file name, exportedAt and every cca row in ccaID order', () => {
    const report = run(scenario({ ccas: [sport({ ccaID: 'C9' }), ...baseCcas()], leaders: { C1: leaderRows('C1'), C2: leaderRows('C2'), C9: leaderRows('C9') } }))
    expect(report.bundle?.fileName).toBe(BUNDLE_FILE_NAME)
    expect(report.bundle?.exportedAt).toBe('2027-04-01T09:30:00.000Z')
    expect(report.bundle?.ccas.map((c) => c.ccaID)).toEqual(['C1', 'C2', 'C9'])
    expect(report.bundle?.ccas[2]).toEqual({ ccaID: 'C9', ccaName: 'Test Sport', flatPoints: null, type: '1x', isSport: true, ihgResult: '1st', ihgCap: 12 })
    expect(report.perCca.find((c) => c.ccaID === 'C9')).toMatchObject({ isSport: true, ihgResult: '1st', ihgCap: 12 })
  })

  it('has no bundle without a bundle file', () => {
    expect(run(scenario({ bundle: null })).bundle).toBeNull()
  })

  it('DUPLICATE_BUNDLE_FILE for a second bundle, which is ignored', () => {
    const older = bundleFile(bundleRows([...baseCcas(), sport()]), 'points_bundle_20270301.csv')
    const report = run(scenario({ extra: [older] }))
    expect(codes(report)).toEqual(['DUPLICATE_BUNDLE_FILE'])
    expect(report.issues[0]?.message).toMatch(/Remove the older bundle\.$/)
    expect(report.bundle?.ccas.map((c) => c.ccaID)).toEqual(['C1', 'C2'])
  })

  it('a standalone settings or flat file beside the bundle is a duplicate and is ignored', () => {
    const settings = settingsFile([settingsDefaultRow({ meanMax: '19' })])
    const flat = { name: 'flat_points_20270401.csv', text: toCsv(FLAT_COLS, flatRows('C1')) }
    const report = run(scenario({ extra: [settings, flat] }))
    expect(codes(report)).toEqual(['DUPLICATE_FLAT_FILE', 'DUPLICATE_SETTINGS_FILE'])
    expect(report.settings?.defaultRange.meanMax).toBe(14)
  })

  it('a cca row with flatPoints and no member rows is a flat CCA with no members', () => {
    const report = run(scenario({ ccas: [...baseCcas(), flatCca('C3', '9')] }))
    expect(report.issues).toEqual([])
    expect(report.perCca.find((c) => c.ccaID === 'C3')).toMatchObject({ status: 'flat', n: 0, flatPoints: 9, fileName: BUNDLE_FILE_NAME })
    expect(report.input?.memberships.filter((m) => m.ccaID === 'C3')).toEqual([])
  })

  it('FLAT_AND_LEADER_FILE for a cca row with flatPoints that also has a points file', () => {
    const report = run(scenario({ ccas: [baseCcas()[0] ?? {}, { ...flatCca('C2') }] }))
    expect(codes(report)).toEqual(['FLAT_AND_LEADER_FILE'])
  })

  it('FLAT_VALUE_MISMATCH when the member rows disagree with the cca row, or the cca row has no value', () => {
    expect(codes(run(scenario({ ccas: [...baseCcas(), flatCca('C3', '11')], flat: flatRows() })))).toEqual(['FLAT_VALUE_MISMATCH'])
    const blank = run(scenario({ ccas: [...baseCcas(), { ...flatCca(), flatPoints: '' }], flat: flatRows() }))
    expect(codes(blank)).toEqual(['FLAT_VALUE_MISMATCH'])
    expect(blank.issues[0]?.message).toContain('but blank on its cca row')
  })

  it('SETTINGS_UNKNOWN_CCA for a waiver of a CCA the bundle does not list', () => {
    const report = run(scenario({ settings: [settingsDefaultRow(), settingsWaiverRow('C9')] }))
    expect(codes(report)).toEqual(['SETTINGS_UNKNOWN_CCA'])
    expect(report.issues[0]?.message).toContain(`not listed in ${BUNDLE_FILE_NAME}`)
    expect(report.settings?.waivers).toEqual({})
  })
})
