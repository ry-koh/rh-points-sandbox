import { RETIRED_CCAS_COLUMNS, RETIRED_IHG_COLUMNS, headerMatches, parseCsv } from '../import'
import { readConfig } from '../ui/state/configShape'

type Rec = Record<string, unknown>
const isRec = (v: unknown): v is Rec => typeof v === 'object' && v !== null && !Array.isArray(v)

/** R26: shown once when a v1 file's ccas.csv or ihg.csv was dropped. */
export const RETIRED_FILES_NOTE =
  "ccas.csv and ihg.csv were removed: load the RH-app bundle and new leader files, then pick each CCA's level on the Review step."

/** R43: shown when the saved config was in the old placement-bonus-and-tiers shape. */
export const LEVELS_MIGRATED_NOTE =
  "The settings' levels were built from the old placement bonus and tiers; check them in Settings."

const RETIRED_HEADERS = [RETIRED_CCAS_COLUMNS, RETIRED_IHG_COLUMNS]

/** A retired ccas.csv or ihg.csv: by its header, or by a name starting "ccas" or "ihg". */
function isRetiredFile(file: unknown): boolean {
  if (!isRec(file)) return false
  const name = typeof file.name === 'string' ? file.name.toLowerCase() : ''
  if (name.startsWith('ccas') || name.startsWith('ihg')) return true
  if (typeof file.text !== 'string') return false
  const header = parseCsv(file.text).header.map((cell) => cell.trim())
  return RETIRED_HEADERS.some((columns) => headerMatches(header, columns))
}

/**
 * Turns a version-1 workspace object into the version-2 shape (spec 8b), with a plain note for
 * each thing the user must redo. Retired files are dropped, never converted (D11).
 */
function v1ToV2(raw: Rec): { readonly raw: Rec; readonly notes: string[] } {
  const notes: string[] = []
  const { meanSdOverrides: _dropped, ...rest } = raw
  const files = Array.isArray(raw.files) ? raw.files.filter((file) => !isRetiredFile(file)) : raw.files
  if (Array.isArray(raw.files) && Array.isArray(files) && files.length < raw.files.length) notes.push(RETIRED_FILES_NOTE)
  const config = readConfig(raw.config)
  if (config.ok && config.migrated.includes('levels')) notes.push(LEVELS_MIGRATED_NOTE)
  return {
    raw: {
      ...rest,
      version: 2,
      files,
      config: config.ok ? config.config : raw.config,
      ccaLevels: [],
      review: { edits: [], log: [], vetted: [], notSubmitting: [] },
      step: 'import',
    },
    notes,
  }
}

/** The review lists added in version 3, all empty. */
const EMPTY_V3_LISTS = { tickEdits: [], tickLog: [], flatEdits: [], flatLog: [], auxEdits: [], auxLog: [] }

/**
 * Version 2 to 3 (R4): empty tick, flat and AUX lists and no groups. Nothing is lost, so no
 * note. A review that is not an object is left as it is for the reader to call CORRUPT.
 */
function v2ToV3(raw: Rec): Rec {
  const review = isRec(raw.review) ? { ...raw.review, ...EMPTY_V3_LISTS } : raw.review
  return { ...raw, version: 3, review, groups: null }
}

/** The review lists added in version 4, both empty. */
const EMPTY_V4_LISTS = { membershipEdits: [], membershipLog: [] }

/** Version 3 to 4: empty role / semester lists. Nothing is lost, so no note. */
function v3ToV4(raw: Rec): Rec {
  const review = isRec(raw.review) ? { ...raw.review, ...EMPTY_V4_LISTS } : raw.review
  return { ...raw, version: 4, review }
}

/**
 * Brings an older workspace object up to the current version, v1 → v2 → v3 → v4, with a plain
 * note for each thing the user must redo. A v4 object is returned unchanged. Never mutates; the
 * result is still checked by the reader.
 */
export function migrateWorkspace(raw: Rec): { readonly raw: Rec; readonly notes: string[] } {
  if (raw.version !== 1 && raw.version !== 2 && raw.version !== 3) return { raw, notes: [] }
  const v2 = raw.version === 1 ? v1ToV2(raw) : { raw, notes: [] }
  const v3 = raw.version === 3 ? v2.raw : v2ToV3(v2.raw)
  return { raw: v3ToV4(v3), notes: v2.notes }
}
