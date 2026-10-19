import type { FileKind } from './types'

/** The leader file's IHG tick column, added in formatVersion 2 (spec 2a). A column, not a file kind. */
export const LEADER_IHG_COLUMN = 'ihg'

/** Exact column names of each file kind (spec section 2). */
export const FILE_COLUMNS: Readonly<Record<FileKind, readonly string[]>> = {
  leader: [
    'formatVersion', 'ccaID', 'ccaName', 'matric', 'name',
    'basePoints', 'semesterOnly', 'outgoingRole', 'incomingRole', LEADER_IHG_COLUMN, 'exportedAt',
  ],
  residents: ['matric', 'name', 'gender', 'sem2', 'aux', 'jcrc'],
  flat: ['formatVersion', 'ccaID', 'ccaName', 'matric', 'name', 'flatPoints', 'exportedAt'],
  settings: [
    'formatVersion', 'scope', 'ccaID', 'ccaName', 'meanMin', 'meanMax', 'sdMin', 'sdMax', 'note', 'exportedAt',
  ],
  bundle: [
    'formatVersion', 'section', 'scope', 'ccaID', 'ccaName', 'matric', 'name', 'flatPoints', 'type', 'sport',
    'ihgResult', 'ihgCap', 'meanMin', 'meanMax', 'sdMin', 'sdMax', 'note', 'exportedAt',
  ],
}

/** The header of the retired ccas.csv (spec 2.2 and earlier). Not a file kind: it is only recognised to raise CCAS_FILE_RETIRED. */
export const RETIRED_CCAS_COLUMNS: readonly string[] = [
  'ccaID', 'ccaName', 'type', 'placement', 'outgoingTier', 'outgoingMultiplier',
  'meanMin', 'meanMax', 'sdMin', 'sdMax',
]

/** The formatVersion-1 leader header (no `ihg` column): still read as a leader file (spec 2a). */
export const LEADER_V1_COLUMNS: readonly string[] = FILE_COLUMNS.leader.filter((col) => col !== LEADER_IHG_COLUMN)

/** The header of the retired ihg.csv (spec 2.2 and earlier). Not a file kind: it is only recognised to raise IHG_FILE_RETIRED. */
export const RETIRED_IHG_COLUMNS: readonly string[] = ['matric', 'ccaID', 'placement']

const KINDS = Object.keys(FILE_COLUMNS) as FileKind[]

/** True when the header has exactly these columns, in any order. */
export function headerMatches(header: readonly string[], columns: readonly string[]): boolean {
  return header.length === columns.length && columns.every((col) => header.includes(col))
}

/** A header matches a kind when it has exactly that kind's columns, in any order. */
export function detectFileKind(header: readonly string[]): FileKind | null {
  const kind = KINDS.find((k) => headerMatches(header, FILE_COLUMNS[k])) ?? null
  return kind ?? (headerMatches(header, LEADER_V1_COLUMNS) ? 'leader' : null)
}
