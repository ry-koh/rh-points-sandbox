import type { FileKind } from './types'

/** Exact column names of each file kind (spec section 2). */
export const FILE_COLUMNS: Readonly<Record<FileKind, readonly string[]>> = {
  leader: [
    'formatVersion', 'ccaID', 'ccaName', 'matric', 'name',
    'basePoints', 'semesterOnly', 'outgoingRole', 'incomingRole', 'exportedAt',
  ],
  residents: ['matric', 'name', 'gender', 'sem2', 'aux', 'jcrc'],
  ihg: ['matric', 'ccaID', 'placement'],
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

const KINDS = Object.keys(FILE_COLUMNS) as FileKind[]

/** True when the header has exactly these columns, in any order. */
export function headerMatches(header: readonly string[], columns: readonly string[]): boolean {
  return header.length === columns.length && columns.every((col) => header.includes(col))
}

/** A header matches a kind when it has exactly that kind's columns, in any order. */
export function detectFileKind(header: readonly string[]): FileKind | null {
  return KINDS.find((kind) => headerMatches(header, FILE_COLUMNS[kind])) ?? null
}
