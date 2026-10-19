import type { Checked, Discretion, FinalOverride, Level, ListRow, Lists } from '../../engine'
import type { OutOfRangeRecord, PerCcaReport, ReviewReport } from '../../import'

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
  /** Review-step score edits that are applied to the current files. */
  readonly reviewEdits: number
}

const NO_ENTRIES: EntryCounts = { finalOverrides: 0, discretion: 0, reviewEdits: 0 }

/** What the levels and tweaks lines are built from: each CCA's level, and the levels in Settings. */
export interface LevelLineData {
  readonly perCca: readonly LevelLineCca[]
  readonly levels: readonly Level[]
}

export type LevelLineCca = Pick<PerCcaReport, 'ccaID' | 'name' | 'fileName' | 'status' | 'level' | 'bonusOverride' | 'multiplierOverride'>

const NO_LEVEL_DATA: LevelLineData = { perCca: [], levels: [] }

const appliedCount = <T,>(checked: readonly Checked<T>[] | undefined): number =>
  (checked ?? []).filter((c) => c.status === 'applied').length

export function entryCounts(
  results: { readonly overrides: readonly Checked<FinalOverride>[]; readonly discretion: readonly Checked<Discretion>[] } | null,
  review: Pick<ReviewReport, 'edits'> = { edits: [] },
): EntryCounts {
  const reviewEdits = review.edits.filter((e) => e.status === 'applied').length
  if (!results) return { ...NO_ENTRIES, reviewEdits }
  return { finalOverrides: appliedCount(results.overrides), discretion: appliedCount(results.discretion), reviewEdits }
}

/** First comment line of every export: which CCAs are outside their allowed mean/SD range. */
export function meanSdOutOfRangeLine(names: readonly string[]): string {
  return `# mean/SD out of range: ${names.length > 0 ? names.join(', ') : 'none'}`
}

export const finalOverridesLine = (count: number): string => `# final-points overrides: ${count}`
export const discretionLine = (count: number): string => `# discretion adjustments: ${count}`
export const reviewEditsLine = (count: number): string => `# review edits: ${count}`

const NOT_SET = 'not set'

/** CCAs with a leader file, which are the ones that carry a level (flat and not-submitting ones do not). */
const withLevel = (perCca: readonly LevelLineCca[]): LevelLineCca[] => perCca.filter((c) => c.fileName !== null && c.status !== 'flat')

/**
 * `# levels: Gold: C01, C04; High Silver: C02; not set: C09`: grouped by level in Settings order,
 * CCAs by name inside each group, "not set" last, one line. IDs only: nothing about a resident.
 */
export function levelsLine(perCca: readonly LevelLineCca[], levels: readonly Level[]): string {
  const ccas = withLevel(perCca).sort((a, b) => a.name.localeCompare(b.name, 'en', { numeric: true, sensitivity: 'base' }) || a.ccaID.localeCompare(b.ccaID, 'en', { numeric: true }))
  const known = new Set(levels.map((level) => level.name))
  const groups = [...levels.map((level) => level.name), NOT_SET].flatMap((name) => {
    const members = ccas.filter((c) => (name === NOT_SET ? c.level === null || !known.has(c.level) : c.level === name))
    return members.length > 0 ? [`${name}: ${members.map((c) => c.ccaID).join(', ')}`] : []
  })
  return `# levels: ${groups.length > 0 ? groups.join('; ') : 'none'}`
}

/** `# level tweaks: Soccer (C05): Gold, multiplier 1.31 (level 1.3) | none`. */
export function tweaksLine(perCca: readonly LevelLineCca[], levels: readonly Level[]): string {
  const tweaks = withLevel(perCca).flatMap((c) => {
    const level = levels.find((l) => l.name === c.level)
    const parts = [
      c.bonusOverride === null ? '' : `bonus ${c.bonusOverride}${level ? ` (level ${level.bonus})` : ''}`,
      c.multiplierOverride === null ? '' : `multiplier ${c.multiplierOverride}${level ? ` (level ${level.multiplier})` : ''}`,
    ].filter((part) => part !== '')
    return parts.length > 0 ? [`${c.name} (${c.ccaID}): ${c.level ?? NOT_SET}, ${parts.join(', ')}`] : []
  })
  return `# level tweaks: ${tweaks.length > 0 ? tweaks.join(' | ') : 'none'}`
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

/** Last comment line of every export made while the lists are finalised. */
export function finalisedLine(penalties: number): string {
  return `# finalised: yes · penalties: ${penalties}`
}

/** The comment lines every export starts with. */
export function headerLines(
  outOfRange: readonly Pick<OutOfRangeRecord, 'name'>[],
  finalisedPenalties: number | null,
  counts: EntryCounts = NO_ENTRIES,
  levelData: LevelLineData = NO_LEVEL_DATA,
): string[] {
  return [
    meanSdOutOfRangeLine(outOfRange.map((o) => o.name)),
    finalOverridesLine(counts.finalOverrides),
    discretionLine(counts.discretion),
    reviewEditsLine(counts.reviewEdits),
    levelsLine(levelData.perCca, levelData.levels),
    tweaksLine(levelData.perCca, levelData.levels),
    ...(finalisedPenalties === null ? [] : [finalisedLine(finalisedPenalties)]),
  ]
}

export const toCsvLine = (cells: readonly string[]): string => cells.map(quote).join(',')

export function buildListCsv(
  rows: readonly ListRow[],
  outOfRange: readonly Pick<OutOfRangeRecord, 'name'>[],
  finalisedPenalties: number | null = null,
  counts: EntryCounts = NO_ENTRIES,
  levelData: LevelLineData = NO_LEVEL_DATA,
): string {
  const lines = [
    ...headerLines(outOfRange, finalisedPenalties, counts, levelData),
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
