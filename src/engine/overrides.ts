import { checkEntries, isFiniteNumber, reasonIsValid, upsertBy, type Validation } from './entries'
import type { Checked, FinalOverride, Membership, PipelineInput } from './types'

export type OverrideCode = 'BAD_FINAL_POINTS' | 'MISSING_REASON' | 'OVERRIDE_UNKNOWN_MEMBERSHIP'

export const overrideKey = (entry: Pick<FinalOverride, 'matric' | 'ccaID'>): string =>
  `${entry.matric}|${entry.ccaID}`

const hasMembership = (memberships: readonly Membership[], entry: FinalOverride): boolean =>
  memberships.some((m) => m.matric === entry.matric && m.ccaID === entry.ccaID)

/** Checked in this order: the points, the reason, then that the membership exists (spec 6.2). */
export function validateOverride(
  input: Pick<PipelineInput, 'memberships'>,
  entry: FinalOverride,
): Validation<OverrideCode> {
  if (!isFiniteNumber(entry.finalPoints)) return { ok: false, code: 'BAD_FINAL_POINTS' }
  if (!reasonIsValid(entry.reason)) return { ok: false, code: 'MISSING_REASON' }
  if (!hasMembership(input.memberships, entry)) return { ok: false, code: 'OVERRIDE_UNKNOWN_MEMBERSHIP' }
  return { ok: true }
}

/** At most one override per (matric, ccaID): setting again replaces it. */
export function upsertOverride(list: readonly FinalOverride[], entry: FinalOverride): FinalOverride[] {
  return upsertBy(list, entry, overrideKey)
}

/** Applied while the membership exists; stale (ignored, reported) once it has gone. */
export function checkOverrides(
  memberships: readonly Membership[],
  overrides: readonly FinalOverride[],
): Checked<FinalOverride>[] {
  return checkEntries(overrides, overrideKey, (entry) => hasMembership(memberships, entry))
}
