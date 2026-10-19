export type Gender = 'M' | 'F'
export type Role = 'none' | 'head' | 'vice_head'
export type CcaType = '1x' | '0.5x'
export type IhgPlacement = '1st' | '2nd' | '3rd' | '3rd4th_no_match'
export type StackingMode = 'max' | 'additive' | 'multiplicative'
export type Sem2Mode = 'separate' | 'merged'
/** residents.csv `jcrc` column: not JCRC, JCRC full year, or JCRC exchange. */
export type JcrcStatus = 'N' | 'FULL' | 'EXCHANGE'

export interface Resident {
  readonly matric: string
  readonly name: string
  readonly gender: Gender
  readonly sem2: boolean
  readonly aux: number
  readonly jcrc: JcrcStatus
}

export interface Cca {
  readonly ccaID: string
  readonly ccaName: string
  readonly type: CcaType
  /** Name of one of `ScenarioConfig.levels`; null = no level (bonus 0, x1). */
  readonly level: string | null
  /** Per-CCA tweaks; each wins over its level's number when not null. */
  readonly bonusOverride: number | null
  readonly multiplierOverride: number | null
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
  /** Set only for a membership of a flat CCA: its exact, final value (spec 2e, 4.1). */
  readonly flatPoints?: number
}

export interface IhgEntry {
  readonly matric: string
  readonly ccaID: string
  readonly placement: IhgPlacement
}

/** A CCA level: members' bonus (added) and outgoing leaders' multiplier (bidding). Keyed by name. */
export interface Level {
  readonly name: string
  readonly bonus: number
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
  readonly sem2Green: number
  readonly sem2Grey: number
}

export interface ScenarioConfig {
  readonly meanSdDefault: MeanSdRange
  readonly levels: readonly Level[]
  readonly halfCcaBaseFactor: number
  /** Halve the LEVEL bonus for 0.5x CCAs (the key name is kept for old files). */
  readonly halfCcaPlacementHalved: boolean
  readonly semesterOnlyFactor: number
  readonly incomingMultiplier: Readonly<Record<'head' | 'vice_head', number>>
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
  readonly jcrcFullYearOffset: number
  readonly jcrcExchangeFactor: number
}

/** A flat or overridden membership is final: exactly this value (spec 4.1). */
export interface FinalNote {
  readonly kind: 'flat' | 'override'
  readonly value: number
  readonly reason: string | null
  /** Breakdown line, e.g. "Flat points (set by JCRC)". */
  readonly text: string
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
  readonly levelBonus: number
  readonly ihgNet: number
  readonly stayNet: number
  readonly bidNet: number
  /** Set when the membership is flat or overridden (nets are then exact). */
  readonly final: FinalNote | null
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
  /** JCRC discretion already included in `points` (0 when none). */
  readonly discretion: number
}

export interface BiddingBreakdown {
  readonly points: number
  readonly contributions: readonly { readonly ccaID: string; readonly bidNet: number }[]
  readonly auxPoints: number
  readonly flatIHG: number
  /** JCRC discretion already included in `points` (0 when none). */
  readonly discretion: number
}

/** How a JCRC resident's value was reached (spec 4.6). It never names the resident holding H. */
export interface JcrcBreakdown {
  readonly mode: 'FULL' | 'EXCHANGE'
  /** The highest final bidding among non-JCRC, non-sem-2 residents. */
  readonly h: number
  /** H + offset or H x factor, before the resident's own discretion. */
  readonly value: number
  readonly note: string
}

export interface AppliedDiscretion {
  readonly stayingDelta: number
  readonly biddingDelta: number
  readonly reason: string
  readonly text: string
}

export type WarningCode =
  | 'SEMESTER_ONLY_ON_HALF_CCA'
  | 'AUX_ABOVE_CAP'
  | 'IHG_NON_MEMBER'
  | 'TOO_MANY_HALF_CCAS'
  | 'IHG_ON_FINAL_CCA'

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
  /** Set for a JCRC resident, whose value comes from H instead of their CCAs. */
  readonly jcrc: JcrcBreakdown | null
  readonly discretion: AppliedDiscretion | null
}

/** Already-parsed data handed to the engine (no CSV handling here). */
export interface PipelineInput {
  readonly residents: readonly Resident[]
  readonly ccas: readonly Cca[]
  readonly memberships: readonly Membership[]
  readonly ihg: readonly IhgEntry[]
}

export type Band = 'green' | 'grey' | 'white'
export type RowStatus = Band | 'removed'

/** Flag on a tie group that straddles a band boundary, e.g. "TIE green/grey — 1 of 2 seats". */
export interface TieFlag {
  readonly boundary: string
  readonly k: number
  readonly n: number
  readonly text: string
  /** True once a wheel resolution settled the group (spec 5.6); absent otherwise. */
  readonly resolved?: boolean
}

export interface ListRow {
  readonly position: number
  readonly rank: number
  readonly matric: string
  readonly name: string
  readonly points: number
  /** Staying lists and sem-2: band (or removed). Bidding lists: the staying band, or the sem-2 band for an inserted sem-2 row. */
  readonly status: RowStatus
  readonly tieFlags: readonly TieFlag[]
  readonly labels: readonly string[]
  readonly result: ResidentResult
}

export interface Lists {
  readonly maleStaying: readonly ListRow[]
  readonly femaleStaying: readonly ListRow[]
  readonly maleBidding: readonly ListRow[]
  readonly femaleBidding: readonly ListRow[]
  readonly sem2: readonly ListRow[]
}

export interface PenaltyKey {
  readonly matric: string
  readonly ccaID: string
}

export interface PenaltyState {
  /** Frozen green cut-off per gender, taken before any penalty (null when nobody was green). */
  readonly cutoffs: Readonly<Record<Gender, number | null>>
  readonly applied: readonly PenaltyKey[]
  readonly removed: readonly string[]
}

export type PenaltyResult =
  | { readonly ok: true; readonly state: PenaltyState }
  | { readonly ok: false; readonly error: string }

/** The staying lists a wheel resolution can settle (spec 5.6). */
export type WheelList = 'maleStaying' | 'femaleStaying' | 'sem2'

/** The wheel's order of one boundary tie group's matrics (spec 5.6). */
export interface WheelResolution {
  readonly list: WheelList
  readonly order: readonly string[]
}

/** A final-points override of one existing membership (spec 6.2). */
export interface FinalOverride {
  readonly matric: string
  readonly ccaID: string
  readonly finalPoints: number
  readonly reason: string
}

/** JCRC discretion points for one resident, applied last (spec 6.3). */
export interface Discretion {
  readonly matric: string
  readonly stayingDelta: number
  readonly biddingDelta: number
  readonly reason: string
}

export type EntryStatus = 'applied' | 'stale'

export interface Checked<T> {
  readonly entry: T
  readonly status: EntryStatus
}

/** Direct JCRC entries passed to computeAll; all resident data, never persisted. */
export interface EntryOptions {
  readonly resolutions?: readonly WheelResolution[]
  readonly overrides?: readonly FinalOverride[]
  readonly discretion?: readonly Discretion[]
}

export interface ComputeOptions extends EntryOptions {
  readonly penaltyState?: PenaltyState
}

export interface PipelineResult {
  readonly results: readonly ResidentResult[]
  readonly lists: Lists
  readonly warnings: readonly EngineWarning[]
  readonly resolutions: readonly Checked<WheelResolution>[]
  readonly overrides: readonly Checked<FinalOverride>[]
  readonly discretion: readonly Checked<Discretion>[]
}
