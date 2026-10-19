import type {
  Discretion,
  FinalOverride,
  PenaltyState,
  ScenarioConfig,
  WheelResolution,
} from '../engine'
import type { ImportReport, SourceFile } from '../import'

export const WORKSPACE_FORMAT = 'rhps-workspace'
export const WORKSPACE_ENCRYPTED_FORMAT = 'rhps-workspace-encrypted'
export const WORKSPACE_VERSION = 1

/**
 * Everything needed to resume a session (spec 8b). It contains resident data, so it only ever
 * exists as a file the user downloads on purpose; nothing here touches browser storage.
 */
export interface Workspace {
  readonly format: typeof WORKSPACE_FORMAT
  readonly version: typeof WORKSPACE_VERSION
  readonly savedAt: string
  readonly files: readonly SourceFile[]
  /** Always written empty. Read and ignored so v1 files that carry ccaIDs here still open. */
  readonly meanSdOverrides: readonly string[]
  readonly config: ScenarioConfig
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
  | { readonly ok: true; readonly workspace: Workspace }
  | { readonly ok: false; readonly code: WorkspaceErrorCode }

/** The envelope of an encrypted workspace file. */
export interface EncryptedEnvelope {
  readonly format: typeof WORKSPACE_ENCRYPTED_FORMAT
  readonly version: typeof WORKSPACE_VERSION
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
  }
}
