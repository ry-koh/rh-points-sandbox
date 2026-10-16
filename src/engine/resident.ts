import { MAX_EXHAUSTIVE_HALVES } from './defaults'
import { computeMembership } from './membership'
import { chooseSlots } from './merge'
import type {
  BiddingBreakdown,
  Cca,
  EngineWarning,
  FinalOverride,
  IhgEntry,
  Membership,
  MembershipResult,
  Resident,
  ResidentResult,
  ScenarioConfig,
  Slot,
  StayingBreakdown,
} from './types'

export function auxPoints(aux: number, config: ScenarioConfig): number {
  const capped = Math.min(aux, config.auxCap)
  const points = config.auxTable[capped]
  if (points === undefined) throw new Error(`auxTable has no entry for ${capped} AUX`)
  return points
}

function sumIhg(entries: readonly IhgEntry[], config: ScenarioConfig): number {
  return entries.reduce((sum, entry) => sum + config.ihgPoints[entry.placement], 0)
}

/** IHG not already counted in a sport net (all of it unless ihgInSportNet is on). */
function flatIhgEntries(
  ihg: readonly IhgEntry[],
  memberOf: ReadonlySet<string>,
  config: ScenarioConfig,
): readonly IhgEntry[] {
  return config.ihgInSportNet ? ihg.filter((entry) => !memberOf.has(entry.ccaID)) : ihg
}

function toSlot(result: MembershipResult): Slot {
  return { ccaIDs: [result.ccaID], value: result.stayNet }
}

function buildStaying(
  results: readonly MembershipResult[],
  aux: number,
  flatIHG: number,
  config: ScenarioConfig,
): StayingBreakdown {
  const fixed = results.filter((r) => !r.isHalf).map(toSlot)
  const halves = results.filter((r) => r.isHalf).map(toSlot)
  const choice = chooseSlots(fixed, halves, config)
  return {
    points: choice.total + aux + flatIHG,
    slots: choice.slots,
    slotTotal: choice.total,
    mergedPairs: choice.pairs,
    usedGreedyPairing: choice.greedy,
    auxPoints: aux,
    flatIHG,
    discretion: 0,
  }
}

function buildBidding(
  results: readonly MembershipResult[],
  aux: number,
  flatIHG: number,
): BiddingBreakdown {
  const contributions = results.map((r) => ({ ccaID: r.ccaID, bidNet: r.bidNet }))
  const netTotal = contributions.reduce((sum, c) => sum + c.bidNet, 0)
  return { points: netTotal + aux + flatIHG, contributions, auxPoints: aux, flatIHG, discretion: 0 }
}

function warn(
  code: EngineWarning['code'],
  matric: string,
  ccaID: string | null,
  message: string,
): EngineWarning {
  return { code, matric, ccaID, message }
}

function collectWarnings(
  resident: Resident,
  memberships: readonly Membership[],
  ccas: Readonly<Record<string, Cca>>,
  nonMemberIhg: readonly IhgEntry[],
  ignoredIhg: readonly IhgEntry[],
  config: ScenarioConfig,
): EngineWarning[] {
  const { matric } = resident
  const isHalf = (m: Membership): boolean => ccas[m.ccaID]?.type === '0.5x'
  const semesterOnHalf = memberships
    .filter((m) => m.semesterOnly && isHalf(m))
    .map((m) => warn('SEMESTER_ONLY_ON_HALF_CCA', matric, m.ccaID, 'semesterOnly is ignored on a 0.5x CCA'))
  const auxWarning =
    resident.aux > config.auxCap
      ? [warn('AUX_ABOVE_CAP', matric, null, `aux ${resident.aux} is capped at ${config.auxCap}`)]
      : []
  const nonMember = nonMemberIhg.map((entry) =>
    warn('IHG_NON_MEMBER', matric, entry.ccaID, 'IHG for a CCA the resident is not a member of'),
  )
  const halfCount = memberships.filter(isHalf).length
  const tooMany =
    halfCount > MAX_EXHAUSTIVE_HALVES
      ? [warn('TOO_MANY_HALF_CCAS', matric, null, `${halfCount} half-CCA memberships; paired greedily`)]
      : []
  const onFinal = ignoredIhg.map((entry) =>
    warn('IHG_ON_FINAL_CCA', matric, entry.ccaID, 'IHG for a flat or overridden membership is ignored'),
  )
  return [...semesterOnHalf, ...auxWarning, ...nonMember, ...tooMany, ...onFinal]
}

function lookupCca(ccas: Readonly<Record<string, Cca>>, ccaID: string): Cca {
  const cca = ccas[ccaID]
  if (!cca) throw new Error(`Membership references unknown CCA "${ccaID}"`)
  return cca
}

export function computeResident(
  resident: Resident,
  memberships: readonly Membership[],
  ccas: Readonly<Record<string, Cca>>,
  ihg: readonly IhgEntry[],
  config: ScenarioConfig,
  overrides: readonly FinalOverride[] = [],
): ResidentResult {
  const own = memberships.filter((m) => m.matric === resident.matric)
  const ownIhg = ihg.filter((entry) => entry.matric === resident.matric)
  const overrideOf = (ccaID: string): FinalOverride | undefined =>
    overrides.find((o) => o.matric === resident.matric && o.ccaID === ccaID)
  const results = own.map((m) =>
    computeMembership(m, lookupCca(ccas, m.ccaID), ownIhg, config, overrideOf(m.ccaID)),
  )
  const finalIds = new Set(results.filter((r) => r.final !== null).map((r) => r.ccaID))
  const ignoredIhg = config.ihgInSportNet ? ownIhg.filter((entry) => finalIds.has(entry.ccaID)) : []
  const flatEntries = flatIhgEntries(ownIhg, new Set(own.map((m) => m.ccaID)), config)
  const aux = auxPoints(resident.aux, config)
  const flatIHG = sumIhg(flatEntries, config)
  const nonMemberIhg = config.ihgInSportNet ? flatEntries : []
  return {
    matric: resident.matric,
    memberships: results,
    staying: buildStaying(results, aux, flatIHG, config),
    bidding: buildBidding(results, aux, flatIHG),
    warnings: collectWarnings(resident, own, ccas, nonMemberIhg, ignoredIhg, config),
    jcrc: null,
    discretion: null,
  }
}
