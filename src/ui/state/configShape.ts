import { DEFAULT_CONFIG, type ScenarioConfig } from '../../engine'

type Rec = Record<string, unknown>
type ConfigKey = keyof ScenarioConfig

const isRec = (v: unknown): v is Rec => typeof v === 'object' && v !== null && !Array.isArray(v)
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
const isBool = (v: unknown): boolean => typeof v === 'boolean'
const numFields = (keys: readonly string[]) => (v: unknown): boolean =>
  isRec(v) && keys.every((k) => isNum(v[k]))
const numArray = (v: unknown): boolean => Array.isArray(v) && v.every(isNum)
const oneOf = (options: readonly string[]) => (v: unknown): boolean =>
  typeof v === 'string' && options.includes(v)
const tiers = (v: unknown): boolean =>
  Array.isArray(v) && v.every((t) => isRec(t) && typeof t.name === 'string' && isNum(t.multiplier))

/** One shape check per §3 key. */
export const CONFIG_VALIDATORS: Readonly<Record<ConfigKey, (v: unknown) => boolean>> = {
  meanSdDefault: numFields(['meanMin', 'meanMax', 'sdMin', 'sdMax']),
  placementBonus: numFields(['pass', 'bronze', 'silver', 'gold']),
  halfCcaBaseFactor: isNum,
  halfCcaPlacementHalved: isBool,
  semesterOnlyFactor: isNum,
  incomingMultiplier: numFields(['head', 'vice_head']),
  outgoingMode: oneOf(['tier', 'manual']),
  outgoingTiers: tiers,
  stackingMode: oneOf(['max', 'additive', 'multiplicative']),
  droppedRoleBase: isNum,
  auxTable: numArray,
  auxCap: isNum,
  ihgPoints: numFields(['1st', '2nd', '3rd', '3rd4th_no_match']),
  ihgInSportNet: isBool,
  stayingWeights: numArray,
  stayingWeightTail: oneOf(['halve']),
  mergeHalfCcas: isBool,
  headcounts: numFields(['maleGreen', 'maleGrey', 'femaleGreen', 'femaleGrey', 'sem2Spots']),
  sem2Mode: oneOf(['separate', 'merged']),
  sem2Factor: isNum,
}

export const CONFIG_KEYS = Object.keys(DEFAULT_CONFIG) as ConfigKey[]

/** Shape check for settings read back from storage: every §3 key with the right type. */
export function isScenarioConfig(v: unknown): v is ScenarioConfig {
  return isRec(v) && CONFIG_KEYS.every((key) => CONFIG_VALIDATORS[key](v[key]))
}

export type ConfigReadResult =
  | { readonly ok: true; readonly config: ScenarioConfig; readonly defaulted: readonly ConfigKey[] }
  | { readonly ok: false; readonly error: string }

/**
 * Builds a config from untrusted data: unknown keys are ignored, missing keys take the
 * defaults, and a present key with the wrong shape is an error.
 */
export function readConfig(v: unknown): ConfigReadResult {
  if (!isRec(v)) return { ok: false, error: 'The settings are missing or are not a list of named values.' }
  const bad = CONFIG_KEYS.filter((key) => key in v && !CONFIG_VALIDATORS[key](v[key]))
  if (bad.length > 0) {
    return { ok: false, error: `These settings have the wrong format: ${bad.join(', ')}.` }
  }
  const defaulted = CONFIG_KEYS.filter((key) => !(key in v))
  const config = Object.fromEntries(
    CONFIG_KEYS.map((key) => [key, key in v ? v[key] : DEFAULT_CONFIG[key]]),
  ) as unknown as ScenarioConfig
  return { ok: true, config, defaulted }
}
