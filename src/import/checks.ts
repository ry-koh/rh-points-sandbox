import { MAX_EXHAUSTIVE_HALVES, RANGE_TOLERANCE, checkMeanSd, resolveRange } from '../engine'
import type { MeanSdRange, ScenarioConfig } from '../engine'
import { makeIssue } from './parseCommon'
import type {
  CcaRow,
  IhgRow,
  Issue,
  LeaderRow,
  OverrideRecord,
  ParseResult,
  PerCcaReport,
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

export function checkCcaRows(ccas: Loaded<CcaRow>, config: ScenarioConfig): Issue[] {
  const tierNames = new Set(config.outgoingTiers.map((tier) => tier.name))
  return ccas.result.rows
    .filter((cca) => cca.outgoingTier !== null && !tierNames.has(cca.outgoingTier))
    .map((cca) =>
      makeIssue('UNKNOWN_TIER', ccas.fileName, `outgoingTier "${cca.outgoingTier}" is not one of the known tiers (${[...tierNames].join(', ')}).`, {
        line: cca.line,
        column: 'outgoingTier',
        ccaID: cca.ccaID,
      }),
    )
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

export function checkIhgRows(
  ihg: Loaded<IhgRow>,
  residents: Loaded<ResidentRow> | null,
  ccas: Loaded<CcaRow> | null,
): { readonly issues: Issue[]; readonly rows: IhgRow[] } {
  const matrics = new Set(residents?.result.seenKeys ?? [])
  const ccaIDs = new Set(ccas?.result.seenKeys ?? [])
  const issues: Issue[] = []
  const rows = ihg.result.rows.filter((row) => {
    const details = { line: row.line, matric: row.matric, ccaID: row.ccaID }
    if (residents && !matrics.has(row.matric)) {
      issues.push(makeIssue('IHG_UNKNOWN_MATRIC', ihg.fileName, `${row.matric} is not in the residents list.`, { ...details, column: 'matric' }))
      return false
    }
    if (ccas && !ccaIDs.has(row.ccaID)) {
      issues.push(makeIssue('IHG_UNKNOWN_CCA', ihg.fileName, `CCA "${row.ccaID}" is not listed in ${ccas.fileName}.`, { ...details, column: 'ccaID' }))
      return false
    }
    return true
  })
  return { issues, rows }
}

export function ihgNonMemberWarnings(
  ihg: Loaded<IhgRow>,
  leaders: readonly CheckedLeader[],
): Issue[] {
  const members = new Set(leaders.flatMap((l) => l.rows.map((row) => `${row.matric}|${l.ccaID}`)))
  return ihg.result.rows
    .filter((row) => !members.has(`${row.matric}|${row.ccaID}`))
    .map((row) =>
      makeIssue('IHG_NON_MEMBER', ihg.fileName, `${row.matric} has IHG points for ${row.ccaID} but is not a member of it, so they stay flat.`, {
        line: row.line,
        matric: row.matric,
        ccaID: row.ccaID,
      }),
    )
}

/** Outgoing leaders need the tier (tier mode) or the multiplier (manual mode) to be filled in. */
export function checkOutgoing(
  ccas: Loaded<CcaRow>,
  leaders: readonly CheckedLeader[],
  config: ScenarioConfig,
): Issue[] {
  const field = config.outgoingMode === 'tier' ? 'outgoingTier' : 'outgoingMultiplier'
  return ccas.result.rows.flatMap((cca) => {
    const blank = (config.outgoingMode === 'tier' ? cca.outgoingTier : cca.outgoingMultiplier) === null
    const leader = leaders.find((l) => l.ccaID === cca.ccaID)
    const hasOutgoing = leader?.rows.some((row) => row.outgoingRole !== 'none') ?? false
    if (!blank || !hasOutgoing) return []
    const text = `${cca.ccaID} has an outgoing leader, but ${field} is blank in ${ccas.fileName} (the outgoing mode is "${config.outgoingMode}").`
    return [makeIssue('MISSING_OUTGOING_MULTIPLIER', ccas.fileName, text, { line: cca.line, column: field, ccaID: cca.ccaID })]
  })
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

export interface CcaStats {
  readonly report: PerCcaReport
  readonly issue: Issue | null
  readonly override: OverrideRecord | null
}

/** Mean/SD for one CCA over its valid leader rows; honours a per-CCA override. */
export function ccaStats(
  cca: CcaRow,
  leader: CheckedLeader | undefined,
  config: ScenarioConfig,
  overridden: boolean,
): CcaStats {
  const range = resolveRange(cca, config.meanSdDefault)
  const base = { ccaID: cca.ccaID, name: cca.ccaName, range }
  if (!leader) {
    const report: PerCcaReport = { ...base, fileName: null, n: 0, mean: null, sd: null, status: 'missing_file' }
    return { report, issue: null, override: null }
  }
  const scores = leader.rows.map((row) => row.basePoints)
  const check = checkMeanSd(scores, range, RANGE_TOLERANCE)
  const n = scores.length
  const mean = n === 0 ? null : check.mean
  const sd = n === 0 ? null : check.sd
  const status = check.ok && n > 0 ? 'ok' : overridden ? 'overridden' : 'out_of_range'
  const report: PerCcaReport = { ...base, fileName: leader.fileName, n, mean, sd, status }
  if (status === 'ok') return { report, issue: null, override: null }
  const text = meanSdMessage(cca, n, check.mean, check.sd, range)
  const issue = { ...makeIssue('MEAN_SD_OUT_OF_RANGE', leader.fileName, text, { ccaID: cca.ccaID }), ...(overridden ? { overridden: true } : {}) }
  const override = overridden ? { ccaID: cca.ccaID, name: cca.ccaName, fileName: leader.fileName, mean, sd, range } : null
  return { report, issue, override }
}
