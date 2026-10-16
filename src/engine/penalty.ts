import { roundForCompare } from './merge'
import { computeAll, penaltyKeyOf } from './pipeline'
import type {
  Lists,
  ListRow,
  PenaltyKey,
  PenaltyResult,
  PenaltyState,
  PipelineInput,
  Resident,
  ScenarioConfig,
} from './types'

function lowestGreenPoints(rows: readonly ListRow[]): number | null {
  const greens = rows.filter((row) => row.status === 'green')
  return greens.at(-1)?.points ?? null
}

/** Freezes the green cut-offs from the lists before any penalty. */
export function createPenaltyState(initialLists: Lists): PenaltyState {
  return {
    cutoffs: {
      M: lowestGreenPoints(initialLists.maleStaying),
      F: lowestGreenPoints(initialLists.femaleStaying),
    },
    applied: [],
    removed: [],
  }
}

function isApplied(state: PenaltyState, key: PenaltyKey): boolean {
  return state.applied.some((applied) => penaltyKeyOf(applied) === penaltyKeyOf(key))
}

function validate(input: PipelineInput, key: PenaltyKey): string | null {
  const membership = input.memberships.find((m) => penaltyKeyOf(m) === penaltyKeyOf(key))
  if (!membership) return `No membership of ${key.matric} in ${key.ccaID}`
  if (!input.residents.some((r) => r.matric === key.matric)) return `Unknown resident ${key.matric}`
  if (membership.incomingRole === 'none') {
    return `${key.matric} has no incoming role in ${key.ccaID} to drop`
  }
  return null
}

function wasGreen(rows: readonly ListRow[], matric: string): boolean {
  return rows.find((row) => row.matric === matric)?.status === 'green'
}

/** Removed = was green in the current lists and falls strictly below the frozen cut-off. */
function fallsBelowCutoff(
  input: PipelineInput,
  config: ScenarioConfig,
  state: PenaltyState,
  nextApplied: readonly PenaltyKey[],
  resident: Resident,
): boolean {
  const cutoff = state.cutoffs[resident.gender]
  const alreadyRemoved = state.removed.includes(resident.matric)
  if (resident.sem2 || cutoff === null || alreadyRemoved) return false
  const { lists } = computeAll(input, config, state)
  const stayingRows = resident.gender === 'M' ? lists.maleStaying : lists.femaleStaying
  if (!wasGreen(stayingRows, resident.matric)) return false
  const after = computeAll(input, config, { ...state, applied: nextApplied })
  const points = after.results.find((r) => r.matric === resident.matric)?.staying.points
  return points !== undefined && roundForCompare(points) < roundForCompare(cutoff)
}

export function applyPenalty(
  input: PipelineInput,
  config: ScenarioConfig,
  state: PenaltyState,
  key: PenaltyKey,
): PenaltyResult {
  const error = validate(input, key)
  if (error !== null) return { ok: false, error }
  if (isApplied(state, key)) return { ok: true, state }
  const resident = input.residents.find((r) => r.matric === key.matric)
  if (!resident) return { ok: false, error: `Unknown resident ${key.matric}` }
  const applied = [...state.applied, key]
  const removed = fallsBelowCutoff(input, config, state, applied, resident)
    ? [...state.removed, key.matric]
    : state.removed
  return { ok: true, state: { ...state, applied, removed } }
}

/** Undo: replays the remaining penalties, in order, against the same frozen cut-offs. */
export function removePenalty(
  input: PipelineInput,
  config: ScenarioConfig,
  state: PenaltyState,
  key: PenaltyKey,
): PenaltyResult {
  if (!isApplied(state, key)) {
    return { ok: false, error: `No penalty applied to ${key.matric} in ${key.ccaID}` }
  }
  const remaining = state.applied.filter((a) => penaltyKeyOf(a) !== penaltyKeyOf(key))
  let current: PenaltyState = { cutoffs: state.cutoffs, applied: [], removed: [] }
  for (const next of remaining) {
    const result = applyPenalty(input, config, current, next)
    if (!result.ok) return result
    current = result.state
  }
  return { ok: true, state: current }
}
