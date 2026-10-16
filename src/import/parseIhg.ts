import { IHG_PLACEMENTS, RowReader, wellShapedRows } from './parseCommon'
import type { IhgRow, Issue, ParsedCsv, ParseResult } from './types'

export function parseIhg(fileName: string, csv: ParsedCsv): ParseResult<IhgRow> {
  const issues: Issue[] = []
  const rows: IhgRow[] = []
  for (const row of wellShapedRows(fileName, csv, issues)) {
    const read = new RowReader(fileName, csv.header, row, issues)
    const parsed: IhgRow = {
      line: row.line,
      matric: read.matric('matric'),
      ccaID: read.text('ccaID'),
      placement: read.oneOf('placement', IHG_PLACEMENTS),
    }
    if (!read.failed) rows.push(parsed)
  }
  return { rows, seenKeys: [], issues }
}
