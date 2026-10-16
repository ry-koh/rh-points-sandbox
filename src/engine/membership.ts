import { HALF_PLACEMENT_FACTOR } from './defaults'
import type {
  Cca,
  FinalNote,
  FinalOverride,
  IhgEntry,
  Membership,
  MembershipResult,
  ScenarioConfig,
} from './types'

function isHalf(cca: Cca): boolean {
  return cca.type === '0.5x'
}

function activeIncomingRole(m: Membership): Membership['incomingRole'] {
  return m.roleDropped ? 'none' : m.incomingRole
}

export function effBase(m: Membership, cca: Cca, config: ScenarioConfig): number {
  const capped = m.roleDropped ? Math.min(m.basePoints, config.droppedRoleBase) : m.basePoints
  // semesterOnly on a 0.5x CCA is ignored (the import step warns about it).
  const semester = m.semesterOnly && !isHalf(cca) ? capped * config.semesterOnlyFactor : capped
  return isHalf(cca) ? semester * config.halfCcaBaseFactor : semester
}

export function incomingMult(m: Membership, config: ScenarioConfig): number {
  const role = activeIncomingRole(m)
  return role === 'none' ? 1 : config.incomingMultiplier[role]
}

function tierMultiplier(cca: Cca, config: ScenarioConfig): number {
  if (cca.outgoingTier === null) {
    throw new Error(`CCA ${cca.ccaID} has an outgoing leader but no outgoing tier`)
  }
  const tier = config.outgoingTiers.find((t) => t.name === cca.outgoingTier)
  if (!tier) {
    throw new Error(`CCA ${cca.ccaID}: unknown outgoing tier "${cca.outgoingTier}"`)
  }
  return tier.multiplier
}

function manualMultiplier(cca: Cca): number {
  if (cca.outgoingMultiplier === null) {
    throw new Error(`CCA ${cca.ccaID} has an outgoing leader but no outgoing multiplier`)
  }
  return cca.outgoingMultiplier
}

export function outgoingMult(m: Membership, cca: Cca, config: ScenarioConfig): number {
  if (m.outgoingRole === 'none') return 1
  return config.outgoingMode === 'tier' ? tierMultiplier(cca, config) : manualMultiplier(cca)
}

/** Outgoing is never used for staying. */
export function stayMult(m: Membership, config: ScenarioConfig): number {
  return incomingMult(m, config)
}

function combine(incoming: number, outgoing: number, config: ScenarioConfig): number {
  switch (config.stackingMode) {
    case 'max':
      return Math.max(incoming, outgoing)
    case 'additive':
      return 1 + (incoming - 1) + (outgoing - 1)
    case 'multiplicative':
      return incoming * outgoing
  }
}

export function bidMult(m: Membership, cca: Cca, config: ScenarioConfig): number {
  const hasIncoming = activeIncomingRole(m) !== 'none'
  const hasOutgoing = m.outgoingRole !== 'none'
  const incoming = incomingMult(m, config)
  const outgoing = outgoingMult(m, cca, config)
  if (hasIncoming && hasOutgoing) return combine(incoming, outgoing, config)
  return hasOutgoing ? outgoing : incoming
}

export function placementPoints(cca: Cca, config: ScenarioConfig): number {
  const bonus = config.placementBonus[cca.placement]
  return isHalf(cca) && config.halfCcaPlacementHalved ? bonus * HALF_PLACEMENT_FACTOR : bonus
}

/** Sum of the IHG points a resident earned in one sport. */
export function ihgPointsForCca(
  ihg: readonly IhgEntry[],
  ccaID: string,
  config: ScenarioConfig,
): number {
  return ihg
    .filter((entry) => entry.ccaID === ccaID)
    .reduce((sum, entry) => sum + config.ihgPoints[entry.placement], 0)
}

export const FLAT_TEXT = 'Flat points (set by JCRC)'

/** A flat or overridden membership: exactly `note.value`, never multiplied, halved, merged or given IHG. */
function finalResult(cca: Cca, note: FinalNote): MembershipResult {
  return {
    ccaID: cca.ccaID,
    isHalf: false,
    effBase: 0,
    inMult: 1,
    outMult: 1,
    stayMult: 1,
    bidMult: 1,
    placement: 0,
    ihgNet: 0,
    stayNet: note.value,
    bidNet: note.value,
    final: note,
  }
}

/** Precedence: final-points override > flat value > normal calculation (spec 4.1). */
export function finalNoteOf(m: Membership, override: FinalOverride | undefined): FinalNote | null {
  if (override) {
    const reason = override.reason.trim()
    return {
      kind: 'override',
      value: override.finalPoints,
      reason,
      text: `Final points set by JCRC: ${override.finalPoints} — ${reason}`,
    }
  }
  if (m.flatPoints !== undefined) {
    return { kind: 'flat', value: m.flatPoints, reason: null, text: FLAT_TEXT }
  }
  return null
}

export function computeMembership(
  m: Membership,
  cca: Cca,
  ihg: readonly IhgEntry[],
  config: ScenarioConfig,
  override?: FinalOverride,
): MembershipResult {
  const note = finalNoteOf(m, override)
  if (note) return finalResult(cca, note)
  const base = effBase(m, cca, config)
  const inMult = incomingMult(m, config)
  const outMult = outgoingMult(m, cca, config)
  const stay = stayMult(m, config)
  const bid = bidMult(m, cca, config)
  const placement = placementPoints(cca, config)
  const ihgNet = config.ihgInSportNet ? ihgPointsForCca(ihg, cca.ccaID, config) : 0
  return {
    ccaID: cca.ccaID,
    isHalf: isHalf(cca),
    effBase: base,
    inMult,
    outMult,
    stayMult: stay,
    bidMult: bid,
    placement,
    ihgNet,
    stayNet: base * stay + placement + ihgNet,
    bidNet: base * bid + placement + ihgNet,
    final: null,
  }
}
