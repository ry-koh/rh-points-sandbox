import type { Dispatch } from 'react'
import type { DrawerEditing } from '../drawer/Editors'
import type { Action, AppState } from './store'

/** Final-points and discretion editing for the drawer and the Summary; locked while finalised. */
export function drawerEditing(state: AppState, dispatch: Dispatch<Action>): DrawerEditing | null {
  const input = state.report.input
  if (!input) return null
  return {
    locked: state.finalised !== null,
    input,
    overrides: state.finalOverrides,
    discretion: state.discretion,
    setOverride: (entry) => dispatch({ type: 'setFinalOverride', entry }),
    removeOverride: (matric, ccaID) => dispatch({ type: 'removeFinalOverride', matric, ccaID }),
    setDiscretion: (entry) => dispatch({ type: 'setDiscretion', entry }),
    removeDiscretion: (matric) => dispatch({ type: 'removeDiscretion', matric }),
  }
}
