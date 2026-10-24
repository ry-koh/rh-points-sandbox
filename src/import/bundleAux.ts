import { makeIssue } from './parseCommon'
import type { BundleAuxRow, Issue, ResidentRow } from './types'

/** The bundle's AUX counts (formatVersion 2): the year and one row per resident with AUX. */
export interface BundleAux {
  readonly fileName: string
  readonly year: string | null
  readonly rows: readonly BundleAuxRow[]
}

/**
 * The resident rows with the bundle's AUX count in place of residents.csv's `aux` (spec 2d): a
 * resident with no aux row has 0. An aux row for a matric residents.csv lacks is ignored
 * (AUX_NOT_A_RESIDENT). A non-zero residents.csv count that the bundle overrides is reported once
 * (AUX_FROM_BUNDLE), so a stale column is noticed; a column of zeros is not. Never mutates.
 */
export function withBundleAux(
  residents: readonly ResidentRow[],
  residentsFile: string,
  aux: BundleAux,
): { readonly rows: ResidentRow[]; readonly issues: Issue[] } {
  const counts = new Map(aux.rows.map((r) => [r.matric, r.aux]))
  const known = new Set(residents.map((r) => r.matric))
  const issues: Issue[] = aux.rows
    .filter((r) => !known.has(r.matric))
    .map((r) => {
      const text = `${r.matric} has ${r.aux} AUX in the bundle but is not in residents.csv; the count is ignored.`
      return makeIssue('AUX_NOT_A_RESIDENT', aux.fileName, text, { line: r.line, column: 'matric', matric: r.matric })
    })
  const rows = residents.map((r) => ({ ...r, aux: counts.get(r.matric) ?? 0 }))
  const overridden = residents.filter((r, i) => r.aux !== 0 && r.aux !== rows[i]?.aux)
  if (overridden.length > 0) {
    const who = overridden.length === 1 ? '1 resident' : `${overridden.length} residents`
    const text = `the AUX counts now come from the bundle; residents.csv's aux column differs for ${who} and is ignored.`
    issues.push(makeIssue('AUX_FROM_BUNDLE', residentsFile, text, { column: 'aux' }))
  }
  return { rows, issues }
}
