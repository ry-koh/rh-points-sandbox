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
  renameLevelInEntries,
  reviewKey,
  upsertCcaLevel,
  validateImport,
  type CcaLevelEntry,
  type ImportReport,
  type NotSubmittingMark,
  type ReviewEdit,
  type SourceFile,
  type VettedMark,
} from '../../import'
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

export const EMPTY_REVIEW: WorkspaceReview = { edits: [], log: [], vetted: [], notSubmitting: [] }

export interface AppState {
  readonly files: readonly SourceFile[]
  readonly config: ScenarioConfig
  /** Each CCA's level and tweaks (spec 3b): in memory and the workspace file only. */
  readonly ccaLevels: readonly CcaLevelEntry[]
  /** Score edits and their log, vetted and not-submitting marks: in memory and the workspace file only. */
  readonly review: WorkspaceReview
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
  | { readonly type: 'setVetted'; readonly ccaID: string; readonly at: string }
  | { readonly type: 'clearVetted'; readonly ccaID: string }
  | { readonly type: 'setNotSubmitting'; readonly mark: NotSubmittingMark }
  | { readonly type: 'clearNotSubmitting'; readonly ccaID: string }
  | { readonly type: 'setCcaLevel'; readonly entry: CcaLevelEntry }
  /** Replaces the whole level table. Used by the demo loader only. */
  | { readonly type: 'setCcaLevelsAll'; readonly list: readonly CcaLevelEntry[] }
  | { readonly type: 'setStep'; readonly step: WorkflowStep }
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

/**
 * Why the lists cannot be finalised yet, or null when they can. Finalising needs the RH-app bundle
 * with usable settings (so every range check used JCRC's own ranges) and an import without errors.
 */
export function finaliseBlock(state: Pick<AppState, 'report'>): string | null {
  if (!state.report.settings) return BUNDLE_REQUIRED_REASON
  if (!state.report.canCompute) return 'Fix the import errors before finalising.'
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

export function initialState(config: ScenarioConfig = DEFAULT_CONFIG): AppState {
  return revalidate({ files: [], config })
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

/**
 * Vetted and not-submitting marks. A vetted mark stores the leader file's hash from the report
 * (R2); a CCA without a leader file cannot be vetted (D25).
 */
function markChange(state: AppState, action: Action): AppState {
  const { review } = state
  switch (action.type) {
    case 'setVetted': {
      const fileHash = state.report.perCca.find((c) => c.ccaID === action.ccaID)?.fileHash ?? null
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

/** Review, checklist and level actions: locked while finalised, like every other input (R11). */
function reviewChange(state: AppState, action: Action): AppState {
  if (state.finalised) return state
  switch (action.type) {
    case 'setReviewEdit':
    case 'removeReviewEdit':
      return editChange(state, action)
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

function change(state: AppState, action: Action): AppState {
  switch (action.type) {
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
    case 'loadWorkspace':
      return revalidate({ ...action.workspace, dirty: false, savedAt: null })
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
