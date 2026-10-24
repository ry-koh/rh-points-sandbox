import type { IhgEntry, MeanSdRange, Membership, PipelineInput, Resident, ScenarioConfig } from '../engine'
import { applyAuxEdits, type CheckedAuxEdit } from './auxEdits'
import { withBundleAux, type BundleAux } from './bundleAux'
import { ccaLevelFor, isBonusTweak, isMultiplierTweak, levelProblems, validateCcaLevelEntry } from './ccaLevels'
import {
  checkFlatFile,
  checkLeaderFile,
  checkResidentRows,
  ccaStats,
  flatStats,
  leaderWarnings,
  type CcaStats,
  type CheckedFlat,
  type CheckedLeader,
  type FlatFile,
  type LeaderFile,
  type Loaded,
} from './checks'
import { parseCsv } from './csv'
import { fnv1a32 } from './hash'
import { applyFlatEdits, type CheckedFlatEdit } from './flatEdits'
import {
  BUNDLE_AUX_COLUMN,
  BUNDLE_V1_COLUMNS,
  FILE_COLUMNS,
  RETIRED_CCAS_COLUMNS,
  RETIRED_IHG_COLUMNS,
  detectFileKind,
  headerMatches,
} from './detect'
import { buildIhgFromTicks } from './ihgTicks'
import { applyMembershipEdits } from './membershipEdits'
import { bundleVersionOf, parseBundle } from './parseBundle'
import { parseFlat } from './parseFlat'
import { makeIssue } from './parseCommon'
import { parseLeader } from './parseLeader'
import { parseResidents } from './parseResidents'
import { parseSettings } from './parseSettings'
import { applyReviewEdits, reviewKey } from './review'
import { applyTickEdits } from './tickEdits'
import type {
  BundleCca,
  BundleCcaRow,
  BundleRow,
  CcaLevelEntry,
  CcaRow,
  FileKind,
  FlatRow,
  FlatTable,
  ImportReport,
  Issue,
  LoadedBundle,
  LoadedSettings,
  ParsedCsv,
  ParseResult,
  PerCcaReport,
  ResidentRow,
  SandboxInput,
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
  flat: 'the flat-points file',
  settings: "JCRC's points settings file",
  bundle: 'the RH-app bundle',
}

function guessKindFromName(name: string): FileKind | null {
  const lower = name.toLowerCase()
  if (lower.startsWith('points_bundle_')) return 'bundle'
  if (lower.startsWith('points_settings_')) return 'settings'
  if (lower.startsWith('points_')) return 'leader'
  if (lower.startsWith('flat_points_')) return 'flat'
  return lower.startsWith('residents') ? 'residents' : null
}

function headerProblem(claimed: FileKind, header: readonly string[]): string {
  // A bundle without the aux column is judged as version 1, so the message never asks for `aux`.
  const v1Bundle = claimed === 'bundle' && !header.includes(BUNDLE_AUX_COLUMN)
  const expected = v1Bundle ? BUNDLE_V1_COLUMNS : FILE_COLUMNS[claimed]
  const missing = expected.filter((col) => !header.includes(col))
  const extra = header.filter((col) => !expected.includes(col))
  const parts = [
    ...(missing.length > 0 ? [`missing ${missing.join(', ')}`] : []),
    ...(extra.length > 0 ? [`unexpected ${extra.join(', ')}`] : []),
  ]
  const detail = parts.length > 0 ? parts.join('; ') : 'columns repeated or misspelt'
  return `the column names do not match ${KIND_LABEL[claimed]} (${detail}). Column names must be exact.`
}

/** The retired ccas.csv, by its header or its name (R34): CCAS_FILE_RETIRED, its rows are never read. */
const isRetiredCcasFile = (file: SourceFile, header: readonly string[]): boolean =>
  headerMatches(header, RETIRED_CCAS_COLUMNS) || file.name.toLowerCase().startsWith('ccas') // CCAS_FILE_RETIRED

const CCAS_RETIRED_TEXT = 'ccas.csv is no longer used: CCA types come from the RH-app bundle and levels are set on the Review step. Remove this file.' // CCAS_FILE_RETIRED

/** The retired ihg.csv, by its header or its name (R34): IHG_FILE_RETIRED, its rows are never read. */
const isRetiredIhgFile = (file: SourceFile, header: readonly string[]): boolean =>
  headerMatches(header, RETIRED_IHG_COLUMNS) || file.name.toLowerCase().startsWith('ihg') // IHG_FILE_RETIRED

const IHG_RETIRED_TEXT = "ihg.csv is no longer used: IHG results come from the RH-app bundle and the sport's head ticks who gets the points in the RH app. Remove this file." // IHG_FILE_RETIRED

function classify(file: SourceFile, issues: Issue[]): Classified {
  const csv = parseCsv(file.text)
  for (const problem of csv.issues) {
    issues.push(makeIssue('CSV_SYNTAX', file.name, problem.message, { line: problem.line }))
  }
  const kind = detectFileKind(csv.header)
  if (kind) return { file, csv, kind, claimed: kind }
  if (isRetiredCcasFile(file, csv.header)) {
    issues.push(makeIssue('CCAS_FILE_RETIRED', file.name, CCAS_RETIRED_TEXT))
    return { file, csv, kind: null, claimed: null }
  }
  if (isRetiredIhgFile(file, csv.header)) {
    issues.push(makeIssue('IHG_FILE_RETIRED', file.name, IHG_RETIRED_TEXT))
    return { file, csv, kind: null, claimed: null }
  }
  const claimed = guessKindFromName(file.name)
  const text = claimed
    ? headerProblem(claimed, csv.header)
    : 'this file is not a points file, RH-app bundle, flat-points file, settings file or residents list (its columns match none of them).'
  issues.push(makeIssue(claimed ? 'BAD_HEADER' : 'UNRECOGNISED_FILE', file.name, text))
  return { file, csv, kind: null, claimed }
}

const MISSING_BUNDLE_TEXT =
  'No RH-app bundle was provided; it carries the CCA list, the ranges and the flat members. Download it from /admin/points.'

function fileLevelIssues(classified: readonly Classified[]): Issue[] {
  const issues: Issue[] = []
  const ofKind = (kind: FileKind): Classified[] => classified.filter((c) => c.kind === kind)
  if (!classified.some((c) => c.claimed === 'residents')) {
    issues.push(makeIssue('MISSING_RESIDENTS_FILE', '', `No ${KIND_LABEL.residents} was provided (residents.csv is needed).`))
  }
  if (!classified.some((c) => c.claimed === 'bundle')) issues.push(makeIssue('MISSING_BUNDLE_FILE', '', MISSING_BUNDLE_TEXT))
  for (const extra of ofKind('residents').slice(1)) {
    const text = `${KIND_LABEL.residents} was provided more than once; this extra copy is ignored.`
    issues.push(makeIssue('DUPLICATE_RESIDENTS_FILE', extra.file.name, text))
  }
  for (const extra of ofKind('bundle').slice(1)) {
    const text = `${KIND_LABEL.bundle} was provided more than once; this extra copy is ignored. Remove the older bundle.`
    issues.push(makeIssue('DUPLICATE_BUNDLE_FILE', extra.file.name, text))
  }
  const hasBundle = ofKind('bundle').length > 0
  for (const [kind, code] of [['flat', 'DUPLICATE_FLAT_FILE'], ['settings', 'DUPLICATE_SETTINGS_FILE']] as const) {
    for (const extra of ofKind(kind).slice(hasBundle ? 0 : 1)) {
      const text = hasBundle
        ? `the RH-app bundle already carries ${KIND_LABEL[kind]}; this standalone copy is ignored.`
        : `${KIND_LABEL[kind]} was provided more than once; this extra copy is ignored.`
      issues.push(makeIssue(code, extra.file.name, text))
    }
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

/** The settings are usable when they have exactly one clean default row. Waivers are by ccaID. */
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

/** The bundle split into its parts: settings rows, flat member rows, the CCA list and (version 2) the AUX counts. */
interface SplitBundle {
  readonly fileName: string
  readonly exportedAt: string
  readonly formatVersion: number
  /** null for a version-1 bundle: the AUX counts then come from residents.csv. */
  readonly aux: BundleAux | null
  readonly settings: Loaded<SettingsRow>
  readonly flat: FlatFile
  readonly ccas: ParseResult<BundleCcaRow>
}

function splitBundle(classified: readonly Classified[], issues: Issue[]): SplitBundle | null {
  const found = classified.find((c) => c.kind === 'bundle')
  const loaded = loadFirst(classified, 'bundle', parseBundle, issues)
  if (!found || !loaded) return null
  const { fileName, result } = loaded
  const pick = <S extends BundleRow['section']>(section: S) =>
    result.rows.flatMap((r) => (r.section === section ? [r.row as Extract<BundleRow, { section: S }>['row']] : []))
  const settingsRows = pick('settings')
  const flatRows: FlatRow[] = pick('flat')
  const waiverIDs = settingsRows.filter((r) => r.scope === 'waiver').map((r) => r.ccaID)
  const formatVersion = bundleVersionOf(found.csv.header)
  const auxRows = pick('aux')
  return {
    fileName,
    exportedAt: found.csv.rows[0]?.cells[found.csv.header.indexOf('exportedAt')] ?? '',
    formatVersion,
    aux: formatVersion === 1 ? null : { fileName, year: auxRows[0]?.scope ?? null, rows: auxRows },
    settings: { fileName, result: { rows: settingsRows, seenKeys: waiverIDs, issues: result.issues } },
    flat: { fileName, result: { rows: flatRows, seenKeys: [...new Set(flatRows.map((r) => r.ccaID))], issues: [] } },
    ccas: { rows: pick('cca'), seenKeys: result.seenKeys, issues: [] },
  }
}

/** Waivers for CCAs the CCA list does not have are ignored with a warning (spec 2g). */
function knownWaivers(
  settings: LoadedSettings,
  ccaIds: readonly string[],
  listName: string,
): { readonly waivers: Readonly<Record<string, MeanSdRange>>; readonly issues: Issue[] } {
  const issues: Issue[] = []
  const waivers: Record<string, MeanSdRange> = {}
  for (const [ccaID, range] of Object.entries(settings.waivers)) {
    if (ccaIds.includes(ccaID)) waivers[ccaID] = range
    else {
      const text = `${ccaID} has a waiver in the settings file but is not listed in ${listName}; the waiver is ignored.`
      issues.push(makeIssue('SETTINGS_UNKNOWN_CCA', settings.fileName, text, { ccaID }))
    }
  }
  return { waivers, issues }
}

const NO_RANGE = { meanMin: null, meanMax: null, sdMin: null, sdMax: null }

/** Checks the level entries; an entry with a bad level or tweak hands the engine null instead (R44). */
function usableEntries(ccaLevels: readonly CcaLevelEntry[], config: ScenarioConfig, ccaIds: ReadonlySet<string>, issues: Issue[]): CcaLevelEntry[] {
  return ccaLevels.map((entry) => {
    const problems = validateCcaLevelEntry(entry, config, ccaIds)
    issues.push(...problems)
    return {
      ...entry,
      level: problems.some((p) => p.code === 'UNKNOWN_LEVEL') ? null : entry.level,
      bonusOverride: isBonusTweak(entry.bonusOverride) ? entry.bonusOverride : null,
      multiplierOverride: isMultiplierTweak(entry.multiplierOverride) ? entry.multiplierOverride : null,
    }
  })
}

/**
 * One CCA row per bundle cca row: the type from the bundle (blank = 1x, with TYPE_NOT_SET unless
 * the CCA is flat), the range from its waiver, and the level and tweaks from the sandbox table.
 */
function synthesiseCcas(
  bundle: SplitBundle,
  waivers: Readonly<Record<string, MeanSdRange>>,
  entries: readonly CcaLevelEntry[],
  issues: Issue[],
): Loaded<CcaRow> {
  const rows = bundle.ccas.rows.map((cca): CcaRow => {
    if (cca.type === null && cca.flatPoints === null) {
      const text = `${cca.ccaName} (${cca.ccaID}) has no type set in RH-app, so 1x is assumed. Set it on /admin/points and download the bundle again.`
      issues.push(makeIssue('TYPE_NOT_SET', bundle.fileName, text, { line: cca.line, column: 'type', ccaID: cca.ccaID }))
    }
    const entry = ccaLevelFor(entries, cca.ccaID)
    return {
      line: cca.line,
      ccaID: cca.ccaID,
      ccaName: cca.ccaName,
      type: cca.type ?? '1x',
      level: entry?.level ?? null,
      bonusOverride: entry?.bonusOverride ?? null,
      multiplierOverride: entry?.multiplierOverride ?? null,
      ...(waivers[cca.ccaID] ?? NO_RANGE),
    }
  })
  return { fileName: bundle.fileName, result: { rows, seenKeys: bundle.ccas.seenKeys, issues: [] } }
}

/** A non-flat CCA with a points file and nothing picked in the level table (R25). */
function levelNotSet(bundle: SplitBundle, leaderIds: ReadonlySet<string>, ccaLevels: readonly CcaLevelEntry[]): Issue[] {
  return bundle.ccas.rows
    .filter((cca) => cca.flatPoints === null && leaderIds.has(cca.ccaID))
    .filter((cca) => {
      const entry = ccaLevelFor(ccaLevels, cca.ccaID)
      return !entry || (entry.level === null && entry.bonusOverride === null && entry.multiplierOverride === null)
    })
    .map((cca) => {
      const text = `${cca.ccaName} (${cca.ccaID}) has no level yet, so a bonus of 0 and ×1 are assumed. Pick it on the Review step.`
      return makeIssue('LEVEL_NOT_SET', '', text, { ccaID: cca.ccaID })
    })
}

/**
 * The bundle's flat CCAs: a group with no member rows is still flat (n 0), the member rows must
 * carry the cca row's value, and a flat CCA cannot also have a points file.
 */
function bundleFlatGroups(
  bundle: SplitBundle,
  flats: readonly CheckedFlat[],
  leaderFiles: readonly LeaderFile[],
): { readonly issues: Issue[]; readonly flats: CheckedFlat[] } {
  const issues: Issue[] = []
  for (const flat of flats) {
    const cca = bundle.ccas.rows.find((c) => c.ccaID === flat.ccaID)
    if (cca && cca.flatPoints !== flat.flatPoints) {
      const value = cca.flatPoints === null ? 'blank' : String(cca.flatPoints)
      const text = `${flat.ccaID} has flatPoints ${flat.flatPoints} on its member rows but ${value} on its cca row; they must match.`
      issues.push(makeIssue('FLAT_VALUE_MISMATCH', bundle.fileName, text, { line: cca.line, column: 'flatPoints', ccaID: flat.ccaID }))
    }
  }
  const empty: CheckedFlat[] = []
  for (const cca of bundle.ccas.rows.filter((c) => c.flatPoints !== null && !flats.some((f) => f.ccaID === c.ccaID))) {
    const leader = leaderFiles.find((f) => f.ccaID === cca.ccaID)
    if (leader) {
      const text = `${cca.ccaID} has a points file AND flat points; a CCA is one or the other.`
      issues.push(makeIssue('FLAT_AND_LEADER_FILE', leader.fileName, text, { ccaID: cca.ccaID }))
    } else {
      empty.push({ fileName: bundle.fileName, ccaID: cca.ccaID, flatPoints: cca.flatPoints ?? 0, rows: [] })
    }
  }
  return { issues, flats: [...flats, ...empty] }
}

/**
 * A flat CCA's content fingerprint (R2): its flat value and its sorted member matrics, from the
 * bundle's rows only, so a re-exported bundle (new exportedAt) or a name change keeps it.
 */
function flatVetHash(bundle: SplitBundle, ccaID: string): string | null {
  const flatPoints = bundle.ccas.rows.find((c) => c.ccaID === ccaID)?.flatPoints ?? null
  if (flatPoints === null) return null
  const matrics = bundle.flat.result.rows.filter((r) => r.ccaID === ccaID).map((r) => r.matric).sort()
  return fnv1a32(`flat|${flatPoints}|${matrics.join(',')}`)
}

/** The flat CCAs' members with the bundle's value and the value in use, for the Review flat table. */
function flatTables(fileFlats: readonly CheckedFlat[], edits: readonly CheckedFlatEdit[]): FlatTable[] {
  const applied = new Map(edits.filter((e) => e.status === 'applied').map((e) => [reviewKey(e.entry), e.entry.to]))
  return fileFlats.map((flat) => {
    const rows = flat.rows.map((row) => ({
      matric: row.matric,
      name: row.name,
      fileValue: row.flatPoints,
      value: applied.get(reviewKey({ matric: row.matric, ccaID: flat.ccaID })) ?? row.flatPoints,
    }))
    return { ccaID: flat.ccaID, flatPoints: flat.flatPoints, rows }
  })
}

const ccaIdFromFileName = (name: string): string => /^points_(.+)_\d{8}\.csv$/i.exec(name)?.[1] ?? ''

/** The leader files (one per CCA) and the hash of each one's text, by ccaID. */
function loadLeaders(
  classified: readonly Classified[],
  issues: Issue[],
): { readonly files: LeaderFile[]; readonly hashes: ReadonlyMap<string, string> } {
  const files: LeaderFile[] = []
  const hashes = new Map<string, string>()
  for (const c of classified.filter((item) => item.kind === 'leader')) {
    const result = parseLeader(c.file.name, c.csv)
    issues.push(...result.issues)
    const ccaID = result.seenKeys[0] ?? ccaIdFromFileName(c.file.name)
    if (files.some((f) => f.ccaID === ccaID)) {
      issues.push(makeIssue('DUPLICATE_CCA_FILE', c.file.name, `A second points file for ${ccaID} was provided; this one is ignored.`, { ccaID }))
    } else {
      files.push({ fileName: c.file.name, ccaID, result })
      hashes.set(ccaID, fnv1a32(c.file.text))
    }
  }
  return { files, hashes }
}

function toEngineInput(
  residents: Loaded<ResidentRow>,
  ccas: Loaded<CcaRow>,
  leaders: readonly CheckedLeader[],
  flats: readonly CheckedFlat[],
  ihg: readonly IhgEntry[],
): PipelineInput {
  const residentList = residents.result.rows.map(
    ({ matric, name, gender, sem2, aux, jcrc }): Resident => ({ matric, name, gender, sem2, aux, jcrc }),
  )
  const ccaList = ccas.result.rows.map(({ line: _line, ...cca }) => cca)
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
        flatPoints: row.flatPoints,
      }),
    ),
  )
  return {
    residents: residentList,
    ccas: ccaList,
    memberships: [...memberships, ...flatMemberships],
    ihg: [...ihg],
  }
}

const byCcaID = (a: BundleCca, b: BundleCca): number => a.ccaID.localeCompare(b.ccaID, undefined, { numeric: true })

function loadedBundle(bundle: SplitBundle | null): LoadedBundle | null {
  if (!bundle) return null
  const ccas = bundle.ccas.rows.map(({ line: _line, ...cca }): BundleCca => cca).sort(byCcaID)
  return {
    fileName: bundle.fileName,
    exportedAt: bundle.exportedAt,
    formatVersion: bundle.formatVersion,
    auxYear: bundle.aux?.year ?? null,
    ccas,
  }
}

/** Adds what the bundle, the level table and the leader file say about a CCA to its stats. */
function perCcaReport(
  stats: CcaStats,
  cca: CcaRow,
  bundle: SplitBundle,
  leaders: readonly CheckedLeader[],
  tickedByCca: Readonly<Record<string, number>>,
  hashes: ReadonlyMap<string, string>,
): PerCcaReport {
  const row = bundle.ccas.rows.find((c) => c.ccaID === cca.ccaID)
  const leader = leaders.find((l) => l.ccaID === cca.ccaID)
  const fileHash = leader ? (hashes.get(cca.ccaID) ?? null) : null
  return {
    ...stats.report,
    type: row?.type ?? null,
    isSport: row?.isSport ?? false,
    ihgResult: row?.ihgResult ?? null,
    ihgCap: row?.ihgCap ?? null,
    level: cca.level,
    bonusOverride: cca.bonusOverride,
    multiplierOverride: cca.multiplierOverride,
    outgoingLeaders: leader?.rows.filter((r) => r.outgoingRole !== 'none').length ?? 0,
    ihgTicked: tickedByCca[cca.ccaID] ?? 0,
    fileHash,
    vetHash: fileHash ?? flatVetHash(bundle, cca.ccaID),
  }
}

/**
 * Parses and checks the dropped files with the values entered in the sandbox (the level table,
 * the review, tick, flat and AUX edits and the not-submitting marks). Each kind of edit is applied
 * once, in this order: AUX counts to the resident rows (before their checks), scores, then roles
 * and semester-only, then ticks to the checked leader rows (before the IHG is built), flat values to the flat rows (after
 * the bundle's flat groups). So the checks, the mean/SD, the IHG and the engine input all see the
 * same edited data. The mean/SD use full scores, so a semester-only edit moves the lists, not them.
 * Pure: the same files, config and sandbox values always give the same report. A mean or SD
 * outside the range is a warning, never an error.
 */
export function validateImport(
  files: readonly SourceFile[],
  config: ScenarioConfig,
  sandbox: Partial<SandboxInput> = {},
): ImportReport {
  const ccaLevels = sandbox.ccaLevels ?? []
  const edits = sandbox.edits ?? []
  const notSubmitting = new Set(sandbox.notSubmitting ?? [])
  const tickEdits = sandbox.tickEdits ?? []
  const flatEdits = sandbox.flatEdits ?? []
  const membershipEdits = sandbox.membershipEdits ?? []
  const issues: Issue[] = []
  const classified = files.map((file) => classify(file, issues))
  issues.push(...fileLevelIssues(classified))
  issues.push(...levelProblems(config))
  const fileResidents = loadFirst(classified, 'residents', parseResidents, issues)
  const bundle = splitBundle(classified, issues)
  // A version-2 bundle's AUX counts replace residents.csv's before the AUX edits are judged.
  const fromBundle =
    fileResidents && bundle?.aux ? withBundleAux(fileResidents.result.rows, fileResidents.fileName, bundle.aux) : null
  if (fromBundle) issues.push(...fromBundle.issues)
  // AUX edits next, so AUX_ABOVE_CAP and the engine see the edited counts (R11). Without a bundle
  // the counts' source (bundle or residents.csv) is unknown, so the edits stay unchecked.
  const counted = fromBundle?.rows ?? fileResidents?.result.rows
  const aux = counted && bundle ? applyAuxEdits(counted, sandbox.auxEdits ?? []) : null
  const residents: Loaded<ResidentRow> | null = fileResidents
    ? { ...fileResidents, result: { ...fileResidents.result, rows: aux?.rows ?? fileResidents.result.rows } }
    : null
  const auxEdits: CheckedAuxEdit[] = aux?.edits ?? []
  // A standalone settings or flat file is only read when there is no bundle (it is a duplicate beside one).
  const settingsSource = bundle ? bundle.settings : loadFirst(classified, 'settings', parseSettings, issues)
  const flatFile = bundle ? bundle.flat : loadFirst(classified, 'flat', parseFlat, issues)
  const settings = readSettings(settingsSource)
  const applied = settings && bundle ? knownWaivers(settings, bundle.ccas.seenKeys, bundle.fileName) : null
  if (applied) issues.push(...applied.issues)
  const ccaIds = new Set(bundle?.ccas.seenKeys ?? [])
  const entries = bundle ? usableEntries(ccaLevels, config, ccaIds, issues) : []
  const ccas = bundle ? synthesiseCcas(bundle, applied?.waivers ?? {}, entries, issues) : null
  // While settings are loaded, their default replaces the sandbox's own for every check.
  const checkConfig: ScenarioConfig = settings ? { ...config, meanSdDefault: settings.defaultRange } : config
  const { files: leaderFiles, hashes } = loadLeaders(classified, issues)
  if (bundle) issues.push(...levelNotSet(bundle, new Set(leaderFiles.map((f) => f.ccaID)), ccaLevels))
  if (residents) issues.push(...checkResidentRows(residents, config))
  const fileRows: CheckedLeader[] = []
  for (const leader of leaderFiles) {
    const outcome = checkLeaderFile(leader, residents, ccas)
    issues.push(...outcome.issues)
    if (outcome.checked) fileRows.push(outcome.checked)
  }
  const reviewed = applyReviewEdits(fileRows, edits)
  const membershipReviewed = applyMembershipEdits(reviewed.checked, membershipEdits)
  const tickReviewed = applyTickEdits(membershipReviewed.checked, tickEdits)
  const checked = tickReviewed.checked
  const flatOutcome = flatFile
    ? checkFlatFile(flatFile, residents, ccas, new Set(leaderFiles.map((f) => f.ccaID)))
    : null
  if (flatOutcome) issues.push(...flatOutcome.issues)
  const grouped = bundle ? bundleFlatGroups(bundle, flatOutcome?.checked ?? [], leaderFiles) : null
  if (grouped) issues.push(...grouped.issues)
  const fileFlats = grouped?.flats ?? flatOutcome?.checked ?? []
  const flatReviewed = applyFlatEdits(fileFlats, flatEdits)
  const flats = flatReviewed.flats
  // IHG comes only from the leader files' ticks, judged against the bundle's sport, result and cap.
  const ticks = buildIhgFromTicks(checked, bundle?.ccas.rows ?? [])
  issues.push(...ticks.issues)
  if (ccas) issues.push(...leaderWarnings(ccas, checked))
  const stats = (ccas?.result.rows ?? []).map((cca) => {
    const flat = flats.find((f) => f.ccaID === cca.ccaID)
    const result = flat
      ? flatStats(cca, flat, checkConfig)
      : ccaStats(cca, checked.find((l) => l.ccaID === cca.ccaID), checkConfig)
    return { cca, result }
  })
  for (const { result: s } of stats) {
    if (s.issue) issues.push(s.issue)
    if (s.report.status === 'missing_file' && !notSubmitting.has(s.report.ccaID)) {
      issues.push(makeIssue('NO_LEADER_FILE', '', `${s.report.name} (${s.report.ccaID}) has no points file.`, { ccaID: s.report.ccaID }))
    }
  }
  const canCompute = !issues.some((i) => i.severity === 'error')
  const input =
    canCompute && residents && ccas ? toEngineInput(residents, ccas, checked, flats, ticks.ihg) : undefined
  const reportSettings: LoadedSettings | null = settings && applied ? { ...settings, waivers: applied.waivers } : settings
  return {
    canCompute,
    bundle: loadedBundle(bundle),
    settings: reportSettings,
    issues,
    perCca: bundle ? stats.map(({ cca, result }) => perCcaReport(result, cca, bundle, checked, ticks.tickedByCca, hashes)) : [],
    outOfRange: stats.flatMap(({ result }) => (result.outOfRange ? [result.outOfRange] : [])),
    review: {
      edits: reviewed.edits,
      flatIds: flats.map((f) => f.ccaID),
      tickEdits: tickReviewed.edits,
      flatEdits: flatReviewed.edits,
      auxEdits,
      membershipEdits: membershipReviewed.edits,
      auxUnchecked: aux === null,
      flats: flatTables(fileFlats, flatReviewed.edits),
    },
    ...(input ? { input } : {}),
  }
}
