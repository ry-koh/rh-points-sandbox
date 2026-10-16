import {
  MAX_REASON_LENGTH,
  validateDiscretion,
  validateOverride,
  type Discretion,
  type DiscretionCode,
  type FinalOverride,
  type OverrideCode,
  type PipelineInput,
} from '../../engine'

export type DraftResult<T> = { readonly ok: true; readonly entry: T } | { readonly ok: false; readonly message: string }

export const OVERRIDE_MESSAGES: Readonly<Record<OverrideCode, string>> = {
  BAD_FINAL_POINTS: 'Enter the final points as a number.',
  MISSING_REASON: `Give a reason (up to ${MAX_REASON_LENGTH} characters).`,
  OVERRIDE_UNKNOWN_MEMBERSHIP: 'This resident is no longer a member of this CCA in the imported files.',
}

export const DISCRETION_MESSAGES: Readonly<Record<DiscretionCode, string>> = {
  BAD_DISCRETION_POINTS: 'Enter each change as a number, e.g. 2 or -1.',
  MISSING_REASON: `Give a reason (up to ${MAX_REASON_LENGTH} characters).`,
  DISCRETION_UNKNOWN_RESIDENT: 'This resident is no longer in the residents list.',
}

/** Blank or non-numeric text becomes NaN, which the engine rejects with a clear code. */
export const parseNumber = (text: string): number => (text.trim() === '' ? Number.NaN : Number(text.trim()))

/** Builds and validates a final-points override from the inline editor's fields. */
export function overrideFromDraft(
  input: Pick<PipelineInput, 'memberships'>,
  key: { readonly matric: string; readonly ccaID: string },
  pointsText: string,
  reason: string,
): DraftResult<FinalOverride> {
  const entry: FinalOverride = { ...key, finalPoints: parseNumber(pointsText), reason: reason.trim() }
  const check = validateOverride(input, entry)
  return check.ok ? { ok: true, entry } : { ok: false, message: OVERRIDE_MESSAGES[check.code] }
}

/** Builds and validates a discretion entry; with "same for both" the bidding change copies staying. */
export function discretionFromDraft(
  input: Pick<PipelineInput, 'residents'>,
  matric: string,
  draft: { readonly staying: string; readonly bidding: string; readonly same: boolean; readonly reason: string },
): DraftResult<Discretion> {
  const stayingDelta = parseNumber(draft.staying)
  const biddingDelta = draft.same ? stayingDelta : parseNumber(draft.bidding)
  const entry: Discretion = { matric, stayingDelta, biddingDelta, reason: draft.reason.trim() }
  const check = validateDiscretion(input, entry)
  return check.ok ? { ok: true, entry } : { ok: false, message: DISCRETION_MESSAGES[check.code] }
}

const signed = (n: number): string => (n < 0 ? `−${Math.abs(n)}` : `+${n}`)

/** "+2 staying / −1 bidding — reason". */
export const discretionSummary = (d: Discretion): string =>
  `${signed(d.stayingDelta)} staying / ${signed(d.biddingDelta)} bidding — ${d.reason}`
