import { checkEntries, isFiniteNumber, reasonIsValid, upsertBy, type Validation } from './entries'
import type { AppliedDiscretion, Checked, Discretion, PipelineInput, ResidentResult } from './types'

export type DiscretionCode = 'BAD_DISCRETION_POINTS' | 'MISSING_REASON' | 'DISCRETION_UNKNOWN_RESIDENT'

/** Checked in this order: the deltas, the reason, then that the resident exists (spec 6.3). */
export function validateDiscretion(
  input: Pick<PipelineInput, 'residents'>,
  entry: Discretion,
): Validation<DiscretionCode> {
  if (!isFiniteNumber(entry.stayingDelta) || !isFiniteNumber(entry.biddingDelta)) {
    return { ok: false, code: 'BAD_DISCRETION_POINTS' }
  }
  if (!reasonIsValid(entry.reason)) return { ok: false, code: 'MISSING_REASON' }
  if (!input.residents.some((r) => r.matric === entry.matric)) {
    return { ok: false, code: 'DISCRETION_UNKNOWN_RESIDENT' }
  }
  return { ok: true }
}

/** At most one entry per resident: setting again replaces it. */
export function upsertDiscretion(list: readonly Discretion[], entry: Discretion): Discretion[] {
  return upsertBy(list, entry, (d) => d.matric)
}

/** Applied while the resident exists; stale (ignored, reported) once they have gone. */
export function checkDiscretion(
  residents: PipelineInput['residents'],
  entries: readonly Discretion[],
): Checked<Discretion>[] {
  const known = new Set(residents.map((r) => r.matric))
  return checkEntries(entries, (d) => d.matric, (d) => known.has(d.matric))
}

const signed = (n: number): string => (n < 0 ? `−${Math.abs(n)}` : `+${n}`)

export function describeDiscretion(entry: Discretion): AppliedDiscretion {
  const reason = entry.reason.trim()
  return {
    stayingDelta: entry.stayingDelta,
    biddingDelta: entry.biddingDelta,
    reason,
    text: `JCRC discretion: ${signed(entry.stayingDelta)} staying / ${signed(entry.biddingDelta)} bidding — ${reason}`,
  }
}

/** Adds the deltas to a computed result, last of all (spec 4.0, 6.3). Returns a new result. */
export function applyDiscretion(result: ResidentResult, entry: Discretion | undefined): ResidentResult {
  if (!entry) return result
  return {
    ...result,
    staying: {
      ...result.staying,
      points: result.staying.points + entry.stayingDelta,
      discretion: entry.stayingDelta,
    },
    bidding: {
      ...result.bidding,
      points: result.bidding.points + entry.biddingDelta,
      discretion: entry.biddingDelta,
    },
    discretion: describeDiscretion(entry),
  }
}
