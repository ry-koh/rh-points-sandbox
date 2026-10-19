import { CCA_TYPES, IHG_PLACEMENTS, RowReader, makeIssue, wellShapedRows } from './parseCommon'
import { readFlatRow } from './parseFlat'
import { defaultRowIssues, newSettingsState, readSettingsRow } from './parseSettings'
import type { BundleCcaRow, BundleRow, Issue, ParsedCsv, ParseResult } from './types'

/** The bundle's own format version (spec 2d); independent of the leader, flat and settings files. */
export const BUNDLE_FORMAT_VERSION = 1

const SECTIONS = ['settings', 'cca', 'flat'] as const
type Section = (typeof SECTIONS)[number]

/** Columns every row may fill, whatever its section. */
const ALWAYS_ALLOWED = ['formatVersion', 'section', 'exportedAt']

/** The columns each section may fill; any other non-blank cell is BAD_BUNDLE_FILE (R14). */
export const SECTION_COLUMNS: Readonly<Record<Section, readonly string[]>> = {
  settings: ['scope', 'ccaID', 'ccaName', 'meanMin', 'meanMax', 'sdMin', 'sdMax', 'note'],
  cca: ['ccaID', 'ccaName', 'flatPoints', 'type', 'sport', 'ihgResult', 'ihgCap'],
  flat: ['ccaID', 'ccaName', 'matric', 'name', 'flatPoints'],
}

const IHG_COLUMNS = ['ihgResult', 'ihgCap'] as const
const WHOLE_NUMBER = /^\d+$/
const MIN_IHG_CAP = 1

const isSection = (value: string): value is Section => (SECTIONS as readonly string[]).includes(value)

function badCell(fileName: string, read: RowReader, column: string, text: string): Issue {
  const ccaID = read.text('ccaID')
  return makeIssue('BAD_BUNDLE_FILE', fileName, text, { line: read.line, column, ...(ccaID === '' ? {} : { ccaID }) })
}

/** Reports every non-blank cell outside the section's columns. */
function strayCells(fileName: string, header: readonly string[], read: RowReader, section: Section): Issue[] {
  const allowed = new Set([...ALWAYS_ALLOWED, ...SECTION_COLUMNS[section]])
  return header
    .filter((column) => !allowed.has(column) && read.text(column) !== '')
    .map((column) => badCell(fileName, read, column, `a ${section} row must leave ${column} blank (it has "${read.text(column)}").`))
}

function readIhgCap(fileName: string, read: RowReader, issues: Issue[]): number | null {
  const raw = read.text('ihgCap')
  if (raw === '') return null
  const value = WHOLE_NUMBER.test(raw) ? Number(raw) : Number.NaN
  if (value >= MIN_IHG_CAP) return value
  const ccaID = read.text('ccaID')
  const text = `ihgCap "${raw}" must be blank or a whole number of ${MIN_IHG_CAP} or more; it is read as blank.`
  issues.push(makeIssue('BAD_IHG_CAP', fileName, text, { line: read.line, column: 'ihgCap', ...(ccaID === '' ? {} : { ccaID }) }))
  return null
}

/** One `cca` row: blank type, ihgResult and ihgCap are null; the IHG columns are for sports only (R58). */
function readCcaRow(fileName: string, read: RowReader, issues: Issue[]): BundleCcaRow {
  const blankOr = <T>(column: string, value: () => T): T | null => (read.text(column) === '' ? null : value())
  const isSport = read.yesNo('sport')
  const ihgResult = blankOr('ihgResult', () => read.oneOf('ihgResult', IHG_PLACEMENTS))
  const ihgCap = readIhgCap(fileName, read, issues)
  const notSport = read.text('sport') === 'N'
  if (notSport) {
    for (const column of IHG_COLUMNS.filter((col) => read.text(col) !== '')) {
      issues.push(badCell(fileName, read, column, `${column} is only for sports, but this cca row has sport N.`))
    }
  }
  return {
    line: read.line,
    ccaID: read.text('ccaID'),
    ccaName: read.text('ccaName'),
    flatPoints: blankOr('flatPoints', () => read.nonNegativeNumber('flatPoints', 'BAD_FLAT_POINTS')),
    type: blankOr('type', () => read.oneOf('type', CCA_TYPES)),
    isSport,
    ihgResult: notSport ? null : ihgResult,
    ihgCap: notSport ? null : ihgCap,
  }
}

/**
 * Parses the RH-app bundle (spec 2d): `settings` rows (read as the settings file's rows), `cca`
 * rows (the CCA list with type, sport and IHG result / cap) and `flat` rows (read as the
 * flat-points file's rows). `seenKeys` lists the cca rows' ccaIDs in first-seen order, even rows
 * dropped for a bad field. A rejected row is dropped; the issues say why.
 */
export function parseBundle(fileName: string, csv: ParsedCsv): ParseResult<BundleRow> {
  const issues: Issue[] = []
  const rows: BundleRow[] = []
  const ccaIDs: string[] = []
  const settings = newSettingsState()
  let versionReported = false
  let ccaRows = 0
  for (const row of wellShapedRows(fileName, csv, issues)) {
    const read = new RowReader(fileName, csv.header, row, issues)
    const version = read.text('formatVersion')
    if (version !== String(BUNDLE_FORMAT_VERSION)) {
      if (!versionReported) {
        const text = `formatVersion "${version}" is not supported; this tool reads version ${BUNDLE_FORMAT_VERSION}.`
        issues.push(makeIssue('BAD_FORMAT_VERSION', fileName, text, { line: row.line, column: 'formatVersion' }))
        versionReported = true
      }
      continue
    }
    const section = read.text('section')
    if (!isSection(section)) {
      issues.push(badCell(fileName, read, 'section', `section "${section}" must be one of: ${SECTIONS.join(', ')}.`))
      continue
    }
    issues.push(...strayCells(fileName, csv.header, read, section))
    if (section === 'settings') {
      const parsed = readSettingsRow(read, fileName, issues, settings)
      if (parsed) rows.push({ section, row: parsed })
      continue
    }
    if (section === 'flat') {
      const parsed = readFlatRow(read)
      if (!read.failed) rows.push({ section, row: parsed })
      continue
    }
    ccaRows += 1
    const parsed = readCcaRow(fileName, read, issues)
    if (parsed.ccaID === '') {
      issues.push(badCell(fileName, read, 'ccaID', 'a cca row needs a ccaID.'))
      continue
    }
    if (ccaIDs.includes(parsed.ccaID)) {
      const text = `${parsed.ccaID} is listed more than once; the later row is ignored.`
      issues.push(makeIssue('DUPLICATE_CCA', fileName, text, { line: row.line, ccaID: parsed.ccaID }))
      continue
    }
    ccaIDs.push(parsed.ccaID)
    if (!read.failed) rows.push({ section, row: parsed })
  }
  // A file in another version says so once; counting its rows would only add noise.
  if (!versionReported) {
    if (ccaRows === 0) {
      issues.push(makeIssue('BAD_BUNDLE_FILE', fileName, 'there are no cca rows; the bundle must list the CCAs.'))
    }
    issues.push(...defaultRowIssues(fileName, settings))
  }
  return { rows, seenKeys: ccaIDs, issues }
}
