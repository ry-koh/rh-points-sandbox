import { buildLists } from './lists'
import type { PenaltyView } from './lists'
import { computeResident } from './resident'
import type {
  Membership,
  PenaltyKey,
  PenaltyState,
  PipelineInput,
  PipelineResult,
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

/** The single entry point for the UI: results, the five lists and every warning. */
export function computeAll(
  input: PipelineInput,
  config: ScenarioConfig,
  penalty?: PenaltyState,
): PipelineResult {
  const ccas = Object.fromEntries(input.ccas.map((cca) => [cca.ccaID, cca]))
  const byMatric = groupByMatric(withDroppedRoles(input.memberships, penalty?.applied ?? []))
  const results = input.residents.map((resident) =>
    computeResident(resident, byMatric.get(resident.matric) ?? [], ccas, input.ihg, config),
  )
  return {
    results,
    lists: buildLists(results, input.residents, config, penaltyView(penalty)),
    warnings: results.flatMap((result) => result.warnings),
  }
}
