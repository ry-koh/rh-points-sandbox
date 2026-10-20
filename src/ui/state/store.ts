import {
  DEFAULT_CONFIG,
  upsertDiscretion,
  upsertOverride,
  type Discretion,
  type EntryOptions,
  type FinalOverride,
  type Level,
  type PenaltyKey,
  type PenaltyState,
  type PipelineResult,
  type ScenarioConfig,
  type WheelList,
  type WheelResolution,
} from '../../engine'
import {
  checklistComplete,
  checklistRows,
  renameLevelInEntries,
  reviewKey,
  upsertCcaLevel,
  validateImport,
  vettedStatus,
  type AuxEdit,
  type CcaLevelEntry,
  type FlatEdit,
  type IhgTickEdit,
  type ImportReport,
  type NotSubmittingMark,
  type PerCcaReport,
  type ReviewEdit,
  type SourceFile,
  type VettedMark,
} from '../../import'
import { groupsOnLoad, normaliseGroups, type CcaGroup } from '../../import/groups'
import { sandboxInputOf, type WorkflowStep, type WorkspaceReview } from '../../workspace'

/** Why Finalise is refused until the RH-app bundle (with its settings) is loaded (spec 2d). */
export const BUNDLE_REQUIRED_REASON = 'Load the RH-app bundle before finalising.'

/** One applied penalty as shown in the Penalties panel. */
export interface PenaltyLogEntry {
  readonly key: PenaltyKey
  readonly residentName: string
  readonly ccaName: string
  readonly outcome: string
}

/** Present only while the lists are finalised (settings and files locked). */
export interface Finalised {
  readonly penalty: PenaltyState
  readonly log: readonly PenaltyLogEntry[]
}

/** A level's bonus or multiplier was edited and the tweaks on it were cleared (D21), for Settings to say so. */
export interface LevelChange {
  readonly level: string
  readonly clearedTweaks: number
}

export const EMPTY_REVIEW: WorkspaceReview = {
  edits: [],
  log: [],
  vetted: [],
  notSubmitting: [],
  tickEdits: [],
  tickLog: [],
  flatEdits: [],
  flatLog: [],
  auxEdits: [],
  auxLog: [],
}

export interface AppState {
  readonly files: readonly SourceFile[]
  readonly config: ScenarioConfig
  /** Each CCA's level and tweaks (spec 3b): in memory and the workspace file only. */
  readonly ccaLevels: readonly CcaLevelEntry[]
  /** Score edits and their log, vetted and not-submitting marks: in memory and the workspace file only. */
  readonly review: WorkspaceReview
  /** CCA groups (ids and names only): kept in browser storage and the workspace file. */
  readonly groups: readonly CcaGroup[]
  /** Whether the last workspace load replaced this computer's groups with the file's (D3 = A). */
  readonly groupsReplaced: boolean
  /** The open step of the guided workflow. Changing it is navigation, not a change to save. */
  readonly step: WorkflowStep
  /** Set by the settings change that cleared tweaks; null after any other change. */
  readonly lastLevelChange: LevelChange | null
  /** Final-points overrides, discretion and wheel results: resident data, in memory only. */
  readonly finalOverrides: readonly FinalOverride[]
  readonly discretion: readonly Discretion[]
  readonly resolutions: readonly WheelResolution[]
  readonly report: ImportReport
  readonly results: PipelineResult | null
  readonly computeError: string | null
  readonly finalised: Finalised | null
  /** Something changed since the last Save or Open workspace. */
  readonly dirty: boolean
  /** When the workspace was last saved (ISO), or null. */
  readonly savedAt: string | null
}

/** Everything a workspace file restores; the report is recomputed from the files. */
export interface LoadedWorkspace {
  readonly files: readonly SourceFile[]
  readonly config: ScenarioConfig
  readonly ccaLevels: readonly CcaLevelEntry[]
  readonly review: WorkspaceReview
  /** The file's groups; null or empty leaves this computer's groups alone. */
  readonly groups: readonly CcaGroup[] | null
  readonly step: WorkflowStep
  readonly finalOverrides: readonly FinalOverride[]
  readonly discretion: readonly Discretion[]
  readonly resolutions: readonly WheelResolution[]
  readonly finalised: Finalised | null
}

export type Action =
  | { readonly type: 'addFiles'; readonly files: readonly SourceFile[] }
  | { readonly type: 'removeFile'; readonly name: string }
  | { readonly type: 'setConfig'; readonly config: ScenarioConfig }
  | { readonly type: 'setFinalOverride'; readonly entry: FinalOverride }
  | { readonly type: 'removeFinalOverride'; readonly matric: string; readonly ccaID: string }
  | { readonly type: 'setDiscretion'; readonly entry: Discretion }
  | { readonly type: 'removeDiscretion'; readonly matric: string }
  | { readonly type: 'setResolution'; readonly resolution: WheelResolution }
  | { readonly type: 'clearResolution'; readonly list: WheelList; readonly matrics: readonly string[] }
  | { readonly type: 'setResults'; readonly results: PipelineResult | null; readonly error: string | null }
  | { readonly type: 'finalise'; readonly penalty: PenaltyState }
  | { readonly type: 'applyPenalty'; readonly penalty: PenaltyState; readonly entry: PenaltyLogEntry }
  | { readonly type: 'undoPenalty'; readonly penalty: PenaltyState; readonly key: PenaltyKey }
  | { readonly type: 'unlock' }
  | { readonly type: 'setReviewEdit'; readonly entry: ReviewEdit }
  | { readonly type: 'removeReviewEdit'; readonly matric: string; readonly ccaID: string; readonly at: string }
  | { readonly type: 'setTickEdit'; readonly entry: IhgTickEdit }
  | { readonly type: 'removeTickEdit'; readonly matric: string; readonly ccaID: string; readonly at: string }
  | { readonly type: 'setFlatEdit'; readonly entry: FlatEdit }
  | { readonly type: 'removeFlatEdit'; readonly matric: string; readonly ccaID: string; readonly at: string }
  | { readonly type: 'setAuxEdit'; readonly entry: AuxEdit }
  | { readonly type: 'removeAuxEdit'; readonly matric: string; readonly at: string }
  | { readonly type: 'setVetted'; readonly ccaID: string; readonly at: string }
  | { readonly type: 'clearVetted'; readonly ccaID: string }
  | { readonly type: 'setNotSubmitting'; readonly mark: NotSubmittingMark }
  | { readonly type: 'clearNotSubmitting'; readonly ccaID: string }
  | { readonly type: 'setCcaLevel'; readonly entry: CcaLevelEntry }
  /** Replaces the whole level table. Used by the demo loader only. */
  | { readonly type: 'setCcaLevelsAll'; readonly list: readonly CcaLevelEntry[] }
  | { readonly type: 'setStep'; readonly step: WorkflowStep }
  /** Groups do not affect points, so this is allowed while finalised. */
  | { readonly type: 'setGroups'; readonly groups: readonly CcaGroup[] }
  | { readonly type: 'loadWorkspace'; readonly workspace: LoadedWorkspace }
  | { readonly type: 'markSaved'; readonly at: string }

type Inputs = Pick<AppState, 'files' | 'config'> & Partial<AppState>

/** Validation is pure and fast, so it runs on every change to files, config, levels or review. */
function revalidate(state: Inputs): AppState {
  const ccaLevels = state.ccaLevels ?? []
  const review = state.review ?? EMPTY_REVIEW
  const report = validateImport(state.files, state.config, sandboxInputOf({ ccaLevels, review }))
  return {
    files: state.files,
    config: state.config,
    ccaLevels,
    review,
    groups: state.groups ?? [],
    groupsReplaced: state.groupsReplaced ?? false,
    step: state.step ?? 'import',
    lastLevelChange: state.lastLevelChange ?? null,
    finalOverrides: state.finalOverrides ?? [],
    discretion: state.discretion ?? [],
    resolutions: state.resolutions ?? [],
    report,
    results: report.canCompute ? (state.results ?? null) : null,
    computeError: null,
    finalised: state.finalised ?? null,
    dirty: state.dirty ?? false,
    savedAt: state.savedAt ?? null,
  }
}

const namesOf = (rows: readonly { readonly name: string }[]): string => rows.map((row) => row.name).join(', ')

/**
 * The "not set" items that block Finalise (D9 extended), as one message, or null. Flat and
 * not-submitting CCAs never count; IHG and level need a leader file, type does not.
 */
function notSetReason(report: AppState['report'], review: AppState['review']): string | null {
  const rows = checklistRows(report, review.notSubmitting).filter((r) => r.status !== 'flat' && r.status !== 'not_submitting')
  const withFile = rows.filter((r) => r.fileName !== null)
  const noType = rows.filter((r) => r.type === null)
  const noIhg = withFile.filter((r) => r.isSport && (r.ihgResult === null || r.ihgCap === null))
  const noLevel = withFile.filter((r) => r.level === null)
  const fromApp = [
    noType.length > 0 ? `type: ${namesOf(noType)}` : '',
    noIhg.length > 0 ? `IHG result or cap: ${namesOf(noIhg)}` : '',
  ].filter((part) => part !== '')
  const parts = [
    fromApp.length > 0 ? `Set these in the RH app and download the bundle again — ${fromApp.join('; ')}.` : '',
    noLevel.length > 0 ? `Pick a level on the Review step for: ${namesOf(noLevel)}.` : '',
  ].filter((part) => part !== '')
  return parts.length > 0 ? parts.join(' ') : null
}

/**
 * The CCAs that can be vetted and that Finalise needs vetted: every bundle CCA with a leader file,
 * and every flat CCA (D1 = A), i.e. those with a `vetHash`. Not-submitting and missing CCAs have none.
 */
export function vettableCcas(report: Pick<ImportReport, 'perCca'>): PerCcaReport[] {
  return report.perCca.filter((c) => c.vetHash !== null)
}

/**
 * The vetted lock (R1): true while the CCA's vetted mark still matches its content, so a changed
 * leader file or flat roster lifts it (R17), as does clearing the mark.
 */
export function vettedLocked(state: Pick<AppState, 'report' | 'review'>, ccaID: string): boolean {
  const mark = state.review.vetted.find((m) => m.ccaID === ccaID)
  return mark !== undefined && vettedStatus(mark, state.report.perCca) === 'vetted'
}

/** A mark on a changed file or flat roster does not count. */
function vettedCounts(state: Pick<AppState, 'report' | 'review'>): { readonly vetted: number; readonly total: number } {
  const vettable = vettableCcas(state.report)
  return { vetted: vettable.filter((c) => vettedLocked(state, c.ccaID)).length, total: vettable.length }
}

/**
 * Why the lists cannot be finalised yet, or null when they can. In this order: the RH-app bundle
 * with usable settings, anything not set, the checklist, vetting (D4), then import errors.
 */
export function finaliseBlock(state: Pick<AppState, 'report' | 'review'>): string | null {
  const { report, review } = state
  if (!report.settings) return BUNDLE_REQUIRED_REASON
  const notSet = notSetReason(report, review)
  if (notSet) return notSet
  if (!checklistComplete(checklistRows(report, review.notSubmitting))) return 'Complete the checklist before finalising.'
  const { vetted, total } = vettedCounts(state)
  if (vetted < total) return `Vet every CCA before finalising (${vetted} of ${total} vetted).`
  if (!report.canCompute) return 'Fix the import errors before finalising.'
  return null
}

/**
 * The config the app works with: the user's config, except that while a settings file is loaded
 * its default range is THE default range. A scenario load or edit cannot change that.
 */
export function effectiveConfig(state: Pick<AppState, 'config' | 'report'>): ScenarioConfig {
  const settings = state.report.settings
  return settings ? { ...state.config, meanSdDefault: settings.defaultRange } : state.config
}

/** The direct JCRC entries to hand to computeAll and the penalty functions. */
export function entryOptions(state: Pick<AppState, 'finalOverrides' | 'discretion' | 'resolutions'>): EntryOptions {
  return { overrides: state.finalOverrides, discretion: state.discretion, resolutions: state.resolutions }
}

export function initialState(config: ScenarioConfig = DEFAULT_CONFIG, groups: readonly CcaGroup[] = []): AppState {
  return revalidate({ files: [], config, groups })
}

/** A dropped file with the same name replaces the earlier one. */
function mergeFiles(current: readonly SourceFile[], added: readonly SourceFile[]): SourceFile[] {
  const names = new Set(added.map((f) => f.name))
  return [...current.filter((f) => !names.has(f.name)), ...added]
}

const sameKey = (a: PenaltyKey, b: PenaltyKey): boolean => a.matric === b.matric && a.ccaID === b.ccaID

/** A wheel result is identified by its list and the set of matrics in its tie group. */
export const resolutionKey = (list: WheelList, matrics: readonly string[]): string =>
  `${list}|${[...matrics].sort().join(',')}`

const keyOfResolution = (r: WheelResolution): string => resolutionKey(r.list, r.order)

/** Files, settings, final-points overrides and discretion: locked while finalised. */
function inputChange(state: AppState, action: Action): AppState {
  if (state.finalised) return state
  switch (action.type) {
    case 'addFiles':
      return revalidate({ ...state, files: mergeFiles(state.files, action.files) })
    case 'removeFile':
      return revalidate({ ...state, files: state.files.filter((f) => f.name !== action.name) })
    case 'setConfig':
      return revalidate({ ...state, config: action.config, ...levelsAfter(state.config.levels, action.config.levels, state.ccaLevels) })
    case 'setFinalOverride':
      return { ...state, finalOverrides: upsertOverride(state.finalOverrides, action.entry) }
    case 'removeFinalOverride':
      return { ...state, finalOverrides: state.finalOverrides.filter((o) => !(o.matric === action.matric && o.ccaID === action.ccaID)) }
    case 'setDiscretion':
      return { ...state, discretion: upsertDiscretion(state.discretion, action.entry) }
    case 'removeDiscretion':
      return { ...state, discretion: state.discretion.filter((d) => d.matric !== action.matric) }
    default:
      return state
  }
}

const levelNames = (levels: readonly Level[]): string[] => levels.map((level) => level.name)

/** The one index whose name changed when the count did not, and only if the old name was unique (R44). */
function renamedLevel(before: readonly Level[], after: readonly Level[]): { from: string; to: string } | null {
  if (before.length !== after.length) return null
  const changed = before.flatMap((level, i) => {
    const next = after[i]
    return next && next.name !== level.name ? [{ from: level.name, to: next.name }] : []
  })
  const only = changed.length === 1 ? changed[0] : undefined
  if (!only) return null
  return levelNames(before).filter((name) => name === only.from).length === 1 ? only : null
}

type LevelNumber = 'bonus' | 'multiplier'

/**
 * The one level number edited while the names and their order stayed the same, else null.
 * A reset or a loaded scenario that changes several numbers clears nothing.
 */
function editedLevelNumber(before: readonly Level[], after: readonly Level[]): { level: string; field: LevelNumber } | null {
  const sameNames = before.length === after.length && before.every((level, i) => level.name === after[i]?.name)
  if (!sameNames) return null
  const fields: readonly LevelNumber[] = ['bonus', 'multiplier']
  const edits = before.flatMap((level, i) =>
    fields.filter((field) => level[field] !== after[i]?.[field]).map((field) => ({ level: level.name, field })),
  )
  return edits.length === 1 ? (edits[0] ?? null) : null
}

/**
 * How a settings change carries the CCAs' level entries: a rename moves them to the new name
 * (R44); editing a level's bonus or multiplier clears that tweak on its CCAs, so they follow
 * the level (D21). Removing or reordering levels, or a reset, touches nothing.
 * Vetted CCAs' tweaks are cleared too and their marks are kept (D2 = B): the level table is
 * hall-wide config, not a per-CCA action, so this is the one deliberate exception to the vetted lock.
 */
function levelsAfter(
  before: readonly Level[],
  after: readonly Level[],
  entries: readonly CcaLevelEntry[],
): Pick<AppState, 'ccaLevels' | 'lastLevelChange'> {
  const rename = renamedLevel(before, after)
  if (rename) return { ccaLevels: renameLevelInEntries(entries, rename.from, rename.to), lastLevelChange: null }
  const edited = editedLevelNumber(before, after)
  const key = edited?.field === 'bonus' ? 'bonusOverride' : 'multiplierOverride'
  const tweaked = (entry: CcaLevelEntry): boolean => entry.level === edited?.level && entry[key] !== null
  const cleared = entries.filter(tweaked).length
  if (!edited || cleared === 0) return { ccaLevels: entries, lastLevelChange: null }
  const ccaLevels = entries.map((entry) => (tweaked(entry) ? { ...entry, [key]: null } : entry))
  return { ccaLevels, lastLevelChange: { level: edited.level, clearedTweaks: cleared } }
}

/** The leader file's current value for an edit's membership, as the last validation judged it. */
function fileValueOf(state: AppState, edit: ReviewEdit): number | null {
  const key = reviewKey(edit)
  return state.report.review.edits.find((checked) => reviewKey(checked.entry) === key)?.fileValue ?? null
}

/** One active edit per membership, and a log line for every set and remove (spec 6.4). */
function editChange(state: AppState, action: Action): AppState {
  const { review } = state
  if (action.type === 'setReviewEdit') {
    const key = reviewKey(action.entry)
    const others = review.edits.filter((e) => reviewKey(e) !== key)
    const edits = others.length < review.edits.length
      ? review.edits.map((e) => (reviewKey(e) === key ? action.entry : e))
      : [...review.edits, action.entry]
    return revalidate({ ...state, review: { ...review, edits, log: [...review.log, { ...action.entry, kind: 'edit' }] } })
  }
  if (action.type === 'removeReviewEdit') {
    const key = reviewKey(action)
    const edit = review.edits.find((e) => reviewKey(e) === key)
    if (!edit) return state
    // The log line reads "edited value -> file value"; with the membership gone, back to `from`.
    const to = fileValueOf(state, edit) ?? edit.from
    const line = { matric: edit.matric, ccaID: edit.ccaID, from: edit.to, to, reason: '', at: action.at, kind: 'remove' as const }
    const edits = review.edits.filter((e) => reviewKey(e) !== key)
    return revalidate({ ...state, review: { ...review, edits, log: [...review.log, line] } })
  }
  return state
}

type LogLine<E> = E & { readonly kind: 'edit' | 'remove' }

interface EditList<E> {
  readonly edits: readonly E[]
  readonly log: readonly LogLine<E>[]
}

/** One active edit per key, and a log line for every set (spec 6.4). */
function upsertEdit<E>(list: EditList<E>, keyOf: (entry: E) => string, entry: E): EditList<E> {
  const key = keyOf(entry)
  const edits = list.edits.some((e) => keyOf(e) === key)
    ? list.edits.map((e) => (keyOf(e) === key ? entry : e))
    : [...list.edits, entry]
  return { edits, log: [...list.log, { ...entry, kind: 'edit' }] }
}

/**
 * Removes the key's edit and logs "edited value -> current file value" (back to `from` when the
 * target is gone), like removeReviewEdit; null when there is no edit to remove.
 */
function dropEdit<V, E extends { readonly from: V; readonly to: V }>(
  list: EditList<E>,
  keyOf: (entry: E) => string,
  key: string,
  at: string,
  currentOf: (edit: E) => V | null,
): EditList<E> | null {
  const edit = list.edits.find((e) => keyOf(e) === key)
  if (!edit) return null
  const line = { ...edit, from: edit.to, to: currentOf(edit) ?? edit.from, reason: '', at, kind: 'remove' } as LogLine<E>
  return { edits: list.edits.filter((e) => keyOf(e) !== key), log: [...list.log, line] }
}

const auxKey = (entry: Pick<AuxEdit, 'matric'>): string => entry.matric

type Judged<E, V = unknown> = readonly { readonly entry: E; readonly status: string; readonly current: V | null }[]

/** The source's current value for an edit, as the last validation judged it. */
const currentIn = <E, V>(judged: Judged<E, V>, keyOf: (entry: E) => string) => (edit: E): V | null =>
  judged.find((j) => keyOf(j.entry) === keyOf(edit))?.current ?? null

/** Tick, flat and AUX edits, kept and logged by the same rules as score edits. */
function otherEditChange(state: AppState, action: Action): AppState {
  const { review } = state
  const judged = state.report.review
  const ticks = (list: EditList<IhgTickEdit> | null) => list && { ...review, tickEdits: list.edits, tickLog: list.log }
  const flats = (list: EditList<FlatEdit> | null) => list && { ...review, flatEdits: list.edits, flatLog: list.log }
  const aux = (list: EditList<AuxEdit> | null) => list && { ...review, auxEdits: list.edits, auxLog: list.log }
  const tickList = { edits: review.tickEdits, log: review.tickLog }
  const flatList = { edits: review.flatEdits, log: review.flatLog }
  const auxList = { edits: review.auxEdits, log: review.auxLog }
  const next = ((): WorkspaceReview | null => {
    switch (action.type) {
      case 'setTickEdit':
        return ticks(upsertEdit(tickList, reviewKey, action.entry))
      case 'removeTickEdit':
        return ticks(dropEdit(tickList, reviewKey, reviewKey(action), action.at, currentIn(judged.tickEdits, reviewKey)))
      case 'setFlatEdit':
        return flats(upsertEdit(flatList, reviewKey, action.entry))
      case 'removeFlatEdit':
        return flats(dropEdit(flatList, reviewKey, reviewKey(action), action.at, currentIn(judged.flatEdits, reviewKey)))
      case 'setAuxEdit':
        return aux(upsertEdit(auxList, auxKey, action.entry))
      case 'removeAuxEdit':
        return aux(dropEdit(auxList, auxKey, auxKey(action), action.at, currentIn(judged.auxEdits, auxKey)))
      default:
        return null
    }
  })()
  return next ? revalidate({ ...state, review: next }) : state
}

/** Whether the membership's edit is in use, as the last validation judged it. */
const isApplied = (judged: Judged<Pick<ReviewEdit, 'matric' | 'ccaID'>>, key: string): boolean =>
  judged.some((j) => reviewKey(j.entry) === key && j.status === 'applied')

/**
 * The reducer-level vetted lock (R1): on a vetted CCA, refuses new score, tick and flat edits, a
 * level change, and removing an APPLIED edit. Removing a changed or stale edit changes nothing in
 * use, so it stays allowed. `setCcaLevelsAll` (demo loader only) is exempt; AUX is not per CCA.
 */
function lockRefuses(state: AppState, action: Action): boolean {
  const judged = state.report.review
  const edits = judged.edits.map((e) => ({ entry: e.entry, status: e.status, current: e.fileValue }))
  switch (action.type) {
    case 'setReviewEdit':
    case 'setTickEdit':
    case 'setFlatEdit':
    case 'setCcaLevel':
      return vettedLocked(state, action.entry.ccaID)
    case 'removeReviewEdit':
      return vettedLocked(state, action.ccaID) && isApplied(edits, reviewKey(action))
    case 'removeTickEdit':
      return vettedLocked(state, action.ccaID) && isApplied(judged.tickEdits, reviewKey(action))
    case 'removeFlatEdit':
      return vettedLocked(state, action.ccaID) && isApplied(judged.flatEdits, reviewKey(action))
    default:
      return false
  }
}

/**
 * Vetted and not-submitting marks. A vetted mark stores the CCA's `vetHash` from the report (R2);
 * only a vettable CCA (leader file or flat) can be vetted (D25, D1).
 */
function markChange(state: AppState, action: Action): AppState {
  const { review } = state
  switch (action.type) {
    case 'setVetted': {
      const fileHash = vettableCcas(state.report).find((c) => c.ccaID === action.ccaID)?.vetHash ?? null
      if (fileHash === null) return state
      const mark: VettedMark = { ccaID: action.ccaID, fileHash, at: action.at }
      return { ...state, review: { ...review, vetted: [...review.vetted.filter((m) => m.ccaID !== action.ccaID), mark] } }
    }
    case 'clearVetted': {
      const vetted = review.vetted.filter((m) => m.ccaID !== action.ccaID)
      return vetted.length === review.vetted.length ? state : { ...state, review: { ...review, vetted } }
    }
    case 'setNotSubmitting': {
      const notSubmitting = [...review.notSubmitting.filter((m) => m.ccaID !== action.mark.ccaID), action.mark]
      return revalidate({ ...state, review: { ...review, notSubmitting } })
    }
    case 'clearNotSubmitting': {
      const notSubmitting = review.notSubmitting.filter((m) => m.ccaID !== action.ccaID)
      return notSubmitting.length === review.notSubmitting.length ? state : revalidate({ ...state, review: { ...review, notSubmitting } })
    }
    default:
      return state
  }
}

/** Review, checklist and level actions: locked while finalised, like every other input (R11), and by the vetted lock. */
function reviewChange(state: AppState, action: Action): AppState {
  if (state.finalised || lockRefuses(state, action)) return state
  switch (action.type) {
    case 'setReviewEdit':
    case 'removeReviewEdit':
      return editChange(state, action)
    case 'setTickEdit':
    case 'removeTickEdit':
    case 'setFlatEdit':
    case 'removeFlatEdit':
    case 'setAuxEdit':
    case 'removeAuxEdit':
      return otherEditChange(state, action)
    case 'setCcaLevel':
      return revalidate({ ...state, ccaLevels: upsertCcaLevel(state.ccaLevels, action.entry) })
    case 'setCcaLevelsAll':
      return revalidate({ ...state, ccaLevels: action.list })
    default:
      return markChange(state, action)
  }
}

/** Wheel results stay editable while finalised (spec 5.6). */
function wheelChange(state: AppState, action: Action): AppState {
  if (action.type === 'setResolution') {
    const key = keyOfResolution(action.resolution)
    return { ...state, resolutions: [...state.resolutions.filter((r) => keyOfResolution(r) !== key), action.resolution] }
  }
  if (action.type === 'clearResolution') {
    const key = resolutionKey(action.list, action.matrics)
    return { ...state, resolutions: state.resolutions.filter((r) => keyOfResolution(r) !== key) }
  }
  return state
}

function penaltyChange(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'finalise':
      return state.finalised || finaliseBlock(state) !== null ? state : { ...state, finalised: { penalty: action.penalty, log: [] } }
    case 'applyPenalty':
      if (!state.finalised) return state
      return { ...state, finalised: { penalty: action.penalty, log: [...state.finalised.log, action.entry] } }
    case 'undoPenalty':
      if (!state.finalised) return state
      return {
        ...state,
        finalised: { penalty: action.penalty, log: state.finalised.log.filter((e) => !sameKey(e.key, action.key)) },
      }
    case 'unlock':
      // Wheel results are kept; they may go stale and are then flagged.
      return state.finalised ? { ...state, finalised: null } : state
    default:
      return state
  }
}

/** Allowed while finalised: groups only order the CCA list. A no-op keeps the same state. */
function groupsChange(state: AppState, action: Action): AppState {
  if (action.type !== 'setGroups') return state
  const groups = normaliseGroups(action.groups)
  return JSON.stringify(groups) === JSON.stringify(state.groups) ? state : { ...state, groups }
}

function change(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'setGroups':
      return groupsChange(state, action)
    case 'addFiles':
    case 'removeFile':
    case 'setConfig':
    case 'setFinalOverride':
    case 'removeFinalOverride':
    case 'setDiscretion':
    case 'removeDiscretion':
      return inputChange(state, action)
    case 'setResolution':
    case 'clearResolution':
      return wheelChange(state, action)
    case 'setReviewEdit':
    case 'removeReviewEdit':
    case 'setTickEdit':
    case 'removeTickEdit':
    case 'setFlatEdit':
    case 'removeFlatEdit':
    case 'setAuxEdit':
    case 'removeAuxEdit':
    case 'setVetted':
    case 'clearVetted':
    case 'setNotSubmitting':
    case 'clearNotSubmitting':
    case 'setCcaLevel':
    case 'setCcaLevelsAll':
      return reviewChange(state, action)
    default:
      return penaltyChange(state, action)
  }
}

export function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'setResults':
      return { ...state, results: action.results, computeError: action.error }
    case 'markSaved':
      return { ...state, dirty: false, savedAt: action.at }
    case 'loadWorkspace': {
      const { groups: fromFile, ...rest } = action.workspace
      const { groups, replaced } = groupsOnLoad(state.groups, fromFile)
      return revalidate({ ...rest, groups, groupsReplaced: replaced, dirty: false, savedAt: null })
    }
    case 'setStep':
      // Navigation is never an unsaved change.
      return state.step === action.step ? state : { ...state, step: action.step, lastLevelChange: null }
    default: {
      // Any real change to files, adjustments, wheel results, penalties, finalise state,
      // settings, review marks or levels marks the workspace as having unsaved changes.
      const next = change(state, action)
      if (next === state) return state
      const lastLevelChange = action.type === 'setConfig' ? next.lastLevelChange : null
      return { ...next, lastLevelChange, dirty: true }
    }
  }
}
