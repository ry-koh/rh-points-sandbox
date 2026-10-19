import {
  WORKSPACE_FORMAT,
  WORKSPACE_VERSION,
  type RestoredWorkspace,
  type Workspace,
  type WorkspaceErrorCode,
} from '../../workspace'
import type { AppState, LoadedWorkspace, PenaltyLogEntry } from './store'

export const MIN_PASSWORD_LENGTH = 8

/** The workspace file for the current state (spec 8b). Resident data: download only. */
export function toWorkspace(state: AppState, savedAt: Date): Workspace {
  return {
    format: WORKSPACE_FORMAT,
    version: WORKSPACE_VERSION,
    savedAt: savedAt.toISOString(),
    files: state.files,
    config: state.config,
    ccaLevels: state.ccaLevels,
    review: state.review,
    step: state.step,
    finalOverrides: state.finalOverrides,
    discretion: state.discretion,
    resolutions: state.resolutions,
    finalised: state.finalised?.penalty ?? null,
  }
}

/**
 * What the reducer loads from a restored workspace. The file keeps only the penalty state,
 * so the Penalties panel's log is rebuilt from it with names from the re-imported files.
 */
export function fromRestored(restored: RestoredWorkspace): LoadedWorkspace {
  const { workspace, report } = restored
  const input = report.input
  const log = (workspace.finalised?.applied ?? []).map(
    (key): PenaltyLogEntry => ({
      key,
      residentName: input?.residents.find((r) => r.matric === key.matric)?.name ?? key.matric,
      ccaName: input?.ccas.find((c) => c.ccaID === key.ccaID)?.ccaName ?? key.ccaID,
      outcome: workspace.finalised?.removed.includes(key.matric) ? 'Removed (restored from file)' : 'Restored from file',
    }),
  )
  return {
    files: workspace.files,
    config: workspace.config,
    ccaLevels: workspace.ccaLevels,
    review: workspace.review,
    step: workspace.step,
    finalOverrides: workspace.finalOverrides,
    discretion: workspace.discretion,
    resolutions: workspace.resolutions,
    finalised: workspace.finalised ? { penalty: workspace.finalised, log } : null,
  }
}

export const OPEN_ERRORS: Readonly<Record<WorkspaceErrorCode, string>> = {
  NOT_A_WORKSPACE: 'This is not a workspace file. Choose a file ending in .rhps that this tool saved.',
  UNSUPPORTED_VERSION: 'This workspace was saved by a different version of the tool and cannot be opened here.',
  PASSWORD_REQUIRED: 'This workspace is protected. Enter its password.',
  WRONG_PASSWORD: 'That password is not right. Check it and try again.',
  CORRUPT: 'This workspace file is damaged and cannot be read. Try an earlier copy.',
}

/** Why a password cannot be used yet, or null when it is fine. */
export function passwordProblem(password: string, confirm: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) return `Use at least ${MIN_PASSWORD_LENGTH} characters.`
  if (password !== confirm) return 'The two passwords do not match.'
  return null
}

/** "Saved 14:32" in local time. */
export function savedLabel(savedAt: string): string {
  const at = new Date(savedAt)
  return `Saved ${String(at.getHours()).padStart(2, '0')}:${String(at.getMinutes()).padStart(2, '0')}`
}

/** Resident data is loaded: closing the tab would lose it. */
export const hasResidentData = (state: Pick<AppState, 'files'>): boolean => state.files.length > 0
