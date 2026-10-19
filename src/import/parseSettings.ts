import { MEAN_RANGE_LIMIT, SD_RANGE_LIMIT, SETTINGS_FORMAT_VERSION } from '../engine'
import { RowReader, makeIssue, wellShapedRows } from './parseCommon'
import type { Issue, ParsedCsv, ParseResult, SettingsRow } from './types'

const SCOPES = ['default', 'waiver'] as const

/** Bookkeeping across the settings rows of one file: default rows counted, waiver ccaIDs kept. */
export interface SettingsState {
  defaultRows: number
  readonly waiverIDs: string[]
}

export const newSettingsState = (): SettingsState => ({ defaultRows: 0, waiverIDs: [] })

/**
 * Reads one settings row (spec 2g, and the bundle's `settings` rows, 2d): its scope, ccaID and
 * full range. Returns null for a rejected row; a later waiver for the same ccaID is DUPLICATE_WAIVER.
 */
export function readSettingsRow(read: RowReader, fileName: string, issues: Issue[], state: SettingsState): SettingsRow | null {
  const scope = read.text('scope')
  if (scope !== 'default' && scope !== 'waiver') {
    const text = `scope "${scope}" must be one of: ${SCOPES.join(', ')}.`
    issues.push(makeIssue('BAD_SETTINGS_FILE', fileName, text, { line: read.line, column: 'scope' }))
    return null
  }
  const ccaID = read.text('ccaID')
  if (scope === 'default') state.defaultRows += 1
  if (scope === 'waiver' && ccaID === '') {
    issues.push(makeIssue('BAD_SETTINGS_FILE', fileName, 'a waiver row needs a ccaID.', { line: read.line, column: 'ccaID' }))
    return null
  }
  const range = {
    meanMin: read.boundedNumber('meanMin', 'BAD_RANGE', 0, MEAN_RANGE_LIMIT),
    meanMax: read.boundedNumber('meanMax', 'BAD_RANGE', 0, MEAN_RANGE_LIMIT),
    sdMin: read.boundedNumber('sdMin', 'BAD_RANGE', 0, SD_RANGE_LIMIT),
    sdMax: read.boundedNumber('sdMax', 'BAD_RANGE', 0, SD_RANGE_LIMIT),
  }
  if (read.failed) return null
  if (range.meanMin > range.meanMax || range.sdMin > range.sdMax) {
    const part = range.meanMin > range.meanMax ? 'meanMin is above meanMax' : 'sdMin is above sdMax'
    issues.push(makeIssue('BAD_RANGE', fileName, `${part}.`, { line: read.line, ...(ccaID === '' ? {} : { ccaID }) }))
    return null
  }
  if (scope === 'waiver') {
    if (state.waiverIDs.includes(ccaID)) {
      const text = `${ccaID} has more than one waiver row; the later row is ignored.`
      issues.push(makeIssue('DUPLICATE_WAIVER', fileName, text, { line: read.line, ccaID }))
      return null
    }
    state.waiverIDs.push(ccaID)
  }
  return { line: read.line, scope, ccaID: scope === 'default' ? '' : ccaID, exportedAt: read.text('exportedAt'), range }
}

/** BAD_SETTINGS_FILE unless exactly one default row was seen. */
export function defaultRowIssues(fileName: string, state: SettingsState): Issue[] {
  if (state.defaultRows === 1) return []
  const text =
    state.defaultRows === 0
      ? 'there is no default row (scope "default"); exactly one is needed.'
      : `there are ${state.defaultRows} default rows (scope "default"); exactly one is needed.`
  return [makeIssue('BAD_SETTINGS_FILE', fileName, text)]
}

/**
 * Parses JCRC's standalone points settings file (spec 2g): one `default` row, then `waiver` rows,
 * each with a full effective range. `seenKeys` lists the waiver ccaIDs, first-seen order. A rejected
 * row is dropped; a file without exactly one `default` row gets BAD_SETTINGS_FILE.
 */
export function parseSettings(fileName: string, csv: ParsedCsv): ParseResult<SettingsRow> {
  const issues: Issue[] = []
  const rows: SettingsRow[] = []
  const state = newSettingsState()
  let versionReported = false
  for (const row of wellShapedRows(fileName, csv, issues)) {
    const read = new RowReader(fileName, csv.header, row, issues)
    const version = read.text('formatVersion')
    if (version !== String(SETTINGS_FORMAT_VERSION)) {
      if (!versionReported) {
        const text = `formatVersion "${version}" is not supported; this tool reads version ${SETTINGS_FORMAT_VERSION}.`
        issues.push(makeIssue('BAD_FORMAT_VERSION', fileName, text, { line: row.line, column: 'formatVersion' }))
        versionReported = true
      }
      continue
    }
    const parsed = readSettingsRow(read, fileName, issues, state)
    if (parsed) rows.push(parsed)
  }
  issues.push(...defaultRowIssues(fileName, state))
  return { rows, seenKeys: state.waiverIDs, issues }
}
