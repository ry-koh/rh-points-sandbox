import { describe, expect, it } from 'vitest'
import { applyPenalty, createPenaltyState, removePenalty } from '../penalty'
import { computeAll } from '../pipeline'
import type { ListRow, PenaltyKey, PenaltyState, PipelineInput } from '../types'
import { configWith, deepFreeze, makeInput, type RowSpec } from './helpers'

const INFORMATIONAL = 'informational — rooms may already be picked'
const config = configWith({ maleGreen: 2, maleGrey: 2, sem2Green: 1 })

// Male staying (one slot per CCA, weights 1): M1 33, M2 18, M3 17, M4 15.6, M5 14.4, M6 10.
// Green M1 M2 | grey M3 M4 | white M5 M6. Frozen cut-off = 18 (M2). Every dropped role: base -> 8.
const ROWS: RowSpec[] = [
  { id: 'M1', base: 20, incoming: 'head', extra: [['Y', 9]] },
  { id: 'M2', base: 15, incoming: 'head' },
  { id: 'M3', base: 17 },
  { id: 'M4', base: 13, incoming: 'head' },
  { id: 'M5', base: 12, incoming: 'head' },
  { id: 'M6', base: 10 },
  { id: 'S1', gender: 'F', sem2: true, base: 14, incoming: 'head' },
  { id: 'S2', gender: 'F', sem2: true, base: 15 },
]
const input = makeInput(ROWS)
const initial = createPenaltyState(computeAll(input, config).lists)

const key = (matric: string): PenaltyKey => ({ matric, ccaID: 'X' })

function apply(from: PenaltyState, matric: string, data: PipelineInput = input): PenaltyState {
  const result = applyPenalty(data, config, from, key(matric))
  if (!result.ok) throw new Error(result.error)
  return result.state
}

const maleStaying = (state: PenaltyState): ListRow[] =>
  [...computeAll(input, config, { penaltyState: state }).lists.maleStaying]
const statusOf = (rows: readonly ListRow[], id: string): string | null | undefined =>
  rows.find((r) => r.matric === id)?.status
const order = (rows: readonly ListRow[]): string[] => rows.map((r) => r.matric)

describe('createPenaltyState', () => {
  it('freezes the lowest green staying points per gender', () => {
    expect(initial.cutoffs.M).toBe(18)
    expect(initial.cutoffs.F).toBeNull()
    expect(initial.applied).toEqual([])
    expect(initial.removed).toEqual([])
  })

  it('has no cut-off when nobody is green', () => {
    const none = createPenaltyState(computeAll(input, configWith({})).lists)
    expect(none.cutoffs.M).toBeNull()
  })
})

describe('green resident', () => {
  it('dropping below the cut-off is removed; top grey moves up and top white moves to grey', () => {
    const rows = maleStaying(apply(initial, 'M2'))
    expect(order(rows)).toEqual(['M1', 'M3', 'M4', 'M5', 'M6', 'M2'])
    expect(rows.map((r) => r.status)).toEqual(['green', 'green', 'grey', 'grey', 'white', 'removed'])
  })

  it('shows the removed resident at the bottom with recomputed points', () => {
    const removed = maleStaying(apply(initial, 'M2')).at(-1)
    expect(removed?.matric).toBe('M2')
    expect(removed?.points).toBe(8)
    expect(apply(initial, 'M2').removed).toEqual(['M2'])
  })

  it('ending exactly at the cut-off stays green', () => {
    const data = makeInput([
      { id: 'P1', base: 10, incoming: 'head' },
      { id: 'P2', base: 8 },
      { id: 'P3', base: 5 },
    ])
    const cfg = configWith({ maleGreen: 2, maleGrey: 1 })
    const start = createPenaltyState(computeAll(data, cfg).lists)
    const result = applyPenalty(data, cfg, start, key('P1'))
    expect(start.cutoffs.M).toBe(8)
    expect(result.ok && result.state.removed).toEqual([])
    const rows = result.ok ? computeAll(data, cfg, { penaltyState: result.state }).lists.maleStaying : []
    expect(statusOf(rows, 'P1')).toBe('green')
    expect(rows.find((r) => r.matric === 'P1')?.points).toBe(8)
  })

  it('a second penalty uses the ORIGINAL frozen cut-off', () => {
    const afterFirst = apply(initial, 'M2')
    // M1 drops to 8 + 9 = 17: below the original cut-off 18, not below the current lowest green (17).
    const afterSecond = apply(afterFirst, 'M1')
    expect(afterSecond.cutoffs.M).toBe(18)
    expect(afterSecond.removed).toEqual(['M2', 'M1'])
    const rows = maleStaying(afterSecond)
    expect(order(rows).slice(0, 4)).toEqual(['M3', 'M4', 'M5', 'M6'])
    expect(rows.slice(0, 4).map((r) => r.status)).toEqual(['green', 'green', 'grey', 'grey'])
  })
})

describe('grey and white residents', () => {
  it('a grey resident who drops is re-sorted and may fall to white', () => {
    const state = apply(initial, 'M4')
    expect(state.removed).toEqual([])
    const rows = maleStaying(state)
    expect(order(rows)).toEqual(['M1', 'M2', 'M3', 'M5', 'M6', 'M4'])
    expect(rows.map((r) => r.status)).toEqual(['green', 'green', 'grey', 'grey', 'white', 'white'])
  })

  it('a white resident is just recomputed', () => {
    const state = apply(initial, 'M5')
    expect(state.removed).toEqual([])
    const rows = maleStaying(state)
    expect(order(rows)).toEqual(['M1', 'M2', 'M3', 'M4', 'M6', 'M5'])
    expect(statusOf(rows, 'M5')).toBe('white')
    expect(rows.find((r) => r.matric === 'M5')?.points).toBe(8)
  })
})

describe('rejections', () => {
  it('rejects a membership with no incoming role, as an error result', () => {
    const result = applyPenalty(input, config, initial, key('M3'))
    expect(result.ok).toBe(false)
    expect(!result.ok && result.error).toMatch(/incoming/i)
  })

  it('rejects an unknown membership', () => {
    const result = applyPenalty(input, config, initial, { matric: 'M1', ccaID: 'Nope' })
    expect(result.ok).toBe(false)
  })

  it('applying the same penalty twice changes nothing', () => {
    const once = apply(initial, 'M2')
    expect(apply(once, 'M2')).toEqual(once)
  })
})

describe('sem-2 residents', () => {
  const state = apply(initial, 'S1')

  it('only recompute and re-sort the sem-2 list', () => {
    const before = computeAll(input, config, { penaltyState: initial }).lists.sem2
    const after = computeAll(input, config, { penaltyState: state }).lists.sem2
    expect(order(before)).toEqual(['S1', 'S2'])
    expect(order(after)).toEqual(['S2', 'S1'])
    expect(after.map((r) => r.status)).toEqual(['green', 'white'])
  })

  it('never remove anyone and leave the male staying list untouched', () => {
    expect(state.removed).toEqual([])
    expect(state.cutoffs).toEqual(initial.cutoffs)
    expect(order(maleStaying(state))).toEqual(order(maleStaying(initial)))
  })
})

describe('bidding rows', () => {
  it('mark a resident with a dropped role as informational on every bidding list', () => {
    const lists = computeAll(input, config, { penaltyState: apply(apply(initial, 'M2'), 'S1') }).lists
    const labelsOf = (rows: readonly ListRow[], id: string): readonly string[] =>
      rows.find((r) => r.matric === id)?.labels ?? []
    expect(labelsOf(lists.maleBidding, 'M2')).toContain(INFORMATIONAL)
    expect(labelsOf(lists.maleBidding, 'M3')).not.toContain(INFORMATIONAL)
    expect(labelsOf(lists.sem2, 'S1')).toContain(INFORMATIONAL)
    expect(labelsOf(lists.sem2, 'S2')).not.toContain(INFORMATIONAL)
  })

  it('keep a removed resident on the bidding list with status removed', () => {
    const lists = computeAll(input, config, { penaltyState: apply(initial, 'M2') }).lists
    expect(statusOf(lists.maleBidding, 'M2')).toBe('removed')
  })
})

describe('removePenalty', () => {
  it('undoes one penalty by replaying the rest against the same frozen cut-offs', () => {
    const both = apply(apply(initial, 'M2'), 'M1')
    const result = removePenalty(input, config, both, key('M2'))
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.state.applied).toEqual([key('M1')])
    expect(result.state.removed).toEqual(['M1'])
    expect(result.state.cutoffs.M).toBe(18)
  })

  it('removing every penalty returns the initial state', () => {
    const result = removePenalty(input, config, apply(initial, 'M2'), key('M2'))
    expect(result.ok && result.state).toEqual(initial)
  })

  it('rejects a penalty that was never applied', () => {
    expect(removePenalty(input, config, initial, key('M2')).ok).toBe(false)
  })
})

describe('immutability', () => {
  it('does not mutate the input or the state', () => {
    const frozenInput = deepFreeze(makeInput(ROWS))
    const frozenState = deepFreeze(createPenaltyState(computeAll(frozenInput, config).lists))
    const next = apply(frozenState, 'M2', frozenInput)
    expect(() => removePenalty(frozenInput, config, next, key('M2'))).not.toThrow()
    expect(frozenState.applied).toEqual([])
  })
})
