import type {
  CcaType,
  Gender,
  IhgPlacement,
  JcrcStatus,
  MeanSdRange,
  PipelineInput,
  Role,
} from '../engine'
import type { CheckedReviewEdit, ReviewEdit } from './review'

export type FileKind = 'leader' | 'residents' | 'flat' | 'settings' | 'bundle'

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
  | 'MISSING_BUNDLE_FILE'
  | 'DUPLICATE_BUNDLE_FILE'
  | 'BAD_BUNDLE_FILE'
  | 'BAD_IHG_CAP'
  | 'CCAS_FILE_RETIRED'
  | 'DUPLICATE_RESIDENTS_FILE'
  | 'IHG_FILE_RETIRED'
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
  | 'SETTINGS_UNKNOWN_CCA'
  | 'UNKNOWN_CCA'
  | 'IHG_OVER_CAP'
  | 'IHG_NOT_SET'
  | 'IHG_TICK_IGNORED'
  | 'IHG_NO_TICKS'
  | 'TYPE_NOT_SET'
  | 'LEVEL_NOT_SET'
  | 'UNKNOWN_LEVEL'
  | 'BAD_LEVEL_TWEAK'
  | 'DUPLICATE_LEVEL_NAME'
  | 'LEVEL_UNKNOWN_CCA'
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
  readonly fileName: string
  readonly line?: number
  readonly column?: string
  readonly ccaID?: string
  readonly matric?: string
  readonly message: string
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
  /** The member gets the sport's IHG points (formatVersion 2); false in a version-1 file. */
  readonly ihg: boolean
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

/** One CCA as the checks and the engine see it: the engine's `Cca` plus the bundle line it came from. */
export interface CcaRow {
  readonly line: number
  readonly ccaID: string
  readonly ccaName: string
  readonly type: CcaType
  readonly level: string | null
  readonly bonusOverride: number | null
  readonly multiplierOverride: number | null
  readonly meanMin: number | null
  readonly meanMax: number | null
  readonly sdMin: number | null
  readonly sdMax: number | null
}

/** A `cca` row of the RH-app bundle (spec 2d). Blank `type` / `ihgResult` / `ihgCap` read as null. */
export interface BundleCcaRow {
  readonly line: number
  readonly ccaID: string
  readonly ccaName: string
  readonly flatPoints: number | null
  readonly type: CcaType | null
  readonly isSport: boolean
  readonly ihgResult: IhgPlacement | null
  readonly ihgCap: number | null
}

export type BundleRow =
  | { readonly section: 'settings'; readonly row: SettingsRow }
  | { readonly section: 'cca'; readonly row: BundleCcaRow }
  | { readonly section: 'flat'; readonly row: FlatRow }

/** A CCA as the loaded bundle lists it. */
export type BundleCca = Omit<BundleCcaRow, 'line'>

/** The RH-app bundle once it is loaded. */
export interface LoadedBundle {
  readonly fileName: string
  readonly exportedAt: string
  /** Every cca row that parsed, in ccaID order. */
  readonly ccas: readonly BundleCca[]
}

/** One CCA's level and tweaks, picked in the sandbox (spec 3b). */
export interface CcaLevelEntry {
  readonly ccaID: string
  readonly level: string | null
  readonly bonusOverride: number | null
  readonly multiplierOverride: number | null
}

/** Values entered in the sandbox itself, not read from any file. Every field is optional at the call site. */
export interface SandboxInput {
  readonly ccaLevels: readonly CcaLevelEntry[]
  /** Reviewed scores from the Review step (spec 6.4). */
  readonly edits: readonly ReviewEdit[]
  /** ccaIDs marked "not submitting" on the checklist: no NO_LEADER_FILE for them (spec 6.5). */
  readonly notSubmitting: readonly string[]
}

export interface ParseResult<T> {
  readonly rows: readonly T[]
  /** Keys (matric or ccaID) seen on rows, even rows dropped for another bad field. */
  readonly seenKeys: readonly string[]
  readonly issues: readonly Issue[]
}

export type CcaStatus = 'ok' | 'out_of_range' | 'missing_file' | 'flat'

/** The part of a CCA's report the per-CCA checks build. */
export interface BaseCcaReport {
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

export interface PerCcaReport extends BaseCcaReport {
  /** As the bundle has it; null = not set in RH-app (1x is assumed). */
  readonly type: CcaType | null
  readonly isSport: boolean
  readonly ihgResult: IhgPlacement | null
  readonly ihgCap: number | null
  /** The level used; null when none is picked or the picked one is not in Settings. */
  readonly level: string | null
  readonly bonusOverride: number | null
  readonly multiplierOverride: number | null
  /** Leader-file rows with an outgoing role. */
  readonly outgoingLeaders: number
  /** Leader-file rows ticked for the sport's IHG points. */
  readonly ihgTicked: number
  /** FNV-1a of the leader file's text (spec 6.5); null when the CCA has none. The bundle is never hashed. */
  readonly fileHash: string | null
}

/** A CCA whose mean or SD is outside its allowed range: allowed, but listed on every export. */
export interface OutOfRangeRecord {
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
  /** The RH-app bundle, when one is loaded. */
  readonly bundle: LoadedBundle | null
  /** Set while usable settings (from the bundle) are loaded: their ranges are the only ones used. */
  readonly settings: LoadedSettings | null
  readonly issues: readonly Issue[]
  readonly perCca: readonly PerCcaReport[]
  readonly outOfRange: readonly OutOfRangeRecord[]
  /** How each review edit was judged against the leader files, and the flat CCAs (not editable). */
  readonly review: ReviewReport
  readonly input?: PipelineInput
}

export interface ReviewReport {
  readonly edits: readonly CheckedReviewEdit[]
  readonly flatIds: readonly string[]
}
