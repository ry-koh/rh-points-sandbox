import {
  DEFAULT_CONFIG,
  upsertDiscretion,
  upsertOverride,
  type Discretion,
  type EntryOptions,
  type FinalOverride,
  type PenaltyKey,
  type PenaltyState,
  type PipelineResult,
  type ScenarioConfig,
  type WheelList,
  type WheelResolution,
} from '../../engine'
import { validateImport, type ImportReport, type SourceFile } from '../../import'

/** Why Finalise is refused until JCRC's points settings file is loaded (spec 2g). */
export const SETTINGS_REQUIRED_REASON = "Load JCRC's points settings file before finalising."

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

export interface AppState {
  readonly files: readonly SourceFile[]
  readonly config: ScenarioConfig
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
  | { readonly type: 'loadWorkspace'; readonly workspace: LoadedWorkspace }
  | { readonly type: 'markSaved'; readonly at: string }

type Inputs = Pick<AppState, 'files' | 'config'> & Partial<AppState>

/** Validation is pure and fast, so it runs on every change to files or config. */
function revalidate(state: Inputs): AppState {
  const report = validateImport(state.files, state.config)
  return {
    files: state.files,
    config: state.config,
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
 * Why the lists cannot be finalised yet, or null when they can. Finalising needs a usable JCRC
 * settings file (so every range check used JCRC's own ranges) and an import without errors.
 */
export function finaliseBlock(state: Pick<AppState, 'report'>): string | null {
  if (!state.report.settings) return SETTINGS_REQUIRED_REASON
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
      return revalidate({ ...state, config: action.config })
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
    default: {
      // Any real change to files, adjustments, wheel results, penalties,
      // finalise state or settings marks the workspace as having unsaved changes.
      const next = change(state, action)
      return next === state ? state : { ...next, dirty: true }
    }
  }
}
