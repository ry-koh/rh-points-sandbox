import { CCA_TYPES, PLACEMENTS, RowReader, makeIssue, wellShapedRows } from './parseCommon'
import type { CcaRow, Issue, ParsedCsv, ParseResult } from './types'

function readRanges(read: RowReader): Pick<CcaRow, 'meanMin' | 'meanMax' | 'sdMin' | 'sdMax'> {
  return {
    meanMin: read.optionalNumber('meanMin', 'BAD_RANGE', false),
    meanMax: read.optionalNumber('meanMax', 'BAD_RANGE', false),
    sdMin: read.optionalNumber('sdMin', 'BAD_RANGE', false),
    sdMax: read.optionalNumber('sdMax', 'BAD_RANGE', false),
  }
}

export function parseCcas(fileName: string, csv: ParsedCsv): ParseResult<CcaRow> {
  const issues: Issue[] = []
  const rows: CcaRow[] = []
  const seen = new Set<string>()
  for (const row of wellShapedRows(fileName, csv, issues)) {
    const read = new RowReader(fileName, csv.header, row, issues)
    const ccaID = read.text('ccaID')
    const tier = read.text('outgoingTier')
    const parsed: CcaRow = {
      line: row.line,
      ccaID,
      ccaName: read.text('ccaName'),
      type: read.oneOf('type', CCA_TYPES),
      placement: read.oneOf('placement', PLACEMENTS),
      outgoingTier: tier === '' ? null : tier,
      outgoingMultiplier: read.optionalNumber('outgoingMultiplier', 'BAD_MANUAL_MULTIPLIER', true),
      ...readRanges(read),
    }
    if (ccaID !== '' && seen.has(ccaID)) {
      issues.push(makeIssue('DUPLICATE_CCA', fileName, `${ccaID} is listed more than once; the later row is ignored.`, { line: row.line, ccaID }))
      continue
    }
    if (ccaID !== '') seen.add(ccaID)
    if (!read.failed) rows.push(parsed)
  }
  return { rows, seenKeys: [...seen], issues }
}
