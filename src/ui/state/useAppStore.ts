import { useEffect, useReducer, type Dispatch } from 'react'
import { computeAll } from '../../engine'
import { loadSettings, saveSettings } from './settingsStorage'
import { initialState, reducer, type Action, type AppState } from './store'

const COMPUTE_DEBOUNCE_MS = 150

/** App store: validation runs inside the reducer; computeAll is debounced here. */
export function useAppStore(): { state: AppState; dispatch: Dispatch<Action> } {
  const [state, dispatch] = useReducer(reducer, undefined, () => initialState(loadSettings()))
  const { report, config } = state

  useEffect(() => {
    saveSettings(config)
  }, [config])

  useEffect(() => {
    const input = report.input
    if (!report.canCompute || !input) return undefined
    const timer = window.setTimeout(() => {
      try {
        dispatch({ type: 'setResults', results: computeAll(input, config), error: null })
      } catch (error) {
        const message = error instanceof Error ? error.message : 'The calculation failed.'
        dispatch({ type: 'setResults', results: null, error: message })
      }
    }, COMPUTE_DEBOUNCE_MS)
    return () => window.clearTimeout(timer)
  }, [report, config])

  return { state, dispatch }
}
