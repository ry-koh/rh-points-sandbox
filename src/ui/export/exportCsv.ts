import type { Checked, Discretion, FinalOverride, ListRow, Lists } from '../../engine'
import type { OutOfRangeRecord } from '../../import'

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

/** How many JCRC entries are in force (applied, not stale) for the comment lines of an export. */
export interface EntryCounts {
  readonly finalOverrides: number
  readonly discretion: number
}

const NO_ENTRIES: EntryCounts = { finalOverrides: 0, discretion: 0 }

const appliedCount = <T,>(checked: readonly Checked<T>[] | undefined): number =>
  (checked ?? []).filter((c) => c.status === 'applied').length

export function entryCounts(
  results: { readonly overrides: readonly Checked<FinalOverride>[]; readonly discretion: readonly Checked<Discretion>[] } | null,
): EntryCounts {
  if (!results) return NO_ENTRIES
  return { finalOverrides: appliedCount(results.overrides), discretion: appliedCount(results.discretion) }
}

/** First comment line of every export: which CCAs are outside their allowed mean/SD range. */
export function meanSdOutOfRangeLine(names: readonly string[]): string {
  return `# mean/SD out of range: ${names.length > 0 ? names.join(', ') : 'none'}`
}

export const finalOverridesLine = (count: number): string => `# final-points overrides: ${count}`
export const discretionLine = (count: number): string => `# discretion adjustments: ${count}`

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

/** Fourth line of every export made while the lists are finalised. */
export function finalisedLine(penalties: number): string {
  return `# finalised: yes · penalties: ${penalties}`
}

/** The comment lines every export starts with. */
export function headerLines(
  outOfRange: readonly Pick<OutOfRangeRecord, 'name'>[],
  finalisedPenalties: number | null,
  counts: EntryCounts = NO_ENTRIES,
): string[] {
  return [
    meanSdOutOfRangeLine(outOfRange.map((o) => o.name)),
    finalOverridesLine(counts.finalOverrides),
    discretionLine(counts.discretion),
    ...(finalisedPenalties === null ? [] : [finalisedLine(finalisedPenalties)]),
  ]
}

export const toCsvLine = (cells: readonly string[]): string => cells.map(quote).join(',')

export function buildListCsv(
  rows: readonly ListRow[],
  outOfRange: readonly Pick<OutOfRangeRecord, 'name'>[],
  finalisedPenalties: number | null = null,
  counts: EntryCounts = NO_ENTRIES,
): string {
  const lines = [
    ...headerLines(outOfRange, finalisedPenalties, counts),
    EXPORT_COLUMNS.join(','),
    ...rows.map((row) => rowCells(row).map(quote).join(',')),
  ]
  return `${lines.join('\n')}\n`
}

const pad2 = (n: number): string => String(n).padStart(2, '0')

/** YYYYMMDD-HHmm in local time. */
export function exportStamp(at: Date): string {
  const date = `${at.getFullYear()}${pad2(at.getMonth() + 1)}${pad2(at.getDate())}`
  return `${date}-${pad2(at.getHours())}${pad2(at.getMinutes())}`
}

export function exportFileName(list: ListKey, at: Date): string {
  return `rhps_${FILE_SLUGS[list]}_${exportStamp(at)}.csv`
}

/** Saves a file through a local Blob URL; nothing leaves the computer. */
export function downloadCsv(fileName: string, text: string): void {
  downloadText(fileName, text, 'text/csv;charset=utf-8')
}

export function downloadText(fileName: string, text: string, type: string): void {
  const url = URL.createObjectURL(new Blob([text], { type }))
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.append(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 0)
}
