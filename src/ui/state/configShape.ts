import type { ScenarioConfig } from '../../engine'

type Rec = Record<string, unknown>

const isRec = (v: unknown): v is Rec => typeof v === 'object' && v !== null && !Array.isArray(v)
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
const numFields = (v: unknown, keys: readonly string[]): boolean =>
  isRec(v) && keys.every((k) => isNum(v[k]))
const numArray = (v: unknown): boolean => Array.isArray(v) && v.every(isNum)
const oneOf = (v: unknown, options: readonly string[]): boolean =>
  typeof v === 'string' && options.includes(v)

function validTiers(v: unknown): boolean {
  return (
    Array.isArray(v) &&
    v.every((t) => isRec(t) && typeof t.name === 'string' && isNum(t.multiplier))
  )
}

/** Shape check for settings read back from storage: every §3 key with the right type. */
export function isScenarioConfig(v: unknown): v is ScenarioConfig {
  if (!isRec(v)) return false
  return (
    numFields(v.meanSdDefault, ['meanMin', 'meanMax', 'sdMin', 'sdMax']) &&
    numFields(v.placementBonus, ['pass', 'bronze', 'silver', 'gold']) &&
    isNum(v.halfCcaBaseFactor) &&
    typeof v.halfCcaPlacementHalved === 'boolean' &&
    isNum(v.semesterOnlyFactor) &&
    numFields(v.incomingMultiplier, ['head', 'vice_head']) &&
    oneOf(v.outgoingMode, ['tier', 'manual']) &&
    validTiers(v.outgoingTiers) &&
    oneOf(v.stackingMode, ['max', 'additive', 'multiplicative']) &&
    isNum(v.droppedRoleBase) &&
    numArray(v.auxTable) &&
    isNum(v.auxCap) &&
    numFields(v.ihgPoints, ['1st', '2nd', '3rd', '3rd4th_no_match']) &&
    typeof v.ihgInSportNet === 'boolean' &&
    numArray(v.stayingWeights) &&
    v.stayingWeightTail === 'halve' &&
    typeof v.mergeHalfCcas === 'boolean' &&
    numFields(v.headcounts, ['maleGreen', 'maleGrey', 'femaleGreen', 'femaleGrey', 'sem2Spots']) &&
    oneOf(v.sem2Mode, ['separate', 'merged']) &&
    isNum(v.sem2Factor)
  )
}
