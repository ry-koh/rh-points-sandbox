import type { FileKind } from './types'

/** Exact column names of each file kind (spec section 2). */
export const FILE_COLUMNS: Readonly<Record<FileKind, readonly string[]>> = {
  leader: [
    'formatVersion', 'ccaID', 'ccaName', 'matric', 'name',
    'basePoints', 'semesterOnly', 'outgoingRole', 'incomingRole', 'exportedAt',
  ],
  residents: ['matric', 'name', 'gender', 'sem2', 'aux', 'jcrc'],
  ihg: ['matric', 'ccaID', 'placement'],
  ccas: [
    'ccaID', 'ccaName', 'type', 'placement', 'outgoingTier', 'outgoingMultiplier',
    'meanMin', 'meanMax', 'sdMin', 'sdMax',
  ],
  flat: ['formatVersion', 'ccaID', 'ccaName', 'matric', 'name', 'flatPoints', 'exportedAt'],
}

const KINDS = Object.keys(FILE_COLUMNS) as FileKind[]

/** A header matches a kind when it has exactly that kind's columns, in any order. */
export function detectFileKind(header: readonly string[]): FileKind | null {
  const found = KINDS.find((kind) => {
    const columns = FILE_COLUMNS[kind]
    return header.length === columns.length && columns.every((col) => header.includes(col))
  })
  return found ?? null
}
