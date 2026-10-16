import type { ScenarioConfig } from './types'

/** Decimal places used when comparing computed values (spec 4.5). */
export const COMPARE_DECIMALS = 6

/** Inclusive tolerance for mean/SD range checks (spec 7.1). */
export const RANGE_TOLERANCE = 1e-9

/** Above this many 0.5x memberships, pairing falls back to greedy (spec 4.3). */
export const MAX_EXHAUSTIVE_HALVES = 10

/** Placement bonus factor for 0.5x CCAs when halfCcaPlacementHalved is on (spec 4.1). */
export const HALF_PLACEMENT_FACTOR = 0.5

/** Each staying weight past the configured array is this fraction of the previous one. */
export const WEIGHT_TAIL_RATIO = 0.5

export const DEFAULT_CONFIG: ScenarioConfig = {
  meanSdDefault: { meanMin: 10, meanMax: 14, sdMin: 2, sdMax: 5 }, // PLACEHOLDER
  placementBonus: { pass: 0, bronze: 0.5, silver: 1.5, gold: 4 },
  halfCcaBaseFactor: 0.5,
  halfCcaPlacementHalved: false,
  semesterOnlyFactor: 0.5,
  incomingMultiplier: { head: 1.2, vice_head: 1.2 },
  outgoingMode: 'tier',
  outgoingTiers: [
    // PLACEHOLDER
    { name: 'Unsatisfactory', multiplier: 0.8 },
    { name: 'Pass', multiplier: 1.0 },
    { name: 'Low Bronze', multiplier: 1.05 },
    { name: 'High Bronze', multiplier: 1.15 },
    { name: 'Low Silver', multiplier: 1.25 },
    { name: 'High Silver', multiplier: 1.5 },
    { name: 'Low Gold', multiplier: 1.75 },
    { name: 'High Gold', multiplier: 2.0 },
  ],
  stackingMode: 'max',
  droppedRoleBase: 8,
  auxTable: [-10, -8, -6, -4, -2, 0, 2, 4, 6, 8, 10],
  auxCap: 10,
  ihgPoints: { '1st': 5, '2nd': 4, '3rd': 3, '3rd4th_no_match': 1 },
  ihgInSportNet: false,
  stayingWeights: [1, 1, 1, 1, 0.5, 0.25],
  stayingWeightTail: 'halve',
  mergeHalfCcas: true,
  // PLACEHOLDER: must be set before lists are final
  headcounts: { maleGreen: 0, maleGrey: 0, femaleGreen: 0, femaleGrey: 0, sem2Green: 0, sem2Grey: 0 },
  sem2Mode: 'separate',
  sem2Factor: 2,
  jcrcFullYearOffset: 1,
  jcrcExchangeFactor: 0.75,
}

/** Longest reason accepted on an override or discretion entry (spec 6.2, 6.3). */
export const MAX_REASON_LENGTH = 200

/** Allowed base points for one member of a CCA (spec 2a). */
export const BASE_POINTS_MIN = 0
export const BASE_POINTS_MAX = 20

/** The only leader-export format version the sandbox accepts (spec 2a). */
export const LEADER_FORMAT_VERSION = 1

/** The only flat-points-file format version the sandbox accepts (spec 2e). */
export const FLAT_FORMAT_VERSION = 1
