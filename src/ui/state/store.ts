import {
  DEFAULT_CONFIG,
  type PenaltyKey,
  type PenaltyState,
  type PipelineResult,
  type ScenarioConfig,
} from '../../engine'
import { validateImport, type ImportReport, type SourceFile } from '../../import'

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
  readonly overrides: readonly string[]
  readonly config: ScenarioConfig
  readonly report: ImportReport
  readonly results: PipelineResult | null
  readonly computeError: string | null
  readonly finalised: Finalised | null
}

export type Action =
  | { readonly type: 'addFiles'; readonly files: readonly SourceFile[] }
  | { readonly type: 'removeFile'; readonly name: string }
  | { readonly type: 'toggleOverride'; readonly ccaID: string }
  | { readonly type: 'setConfig'; readonly config: ScenarioConfig }
  | { readonly type: 'setResults'; readonly results: PipelineResult | null; readonly error: string | null }
  | { readonly type: 'finalise'; readonly penalty: PenaltyState }
  | { readonly type: 'applyPenalty'; readonly penalty: PenaltyState; readonly entry: PenaltyLogEntry }
  | { readonly type: 'undoPenalty'; readonly penalty: PenaltyState; readonly key: PenaltyKey }
  | { readonly type: 'unlock' }

type Inputs = Pick<AppState, 'files' | 'overrides' | 'config'> & Partial<AppState>

/** Validation is pure and fast, so it runs on every change to files, overrides or config. */
function revalidate(state: Inputs): AppState {
  const report = validateImport(state.files, state.config, state.overrides.map((ccaID) => ({ ccaID })))
  return {
    files: state.files,
    overrides: state.overrides,
    config: state.config,
    report,
    results: report.canCompute ? (state.results ?? null) : null,
    computeError: null,
    finalised: state.finalised ?? null,
  }
}

export function initialState(config: ScenarioConfig = DEFAULT_CONFIG): AppState {
  return revalidate({ files: [], overrides: [], config })
}

/** A dropped file with the same name replaces the earlier one. */
function mergeFiles(current: readonly SourceFile[], added: readonly SourceFile[]): SourceFile[] {
  const names = new Set(added.map((f) => f.name))
  return [...current.filter((f) => !names.has(f.name)), ...added]
}

const sameKey = (a: PenaltyKey, b: PenaltyKey): boolean => a.matric === b.matric && a.ccaID === b.ccaID

/** Changes to files, overrides and settings are refused while finalised. */
function inputChange(state: AppState, action: Action): AppState {
  if (state.finalised) return state
  switch (action.type) {
    case 'addFiles':
      return revalidate({ ...state, files: mergeFiles(state.files, action.files) })
    case 'removeFile':
      return revalidate({ ...state, files: state.files.filter((f) => f.name !== action.name) })
    case 'toggleOverride': {
      const on = state.overrides.includes(action.ccaID)
      const overrides = on ? state.overrides.filter((id) => id !== action.ccaID) : [...state.overrides, action.ccaID]
      return revalidate({ ...state, overrides })
    }
    case 'setConfig':
      return revalidate({ ...state, config: action.config })
    default:
      return state
  }
}

function penaltyChange(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'finalise':
      return state.finalised || !state.report.canCompute ? state : { ...state, finalised: { penalty: action.penalty, log: [] } }
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
      return { ...state, finalised: null }
    default:
      return state
  }
}

export function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'addFiles':
    case 'removeFile':
    case 'toggleOverride':
    case 'setConfig':
      return inputChange(state, action)
    case 'setResults':
      return { ...state, results: action.results, computeError: action.error }
    default:
      return penaltyChange(state, action)
  }
}
