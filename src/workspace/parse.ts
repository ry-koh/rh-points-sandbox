import { computeAll, type ComputeOptions } from '../engine'
import { validateImport, vettedStatus, type SandboxInput } from '../import'
import { readConfig } from '../ui/state/configShape'
import { KDF_ITERATIONS, decryptEnvelope, fromBase64, isBase64 } from './crypto'
import { migrateWorkspace } from './migrate'
import {
  ENVELOPE_VERSION,
  WORKFLOW_STEPS,
  WORKSPACE_ENCRYPTED_FORMAT,
  WORKSPACE_FORMAT,
  WORKSPACE_READABLE_VERSIONS,
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
const isNumOrNull = (v: unknown): boolean => v === null || isNum(v)
const isEdit = (v: unknown): v is Rec =>
  isRec(v) && isStr(v.matric) && isStr(v.ccaID) && isNum(v.from) && isNum(v.to) && isStr(v.reason) && isStr(v.at)
const isLogEntry = (v: unknown): boolean => isEdit(v) && (v.kind === 'edit' || v.kind === 'remove')
const isVetted = (v: unknown): boolean => isRec(v) && isStr(v.ccaID) && isStr(v.fileHash) && isStr(v.at)
const isNotSubmitting = (v: unknown): boolean => isRec(v) && isStr(v.ccaID) && isStr(v.note) && isStr(v.at)
const isReview = (v: unknown): v is Workspace['review'] =>
  isRec(v) &&
  listOf(v.edits, isEdit) &&
  listOf(v.log, (e): e is Rec => isLogEntry(e)) &&
  listOf(v.vetted, (e): e is Rec => isVetted(e)) &&
  listOf(v.notSubmitting, (e): e is Rec => isNotSubmitting(e))
const isLevelEntry = (v: unknown): v is Workspace['ccaLevels'][number] =>
  isRec(v) &&
  isStr(v.ccaID) &&
  (v.level === null || isStr(v.level)) &&
  isNumOrNull(v.bonusOverride) &&
  isNumOrNull(v.multiplierOverride)
const isStep = (v: unknown): v is Workspace['step'] => WORKFLOW_STEPS.some((step) => step === v)

export function serializeWorkspace(workspace: Workspace): string {
  return JSON.stringify(workspace)
}

const pad2 = (n: number): string => String(n).padStart(2, '0')

/** rhps_workspace_<YYYYMMDD-HHmm>.rhps, in local time. */
export function workspaceFilename(at: Date): string {
  const day = `${at.getFullYear()}${pad2(at.getMonth() + 1)}${pad2(at.getDate())}`
  return `rhps_workspace_${day}-${pad2(at.getHours())}${pad2(at.getMinutes())}.rhps`
}

/**
 * Checks the shape of a plain workspace object. A version-1 object is migrated to version 2
 * first (spec 8b); the config is migrated and filled on the way.
 */
function readWorkspace(original: Rec): WorkspaceParse {
  if (!WORKSPACE_READABLE_VERSIONS.includes(original.version as number)) return { ok: false, code: 'UNSUPPORTED_VERSION' }
  const { raw, notes } = migrateWorkspace(original)
  const config = readConfig(raw.config)
  const valid =
    isStr(raw.savedAt) &&
    listOf(raw.files, isFile) &&
    config.ok &&
    listOf(raw.ccaLevels, isLevelEntry) &&
    isReview(raw.review) &&
    isStep(raw.step) &&
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
      config: config.config,
      ccaLevels: raw.ccaLevels as Workspace['ccaLevels'],
      review: raw.review as Workspace['review'],
      step: raw.step as Workspace['step'],
      finalOverrides: raw.finalOverrides as Workspace['finalOverrides'],
      discretion: raw.discretion as Workspace['discretion'],
      resolutions: raw.resolutions as Workspace['resolutions'],
      finalised: raw.finalised as Workspace['finalised'],
    },
    notes,
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
  if (raw.version !== ENVELOPE_VERSION) return { ok: false, code: 'UNSUPPORTED_VERSION' }
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

/** The values entered in the sandbox, as the import validation takes them. */
export function sandboxInputOf(workspace: Pick<Workspace, 'ccaLevels' | 'review'>): SandboxInput {
  return {
    ccaLevels: workspace.ccaLevels,
    edits: workspace.review.edits,
    notSubmitting: workspace.review.notSubmitting.map((mark) => mark.ccaID),
  }
}

/**
 * Loads a workspace: re-runs the import validation on the saved files, then reports every
 * override, discretion entry, wheel resolution, score edit, vetted mark and level entry that no
 * longer matches. Stale entries are never applied silently. What cannot be checked yet is not
 * called stale: with no bundle the review items are `unchecked.review`, and while the import
 * cannot compute the computed entries are `unchecked.computed`. Nothing is dropped. `notes` are
 * the migration notes from reading the file.
 */
export function restoreWorkspace(workspace: Workspace, notes: readonly string[] = []): RestoredWorkspace {
  const report = validateImport(workspace.files, workspace.config, sandboxInputOf(workspace))
  const bundleIds = new Set(report.bundle?.ccas.map((cca) => cca.ccaID) ?? [])
  const reviewUnchecked = report.bundle === null
  const review = reviewUnchecked
    ? { edits: [], vetted: [], ccaLevels: [] }
    : {
        edits: report.review.edits.filter((checked) => checked.status !== 'applied'),
        vetted: workspace.review.vetted.filter((mark) => vettedStatus(mark, report.perCca) !== 'vetted'),
        ccaLevels: workspace.ccaLevels.filter((entry) => !bundleIds.has(entry.ccaID)),
      }
  const { input } = report
  if (!report.canCompute || !input) {
    return {
      workspace,
      report,
      stale: { overrides: [], discretion: [], resolutions: [], ...review },
      unchecked: { review: reviewUnchecked, computed: true },
      notes,
    }
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
      ...review,
    },
    unchecked: { review: reviewUnchecked, computed: false },
    notes,
  }
}
