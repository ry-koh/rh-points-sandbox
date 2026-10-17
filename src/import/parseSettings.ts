import { MEAN_RANGE_LIMIT, SD_RANGE_LIMIT, SETTINGS_FORMAT_VERSION } from '../engine'
import { RowReader, makeIssue, wellShapedRows } from './parseCommon'
import type { Issue, ParsedCsv, ParseResult, SettingsRow } from './types'

const SCOPES = ['default', 'waiver'] as const

/**
 * Parses the JCRC points settings file (spec 2g): one `default` row, then `waiver` rows, each
 * with a full effective range. `seenKeys` lists the waiver ccaIDs, first-seen order. A rejected
 * row is dropped; a file without exactly one `default` row gets BAD_SETTINGS_FILE.
 */
export function parseSettings(fileName: string, csv: ParsedCsv): ParseResult<SettingsRow> {
  const issues: Issue[] = []
  const rows: SettingsRow[] = []
  const waiverIDs: string[] = []
  let defaultRows = 0
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
    const scope = read.text('scope')
    if (scope !== 'default' && scope !== 'waiver') {
      const text = `scope "${scope}" must be one of: ${SCOPES.join(', ')}.`
      issues.push(makeIssue('BAD_SETTINGS_FILE', fileName, text, { line: row.line, column: 'scope' }))
      continue
    }
    const ccaID = read.text('ccaID')
    if (scope === 'default') defaultRows += 1
    if (scope === 'waiver' && ccaID === '') {
      issues.push(makeIssue('BAD_SETTINGS_FILE', fileName, 'a waiver row needs a ccaID.', { line: row.line, column: 'ccaID' }))
      continue
    }
    const range = {
      meanMin: read.boundedNumber('meanMin', 'BAD_RANGE', 0, MEAN_RANGE_LIMIT),
      meanMax: read.boundedNumber('meanMax', 'BAD_RANGE', 0, MEAN_RANGE_LIMIT),
      sdMin: read.boundedNumber('sdMin', 'BAD_RANGE', 0, SD_RANGE_LIMIT),
      sdMax: read.boundedNumber('sdMax', 'BAD_RANGE', 0, SD_RANGE_LIMIT),
    }
    if (read.failed) continue
    if (range.meanMin > range.meanMax || range.sdMin > range.sdMax) {
      const part = range.meanMin > range.meanMax ? 'meanMin is above meanMax' : 'sdMin is above sdMax'
      issues.push(makeIssue('BAD_RANGE', fileName, `${part}.`, { line: row.line, ...(ccaID === '' ? {} : { ccaID }) }))
      continue
    }
    if (scope === 'waiver') {
      if (waiverIDs.includes(ccaID)) {
        const text = `${ccaID} has more than one waiver row; the later row is ignored.`
        issues.push(makeIssue('DUPLICATE_WAIVER', fileName, text, { line: row.line, ccaID }))
        continue
      }
      waiverIDs.push(ccaID)
    }
    rows.push({ line: row.line, scope, ccaID: scope === 'default' ? '' : ccaID, exportedAt: read.text('exportedAt'), range })
  }
  if (defaultRows !== 1) {
    const text =
      defaultRows === 0
        ? 'there is no default row (scope "default"); exactly one is needed.'
        : `there are ${defaultRows} default rows (scope "default"); exactly one is needed.`
    issues.push(makeIssue('BAD_SETTINGS_FILE', fileName, text))
  }
  return { rows, seenKeys: waiverIDs, issues }
}
