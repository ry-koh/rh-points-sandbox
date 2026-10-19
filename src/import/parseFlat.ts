import { FLAT_FORMAT_VERSION } from '../engine'
import { RowReader, makeIssue, wellShapedRows } from './parseCommon'
import type { FlatRow, Issue, ParsedCsv, ParseResult } from './types'

/** Reads one member row of a flat CCA (the standalone file, spec 2e, and the bundle's `flat` rows). */
export function readFlatRow(read: RowReader): FlatRow {
  return {
    line: read.line,
    ccaID: read.text('ccaID'),
    ccaName: read.text('ccaName'),
    matric: read.matric('matric'),
    name: read.text('name'),
    flatPoints: read.nonNegativeNumber('flatPoints', 'BAD_FLAT_POINTS'),
  }
}

/**
 * Parses the standalone flat-points file (spec 2e): one row per member per flat CCA. `seenKeys` lists the
 * ccaIDs on the rows (even rows dropped for another bad field), in first-seen order.
 */
export function parseFlat(fileName: string, csv: ParsedCsv): ParseResult<FlatRow> {
  const issues: Issue[] = []
  const rows: FlatRow[] = []
  const ccaIDs: string[] = []
  let versionReported = false
  for (const row of wellShapedRows(fileName, csv, issues)) {
    const read = new RowReader(fileName, csv.header, row, issues)
    const ccaID = read.text('ccaID')
    if (ccaID !== '' && !ccaIDs.includes(ccaID)) ccaIDs.push(ccaID)
    const version = read.text('formatVersion')
    if (version !== String(FLAT_FORMAT_VERSION)) {
      if (!versionReported) {
        const text = `formatVersion "${version}" is not supported; this tool reads version ${FLAT_FORMAT_VERSION}.`
        issues.push(makeIssue('BAD_FORMAT_VERSION', fileName, text, { line: row.line, column: 'formatVersion' }))
        versionReported = true
      }
      continue
    }
    const parsed = readFlatRow(read)
    if (!read.failed) rows.push(parsed)
  }
  return { rows, seenKeys: ccaIDs, issues }
}
