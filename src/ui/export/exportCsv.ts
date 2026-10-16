import type { ListRow, Lists } from '../../engine'
import type { OverrideRecord } from '../../import'

export type ListKey = keyof Lists

export const LIST_TITLES: Readonly<Record<ListKey, string>> = {
  maleStaying: 'Male staying',
  femaleStaying: 'Female staying',
  maleBidding: 'Male bidding',
  femaleBidding: 'Female bidding',
  sem2: 'Sem-2',
}

export const LIST_KEYS = Object.keys(LIST_TITLES) as ListKey[]

const FILE_SLUGS: Readonly<Record<ListKey, string>> = {
  maleStaying: 'male-staying',
  femaleStaying: 'female-staying',
  maleBidding: 'male-bidding',
  femaleBidding: 'female-bidding',
  sem2: 'sem2',
}

export const EXPORT_COLUMNS = [
  'rank', 'position', 'matric', 'name', 'points', 'status', 'tieFlags', 'labels',
]
export const POINTS_DECIMALS = 3

const quote = (cell: string): string =>
  /[",\n]/.test(cell) ? `"${cell.replaceAll('"', '""')}"` : cell

/** First line of every export: which CCAs had their mean/SD check overridden. */
export function overridesLine(overrideNames: readonly string[]): string {
  return `# overrides: ${overrideNames.length > 0 ? overrideNames.join(', ') : 'none'}`
}

function rowCells(row: ListRow): string[] {
  return [
    String(row.rank),
    String(row.position),
    row.matric,
    row.name,
    row.points.toFixed(POINTS_DECIMALS),
    row.status ?? '',
    row.tieFlags.map((f) => f.text).join('; '),
    row.labels.join('; '),
  ]
}

export function buildListCsv(
  rows: readonly ListRow[],
  overrides: readonly Pick<OverrideRecord, 'name'>[],
): string {
  const lines = [
    overridesLine(overrides.map((o) => o.name)),
    EXPORT_COLUMNS.join(','),
    ...rows.map((row) => rowCells(row).map(quote).join(',')),
  ]
  return `${lines.join('\n')}\n`
}

const pad2 = (n: number): string => String(n).padStart(2, '0')

export function exportFileName(list: ListKey, at: Date): string {
  const date = `${at.getFullYear()}${pad2(at.getMonth() + 1)}${pad2(at.getDate())}`
  return `rhps_${FILE_SLUGS[list]}_${date}-${pad2(at.getHours())}${pad2(at.getMinutes())}.csv`
}

/** Saves a file through a local Blob URL; nothing leaves the computer. */
export function downloadCsv(fileName: string, text: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.append(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 0)
}
