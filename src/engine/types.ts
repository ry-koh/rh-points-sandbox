export type Gender = 'M' | 'F'
export type Role = 'none' | 'head' | 'vice_head'
export type CcaType = '1x' | '0.5x'
export type PlacementLevel = 'pass' | 'bronze' | 'silver' | 'gold'
export type IhgPlacement = '1st' | '2nd' | '3rd' | '3rd4th_no_match'
export type OutgoingMode = 'tier' | 'manual'
export type StackingMode = 'max' | 'additive' | 'multiplicative'
export type Sem2Mode = 'separate' | 'merged'

export interface Resident {
  readonly matric: string
  readonly name: string
  readonly gender: Gender
  readonly sem2: boolean
  readonly aux: number
}

export interface Cca {
  readonly ccaID: string
  readonly ccaName: string
  readonly type: CcaType
  readonly placement: PlacementLevel
  readonly outgoingTier: string | null
  readonly outgoingMultiplier: number | null
  readonly meanMin: number | null
  readonly meanMax: number | null
  readonly sdMin: number | null
  readonly sdMax: number | null
}

export interface Membership {
  readonly matric: string
  readonly ccaID: string
  readonly basePoints: number
  readonly semesterOnly: boolean
  readonly outgoingRole: Role
  readonly incomingRole: Role
  /** Set only by the penalty action (spec section 6). */
  readonly roleDropped: boolean
}

export interface IhgEntry {
  readonly matric: string
  readonly ccaID: string
  readonly placement: IhgPlacement
}

export interface OutgoingTier {
  readonly name: string
  readonly multiplier: number
}

export interface MeanSdRange {
  readonly meanMin: number
  readonly meanMax: number
  readonly sdMin: number
  readonly sdMax: number
}

export interface Headcounts {
  readonly maleGreen: number
  readonly maleGrey: number
  readonly femaleGreen: number
  readonly femaleGrey: number
  readonly sem2Spots: number
}

export interface ScenarioConfig {
  readonly meanSdDefault: MeanSdRange
  readonly placementBonus: Readonly<Record<PlacementLevel, number>>
  readonly halfCcaBaseFactor: number
  readonly halfCcaPlacementHalved: boolean
  readonly semesterOnlyFactor: number
  readonly incomingMultiplier: Readonly<Record<'head' | 'vice_head', number>>
  readonly outgoingMode: OutgoingMode
  readonly outgoingTiers: readonly OutgoingTier[]
  readonly stackingMode: StackingMode
  readonly droppedRoleBase: number
  readonly auxTable: readonly number[]
  readonly auxCap: number
  readonly ihgPoints: Readonly<Record<IhgPlacement, number>>
  readonly ihgInSportNet: boolean
  readonly stayingWeights: readonly number[]
  readonly stayingWeightTail: 'halve'
  readonly mergeHalfCcas: boolean
  readonly headcounts: Headcounts
  readonly sem2Mode: Sem2Mode
  readonly sem2Factor: number
}

/** Everything computed for one membership (resident, CCA). */
export interface MembershipResult {
  readonly ccaID: string
  readonly isHalf: boolean
  readonly effBase: number
  readonly inMult: number
  readonly outMult: number
  readonly stayMult: number
  readonly bidMult: number
  readonly placement: number
  readonly ihgNet: number
  readonly stayNet: number
  readonly bidNet: number
}

/** A staying slot: one membership, or two merged 0.5x memberships. */
export interface Slot {
  readonly ccaIDs: readonly string[]
  readonly value: number
}

export interface WeightedSlot extends Slot {
  readonly weight: number
  readonly contribution: number
}

export type PairedIds = readonly [string, string]

export interface StayingBreakdown {
  readonly points: number
  readonly slots: readonly WeightedSlot[]
  readonly slotTotal: number
  readonly mergedPairs: readonly PairedIds[]
  readonly usedGreedyPairing: boolean
  readonly auxPoints: number
  readonly flatIHG: number
}

export interface BiddingBreakdown {
  readonly points: number
  readonly contributions: readonly { readonly ccaID: string; readonly bidNet: number }[]
  readonly auxPoints: number
  readonly flatIHG: number
}

export type WarningCode =
  | 'SEMESTER_ONLY_ON_HALF_CCA'
  | 'AUX_ABOVE_CAP'
  | 'IHG_NON_MEMBER'
  | 'TOO_MANY_HALF_CCAS'

export interface EngineWarning {
  readonly code: WarningCode
  readonly matric: string
  readonly ccaID: string | null
  readonly message: string
}

export interface ResidentResult {
  readonly matric: string
  readonly memberships: readonly MembershipResult[]
  readonly staying: StayingBreakdown
  readonly bidding: BiddingBreakdown
  readonly warnings: readonly EngineWarning[]
}
