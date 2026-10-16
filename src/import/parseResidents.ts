import { makeIssue, GENDERS, JCRC_VALUES, RowReader, isMatric, wellShapedRows } from './parseCommon'
import type { Issue, ParsedCsv, ParseResult, ResidentRow } from './types'

export function parseResidents(fileName: string, csv: ParsedCsv): ParseResult<ResidentRow> {
  const issues: Issue[] = []
  const rows: ResidentRow[] = []
  const seen = new Set<string>()
  for (const row of wellShapedRows(fileName, csv, issues)) {
    const read = new RowReader(fileName, csv.header, row, issues)
    const matric = read.matric('matric')
    const parsed: ResidentRow = {
      line: row.line,
      matric,
      name: read.text('name'),
      gender: read.oneOf('gender', GENDERS, 'BAD_GENDER'),
      sem2: read.yesNo('sem2'),
      aux: read.int('aux', 'BAD_AUX', { min: 0, expect: 'a whole number of 0 or more' }),
      jcrc: read.oneOf('jcrc', JCRC_VALUES, 'BAD_JCRC'),
    }
    if (read.failed) {
      if (isMatric(matric)) seen.add(matric)
    } else if (parsed.jcrc !== 'N' && parsed.sem2) {
      const text = `${matric} is marked jcrc "${parsed.jcrc}" and sem2 "Y"; a JCRC resident cannot be a sem-2 resident.`
      issues.push(makeIssue('JCRC_AND_SEM2', fileName, text, { line: row.line, column: 'jcrc', matric }))
      seen.add(matric)
    } else if (seen.has(matric)) {
      issues.push(makeIssue('DUPLICATE_RESIDENT', fileName, `${matric} is listed more than once; the later row is ignored.`, { line: row.line, matric }))
    } else {
      seen.add(matric)
      rows.push(parsed)
    }
  }
  return { rows, seenKeys: [...seen], issues }
}
