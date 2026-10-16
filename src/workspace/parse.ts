import { computeAll, type ComputeOptions } from '../engine'
import { validateImport } from '../import'
import { readConfig } from '../ui/state/configShape'
import { KDF_ITERATIONS, decryptEnvelope, fromBase64, isBase64 } from './crypto'
import {
  WORKSPACE_ENCRYPTED_FORMAT,
  WORKSPACE_FORMAT,
  WORKSPACE_VERSION,
  type EncryptedEnvelope,
  type RestoredWorkspace,
  type Workspace,
  type WorkspaceParse,
} from './types'

type Rec = Record<string, unknown>
const isRec = (v: unknown): v is Rec => typeof v === 'object' && v !== null && !Array.isArray(v)
const isStr = (v: unknown): v is string => typeof v === 'string'
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
const isStrArray = (v: unknown): v is string[] => Array.isArray(v) && v.every(isStr)
const listOf = <T>(v: unknown, ok: (item: unknown) => item is T): v is T[] => Array.isArray(v) && v.every(ok)

const isFile = (v: unknown): v is Workspace['files'][number] => isRec(v) && isStr(v.name) && isStr(v.text)
const isOverride = (v: unknown): v is Workspace['finalOverrides'][number] =>
  isRec(v) && isStr(v.matric) && isStr(v.ccaID) && isNum(v.finalPoints) && isStr(v.reason)
const isDiscretion = (v: unknown): v is Workspace['discretion'][number] =>
  isRec(v) && isStr(v.matric) && isNum(v.stayingDelta) && isNum(v.biddingDelta) && isStr(v.reason)
const isResolution = (v: unknown): v is Workspace['resolutions'][number] =>
  isRec(v) && ['maleStaying', 'femaleStaying', 'sem2'].includes(String(v.list)) && isStrArray(v.order)
const isCutoff = (v: unknown): boolean => v === null || isNum(v)
const isPenaltyState = (v: unknown): v is NonNullable<Workspace['finalised']> =>
  isRec(v) &&
  isRec(v.cutoffs) &&
  isCutoff(v.cutoffs.M) &&
  isCutoff(v.cutoffs.F) &&
  listOf(v.applied, (k): k is { matric: string; ccaID: string } => isRec(k) && isStr(k.matric) && isStr(k.ccaID)) &&
  isStrArray(v.removed)

export function serializeWorkspace(workspace: Workspace): string {
  return JSON.stringify(workspace)
}

const pad2 = (n: number): string => String(n).padStart(2, '0')

/** rhps_workspace_<YYYYMMDD-HHmm>.rhps, in local time. */
export function workspaceFilename(at: Date): string {
  const day = `${at.getFullYear()}${pad2(at.getMonth() + 1)}${pad2(at.getDate())}`
  return `rhps_workspace_${day}-${pad2(at.getHours())}${pad2(at.getMinutes())}.rhps`
}

/** Checks the shape of a plain workspace object; the config is migrated and filled on the way. */
function readWorkspace(raw: Rec): WorkspaceParse {
  if (raw.version !== WORKSPACE_VERSION) return { ok: false, code: 'UNSUPPORTED_VERSION' }
  const config = readConfig(raw.config)
  const valid =
    isStr(raw.savedAt) &&
    listOf(raw.files, isFile) &&
    isStrArray(raw.meanSdOverrides) &&
    config.ok &&
    listOf(raw.finalOverrides, isOverride) &&
    listOf(raw.discretion, isDiscretion) &&
    listOf(raw.resolutions, isResolution) &&
    (raw.finalised === null || isPenaltyState(raw.finalised))
  if (!valid || !config.ok) return { ok: false, code: 'CORRUPT' }
  return {
    ok: true,
    workspace: {
      format: WORKSPACE_FORMAT,
      version: WORKSPACE_VERSION,
      savedAt: raw.savedAt as string,
      files: raw.files as Workspace['files'],
      meanSdOverrides: raw.meanSdOverrides as string[],
      config: config.config,
      finalOverrides: raw.finalOverrides as Workspace['finalOverrides'],
      discretion: raw.discretion as Workspace['discretion'],
      resolutions: raw.resolutions as Workspace['resolutions'],
      finalised: raw.finalised as Workspace['finalised'],
    },
  }
}

function readEnvelope(raw: Rec): EncryptedEnvelope | null {
  const { kdf, cipher } = raw
  const valid =
    isRec(kdf) &&
    kdf.name === 'PBKDF2' &&
    kdf.hash === 'SHA-256' &&
    kdf.iterations === KDF_ITERATIONS &&
    isBase64(kdf.salt) &&
    isBase64(kdf.verifier) &&
    isRec(cipher) &&
    cipher.name === 'AES-GCM' &&
    isBase64(cipher.iv) &&
    fromBase64(cipher.iv).length === 12 &&
    isBase64(raw.data)
  return valid ? (raw as unknown as EncryptedEnvelope) : null
}

async function readEncrypted(raw: Rec, password: string | undefined): Promise<WorkspaceParse> {
  if (raw.version !== WORKSPACE_VERSION) return { ok: false, code: 'UNSUPPORTED_VERSION' }
  const envelope = readEnvelope(raw)
  if (!envelope) return { ok: false, code: 'CORRUPT' }
  if (!password) return { ok: false, code: 'PASSWORD_REQUIRED' }
  const decrypted = await decryptEnvelope(envelope, password)
  if (!decrypted.ok) return { ok: false, code: decrypted.code }
  const inner = parseJson(decrypted.json)
  if (!isRec(inner) || inner.format !== WORKSPACE_FORMAT) return { ok: false, code: 'CORRUPT' }
  return readWorkspace(inner)
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text) as unknown
  } catch {
    return undefined
  }
}

/** Reads a workspace file, plain or encrypted. Never throws; every problem is a code. */
export async function parseWorkspaceFile(text: string, password?: string): Promise<WorkspaceParse> {
  const raw = parseJson(text)
  if (!isRec(raw)) return { ok: false, code: 'NOT_A_WORKSPACE' }
  if (raw.format === WORKSPACE_FORMAT) return readWorkspace(raw)
  if (raw.format === WORKSPACE_ENCRYPTED_FORMAT) return readEncrypted(raw, password)
  return { ok: false, code: 'NOT_A_WORKSPACE' }
}

/**
 * Loads a workspace: re-runs the import validation on the saved files, then reports every
 * override, discretion entry and wheel resolution that no longer matches. Stale entries are
 * never applied silently. While the files do not import, nothing can be checked, so every
 * entry is reported as stale.
 */
export function restoreWorkspace(workspace: Workspace): RestoredWorkspace {
  const report = validateImport(
    workspace.files,
    workspace.config,
    workspace.meanSdOverrides.map((ccaID) => ({ ccaID })),
  )
  const { input } = report
  if (!report.canCompute || !input) {
    const { finalOverrides, discretion, resolutions } = workspace
    return { workspace, report, stale: { overrides: finalOverrides, discretion, resolutions } }
  }
  const options: ComputeOptions = {
    overrides: workspace.finalOverrides,
    discretion: workspace.discretion,
    resolutions: workspace.resolutions,
    ...(workspace.finalised ? { penaltyState: workspace.finalised } : {}),
  }
  const run = computeAll(input, workspace.config, options)
  const staleOf = <T>(checked: readonly { entry: T; status: string }[]): T[] =>
    checked.filter((c) => c.status === 'stale').map((c) => c.entry)
  return {
    workspace,
    report,
    stale: {
      overrides: staleOf(run.overrides),
      discretion: staleOf(run.discretion),
      resolutions: staleOf(run.resolutions),
    },
  }
}
