import { describe, expect, it } from 'vitest'
import { DEFAULT_CONFIG } from '../../engine'
import { deepFreeze } from '../../engine/__tests__/helpers'
import { withBundleAux } from '../bundleAux'
import { parseCsv } from '../csv'
import { parseBundle } from '../parseBundle'
import { validateImport } from '../validate'
import type { AuxEdit } from '../auxEdits'
import type { BundleRow, ImportReport, ResidentRow, SourceFile } from '../types'
import {
  BUNDLE_FILE_NAME,
  DEMO_LEVELS,
  baseCcas,
  baseResidents,
  bundleAuxRow,
  bundleFile,
  bundleRows,
  bundleV2File,
  matricOf,
  scenario,
  type Row,
} from './fixtures'

const parseV2 = (aux: readonly Row[], rows: readonly Row[] = bundleRows(baseCcas())) =>
  parseBundle(BUNDLE_FILE_NAME, parseCsv(bundleV2File(rows, aux).text))
const auxRowsOf = (rows: readonly BundleRow[]) => rows.flatMap((r) => (r.section === 'aux' ? [r.row] : []))
const codesOf = (issues: readonly { readonly code: string }[]): string[] => [...new Set(issues.map((i) => i.code))].sort()

/** The base scenario with a version-2 bundle carrying these aux rows, and residents.csv's aux set to `fileAux`. */
function runV2(aux: readonly Row[], fileAux = '0', auxEdits: readonly AuxEdit[] = []): ImportReport {
  const residents = baseResidents().map((r) => ({ ...r, aux: fileAux }))
  const files: SourceFile[] = scenario({ residents, bundle: null, extra: [bundleV2File(bundleRows(baseCcas()), aux)] })
  return validateImport(files, DEFAULT_CONFIG, { ccaLevels: DEMO_LEVELS, auxEdits })
}
const auxOf = (report: ImportReport, matric: string): number | undefined =>
  report.input?.residents.find((r) => r.matric === matric)?.aux

describe('parseBundle: version-2 aux rows', () => {
  it('reads each resident count with its year', () => {
    const result = parseV2([bundleAuxRow(matricOf(1), '3'), bundleAuxRow(matricOf(2), '0')])
    expect(result.issues).toEqual([])
    expect(auxRowsOf(result.rows)).toEqual([
      { line: 5, scope: 'AY2026/27', matric: matricOf(1), name: `Test Resident ${matricOf(1)}`, aux: 3 },
      { line: 6, scope: 'AY2026/27', matric: matricOf(2), name: `Test Resident ${matricOf(2)}`, aux: 0 },
    ])
  })

  it('drops a row with a bad count or matric', () => {
    const result = parseV2([bundleAuxRow(matricOf(1), '1.5'), bundleAuxRow('X1', '2'), bundleAuxRow(matricOf(3), '-1')])
    expect(codesOf(result.issues)).toEqual(['BAD_AUX', 'BAD_MATRIC'])
    expect(auxRowsOf(result.rows)).toEqual([])
  })

  it('needs a points year, the same on every aux row', () => {
    const result = parseV2([
      bundleAuxRow(matricOf(1), '1', { scope: '2026' }),
      bundleAuxRow(matricOf(2), '1'),
      bundleAuxRow(matricOf(3), '1', { scope: 'AY2027/28' }),
    ])
    expect(result.issues.map((i) => [i.code, i.line, i.column])).toEqual([
      ['BAD_BUNDLE_FILE', 5, 'scope'],
      ['BAD_BUNDLE_FILE', 7, 'scope'],
    ])
    expect(auxRowsOf(result.rows).map((r) => r.matric)).toEqual([matricOf(2)])
  })

  it('takes the year from the first row it keeps, not a dropped one', () => {
    const result = parseV2([bundleAuxRow('X1', '1', { scope: 'AY2025/26' }), bundleAuxRow(matricOf(2), '1')])
    expect(codesOf(result.issues)).toEqual(['BAD_MATRIC'])
    expect(auxRowsOf(result.rows).map((r) => r.scope)).toEqual(['AY2026/27'])
  })

  it('ignores a later row for the same matric', () => {
    const result = parseV2([bundleAuxRow(matricOf(1), '1'), bundleAuxRow(matricOf(1), '4')])
    expect(result.issues.map((i) => [i.code, i.line, i.matric])).toEqual([['BAD_BUNDLE_FILE', 6, matricOf(1)]])
    expect(auxRowsOf(result.rows).map((r) => r.aux)).toEqual([1])
  })

  it('refuses a stray cell on an aux row', () => {
    const result = parseV2([bundleAuxRow(matricOf(1), '1', { ccaID: 'C1' })])
    expect(result.issues.map((i) => [i.code, i.column])).toEqual([['BAD_BUNDLE_FILE', 'ccaID']])
  })

  it('refuses version 1 in the version-2 columns, and an aux section in a version-1 file', () => {
    const v1Stamped = parseBundle(BUNDLE_FILE_NAME, parseCsv(bundleV2File(bundleRows(baseCcas())).text.replaceAll('\n2,', '\n1,')))
    expect(codesOf(v1Stamped.issues)).toEqual(['BAD_FORMAT_VERSION'])
    const v1 = parseBundle(BUNDLE_FILE_NAME, parseCsv(bundleFile([...bundleRows(baseCcas()), { formatVersion: '1', section: 'aux' }]).text))
    expect(v1.issues.map((i) => [i.code, i.column])).toEqual([['BAD_BUNDLE_FILE', 'section']])
  })
})

describe('withBundleAux', () => {
  const resident = (n: number, aux: number): ResidentRow => ({
    line: n + 1, matric: matricOf(n), name: `R${n}`, gender: 'M', sem2: false, aux, jcrc: 'N',
  })
  const aux = (rows: readonly [number, number][]) => ({
    fileName: BUNDLE_FILE_NAME,
    year: 'AY2026/27',
    rows: rows.map(([n, count], i) => ({ line: i + 2, scope: 'AY2026/27', matric: matricOf(n), name: '', aux: count })),
  })

  it('uses the bundle count, 0 when a resident has no aux row, and never mutates', () => {
    const residents = deepFreeze([resident(1, 0), resident(2, 0)])
    const out = withBundleAux(residents, 'residents.csv', deepFreeze(aux([[1, 4]])))
    expect(out.rows.map((r) => r.aux)).toEqual([4, 0])
    expect(out.issues).toEqual([])
  })

  it('warns once for every residents.csv count the bundle overrides, but not for zeros', () => {
    const out = withBundleAux([resident(1, 5), resident(2, 5), resident(3, 0), resident(4, 2)], 'residents.csv', aux([[3, 1], [4, 2]]))
    expect(out.issues.map((i) => [i.code, i.severity, i.fileName])).toEqual([['AUX_FROM_BUNDLE', 'warning', 'residents.csv']])
    expect(out.issues[0]?.message).toContain('differs for 2 residents')
  })

  it('ignores, with a warning, a count for someone not in residents.csv', () => {
    const out = withBundleAux([resident(1, 0)], 'residents.csv', aux([[9, 3]]))
    expect(out.rows.map((r) => r.aux)).toEqual([0])
    expect(out.issues.map((i) => [i.code, i.severity, i.matric])).toEqual([['AUX_NOT_A_RESIDENT', 'warning', matricOf(9)]])
  })
})

describe('validateImport with a version-2 bundle', () => {
  it('takes the AUX counts from the bundle and reports its year', () => {
    const report = runV2([bundleAuxRow(matricOf(1), '7'), bundleAuxRow(matricOf(2), '2')])
    expect(report.issues.filter((i) => i.severity === 'error')).toEqual([])
    expect([auxOf(report, matricOf(1)), auxOf(report, matricOf(2)), auxOf(report, matricOf(3))]).toEqual([7, 2, 0])
    expect(report.bundle).toMatchObject({ formatVersion: 2, auxYear: 'AY2026/27' })
  })

  it('has no year when nobody has AUX', () => {
    expect(runV2([]).bundle).toMatchObject({ formatVersion: 2, auxYear: null })
  })

  it('warns when residents.csv still has its own counts', () => {
    const report = runV2([bundleAuxRow(matricOf(1), '12')], '5')
    expect(codesOf(report.issues.filter((i) => i.code.startsWith('AUX_')))).toEqual(['AUX_ABOVE_CAP', 'AUX_FROM_BUNDLE'])
    expect(auxOf(report, matricOf(2))).toBe(0)
  })

  it('judges an AUX edit against the bundle count', () => {
    const at = '2027-04-02T00:00:00Z'
    const applied = runV2([bundleAuxRow(matricOf(1), '3')], '0', [{ matric: matricOf(1), from: 3, to: 4, reason: 'late award', at }])
    expect(applied.review.auxEdits.map((e) => e.status)).toEqual(['applied'])
    expect(auxOf(applied, matricOf(1))).toBe(4)
    const stale = runV2([bundleAuxRow(matricOf(1), '3')], '0', [{ matric: matricOf(1), from: 0, to: 4, reason: '', at }])
    expect(stale.review.auxEdits.map((e) => e.status)).toEqual(['changed'])
    expect(auxOf(stale, matricOf(1))).toBe(3)
  })
})

describe('validateImport with a version-1 bundle', () => {
  it('still takes the AUX counts from residents.csv', () => {
    const report = validateImport(scenario(), DEFAULT_CONFIG, { ccaLevels: DEMO_LEVELS })
    expect(auxOf(report, matricOf(1))).toBe(5)
    expect(report.bundle).toMatchObject({ formatVersion: 1, auxYear: null })
    expect(report.issues.some((i) => i.code === 'AUX_FROM_BUNDLE')).toBe(false)
  })
})

describe('validateImport without a usable bundle', () => {
  it('leaves the AUX edits unchecked: the counts may come from the missing bundle', () => {
    const at = '2027-04-02T00:00:00Z'
    const report = validateImport(scenario({ bundle: null }), DEFAULT_CONFIG, {
      ccaLevels: DEMO_LEVELS,
      auxEdits: [{ matric: matricOf(1), from: 3, to: 4, reason: '', at }],
    })
    expect(report.review.auxUnchecked).toBe(true)
    expect(report.review.auxEdits).toEqual([])
  })

  it('names the version-1 columns when a version-1 header is misspelt', () => {
    const v1 = bundleFile(bundleRows(baseCcas()))
    const text = v1.text.replace(',note,', ',notes,')
    const report = validateImport(scenario({ bundle: null, extra: [{ ...v1, text }] }), DEFAULT_CONFIG, { ccaLevels: DEMO_LEVELS })
    const header = report.issues.find((i) => i.code === 'BAD_HEADER')
    expect(header?.message).toContain('missing note; unexpected notes')
  })
})
