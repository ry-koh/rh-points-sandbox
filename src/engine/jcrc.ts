import type { JcrcBreakdown, Resident, ResidentResult, ScenarioConfig } from './types'

/**
 * H: the highest FINAL bidding (discretion included) among residents who are neither JCRC
 * nor sem-2, hall-wide. 0 when there is no such resident (spec 4.6).
 */
export function highestOtherBidding(
  residents: readonly Resident[],
  results: ReadonlyMap<string, ResidentResult>,
): number {
  const values = residents
    .filter((r) => r.jcrc === 'N' && !r.sem2)
    .flatMap((r) => {
      const result = results.get(r.matric)
      return result ? [result.bidding.points] : []
    })
  return values.length === 0 ? 0 : Math.max(...values)
}

const formatNumber = (n: number): string => String(n)

export function describeJcrc(
  mode: JcrcBreakdown['mode'],
  h: number,
  config: ScenarioConfig,
): JcrcBreakdown {
  if (mode === 'FULL') {
    const offset = config.jcrcFullYearOffset
    return {
      mode,
      h,
      value: h + offset,
      note: `JCRC (full year): highest other bidding H + ${formatNumber(offset)}`,
    }
  }
  const factor = config.jcrcExchangeFactor
  return {
    mode,
    h,
    value: h * factor,
    note: `JCRC (exchange): highest other bidding H × ${formatNumber(factor)}`,
  }
}

/**
 * A JCRC resident's result: staying = bidding = the JCRC value. Their own CCA data, AUX and IHG
 * are ignored, so there are no memberships, slots or warnings (spec 4.6).
 */
export function jcrcResult(
  resident: Resident,
  mode: JcrcBreakdown['mode'],
  h: number,
  config: ScenarioConfig,
): ResidentResult {
  const jcrc = describeJcrc(mode, h, config)
  return {
    matric: resident.matric,
    memberships: [],
    staying: {
      points: jcrc.value,
      slots: [],
      slotTotal: 0,
      mergedPairs: [],
      usedGreedyPairing: false,
      auxPoints: 0,
      flatIHG: 0,
      discretion: 0,
    },
    bidding: { points: jcrc.value, contributions: [], auxPoints: 0, flatIHG: 0, discretion: 0 },
    warnings: [],
    jcrc,
    discretion: null,
  }
}
