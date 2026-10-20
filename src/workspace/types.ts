import type {
  Discretion,
  FinalOverride,
  PenaltyState,
  ScenarioConfig,
  WheelResolution,
} from '../engine'
import type {
  AuxEdit,
  AuxLogEntry,
  CcaLevelEntry,
  CheckedAuxEdit,
  CheckedFlatEdit,
  CheckedReviewEdit,
  CheckedTickEdit,
  FlatEdit,
  FlatLogEntry,
  IhgTickEdit,
  ImportReport,
  NotSubmittingMark,
  ReviewEdit,
  ReviewLogEntry,
  SourceFile,
  TickLogEntry,
  VettedMark,
} from '../import'
import type { CcaGroup } from '../import/groups'

export const WORKSPACE_FORMAT = 'rhps-workspace'
export const WORKSPACE_ENCRYPTED_FORMAT = 'rhps-workspace-encrypted'
/** The version written. Version 1 and 2 files are migrated on read (spec 8b, R4). */
export const WORKSPACE_VERSION = 3
export const WORKSPACE_READABLE_VERSIONS: readonly number[] = [1, 2, 3]
/** The encrypted envelope has its own version; its layout did not change with workspace v2 or v3. */
export const ENVELOPE_VERSION = 1

/** The steps of the guided workflow, in order. The top bar's screens are these. */
export type WorkflowStep = 'import' | 'checklist' | 'review' | 'summary' | 'results' | 'publish' | 'compare'

export const WORKFLOW_STEPS: readonly WorkflowStep[] = ['import', 'checklist', 'review', 'summary', 'results', 'publish', 'compare']

/**
 * The Review and Summary steps' state: score, IHG tick, flat value and AUX edits with their logs,
 * vetted marks and not-submitting marks.
 */
export interface WorkspaceReview {
  readonly edits: readonly ReviewEdit[]
  readonly log: readonly ReviewLogEntry[]
  readonly vetted: readonly VettedMark[]
  readonly notSubmitting: readonly NotSubmittingMark[]
  readonly tickEdits: readonly IhgTickEdit[]
  readonly tickLog: readonly TickLogEntry[]
  readonly flatEdits: readonly FlatEdit[]
  readonly flatLog: readonly FlatLogEntry[]
  readonly auxEdits: readonly AuxEdit[]
  readonly auxLog: readonly AuxLogEntry[]
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
  /** The CCA groups; null when the file records no groups (older files, or none saved yet). */
  readonly groups: readonly CcaGroup[] | null
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
    /** IHG tick edits not applied: the file's tick moved, or the membership is gone. */
    readonly tickEdits: readonly CheckedTickEdit[]
    /** Flat value edits not applied: the flat value moved, or the member is gone. */
    readonly flatEdits: readonly CheckedFlatEdit[]
    /** AUX edits not applied: the residents list's count moved, or the resident is gone. */
    readonly auxEdits: readonly CheckedAuxEdit[]
  }
  /**
   * Groups that could not be checked yet, so nothing in them is listed as stale: `review` while
   * no RH-app bundle is loaded, `computed` while the import cannot compute, `aux` while no
   * residents list is loaded.
   */
  readonly unchecked: { readonly review: boolean; readonly computed: boolean; readonly aux: boolean }
  /** The migration notes, passed through from reading the file. */
  readonly notes: readonly string[]
}
