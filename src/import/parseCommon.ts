import type { CsvRow, Issue, IssueCode, ParsedCsv } from './types'

export const GENDERS = ['M', 'F'] as const
export const ROLES = ['none', 'head', 'vice_head'] as const
export const CCA_TYPES = ['1x', '0.5x'] as const
export const IHG_PLACEMENTS = ['1st', '2nd', '3rd', '3rd4th_no_match'] as const
export const JCRC_VALUES = ['N', 'FULL', 'EXCHANGE'] as const

const MATRIC_PATTERN = /^A\d{7}[A-Z]$/
const WHOLE_NUMBER = /^\d+$/
const DECIMAL_NUMBER = /^-?\d+(\.\d+)?$/
const NON_NEGATIVE_NUMBER = /^\d+(\.\d+)?$/

const WARNING_CODES: ReadonlySet<IssueCode> = new Set<IssueCode>([
  'NO_LEADER_FILE',
  'SEMESTER_ONLY_ON_HALF_CCA',
  'AUX_ABOVE_CAP',
  'IHG_NON_MEMBER',
  'MANY_HALF_CCAS',
  'IHG_ON_FINAL_CCA',
  'SETTINGS_UNKNOWN_CCA',
  'MEAN_SD_OUT_OF_RANGE',
  'TYPE_NOT_SET',
  'LEVEL_NOT_SET',
  'LEVEL_UNKNOWN_CCA',
  'IHG_NOT_SET',
  'IHG_TICK_IGNORED',
  'IHG_NO_TICKS',
])

type IssueDetails = Partial<Pick<Issue, 'line' | 'column' | 'ccaID' | 'matric'>>

/** Builds an issue; the message is prefixed with the file name and line when known. */
export function makeIssue(
  code: IssueCode,
  fileName: string,
  text: string,
  details: IssueDetails = {},
): Issue {
  const where =
    fileName === '' ? '' : details.line === undefined ? `${fileName}: ` : `${fileName} line ${details.line}: `
  return {
    severity: WARNING_CODES.has(code) ? 'warning' : 'error',
    code,
    fileName,
    ...details,
    message: `${where}${text}`,
  }
}

export const normaliseMatric = (raw: string): string => raw.trim().toUpperCase()
export const isMatric = (value: string): boolean => MATRIC_PATTERN.test(value)

/** Drops rows whose cell count differs from the header, reporting each. */
export function wellShapedRows(fileName: string, csv: ParsedCsv, issues: Issue[]): CsvRow[] {
  return csv.rows.filter((row) => {
    if (row.cells.length === csv.header.length) return true
    const text = `this row has ${row.cells.length} values but the header has ${csv.header.length} columns.`
    issues.push(makeIssue('CSV_SYNTAX', fileName, text, { line: row.line }))
    return false
  })
}

interface IntSpec {
  readonly min: number
  readonly max?: number
  readonly expect: string
}

/** Reads the cells of one row by column name; any bad value marks the row as failed. */
export class RowReader {
  private bad = false

  constructor(
    private readonly fileName: string,
    private readonly header: readonly string[],
    private readonly row: CsvRow,
    private readonly issues: Issue[],
  ) {}

  get failed(): boolean {
    return this.bad
  }

  get line(): number {
    return this.row.line
  }

  text(column: string): string {
    return this.row.cells[this.header.indexOf(column)] ?? ''
  }

  private fail(code: IssueCode, column: string, text: string, details: IssueDetails = {}): void {
    this.bad = true
    this.report(code, column, text, details)
  }

  /** The row's own matric and ccaID, when it has valid ones, so every issue can name them. */
  private subject(): IssueDetails {
    const matric = normaliseMatric(this.text('matric'))
    const ccaID = this.text('ccaID')
    return {
      ...(isMatric(matric) ? { matric } : {}),
      ...(ccaID === '' ? {} : { ccaID }),
    }
  }

  private report(code: IssueCode, column: string, text: string, details: IssueDetails = {}): void {
    const found = { line: this.row.line, column, ...this.subject(), ...details }
    this.issues.push(makeIssue(code, this.fileName, text, found))
  }

  matric(column: string): string {
    const value = normaliseMatric(this.text(column))
    if (!isMatric(value)) {
      this.fail('BAD_MATRIC', column, `${column} "${this.text(column)}" must look like A1234567Z (the letter A, seven digits, then a letter).`)
    }
    return value
  }

  int(column: string, code: IssueCode, spec: IntSpec): number {
    const raw = this.text(column)
    const value = WHOLE_NUMBER.test(raw) ? Number(raw) : Number.NaN
    const inRange = value >= spec.min && (spec.max === undefined || value <= spec.max)
    if (!inRange) this.fail(code, column, `${column} "${raw}" must be ${spec.expect}.`)
    return inRange ? value : 0
  }

  /** A number of 0 or more (whole or decimal); anything else fails the row. */
  nonNegativeNumber(column: string, code: IssueCode): number {
    const raw = this.text(column)
    const ok = NON_NEGATIVE_NUMBER.test(raw)
    if (!ok) this.fail(code, column, `${column} "${raw}" must be a number of 0 or more.`)
    return ok ? Number(raw) : 0
  }

  /** A number from `min` to `max` inclusive; blank, text or out of range fails the row. */
  boundedNumber(column: string, code: IssueCode, min: number, max: number): number {
    const raw = this.text(column)
    const value = DECIMAL_NUMBER.test(raw) ? Number(raw) : Number.NaN
    const inRange = value >= min && value <= max
    if (!inRange) this.fail(code, column, `${column} "${raw}" must be a number from ${min} to ${max}.`)
    return inRange ? value : 0
  }

  oneOf<T extends string>(column: string, allowed: readonly T[], code: IssueCode = 'BAD_ENUM'): T {
    const raw = this.text(column)
    const found = allowed.find((option) => option === raw)
    if (found === undefined) {
      this.fail(code, column, `${column} "${raw}" must be one of: ${allowed.join(', ')}.`)
    }
    return found ?? allowed[0] ?? ('' as T)
  }

  yesNo(column: string): boolean {
    return this.oneOf(column, ['Y', 'N'] as const, 'BAD_YN') === 'Y'
  }

  /** Blank gives null. A bad number is reported but does not fail the row. */
  optionalNumber(column: string, code: IssueCode, positiveOnly: boolean): number | null {
    const raw = this.text(column)
    if (raw === '') return null
    const value = DECIMAL_NUMBER.test(raw) ? Number(raw) : Number.NaN
    if (Number.isNaN(value) || (positiveOnly && value <= 0)) {
      const expect = positiveOnly ? 'a number above 0' : 'a number'
      this.report(code, column, `${column} "${raw}" must be blank or ${expect}.`)
      return null
    }
    return value
  }
}
