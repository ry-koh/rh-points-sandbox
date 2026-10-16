import { describe, expect, it } from 'vitest'
import { parseCsv } from '../csv'

describe('parseCsv', () => {
  it('reads a header and rows with 1-based line numbers', () => {
    const csv = parseCsv('a,b\n1,2\n3,4\n')
    expect(csv.header).toEqual(['a', 'b'])
    expect(csv.rows).toEqual([
      { line: 2, cells: ['1', '2'] },
      { line: 3, cells: ['3', '4'] },
    ])
    expect(csv.issues).toEqual([])
  })

  it('strips a UTF-8 BOM', () => {
    expect(parseCsv('﻿a,b\n1,2').header).toEqual(['a', 'b'])
  })

  it('accepts CRLF and LF line endings alike', () => {
    expect(parseCsv('a,b\r\n1,2\r\n')).toEqual(parseCsv('a,b\n1,2\n'))
  })

  it('handles quoted commas, doubled quotes and newlines', () => {
    const csv = parseCsv('a,b\n"x, y","he said ""hi"""\n"multi\nline",z\n')
    expect(csv.rows[0]?.cells).toEqual(['x, y', 'he said "hi"'])
    expect(csv.rows[1]).toEqual({ line: 3, cells: ['multi\nline', 'z'] })
  })

  it('numbers lines by where each record starts, even after a multi-line cell', () => {
    const csv = parseCsv('a\n"p\nq"\nr\n')
    expect(csv.rows.map((row) => row.line)).toEqual([2, 4])
  })

  it('trims unquoted values but keeps quoted ones as written', () => {
    const csv = parseCsv('a,b\n  1 , 2 \n" 3 ",x\n')
    expect(csv.rows[0]?.cells).toEqual(['1', '2'])
    expect(csv.rows[1]?.cells).toEqual([' 3 ', 'x'])
  })

  it('keeps empty cells', () => {
    expect(parseCsv('a,b,c\n1,,3\n').rows[0]?.cells).toEqual(['1', '', '3'])
  })

  it('ignores blank lines, including trailing ones', () => {
    const csv = parseCsv('a,b\n1,2\n\n   \n3,4\n\n\n')
    expect(csv.rows.map((row) => row.cells)).toEqual([
      ['1', '2'],
      ['3', '4'],
    ])
  })

  it('reports an unterminated quote as an issue, not an exception', () => {
    const csv = parseCsv('a,b\n1,2\n3,"oops\n')
    expect(csv.rows).toHaveLength(1)
    expect(csv.issues).toHaveLength(1)
    expect(csv.issues[0]?.line).toBe(3)
    expect(csv.issues[0]?.message).toMatch(/quote/i)
  })

  it('returns an empty header for empty text', () => {
    expect(parseCsv('')).toEqual({ header: [], rows: [], issues: [] })
  })
})
