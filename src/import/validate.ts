import type { Cca, MeanSdRange, Membership, PipelineInput, Resident, ScenarioConfig } from '../engine'
import {
  checkCcaRows,
  checkFlatFile,
  checkIhgRows,
  checkLeaderFile,
  checkOutgoing,
  checkResidentRows,
  ccaStats,
  flatStats,
  ihgNonMemberWarnings,
  ihgOnFlatWarnings,
  leaderWarnings,
  type CheckedFlat,
  type CheckedLeader,
  type LeaderFile,
  type Loaded,
} from './checks'
import { parseCsv } from './csv'
import { FILE_COLUMNS, detectFileKind } from './detect'
import { parseCcas } from './parseCcas'
import { parseFlat } from './parseFlat'
import { makeIssue } from './parseCommon'
import { parseIhg } from './parseIhg'
import { parseLeader } from './parseLeader'
import { parseResidents } from './parseResidents'
import { parseSettings } from './parseSettings'
import type {
  CcaRow,
  FileKind,
  ImportReport,
  Issue,
  IhgRow,
  LoadedSettings,
  OverrideRequest,
  ParsedCsv,
  ParseResult,
  ResidentRow,
  SettingsRow,
  SourceFile,
} from './types'

interface Classified {
  readonly file: SourceFile
  readonly csv: ParsedCsv
  /** Set only when the header is exactly right. */
  readonly kind: FileKind | null
  /** The kind the header or (failing that) the file name says it is meant to be. */
  readonly claimed: FileKind | null
}

const KIND_LABEL: Readonly<Record<FileKind, string>> = {
  leader: 'a CCA points file',
  residents: 'the residents list',
  ihg: 'the IHG list',
  ccas: 'the CCA settings list',
  flat: 'the flat-points file',
  settings: "JCRC's points settings file",
}

function guessKindFromName(name: string): FileKind | null {
  const lower = name.toLowerCase()
  if (lower.startsWith('points_settings_')) return 'settings'
  if (lower.startsWith('points_')) return 'leader'
  if (lower.startsWith('flat_points_')) return 'flat'
  return (['residents', 'ihg', 'ccas'] as const).find((kind) => lower.startsWith(kind)) ?? null
}

function headerProblem(claimed: FileKind, header: readonly string[]): string {
  const expected = FILE_COLUMNS[claimed]
  const missing = expected.filter((col) => !header.includes(col))
  const extra = header.filter((col) => !expected.includes(col))
  const parts = [
    ...(missing.length > 0 ? [`missing ${missing.join(', ')}`] : []),
    ...(extra.length > 0 ? [`unexpected ${extra.join(', ')}`] : []),
  ]
  const detail = parts.length > 0 ? parts.join('; ') : 'columns repeated or misspelt'
  return `the column names do not match ${KIND_LABEL[claimed]} (${detail}). Column names must be exact.`
}

function classify(file: SourceFile, issues: Issue[]): Classified {
  const csv = parseCsv(file.text)
  for (const problem of csv.issues) {
    issues.push(makeIssue('CSV_SYNTAX', file.name, problem.message, { line: problem.line }))
  }
  const kind = detectFileKind(csv.header)
  if (kind) return { file, csv, kind, claimed: kind }
  const claimed = guessKindFromName(file.name)
  const text = claimed
    ? headerProblem(claimed, csv.header)
    : 'this file is not a points file, flat-points file, settings file, residents list, IHG list or CCA settings list (its columns match none of them).'
  issues.push(makeIssue(claimed ? 'BAD_HEADER' : 'UNRECOGNISED_FILE', file.name, text))
  return { file, csv, kind: null, claimed }
}

function fileLevelIssues(classified: readonly Classified[]): Issue[] {
  const issues: Issue[] = []
  for (const [kind, code] of [['residents', 'MISSING_RESIDENTS_FILE'], ['ccas', 'MISSING_CCAS_FILE']] as const) {
    if (!classified.some((c) => c.claimed === kind)) {
      issues.push(makeIssue(code, '', `No ${KIND_LABEL[kind]} was provided (${kind}.csv is needed).`))
    }
  }
  for (const kind of ['residents', 'ccas', 'ihg'] as const) {
    for (const extra of classified.filter((c) => c.kind === kind).slice(1)) {
      const text = `${KIND_LABEL[kind]} was provided more than once; this extra copy is ignored.`
      issues.push(makeIssue('DUPLICATE_RESIDENTS_OR_CCAS_FILE', extra.file.name, text))
    }
  }
  for (const extra of classified.filter((c) => c.kind === 'flat').slice(1)) {
    const text = `${KIND_LABEL.flat} was provided more than once; this extra copy is ignored.`
    issues.push(makeIssue('DUPLICATE_FLAT_FILE', extra.file.name, text))
  }
  for (const extra of classified.filter((c) => c.kind === 'settings').slice(1)) {
    const text = `${KIND_LABEL.settings} was provided more than once; this extra copy is ignored.`
    issues.push(makeIssue('DUPLICATE_SETTINGS_FILE', extra.file.name, text))
  }
  return issues
}

function loadFirst<T>(
  classified: readonly Classified[],
  kind: FileKind,
  parse: (fileName: string, csv: ParsedCsv) => ParseResult<T>,
  issues: Issue[],
): Loaded<T> | null {
  const found = classified.find((c) => c.kind === kind)
  if (!found) return null
  const result = parse(found.file.name, found.csv)
  issues.push(...result.issues)
  return { fileName: found.file.name, result }
}

/** The settings file is usable when it has exactly one clean default row. Its waivers are by ccaID. */
function readSettings(settings: Loaded<SettingsRow> | null): LoadedSettings | null {
  if (!settings) return null
  const rows = settings.result.rows
  const defaults = rows.filter((r) => r.scope === 'default')
  const broken = settings.result.issues.some((i) => i.code === 'BAD_SETTINGS_FILE')
  const [fallback] = defaults
  if (broken || defaults.length !== 1 || !fallback) return null
  const waivers = Object.fromEntries(rows.filter((r) => r.scope === 'waiver').map((r) => [r.ccaID, r.range]))
  return { fileName: settings.fileName, exportedAt: fallback.exportedAt, defaultRange: fallback.range, waivers }
}

const hasOwnRange = (cca: CcaRow): boolean =>
  cca.meanMin !== null || cca.meanMax !== null || cca.sdMin !== null || cca.sdMax !== null

/**
 * With a settings file loaded, the only ranges are the file's (spec 2g, 7.1): each CCA row gets its
 * waiver range or none (so it follows the file's default), ccas.csv ranges are dropped with one
 * warning, and a waiver for a CCA ccas.csv does not list is ignored with a warning.
 */
function applySettings(
  ccas: Loaded<CcaRow> | null,
  settings: LoadedSettings,
): { readonly ccas: Loaded<CcaRow> | null; readonly waivers: Readonly<Record<string, MeanSdRange>>; readonly issues: Issue[] } {
  if (!ccas) return { ccas, waivers: settings.waivers, issues: [] }
  const known = new Set(ccas.result.seenKeys)
  const issues: Issue[] = []
  const waivers: Record<string, MeanSdRange> = {}
  for (const [ccaID, range] of Object.entries(settings.waivers)) {
    if (known.has(ccaID)) waivers[ccaID] = range
    else {
      const text = `${ccaID} has a waiver in the settings file but is not listed in ${ccas.fileName}; the waiver is ignored.`
      issues.push(makeIssue('SETTINGS_UNKNOWN_CCA', settings.fileName, text, { ccaID }))
    }
  }
  const ignored = ccas.result.rows.filter(hasOwnRange).map((c) => c.ccaID)
  if (ignored.length > 0) {
    const text = `mean/SD ranges for ${ignored.join(', ')} are ignored because JCRC's points settings file is loaded.`
    issues.push(makeIssue('CCAS_RANGE_IGNORED', ccas.fileName, text))
  }
  const rows = ccas.result.rows.map((cca) => ({ ...cca, ...(waivers[cca.ccaID] ?? { meanMin: null, meanMax: null, sdMin: null, sdMax: null }) }))
  return { ccas: { fileName: ccas.fileName, result: { ...ccas.result, rows } }, waivers, issues }
}

const ccaIdFromFileName = (name: string): string => /^points_(.+)_\d{8}\.csv$/i.exec(name)?.[1] ?? ''

function loadLeaders(classified: readonly Classified[], issues: Issue[]): LeaderFile[] {
  const files: LeaderFile[] = []
  for (const c of classified.filter((item) => item.kind === 'leader')) {
    const result = parseLeader(c.file.name, c.csv)
    issues.push(...result.issues)
    const ccaID = result.seenKeys[0] ?? ccaIdFromFileName(c.file.name)
    if (files.some((f) => f.ccaID === ccaID)) {
      issues.push(makeIssue('DUPLICATE_CCA_FILE', c.file.name, `A second points file for ${ccaID} was provided; this one is ignored.`, { ccaID }))
    } else {
      files.push({ fileName: c.file.name, ccaID, result })
    }
  }
  return files
}

function toEngineInput(
  residents: Loaded<ResidentRow>,
  ccas: Loaded<CcaRow>,
  leaders: readonly CheckedLeader[],
  flats: readonly CheckedFlat[],
  ihg: readonly IhgRow[],
): PipelineInput {
  const residentList = residents.result.rows.map(
    ({ matric, name, gender, sem2, aux, jcrc }): Resident => ({ matric, name, gender, sem2, aux, jcrc }),
  )
  const ccaList = ccas.result.rows.map(({ line: _line, ...cca }): Cca => cca)
  const memberships = leaders.flatMap((leader) =>
    leader.rows.map(
      (row): Membership => ({
        matric: row.matric,
        ccaID: leader.ccaID,
        basePoints: row.basePoints,
        semesterOnly: row.semesterOnly,
        outgoingRole: row.outgoingRole,
        incomingRole: row.incomingRole,
        roleDropped: false,
      }),
    ),
  )
  const flatMemberships = flats.flatMap((flat) =>
    flat.rows.map(
      (row): Membership => ({
        matric: row.matric,
        ccaID: flat.ccaID,
        basePoints: 0,
        semesterOnly: false,
        outgoingRole: 'none',
        incomingRole: 'none',
        roleDropped: false,
        flatPoints: flat.flatPoints,
      }),
    ),
  )
  return {
    residents: residentList,
    ccas: ccaList,
    memberships: [...memberships, ...flatMemberships],
    ihg: ihg.map(({ matric, ccaID, placement }) => ({ matric, ccaID, placement })),
  }
}

/**
 * Parses and checks the dropped files. Pure: the same files, config and overrides always
 * give the same report. Only MEAN_SD_OUT_OF_RANGE can be overridden.
 */
export function validateImport(
  files: readonly SourceFile[],
  config: ScenarioConfig,
  overrides: readonly OverrideRequest[],
): ImportReport {
  const issues: Issue[] = []
  const classified = files.map((file) => classify(file, issues))
  issues.push(...fileLevelIssues(classified))
  const residents = loadFirst(classified, 'residents', parseResidents, issues)
  const loadedCcas = loadFirst(classified, 'ccas', parseCcas, issues)
  const settingsFile = loadFirst(classified, 'settings', parseSettings, issues)
  const settings = readSettings(settingsFile)
  const applied = settings ? applySettings(loadedCcas, settings) : null
  if (applied) issues.push(...applied.issues)
  const ccas = applied ? applied.ccas : loadedCcas
  // While a settings file is loaded, its default replaces the sandbox's own for every check.
  const checkConfig: ScenarioConfig = settings ? { ...config, meanSdDefault: settings.defaultRange } : config
  const ihg = loadFirst(classified, 'ihg', parseIhg, issues)
  const leaderFiles = loadLeaders(classified, issues)
  const flatFile = loadFirst(classified, 'flat', parseFlat, issues)
  if (residents) issues.push(...checkResidentRows(residents, config))
  if (ccas) issues.push(...checkCcaRows(ccas, config))
  const checked: CheckedLeader[] = []
  for (const leader of leaderFiles) {
    const outcome = checkLeaderFile(leader, residents, ccas)
    issues.push(...outcome.issues)
    if (outcome.checked) checked.push(outcome.checked)
  }
  const flatOutcome = flatFile
    ? checkFlatFile(flatFile, residents, ccas, new Set(leaderFiles.map((f) => f.ccaID)))
    : null
  if (flatOutcome) issues.push(...flatOutcome.issues)
  const flats = flatOutcome?.checked ?? []
  const ihgOutcome = ihg ? checkIhgRows(ihg, residents, ccas) : null
  if (ihgOutcome) issues.push(...ihgOutcome.issues)
  if (ccas) issues.push(...checkOutgoing(ccas, checked, config), ...leaderWarnings(ccas, checked))
  if (ihg && config.ihgInSportNet) issues.push(...ihgNonMemberWarnings(ihg, checked, flats))
  if (ihg) issues.push(...ihgOnFlatWarnings(ihg, flats))
  const wanted = new Set(overrides.map((o) => o.ccaID))
  const stats = (ccas?.result.rows ?? []).map((cca) => {
    const flat = flats.find((f) => f.ccaID === cca.ccaID)
    return flat
      ? flatStats(cca, flat, checkConfig)
      : ccaStats(cca, checked.find((l) => l.ccaID === cca.ccaID), checkConfig, wanted.has(cca.ccaID))
  })
  for (const s of stats) {
    if (s.issue) issues.push(s.issue)
    if (s.report.status === 'missing_file') {
      issues.push(makeIssue('NO_LEADER_FILE', '', `${s.report.name} (${s.report.ccaID}) has no points file.`, { ccaID: s.report.ccaID }))
    }
  }
  const canCompute = !issues.some((i) => i.severity === 'error' && i.overridden !== true)
  const input =
    canCompute && residents && ccas ? toEngineInput(residents, ccas, checked, flats, ihgOutcome?.rows ?? []) : undefined
  const reportSettings: LoadedSettings | null = settings && applied ? { ...settings, waivers: applied.waivers } : settings
  return {
    canCompute,
    settings: reportSettings,
    issues,
    perCca: stats.map((s) => s.report),
    overrides: stats.flatMap((s) => (s.override ? [s.override] : [])),
    ...(input ? { input } : {}),
  }
}
