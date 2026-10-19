import { MAX_EXHAUSTIVE_HALVES, RANGE_TOLERANCE, checkMeanSd, resolveRange } from '../engine'
import type { MeanSdRange, ScenarioConfig } from '../engine'
import { makeIssue } from './parseCommon'
import type {
  BaseCcaReport,
  CcaRow,
  FlatRow,
  Issue,
  LeaderRow,
  OutOfRangeRecord,
  ParseResult,
  ResidentRow,
} from './types'

export interface Loaded<T> {
  readonly fileName: string
  readonly result: ParseResult<T>
}

export interface LeaderFile {
  readonly fileName: string
  readonly ccaID: string
  readonly result: ParseResult<LeaderRow>
}

/** A leader file after the cross-file checks (rows with unknown matrics removed). */
export interface CheckedLeader {
  readonly fileName: string
  readonly ccaID: string
  readonly rows: readonly LeaderRow[]
}

/** Flat member rows (the bundle's, or a standalone flat-points file's): one group per flat CCA (spec 2e). */
export interface FlatFile {
  readonly fileName: string
  readonly result: ParseResult<FlatRow>
}

export interface CheckedFlat {
  readonly fileName: string
  readonly ccaID: string
  readonly flatPoints: number
  readonly rows: readonly FlatRow[]
}

export function checkResidentRows(residents: Loaded<ResidentRow>, config: ScenarioConfig): Issue[] {
  return residents.result.rows
    .filter((resident) => resident.aux > config.auxCap)
    .map((resident) =>
      makeIssue('AUX_ABOVE_CAP', residents.fileName, `${resident.matric} has ${resident.aux} AUX; only ${config.auxCap} count.`, {
        line: resident.line,
        column: 'aux',
        matric: resident.matric,
      }),
    )
}

/** Applies the checks that need the residents and CCA lists to one leader file. */
export function checkLeaderFile(
  leader: LeaderFile,
  residents: Loaded<ResidentRow> | null,
  ccas: Loaded<CcaRow> | null,
): { readonly issues: Issue[]; readonly checked: CheckedLeader | null } {
  const { fileName, ccaID } = leader
  if (ccas && !ccas.result.seenKeys.includes(ccaID)) {
    const text = `CCA "${ccaID}" is not listed in ${ccas.fileName}.`
    return { issues: [makeIssue('UNKNOWN_CCA', fileName, text, { ccaID })], checked: null }
  }
  const known = new Set(residents?.result.seenKeys ?? [])
  const issues: Issue[] = []
  const rows = leader.result.rows.filter((row) => {
    if (!residents || known.has(row.matric)) return true
    const text = `${row.matric} is not in the residents list (${residents.fileName}).`
    issues.push(makeIssue('UNKNOWN_MATRIC', fileName, text, { line: row.line, column: 'matric', matric: row.matric, ccaID }))
    return false
  })
  return { issues, checked: { fileName, ccaID, rows } }
}

/**
 * Checks each flat CCA of the flat rows: it must be in the bundle, must not also have a leader
 * file, must carry one value, and its members must be known and not repeated.
 */
export function checkFlatFile(
  flat: FlatFile,
  residents: Loaded<ResidentRow> | null,
  ccas: Loaded<CcaRow> | null,
  leaderIds: ReadonlySet<string>,
): { readonly issues: Issue[]; readonly checked: CheckedFlat[] } {
  const issues: Issue[] = []
  const checked: CheckedFlat[] = []
  const known = new Set(residents?.result.seenKeys ?? [])
  const { fileName } = flat
  for (const ccaID of flat.result.seenKeys) {
    const rows = flat.result.rows.filter((row) => row.ccaID === ccaID)
    if (ccas && !ccas.result.seenKeys.includes(ccaID)) {
      issues.push(makeIssue('UNKNOWN_CCA', fileName, `CCA "${ccaID}" is not listed in ${ccas.fileName}.`, { ccaID }))
      continue
    }
    if (leaderIds.has(ccaID)) {
      const text = `${ccaID} has a points file AND flat points; a CCA is one or the other.`
      issues.push(makeIssue('FLAT_AND_LEADER_FILE', fileName, text, { ccaID }))
      continue
    }
    const first = rows[0]
    if (!first) continue
    if (rows.some((row) => row.flatPoints !== first.flatPoints)) {
      const text = `${ccaID} has different flatPoints on different rows; every row of one CCA must carry the same value.`
      issues.push(makeIssue('FLAT_VALUE_MISMATCH', fileName, text, { ccaID }))
    }
    const seen = new Set<string>()
    const members = rows.filter((row) => {
      if (residents && !known.has(row.matric)) {
        const text = `${row.matric} is not in the residents list (${residents.fileName}).`
        issues.push(makeIssue('UNKNOWN_MATRIC', fileName, text, { line: row.line, column: 'matric', matric: row.matric, ccaID }))
        return false
      }
      if (seen.has(row.matric)) {
        const text = `${row.matric} appears more than once for ${ccaID}; the later row is ignored.`
        issues.push(makeIssue('DUPLICATE_MATRIC_IN_FILE', fileName, text, { line: row.line, matric: row.matric, ccaID }))
        return false
      }
      seen.add(row.matric)
      return true
    })
    checked.push({ fileName, ccaID, flatPoints: first.flatPoints, rows: members })
  }
  return { issues, checked }
}

export function leaderWarnings(
  ccas: Loaded<CcaRow>,
  leaders: readonly CheckedLeader[],
): Issue[] {
  const halfIds = new Set(ccas.result.rows.filter((c) => c.type === '0.5x').map((c) => c.ccaID))
  const halfCounts = new Map<string, number>()
  const issues: Issue[] = []
  for (const leader of leaders) {
    for (const row of leader.rows) {
      if (!halfIds.has(leader.ccaID)) continue
      halfCounts.set(row.matric, (halfCounts.get(row.matric) ?? 0) + 1)
      if (row.semesterOnly) {
        const text = `${row.matric} is marked semester-only, but ${leader.ccaID} is a 0.5x CCA, so the tick is ignored.`
        issues.push(makeIssue('SEMESTER_ONLY_ON_HALF_CCA', leader.fileName, text, { line: row.line, column: 'semesterOnly', matric: row.matric, ccaID: leader.ccaID }))
      }
    }
  }
  for (const [matric, count] of halfCounts) {
    if (count > MAX_EXHAUSTIVE_HALVES) {
      const text = `${matric} is in ${count} half-weight (0.5x) CCAs; they will be paired by a simpler method.`
      issues.push(makeIssue('MANY_HALF_CCAS', '', text, { matric }))
    }
  }
  return issues
}

const fixed = (value: number): string => value.toFixed(2)

function meanSdMessage(cca: CcaRow, n: number, mean: number, sd: number, range: MeanSdRange): string {
  if (n === 0) return `${cca.ccaName} (${cca.ccaID}) has no members, so the average and spread cannot be checked.`
  return (
    `${cca.ccaName} (${cca.ccaID}): the average is ${fixed(mean)} and the spread (standard deviation) is ${fixed(sd)}. ` +
    `The average must be from ${range.meanMin} to ${range.meanMax} and the spread from ${range.sdMin} to ${range.sdMax}.`
  )
}

/** A flat CCA is not mean/SD checked and never counts as missing a file (spec 2e). */
export function flatStats(cca: CcaRow, flat: CheckedFlat, config: ScenarioConfig): CcaStats {
  const range = resolveRange(cca, config.meanSdDefault)
  const report: BaseCcaReport = {
    ccaID: cca.ccaID,
    name: cca.ccaName,
    range,
    fileName: flat.fileName,
    n: flat.rows.length,
    mean: null,
    sd: null,
    status: 'flat',
    flatPoints: flat.flatPoints,
  }
  return { report, issue: null, outOfRange: null }
}

export interface CcaStats {
  readonly report: BaseCcaReport
  readonly issue: Issue | null
  readonly outOfRange: OutOfRangeRecord | null
}

/** Mean/SD for one CCA over its valid leader rows. */
export function ccaStats(
  cca: CcaRow,
  leader: CheckedLeader | undefined,
  config: ScenarioConfig,
): CcaStats {
  const range = resolveRange(cca, config.meanSdDefault)
  const base = { ccaID: cca.ccaID, name: cca.ccaName, range, flatPoints: null }
  if (!leader) {
    const report: BaseCcaReport = { ...base, fileName: null, n: 0, mean: null, sd: null, status: 'missing_file' }
    return { report, issue: null, outOfRange: null }
  }
  const scores = leader.rows.map((row) => row.basePoints)
  const check = checkMeanSd(scores, range, RANGE_TOLERANCE)
  const n = scores.length
  const mean = n === 0 ? null : check.mean
  const sd = n === 0 ? null : check.sd
  const status = check.ok && n > 0 ? 'ok' : 'out_of_range'
  const report: BaseCcaReport = { ...base, fileName: leader.fileName, n, mean, sd, status }
  if (status === 'ok') return { report, issue: null, outOfRange: null }
  const text = meanSdMessage(cca, n, check.mean, check.sd, range)
  const issue = makeIssue('MEAN_SD_OUT_OF_RANGE', leader.fileName, text, { ccaID: cca.ccaID })
  const outOfRange = { ccaID: cca.ccaID, name: cca.ccaName, fileName: leader.fileName, mean, sd, range }
  return { report, issue, outOfRange }
}
