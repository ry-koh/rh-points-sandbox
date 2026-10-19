import type { CcaType, IhgPlacement } from '../engine'
import { reviewOrder, type NotSubmittingMark } from './review'
import type { ImportReport } from './types'

/**
 * present: the CCA's leader file is loaded (even with row errors); flat: a flat CCA; not_submitting:
 * marked and no file; superseded: marked, but a file arrived (the file wins); missing: neither.
 */
export type ChecklistStatus = 'present' | 'flat' | 'not_submitting' | 'missing' | 'superseded'

export interface ChecklistRow {
  readonly ccaID: string
  readonly name: string
  readonly status: ChecklistStatus
  readonly fileName: string | null
  /** The "not submitting" note; null when the CCA is not marked. */
  readonly note: string | null
  readonly type: CcaType | null
  readonly isSport: boolean
  readonly ihgResult: IhgPlacement | null
  readonly ihgCap: number | null
  readonly level: string | null
  readonly flatPoints: number | null
}

function statusOf(flat: boolean, hasFile: boolean, marked: boolean): ChecklistStatus {
  if (flat) return 'flat'
  if (hasFile) return marked ? 'superseded' : 'present'
  return marked ? 'not_submitting' : 'missing'
}

/**
 * One row per CCA in the bundle (the checklist is the bundle's CCA list; no bundle, no rows), in
 * review order. A mark for a CCA the bundle does not list is ignored here (spec 6.5).
 */
export function checklistRows(
  report: Pick<ImportReport, 'bundle' | 'perCca'>,
  marks: readonly NotSubmittingMark[],
): ChecklistRow[] {
  const rows = (report.bundle?.ccas ?? []).map((cca): ChecklistRow => {
    const perCca = report.perCca.find((c) => c.ccaID === cca.ccaID)
    const mark = marks.find((m) => m.ccaID === cca.ccaID)
    const flat = perCca?.status === 'flat'
    const hasFile = perCca !== undefined && perCca.fileName !== null
    return {
      ccaID: cca.ccaID,
      name: cca.ccaName,
      status: statusOf(flat, hasFile, mark !== undefined),
      fileName: perCca?.fileName ?? null,
      note: mark?.note ?? null,
      type: cca.type,
      isSport: cca.isSport,
      ihgResult: cca.ihgResult,
      ihgCap: cca.ihgCap,
      level: perCca?.level ?? null,
      flatPoints: cca.flatPoints,
    }
  })
  return reviewOrder(rows)
}

/** Complete when there is at least one CCA and none is missing. */
export const checklistComplete = (rows: readonly ChecklistRow[]): boolean =>
  rows.length > 0 && !rows.some((row) => row.status === 'missing')
