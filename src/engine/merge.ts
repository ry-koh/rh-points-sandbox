import { COMPARE_DECIMALS, MAX_EXHAUSTIVE_HALVES, WEIGHT_TAIL_RATIO } from './defaults'
import type { PairedIds, ScenarioConfig, Slot, WeightedSlot } from './types'

export interface SlotChoice {
  readonly slots: readonly WeightedSlot[]
  readonly total: number
  readonly pairs: readonly PairedIds[]
  readonly greedy: boolean
}

type Pairing = readonly PairedIds[]

export function roundForCompare(value: number): number {
  return Number(value.toFixed(COMPARE_DECIMALS))
}

/** Weight of the slot at 0-indexed `index`; positions past the array keep halving. */
export function slotWeight(index: number, config: ScenarioConfig): number {
  const weights = config.stayingWeights
  const last = weights[weights.length - 1]
  if (last === undefined) return 0
  const configured = weights[index]
  if (configured !== undefined) return configured
  return last * WEIGHT_TAIL_RATIO ** (index - weights.length + 1)
}

function slotKey(slot: Slot): string {
  return slot.ccaIDs.join('+')
}

function compareText(a: string, b: string): number {
  if (a < b) return -1
  return a > b ? 1 : 0
}

function bySlotOrder(a: Slot, b: Slot): number {
  const byValue = roundForCompare(b.value) - roundForCompare(a.value)
  return byValue !== 0 ? byValue : compareText(slotKey(a), slotKey(b))
}

/** Sorts descending (ties by ccaID) and applies the position weights. */
export function weighSlots(
  slots: readonly Slot[],
  config: ScenarioConfig,
): { readonly slots: readonly WeightedSlot[]; readonly total: number } {
  const weighted = [...slots].sort(bySlotOrder).map((slot, index): WeightedSlot => {
    const weight = slotWeight(index, config)
    return { ...slot, weight, contribution: slot.value * weight }
  })
  const total = weighted.reduce((sum, slot) => sum + slot.contribution, 0)
  return { slots: weighted, total }
}

function pairOf(a: string, b: string): PairedIds {
  return a < b ? [a, b] : [b, a]
}

/** Every set of disjoint pairs (including the empty set) over `ids`. */
export function enumeratePairings(ids: readonly string[]): readonly Pairing[] {
  const walk = (rest: readonly string[]): Pairing[] => {
    const [first, ...others] = rest
    if (first === undefined) return [[]]
    const leaveFirst = walk(others)
    const pairFirst = others.flatMap((partner, i) => {
      const remaining = [...others.slice(0, i), ...others.slice(i + 1)]
      return walk(remaining).map((pairing): Pairing => [pairOf(first, partner), ...pairing])
    })
    return [...leaveFirst, ...pairFirst]
  }
  return walk([...ids].sort(compareText))
}

function pairKeys(pairing: Pairing): string[] {
  return pairing.map(([a, b]) => `${a}+${b}`).sort(compareText)
}

function compareKeyLists(a: readonly string[], b: readonly string[]): number {
  for (let i = 0; i < Math.min(a.length, b.length); i += 1) {
    const result = compareText(a[i] ?? '', b[i] ?? '')
    if (result !== 0) return result
  }
  return a.length - b.length
}

function applyPairing(fixed: readonly Slot[], halves: readonly Slot[], pairing: Pairing): Slot[] {
  const valueById = new Map(halves.map((half) => [slotKey(half), half.value]))
  const merged = pairing.map(
    ([a, b]): Slot => ({ ccaIDs: [a, b], value: (valueById.get(a) ?? 0) + (valueById.get(b) ?? 0) }),
  )
  const paired = new Set(pairing.flat())
  const unpaired = halves.filter((half) => !paired.has(slotKey(half)))
  return [...fixed, ...unpaired, ...merged]
}

function evaluate(
  fixed: readonly Slot[],
  halves: readonly Slot[],
  pairing: Pairing,
  config: ScenarioConfig,
): SlotChoice {
  const { slots, total } = weighSlots(applyPairing(fixed, halves, pairing), config)
  return { slots, total, pairs: pairing, greedy: false }
}

/** Better = higher total, then fewer pairs, then lowest sorted pair keys. */
function isBetter(candidate: SlotChoice, best: SlotChoice): boolean {
  const byTotal = roundForCompare(candidate.total) - roundForCompare(best.total)
  if (byTotal !== 0) return byTotal > 0
  if (candidate.pairs.length !== best.pairs.length) {
    return candidate.pairs.length < best.pairs.length
  }
  return compareKeyLists(pairKeys(candidate.pairs), pairKeys(best.pairs)) < 0
}

function greedyPairing(halves: readonly Slot[]): Pairing {
  const ordered = [...halves].sort(bySlotOrder).map(slotKey)
  const pairs: PairedIds[] = []
  for (let i = 0; i + 1 < ordered.length; i += 2) {
    pairs.push(pairOf(ordered[i] ?? '', ordered[i + 1] ?? ''))
  }
  return pairs
}

/**
 * Builds the staying slots from the fixed (1x) slots and the 0.5x slots,
 * choosing the half-CCA pairing that maximises the weighted total.
 */
export function chooseSlots(
  fixed: readonly Slot[],
  halves: readonly Slot[],
  config: ScenarioConfig,
): SlotChoice {
  if (!config.mergeHalfCcas || halves.length < 2) {
    return evaluate(fixed, halves, [], config)
  }
  if (halves.length > MAX_EXHAUSTIVE_HALVES) {
    return { ...evaluate(fixed, halves, greedyPairing(halves), config), greedy: true }
  }
  const candidates = enumeratePairings(halves.map(slotKey)).map((pairing) =>
    evaluate(fixed, halves, pairing, config),
  )
  return candidates.reduce((best, candidate) => (isBetter(candidate, best) ? candidate : best))
}
