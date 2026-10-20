import type { Discretion, Gender, IhgPlacement, JcrcStatus, Role } from '../../engine'
import { reviewKey, type CcaLevelEntry, type ImportReport } from '../../import'
import type { WorkspaceReview } from '../../workspace'

/** What the Summary reads: the import's inputs only, never a computed result. */
export type SummaryReport = Pick<ImportReport, 'input' | 'perCca' | 'review'>

export const JCRC_NOTE = 'value set from H on Results'

export interface SummaryMembership {
  readonly ccaID: string
  readonly ccaName: string
  /** The reviewed score: the leader file's value with any applied Review edit. */
  readonly basePoints: number
  readonly edited: boolean
  readonly semesterOnly: boolean
  readonly outgoingRole: Role
  readonly incomingRole: Role
  /** Ticked for the sport's IHG points (the tick, not an amount). */
  readonly ihg: boolean
  readonly levelName: string | null
  readonly tweaked: boolean
  readonly flatPoints: number | null
  /** A flat value edited on Review; `flatFile` is the RH-app value (null when the CCA is not flat). */
  readonly flatEdited: boolean
  readonly flatFile: number | null
}

/** How an AUX edit was judged against residents.csv. */
export type AuxEditState = 'applied' | 'changed' | 'stale'

export interface SummaryRow {
  readonly matric: string
  readonly name: string
  readonly gender: Gender
  readonly sem2: boolean
  /** The AUX count in use (an input), not AUX points. */
  readonly aux: number
  /** residents.csv's count. */
  readonly auxFile: number
  readonly auxEdit: AuxEditState | null
  readonly jcrc: JcrcStatus
  readonly jcrcNote: string | null
  readonly ihg: readonly { readonly ccaID: string; readonly result: IhgPlacement }[]
  readonly memberships: readonly SummaryMembership[]
  readonly discretion: Discretion | null
}

export interface SummaryCounts {
  readonly residents: number
  readonly discretion: number
  readonly edits: number
  readonly ihgRecipients: number
  readonly auxEdits: number
  readonly flatEdits: number
}

const byName = (a: SummaryRow, b: SummaryRow): number =>
  a.name.localeCompare(b.name, 'en', { numeric: true, sensitivity: 'base' }) || a.matric.localeCompare(b.matric)

/** One row per resident, sorted by name. Inputs only: nothing here needs the pipeline's results. */
export function summaryRows(
  report: SummaryReport,
  review: Pick<WorkspaceReview, 'edits'>,
  ccaLevels: readonly CcaLevelEntry[],
  discretion: readonly Discretion[],
): SummaryRow[] {
  const input = report.input
  if (!input) return []
  const latest = new Set(review.edits.map(reviewKey))
  const applied = new Set(
    report.review.edits.filter((e) => e.status === 'applied' && latest.has(reviewKey(e.entry))).map((e) => reviewKey(e.entry)),
  )
  const tweakedIds = new Set(
    ccaLevels.filter((e) => e.bonusOverride !== null || e.multiplierOverride !== null).map((e) => e.ccaID),
  )
  const perCca = new Map(report.perCca.map((c) => [c.ccaID, c]))
  const ccaNames = new Map(input.ccas.map((c) => [c.ccaID, c.ccaName]))
  const auxJudged = new Map(report.review.auxEdits.map((e) => [e.entry.matric, e]))
  const flatApplied = new Map(
    report.review.flatEdits.filter((e) => e.status === 'applied').map((e) => [reviewKey(e.entry), e.entry.from]),
  )
  const ticked = new Set(input.ihg.map((e) => reviewKey(e)))
  const rows = input.residents.map((resident): SummaryRow => ({
    matric: resident.matric,
    name: resident.name,
    gender: resident.gender,
    sem2: resident.sem2,
    aux: resident.aux,
    auxFile: auxJudged.get(resident.matric)?.status === 'applied' ? auxJudged.get(resident.matric)!.entry.from : (auxJudged.get(resident.matric)?.current ?? resident.aux),
    auxEdit: auxJudged.get(resident.matric)?.status ?? null,
    jcrc: resident.jcrc,
    jcrcNote: resident.jcrc === 'N' ? null : JCRC_NOTE,
    ihg: input.ihg.filter((e) => e.matric === resident.matric).map((e) => ({ ccaID: e.ccaID, result: e.placement })),
    memberships: input.memberships
      .filter((m) => m.matric === resident.matric)
      .map((m): SummaryMembership => ({
        ccaID: m.ccaID,
        ccaName: ccaNames.get(m.ccaID) ?? m.ccaID,
        basePoints: m.basePoints,
        edited: applied.has(reviewKey(m)),
        semesterOnly: m.semesterOnly,
        outgoingRole: m.outgoingRole,
        incomingRole: m.incomingRole,
        ihg: ticked.has(reviewKey(m)),
        levelName: perCca.get(m.ccaID)?.level ?? null,
        tweaked: tweakedIds.has(m.ccaID),
        flatPoints: m.flatPoints ?? null,
        flatEdited: flatApplied.has(reviewKey(m)),
        flatFile: m.flatPoints === undefined ? null : (flatApplied.get(reviewKey(m)) ?? m.flatPoints),
      })),
    discretion: discretion.find((d) => d.matric === resident.matric) ?? null,
  }))
  return rows.sort(byName)
}

export function summaryCounts(rows: readonly SummaryRow[]): SummaryCounts {
  return {
    residents: rows.length,
    discretion: rows.filter((r) => r.discretion !== null).length,
    edits: rows.reduce((sum, r) => sum + r.memberships.filter((m) => m.edited).length, 0),
    ihgRecipients: rows.filter((r) => r.ihg.length > 0).length,
    auxEdits: rows.filter((r) => r.auxEdit === 'applied').length,
    flatEdits: rows.reduce((sum, r) => sum + r.memberships.filter((m) => m.flatEdited).length, 0),
  }
}
