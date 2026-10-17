import type {
  CcaType,
  Gender,
  IhgPlacement,
  JcrcStatus,
  MeanSdRange,
  PipelineInput,
  PlacementLevel,
  Role,
} from '../engine'

export type FileKind = 'leader' | 'residents' | 'ihg' | 'ccas' | 'flat' | 'settings'

export interface SourceFile {
  readonly name: string
  readonly text: string
}

export type IssueCode =
  | 'UNRECOGNISED_FILE'
  | 'CSV_SYNTAX'
  | 'BAD_HEADER'
  | 'BAD_FORMAT_VERSION'
  | 'MIXED_CCA_ID'
  | 'DUPLICATE_CCA_FILE'
  | 'MISSING_RESIDENTS_FILE'
  | 'MISSING_CCAS_FILE'
  | 'DUPLICATE_RESIDENTS_OR_CCAS_FILE'
  | 'BAD_MATRIC'
  | 'UNKNOWN_MATRIC'
  | 'DUPLICATE_MATRIC_IN_FILE'
  | 'DUPLICATE_RESIDENT'
  | 'BAD_BASE_POINTS'
  | 'BAD_ENUM'
  | 'BAD_YN'
  | 'BAD_GENDER'
  | 'BAD_AUX'
  | 'BAD_JCRC'
  | 'JCRC_AND_SEM2'
  | 'BAD_FLAT_POINTS'
  | 'FLAT_VALUE_MISMATCH'
  | 'FLAT_AND_LEADER_FILE'
  | 'DUPLICATE_FLAT_FILE'
  | 'BAD_SETTINGS_FILE'
  | 'DUPLICATE_WAIVER'
  | 'DUPLICATE_SETTINGS_FILE'
  | 'CCAS_RANGE_IGNORED'
  | 'SETTINGS_UNKNOWN_CCA'
  | 'UNKNOWN_CCA'
  | 'IHG_UNKNOWN_MATRIC'
  | 'IHG_UNKNOWN_CCA'
  | 'UNKNOWN_TIER'
  | 'BAD_MANUAL_MULTIPLIER'
  | 'MISSING_OUTGOING_MULTIPLIER'
  | 'DUPLICATE_CCA'
  | 'BAD_RANGE'
  | 'MEAN_SD_OUT_OF_RANGE'
  | 'NO_LEADER_FILE'
  | 'SEMESTER_ONLY_ON_HALF_CCA'
  | 'AUX_ABOVE_CAP'
  | 'IHG_NON_MEMBER'
  | 'MANY_HALF_CCAS'
  | 'IHG_ON_FINAL_CCA'

export interface Issue {
  readonly severity: 'error' | 'warning'
  readonly code: IssueCode
  readonly overridable: boolean
  readonly fileName: string
  readonly line?: number
  readonly column?: string
  readonly ccaID?: string
  readonly matric?: string
  readonly message: string
  /** True once the user has overridden this (only MEAN_SD_OUT_OF_RANGE can be). */
  readonly overridden?: boolean
}

export interface CsvRow {
  readonly line: number
  readonly cells: readonly string[]
}

export interface CsvIssue {
  readonly line: number
  readonly message: string
}

export interface ParsedCsv {
  readonly header: readonly string[]
  readonly rows: readonly CsvRow[]
  readonly issues: readonly CsvIssue[]
}

export interface LeaderRow {
  readonly line: number
  readonly ccaID: string
  readonly ccaName: string
  readonly matric: string
  readonly name: string
  readonly basePoints: number
  readonly semesterOnly: boolean
  readonly outgoingRole: Role
  readonly incomingRole: Role
}

export interface ResidentRow {
  readonly line: number
  readonly matric: string
  readonly name: string
  readonly gender: Gender
  readonly sem2: boolean
  readonly aux: number
  readonly jcrc: JcrcStatus
}

export interface FlatRow {
  readonly line: number
  readonly ccaID: string
  readonly ccaName: string
  readonly matric: string
  readonly name: string
  readonly flatPoints: number
}

export interface SettingsRow {
  readonly line: number
  readonly scope: 'default' | 'waiver'
  /** Blank on the default row. */
  readonly ccaID: string
  readonly exportedAt: string
  readonly range: MeanSdRange
}

export interface IhgRow {
  readonly line: number
  readonly matric: string
  readonly ccaID: string
  readonly placement: IhgPlacement
}

export interface CcaRow {
  readonly line: number
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

export interface ParseResult<T> {
  readonly rows: readonly T[]
  /** Keys (matric or ccaID) seen on rows, even rows dropped for another bad field. */
  readonly seenKeys: readonly string[]
  readonly issues: readonly Issue[]
}

export type CcaStatus = 'ok' | 'out_of_range' | 'overridden' | 'missing_file' | 'flat'

export interface PerCcaReport {
  readonly ccaID: string
  readonly name: string
  readonly fileName: string | null
  readonly n: number
  readonly mean: number | null
  readonly sd: number | null
  readonly range: MeanSdRange
  readonly status: CcaStatus
  /** The flat value of a flat CCA (status "flat"); null for every other CCA. */
  readonly flatPoints: number | null
}

export interface OverrideRecord {
  readonly ccaID: string
  readonly name: string
  readonly fileName: string
  readonly mean: number | null
  readonly sd: number | null
  readonly range: MeanSdRange
}

/** The JCRC points settings file once it is loaded and usable (spec 2g). */
export interface LoadedSettings {
  readonly fileName: string
  /** The default row's exportedAt text, as written by the app. */
  readonly exportedAt: string
  readonly defaultRange: MeanSdRange
  /** The effective range of each waived CCA, by ccaID. */
  readonly waivers: Readonly<Record<string, MeanSdRange>>
}

export interface ImportReport {
  readonly canCompute: boolean
  /** Set while a usable settings file is loaded: its ranges are the only ones used. */
  readonly settings: LoadedSettings | null
  readonly issues: readonly Issue[]
  readonly perCca: readonly PerCcaReport[]
  readonly overrides: readonly OverrideRecord[]
  readonly input?: PipelineInput
}

export interface OverrideRequest {
  readonly ccaID: string
}
