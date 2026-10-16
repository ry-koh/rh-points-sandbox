import { applyDiscretion, checkDiscretion } from './discretion'
import { highestOtherBidding, jcrcResult } from './jcrc'
import { buildLists } from './lists'
import type { PenaltyView } from './lists'
import { checkOverrides } from './overrides'
import { computeResident } from './resident'
import type {
  ComputeOptions,
  Discretion,
  FinalOverride,
  Membership,
  PenaltyKey,
  PenaltyState,
  PipelineInput,
  PipelineResult,
  Resident,
  ResidentResult,
  ScenarioConfig,
} from './types'

export function penaltyKeyOf(key: PenaltyKey | Membership): string {
  return `${key.matric}|${key.ccaID}`
}

function groupByMatric(memberships: readonly Membership[]): Map<string, Membership[]> {
  const groups = new Map<string, Membership[]>()
  for (const membership of memberships) {
    groups.set(membership.matric, [...(groups.get(membership.matric) ?? []), membership])
  }
  return groups
}

function withDroppedRoles(
  memberships: readonly Membership[],
  applied: readonly PenaltyKey[],
): Membership[] {
  const dropped = new Set(applied.map(penaltyKeyOf))
  return memberships.map((m) => (dropped.has(penaltyKeyOf(m)) ? { ...m, roleDropped: true } : m))
}

function penaltyView(penalty: PenaltyState | undefined): PenaltyView | undefined {
  if (!penalty) return undefined
  return {
    removed: new Set(penalty.removed),
    dropped: new Set(penalty.applied.map((key) => key.matric)),
  }
}

function jcrcMode(resident: Resident): 'FULL' | 'EXCHANGE' | null {
  return resident.jcrc === 'N' ? null : resident.jcrc
}

/**
 * Results in input order: every non-JCRC resident first (with discretion last), then H from
 * their final bidding, then the JCRC residents from H (spec 4.0).
 */
function computeResults(
  input: PipelineInput,
  config: ScenarioConfig,
  memberships: ReadonlyMap<string, Membership[]>,
  overrides: readonly FinalOverride[],
  discretion: ReadonlyMap<string, Discretion>,
): ResidentResult[] {
  const ccas = Object.fromEntries(input.ccas.map((cca) => [cca.ccaID, cca]))
  const done = new Map<string, ResidentResult>()
  for (const resident of input.residents) {
    if (jcrcMode(resident)) continue
    const result = computeResident(resident, memberships.get(resident.matric) ?? [], ccas, input.ihg, config, overrides)
    done.set(resident.matric, applyDiscretion(result, discretion.get(resident.matric)))
  }
  const h = highestOtherBidding(input.residents, done)
  for (const resident of input.residents) {
    const mode = jcrcMode(resident)
    if (!mode) continue
    done.set(resident.matric, applyDiscretion(jcrcResult(resident, mode, h, config), discretion.get(resident.matric)))
  }
  return input.residents.flatMap((resident) => {
    const result = done.get(resident.matric)
    return result ? [result] : []
  })
}

/** The single entry point for the UI: results, the five lists and every warning. */
export function computeAll(
  input: PipelineInput,
  config: ScenarioConfig,
  options: ComputeOptions = {},
): PipelineResult {
  const { penaltyState, resolutions = [], overrides = [], discretion = [] } = options
  const checkedOverrides = checkOverrides(input.memberships, overrides)
  const checkedDiscretion = checkDiscretion(input.residents, discretion)
  const appliedOverrides = checkedOverrides.filter((c) => c.status === 'applied').map((c) => c.entry)
  const appliedDiscretion = new Map(
    checkedDiscretion.filter((c) => c.status === 'applied').map((c) => [c.entry.matric, c.entry]),
  )
  const byMatric = groupByMatric(withDroppedRoles(input.memberships, penaltyState?.applied ?? []))
  const results = computeResults(input, config, byMatric, appliedOverrides, appliedDiscretion)
  const built = buildLists(results, input.residents, config, penaltyView(penaltyState), resolutions)
  return {
    results,
    lists: built.lists,
    warnings: results.flatMap((result) => result.warnings),
    resolutions: built.resolutions,
    overrides: checkedOverrides,
    discretion: checkedDiscretion,
  }
}
