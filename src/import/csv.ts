import type { CsvIssue, CsvRow, ParsedCsv } from './types'

const BOM = '﻿'
const QUOTE = '"'

interface CellRead {
  readonly value: string
  readonly next: number
  readonly newlines: number
  readonly unterminated: boolean
}

interface RecordRead {
  readonly cells: readonly string[]
  readonly next: number
  readonly newlines: number
  readonly unterminated: boolean
}

const isBreak = (ch: string | undefined): boolean => ch === '\n' || ch === '\r'

function readQuoted(src: string, start: number): CellRead {
  let value = ''
  let newlines = 0
  let i = start + 1
  while (i < src.length) {
    const ch = src.charAt(i)
    if (ch === QUOTE && src.charAt(i + 1) === QUOTE) {
      value += QUOTE
      i += 2
    } else if (ch === QUOTE) {
      return { value, next: skipToDelimiter(src, i + 1), newlines, unterminated: false }
    } else {
      if (ch === '\n') newlines += 1
      value += ch
      i += 1
    }
  }
  return { value, next: src.length, newlines, unterminated: true }
}

/** After a closing quote, ignore stray characters up to the next delimiter. */
function skipToDelimiter(src: string, from: number): number {
  let i = from
  while (i < src.length && src.charAt(i) !== ',' && !isBreak(src.charAt(i))) i += 1
  return i
}

function readPlain(src: string, start: number): CellRead {
  let i = start
  while (i < src.length && src.charAt(i) !== ',' && !isBreak(src.charAt(i))) i += 1
  return { value: src.slice(start, i).trim(), next: i, newlines: 0, unterminated: false }
}

function readCell(src: string, start: number): CellRead {
  return src.charAt(start) === QUOTE ? readQuoted(src, start) : readPlain(src, start)
}

/** Position just after the line break at `at` (CRLF counts as one). */
function afterBreak(src: string, at: number): number {
  return src.charAt(at) === '\r' && src.charAt(at + 1) === '\n' ? at + 2 : at + 1
}

function readRecord(src: string, start: number): RecordRead {
  const cells: string[] = []
  let pos = start
  let newlines = 0
  for (;;) {
    const cell = readCell(src, pos)
    cells.push(cell.value)
    newlines += cell.newlines
    if (cell.unterminated) return { cells, next: src.length, newlines, unterminated: true }
    if (src.charAt(cell.next) !== ',') {
      const next = cell.next >= src.length ? src.length : afterBreak(src, cell.next)
      return { cells, next, newlines: newlines + (next > cell.next ? 1 : 0), unterminated: false }
    }
    pos = cell.next + 1
  }
}

const isBlank = (cells: readonly string[]): boolean => cells.length === 1 && cells[0] === ''

/** Tolerant CSV reader: BOM, CRLF/LF, quoted cells, blank lines. Never throws. */
export function parseCsv(text: string): ParsedCsv {
  const src = text.startsWith(BOM) ? text.slice(1) : text
  const records: CsvRow[] = []
  const issues: CsvIssue[] = []
  let pos = 0
  let line = 1
  while (pos < src.length) {
    const read = readRecord(src, pos)
    if (read.unterminated) {
      issues.push({ line, message: 'a quoted value is missing its closing quote.' })
    } else if (!isBlank(read.cells)) {
      records.push({ line, cells: read.cells })
    }
    line += read.newlines
    pos = read.next
  }
  const [head, ...rows] = records
  return { header: head?.cells ?? [], rows, issues }
}
