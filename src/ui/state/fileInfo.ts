import { detectFileKind, parseCsv, type FileKind, type SourceFile } from '../../import'

export interface FileInfo {
  readonly name: string
  readonly kind: FileKind | null
  readonly rows: number
}

export const KIND_LABELS: Readonly<Record<FileKind, string>> = {
  leader: 'Leader',
  residents: 'Residents',
  ihg: 'IHG',
  ccas: 'CCA settings',
  flat: 'Flat points',
}

export function describeFile(file: SourceFile): FileInfo {
  const csv = parseCsv(file.text)
  return { name: file.name, kind: detectFileKind(csv.header), rows: csv.rows.length }
}
