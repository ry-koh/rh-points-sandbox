import { DEFAULT_CONFIG, type PipelineResult, type ScenarioConfig } from '../../engine'
import { validateImport, type ImportReport, type SourceFile } from '../../import'

export interface AppState {
  readonly files: readonly SourceFile[]
  readonly overrides: readonly string[]
  readonly config: ScenarioConfig
  readonly report: ImportReport
  readonly results: PipelineResult | null
  readonly computeError: string | null
}

export type Action =
  | { readonly type: 'addFiles'; readonly files: readonly SourceFile[] }
  | { readonly type: 'removeFile'; readonly name: string }
  | { readonly type: 'toggleOverride'; readonly ccaID: string }
  | { readonly type: 'setConfig'; readonly config: ScenarioConfig }
  | {
      readonly type: 'setResults'
      readonly results: PipelineResult | null
      readonly error: string | null
    }

type Inputs = Pick<AppState, 'files' | 'overrides' | 'config'> & Partial<AppState>

/** Validation is pure and fast, so it runs on every change to files, overrides or config. */
function revalidate(state: Inputs): AppState {
  const report = validateImport(
    state.files,
    state.config,
    state.overrides.map((ccaID) => ({ ccaID })),
  )
  return {
    files: state.files,
    overrides: state.overrides,
    config: state.config,
    report,
    results: report.canCompute ? (state.results ?? null) : null,
    computeError: null,
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

export function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'addFiles':
      return revalidate({ ...state, files: mergeFiles(state.files, action.files) })
    case 'removeFile':
      return revalidate({ ...state, files: state.files.filter((f) => f.name !== action.name) })
    case 'toggleOverride': {
      const on = state.overrides.includes(action.ccaID)
      const overrides = on
        ? state.overrides.filter((id) => id !== action.ccaID)
        : [...state.overrides, action.ccaID]
      return revalidate({ ...state, overrides })
    }
    case 'setConfig':
      return revalidate({ ...state, config: action.config })
    case 'setResults':
      return { ...state, results: action.results, computeError: action.error }
  }
}
