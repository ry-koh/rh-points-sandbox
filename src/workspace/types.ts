import type {
  Discretion,
  FinalOverride,
  PenaltyState,
  ScenarioConfig,
  WheelResolution,
} from '../engine'
import type {
  CcaLevelEntry,
  CheckedReviewEdit,
  ImportReport,
  NotSubmittingMark,
  ReviewEdit,
  ReviewLogEntry,
  SourceFile,
  VettedMark,
} from '../import'

export const WORKSPACE_FORMAT = 'rhps-workspace'
export const WORKSPACE_ENCRYPTED_FORMAT = 'rhps-workspace-encrypted'
/** The version written. Version 1 files are migrated on read (spec 8b). */
export const WORKSPACE_VERSION = 2
export const WORKSPACE_READABLE_VERSIONS: readonly number[] = [1, 2]
/** The encrypted envelope has its own version; its layout did not change with workspace v2. */
export const ENVELOPE_VERSION = 1

/** The steps of the guided workflow, in order. The top bar's screens are these. */
export type WorkflowStep = 'import' | 'checklist' | 'review' | 'summary' | 'results' | 'publish' | 'compare'

export const WORKFLOW_STEPS: readonly WorkflowStep[] = ['import', 'checklist', 'review', 'summary', 'results', 'publish', 'compare']

/** The Review step's state: score edits and their log, vetted marks and not-submitting marks. */
export interface WorkspaceReview {
  readonly edits: readonly ReviewEdit[]
  readonly log: readonly ReviewLogEntry[]
  readonly vetted: readonly VettedMark[]
  readonly notSubmitting: readonly NotSubmittingMark[]
}

/**
 * Everything needed to resume a session (spec 8b). It contains resident data, so it only ever
 * exists as a file the user downloads on purpose; nothing here touches browser storage.
 */
export interface Workspace {
  readonly format: typeof WORKSPACE_FORMAT
  readonly version: typeof WORKSPACE_VERSION
  readonly savedAt: string
  readonly files: readonly SourceFile[]
  readonly config: ScenarioConfig
  /** Each CCA's level and tweaks (spec 3b). */
  readonly ccaLevels: readonly CcaLevelEntry[]
  readonly review: WorkspaceReview
  /** The step that was open when the file was saved. */
  readonly step: WorkflowStep
  readonly finalOverrides: readonly FinalOverride[]
  readonly discretion: readonly Discretion[]
  readonly resolutions: readonly WheelResolution[]
  readonly finalised: PenaltyState | null
}

export type WorkspaceErrorCode =
  | 'NOT_A_WORKSPACE'
  | 'UNSUPPORTED_VERSION'
  | 'PASSWORD_REQUIRED'
  | 'WRONG_PASSWORD'
  | 'CORRUPT'

export type WorkspaceParse =
  /** `notes`: what migrating an older file changed, in plain words (empty for a current file). */
  | { readonly ok: true; readonly workspace: Workspace; readonly notes: readonly string[] }
  | { readonly ok: false; readonly code: WorkspaceErrorCode }

/** The envelope of an encrypted workspace file. */
export interface EncryptedEnvelope {
  readonly format: typeof WORKSPACE_ENCRYPTED_FORMAT
  readonly version: typeof ENVELOPE_VERSION
  readonly kdf: {
    readonly name: 'PBKDF2'
    readonly hash: 'SHA-256'
    readonly iterations: number
    readonly salt: string
    /** Base64 SHA-256 of a label plus the key: tells a wrong password from a damaged file. */
    readonly verifier: string
  }
  readonly cipher: { readonly name: 'AES-GCM'; readonly iv: string }
  readonly data: string
}

/** What loading a workspace found: the re-run import, and every entry that no longer applies. */
export interface RestoredWorkspace {
  readonly workspace: Workspace
  readonly report: ImportReport
  readonly stale: {
    readonly overrides: readonly FinalOverride[]
    readonly discretion: readonly Discretion[]
    readonly resolutions: readonly WheelResolution[]
    /** Score edits not applied: `changed` (the file's value moved) or `stale` (the membership is gone). */
    readonly edits: readonly CheckedReviewEdit[]
    /** Vetted marks that no longer count: the leader file changed, or the CCA has no file or left the bundle. */
    readonly vetted: readonly VettedMark[]
    /** Level entries for CCAs the loaded bundle does not list. */
    readonly ccaLevels: readonly CcaLevelEntry[]
  }
  /** The migration notes, passed through from reading the file. */
  readonly notes: readonly string[]
}
