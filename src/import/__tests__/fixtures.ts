import type { SourceFile } from '../types'

export type Row = Readonly<Record<string, string>>

export const LEADER_COLS = [
  'formatVersion', 'ccaID', 'ccaName', 'matric', 'name',
  'basePoints', 'semesterOnly', 'outgoingRole', 'incomingRole', 'exportedAt',
]
export const RESIDENT_COLS = ['matric', 'name', 'gender', 'sem2', 'aux']
export const IHG_COLS = ['matric', 'ccaID', 'placement']
export const CCA_COLS = [
  'ccaID', 'ccaName', 'type', 'placement', 'outgoingTier', 'outgoingMultiplier',
  'meanMin', 'meanMax', 'sdMin', 'sdMax',
]

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
  }))
}

export function baseCcas(): Row[] {
  const blank = {
    outgoingTier: '',
    outgoingMultiplier: '',
    meanMin: '',
    meanMax: '',
    sdMin: '',
    sdMax: '',
  }
  return [
    { ccaID: 'C1', ccaName: 'Test CCA One', type: '1x', placement: 'gold', ...blank },
    { ccaID: 'C2', ccaName: 'Test CCA Two', type: '0.5x', placement: 'bronze', ...blank },
  ]
}

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

/** Patches one row; a negative index counts from the end. */
export function patchRow(rows: readonly Row[], index: number, patch: Row): Row[] {
  const at = index < 0 ? rows.length + index : index
  return rows.map((row, i) => (i === at ? { ...row, ...patch } : row))
}

export interface Scenario {
  readonly residents: readonly Row[] | null
  readonly ccas: readonly Row[] | null
  readonly leaders: Readonly<Record<string, readonly Row[]>>
  readonly ihg: readonly Row[] | null
  readonly extra: readonly SourceFile[]
}

/** A valid import (10 residents, C1 and C2, no IHG) with any part replaced. */
export function scenario(overrides: Partial<Scenario> = {}): SourceFile[] {
  const s: Scenario = {
    residents: baseResidents(),
    ccas: baseCcas(),
    leaders: { C1: leaderRows('C1'), C2: leaderRows('C2') },
    ihg: null,
    extra: [],
    ...overrides,
  }
  const files: SourceFile[] = []
  if (s.residents) files.push({ name: 'residents.csv', text: toCsv(RESIDENT_COLS, s.residents) })
  if (s.ccas) files.push({ name: 'ccas.csv', text: toCsv(CCA_COLS, s.ccas) })
  for (const [ccaID, rows] of Object.entries(s.leaders)) {
    files.push({ name: leaderFileName(ccaID), text: toCsv(LEADER_COLS, rows) })
  }
  if (s.ihg) files.push({ name: 'ihg.csv', text: toCsv(IHG_COLS, s.ihg) })
  return [...files, ...s.extra]
}
