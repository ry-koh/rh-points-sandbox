import type { CcaLevelEntry, SourceFile } from '../types'

export type Row = Readonly<Record<string, string>>

export const LEADER_COLS = [
  'formatVersion', 'ccaID', 'ccaName', 'matric', 'name',
  'basePoints', 'semesterOnly', 'outgoingRole', 'incomingRole', 'exportedAt',
]
export const RESIDENT_COLS = ['matric', 'name', 'gender', 'sem2', 'aux', 'jcrc']
export const FLAT_COLS = ['formatVersion', 'ccaID', 'ccaName', 'matric', 'name', 'flatPoints', 'exportedAt']
export const IHG_COLS = ['matric', 'ccaID', 'placement']
export const BUNDLE_COLS = [
  'formatVersion', 'section', 'scope', 'ccaID', 'ccaName', 'matric', 'name', 'flatPoints', 'type', 'sport',
  'ihgResult', 'ihgCap', 'meanMin', 'meanMax', 'sdMin', 'sdMax', 'note', 'exportedAt',
]
export const BUNDLE_FILE_NAME = 'points_bundle_20270401.csv'

/** Mean 13, population SD 3.42: inside the default 10-14 / 2-5 ranges. */
export const BASE_SCORES = [8, 10, 12, 14, 16, 18]

const EXPORTED_AT = '2027-04-01T00:00:00Z'

export const matricOf = (n: number): string => `A99${String(n).padStart(5, '0')}Z`

const quote = (cell: string): string =>
  /[",\n]/.test(cell) ? `"${cell.replaceAll('"', '""')}"` : cell

export function toCsv(cols: readonly string[], rows: readonly Row[]): string {
  const lines = rows.map((row) => cols.map((col) => quote(row[col] ?? '')).join(','))
  return [cols.join(','), ...lines].join('\n') + '\n'
}

export function baseResidents(count = 10): Row[] {
  return Array.from({ length: count }, (_, i) => ({
    matric: matricOf(i + 1),
    name: `Test Resident ${String(i + 1).padStart(3, '0')}`,
    gender: i % 2 === 0 ? 'M' : 'F',
    sem2: 'N',
    aux: '5',
    jcrc: 'N',
  }))
}

/** CCA specs for the bundle's cca rows: C1 1x, C2 0.5x; neither is a sport. */
export function baseCcas(): Row[] {
  return [
    { ccaID: 'C1', ccaName: 'Test CCA One', type: '1x' },
    { ccaID: 'C2', ccaName: 'Test CCA Two', type: '0.5x' },
  ]
}

/** The level table that keeps the old numbers: C1 was gold, C2 bronze. */
export const DEMO_LEVELS: readonly CcaLevelEntry[] = [
  { ccaID: 'C1', level: 'High Gold', bonusOverride: null, multiplierOverride: null },
  { ccaID: 'C2', level: 'Low Bronze', bonusOverride: null, multiplierOverride: null },
]

export function leaderRows(ccaID: string, scores: readonly number[] = BASE_SCORES): Row[] {
  return scores.map((score, i) => ({
    formatVersion: '1',
    ccaID,
    ccaName: `Test CCA ${ccaID}`,
    matric: matricOf(i + 1),
    name: `Test Resident ${String(i + 1).padStart(3, '0')}`,
    basePoints: String(score),
    semesterOnly: 'N',
    outgoingRole: 'none',
    incomingRole: 'none',
    exportedAt: EXPORTED_AT,
  }))
}

export const leaderFileName = (ccaID: string): string => `points_${ccaID}_20270401.csv`
export const FLAT_FILE_NAME = 'flat_points_20270401.csv'

/** A CCA spec with a flat value: a flat CCA (no leader file; its type and level are not used). */
export function flatCca(ccaID = 'C3', value = '12'): Row {
  return { ccaID, ccaName: `Test Flat ${ccaID}`, type: '1x', flatPoints: value }
}

/** Flat member rows for residents 1..count of one flat CCA. */
export function flatRows(ccaID = 'C3', value = '12', count = 6): Row[] {
  return Array.from({ length: count }, (_, i) => ({
    formatVersion: '1',
    ccaID,
    ccaName: `Test Flat ${ccaID}`,
    matric: matricOf(i + 1),
    name: `Test Resident ${String(i + 1).padStart(3, '0')}`,
    flatPoints: value,
    exportedAt: EXPORTED_AT,
  }))
}

/** Patches one row; a negative index counts from the end. */
export function patchRow(rows: readonly Row[], index: number, patch: Row): Row[] {
  const at = index < 0 ? rows.length + index : index
  return rows.map((row, i) => (i === at ? { ...row, ...patch } : row))
}

export const SETTINGS_COLS = [
  'formatVersion', 'scope', 'ccaID', 'ccaName', 'meanMin', 'meanMax', 'sdMin', 'sdMax', 'note', 'exportedAt',
]
export const SETTINGS_FILE_NAME = 'points_settings_20270401.csv'
const SETTINGS_EXPORTED_AT = '2027-04-01T09:30:00.000Z'

/** The `default` settings row: 10-14 / 2-5, like the app's built-in default. */
export const settingsDefaultRow = (patch: Row = {}): Row => ({
  formatVersion: '1', scope: 'default', ccaID: '', ccaName: '', meanMin: '10', meanMax: '14', sdMin: '2', sdMax: '5', note: '', exportedAt: SETTINGS_EXPORTED_AT, ...patch,
})

/** A `waiver` settings row: 12-15 / 1.5-5 unless patched. */
export const settingsWaiverRow = (ccaID: string, patch: Row = {}): Row => ({
  formatVersion: '1', scope: 'waiver', ccaID, ccaName: `Test CCA ${ccaID}`, meanMin: '12', meanMax: '15', sdMin: '1.5', sdMax: '5', note: 'Small CCA', exportedAt: SETTINGS_EXPORTED_AT, ...patch,
})

/** A standalone points settings file (superseded by the bundle). */
export const settingsFile = (rows: readonly Row[] = [settingsDefaultRow()], name = SETTINGS_FILE_NAME): SourceFile => ({
  name,
  text: toCsv(SETTINGS_COLS, rows),
})

/** A cca row of the bundle from a spec; sport defaults to N. */
export const bundleCcaRow = (spec: Row): Row => ({
  formatVersion: '1',
  section: 'cca',
  ccaID: spec.ccaID ?? '',
  ccaName: spec.ccaName ?? '',
  flatPoints: spec.flatPoints ?? '',
  type: spec.type ?? '',
  sport: spec.sport ?? 'N',
  ihgResult: spec.ihgResult ?? '',
  ihgCap: spec.ihgCap ?? '',
  exportedAt: SETTINGS_EXPORTED_AT,
})

/** The bundle's rows in the app's order: settings, cca, flat. */
export function bundleRows(
  ccas: readonly Row[],
  settings: readonly Row[] = [settingsDefaultRow()],
  flat: readonly Row[] = [],
): Row[] {
  return [
    ...settings.map((row) => ({ ...row, section: 'settings' })),
    ...ccas.map(bundleCcaRow),
    ...flat.map((row) => ({ ...row, section: 'flat' })),
  ]
}

/** A bundle file from hand-built rows. */
export const bundleFile = (rows: readonly Row[], name = BUNDLE_FILE_NAME): SourceFile => ({
  name,
  text: toCsv(BUNDLE_COLS, rows),
})

export interface Scenario {
  readonly residents: readonly Row[] | null
  /** The bundle's cca rows as specs: ccaID, ccaName, type and optionally sport, ihgResult, ihgCap, flatPoints. */
  readonly ccas: readonly Row[]
  /** The bundle's settings rows (SETTINGS_COLS shape). */
  readonly settings: readonly Row[]
  /** The bundle's flat member rows (FLAT_COLS shape). */
  readonly flat: readonly Row[] | null
  /** null leaves the bundle out. */
  readonly bundle: null | undefined
  readonly leaders: Readonly<Record<string, readonly Row[]>>
  readonly ihg: readonly Row[] | null
  readonly extra: readonly SourceFile[]
}

/** A valid import (10 residents, C1 and C2 in one bundle with a default range, no IHG) with any part replaced. */
export function scenario(overrides: Partial<Scenario> = {}): SourceFile[] {
  const s: Scenario = {
    residents: baseResidents(),
    ccas: baseCcas(),
    settings: [settingsDefaultRow()],
    flat: null,
    bundle: undefined,
    leaders: { C1: leaderRows('C1'), C2: leaderRows('C2') },
    ihg: null,
    extra: [],
    ...overrides,
  }
  const files: SourceFile[] = []
  if (s.residents) files.push({ name: 'residents.csv', text: toCsv(RESIDENT_COLS, s.residents) })
  if (s.bundle !== null) files.push(bundleFile(bundleRows(s.ccas, s.settings, s.flat ?? [])))
  for (const [ccaID, rows] of Object.entries(s.leaders)) {
    files.push({ name: leaderFileName(ccaID), text: toCsv(LEADER_COLS, rows) })
  }
  if (s.ihg) files.push({ name: 'ihg.csv', text: toCsv(IHG_COLS, s.ihg) })
  return [...files, ...s.extra]
}
