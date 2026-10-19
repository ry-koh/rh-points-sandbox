import { BASE_POINTS_MAX, BASE_POINTS_MIN, LEADER_FORMAT_VERSIONS } from '../engine'
import { LEADER_IHG_COLUMN } from './detect'
import { ROLES, RowReader, makeIssue, wellShapedRows } from './parseCommon'
import type { Issue, LeaderRow, ParsedCsv, ParseResult } from './types'

const BASE_POINTS_EXPECT = `a whole number from ${BASE_POINTS_MIN} to ${BASE_POINTS_MAX}`

function readRow(read: RowReader, v2: boolean): LeaderRow {
  return {
    line: read.line,
    ccaID: read.text('ccaID'),
    ccaName: read.text('ccaName'),
    matric: read.matric('matric'),
    name: read.text('name'),
    basePoints: read.int('basePoints', 'BAD_BASE_POINTS', {
      min: BASE_POINTS_MIN,
      max: BASE_POINTS_MAX,
      expect: BASE_POINTS_EXPECT,
    }),
    semesterOnly: read.yesNo('semesterOnly'),
    outgoingRole: read.oneOf('outgoingRole', ROLES),
    incomingRole: read.oneOf('incomingRole', ROLES),
    ihg: v2 ? read.yesNo(LEADER_IHG_COLUMN) : false,
  }
}

const SUPPORTED = LEADER_FORMAT_VERSIONS.map(String)

/** Why a row's formatVersion is refused: not a version this tool reads, or not the one its columns say (R39). */
function versionProblem(version: string, expected: string): string {
  if (!SUPPORTED.includes(version)) {
    return `formatVersion "${version}" is not supported; this tool reads versions ${SUPPORTED.join(' and ')}.`
  }
  const columns = expected === '2' ? 'a file with an ihg column is version 2' : 'a file without an ihg column is version 1'
  return `formatVersion "${version}" does not match this file's columns: ${columns}.`
}

/** Keeps only the rows of the file's first ccaID, reporting any others once. */
function keepFirstCca(fileName: string, rows: readonly LeaderRow[], issues: Issue[]): LeaderRow[] {
  const first = rows[0]?.ccaID
  const others = [...new Set(rows.map((r) => r.ccaID).filter((id) => id !== first))]
  if (others.length > 0) {
    const text = `this file mixes CCAs (${[first, ...others].join(', ')}); only ${first} rows are used.`
    issues.push(makeIssue('MIXED_CCA_ID', fileName, text, { ccaID: first }))
  }
  return rows.filter((r) => r.ccaID === first)
}

export function parseLeader(fileName: string, csv: ParsedCsv): ParseResult<LeaderRow> {
  const issues: Issue[] = []
  const rows: LeaderRow[] = []
  const seen = new Set<string>()
  let versionReported = false
  const v2 = csv.header.includes(LEADER_IHG_COLUMN)
  const expected = v2 ? '2' : '1'
  for (const row of wellShapedRows(fileName, csv, issues)) {
    const read = new RowReader(fileName, csv.header, row, issues)
    const version = read.text('formatVersion')
    if (version !== expected) {
      if (!versionReported) {
        const text = versionProblem(version, expected)
        issues.push(makeIssue('BAD_FORMAT_VERSION', fileName, text, { line: row.line, column: 'formatVersion' }))
        versionReported = true
      }
      continue
    }
    const parsed = readRow(read, v2)
    if (read.failed) continue
    if (seen.has(parsed.matric)) {
      const text = `${parsed.matric} appears more than once in this file; the later row is ignored.`
      issues.push(makeIssue('DUPLICATE_MATRIC_IN_FILE', fileName, text, { line: row.line, matric: parsed.matric, ccaID: parsed.ccaID }))
      continue
    }
    seen.add(parsed.matric)
    rows.push(parsed)
  }
  const ccaIDs = csv.rows.map((r) => r.cells[csv.header.indexOf('ccaID')]?.trim() ?? '').filter((id) => id !== '')
  return { rows: keepFirstCca(fileName, rows, issues), seenKeys: ccaIDs.slice(0, 1), issues }
}
