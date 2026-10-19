import { describe, expect, it } from 'vitest'
import { leaderRows, matricOf, patchRow, scenario } from '../../import/__tests__/fixtures'
import { initialState, reducer, type AppState } from '../state/store'
import {
  BUNDLE_FIRST,
  CHECKLIST_FIRST,
  COMPARE_NEEDS_DATA,
  COMPARE_NEEDS_SCENARIO,
  stepLocks,
} from '../state/stepLocks'

const load = (files = scenario()): AppState => reducer(initialState(), { type: 'addFiles', files })
const AT = '2027-04-02T10:00:00.000Z'

/** C1 has a leader file; C2 is missing unless marked. */
const oneMissing = (): AppState => load(scenario({ leaders: { C1: leaderRows('C1') } }))
const badMatric = (): AppState =>
  load(scenario({ leaders: { C1: patchRow(leaderRows('C1'), -1, { matric: matricOf(99) }), C2: leaderRows('C2') } }))

describe('stepLocks', () => {
  it('locks everything after Import when no files are loaded', () => {
    const locks = stepLocks(initialState(), 0)
    expect(locks.import).toBeNull()
    expect(locks.checklist).toBe(BUNDLE_FIRST)
    expect(locks.review).toBe(BUNDLE_FIRST)
    expect(locks.summary).toBe(BUNDLE_FIRST)
    expect(locks.results).toBe(BUNDLE_FIRST)
    expect(locks.publish).toBe(BUNDLE_FIRST)
    expect(locks.compare).toBe(COMPARE_NEEDS_DATA)
  })

  it('locks the checklist with "Load the RH-app bundle first" when files are loaded without a bundle', () => {
    const locks = stepLocks(load(scenario({ bundle: null })), 0)
    expect(locks.checklist).toBe('Load the RH-app bundle first')
    expect(locks.review).toBe(BUNDLE_FIRST)
  })

  it('opens the checklist but locks Review while a CCA is missing', () => {
    const locks = stepLocks(oneMissing(), 0)
    expect(locks.checklist).toBeNull()
    expect(locks.review).toBe('Complete the checklist first')
    expect(CHECKLIST_FIRST).toBe('Complete the checklist first')
    expect(locks.summary).toBe(CHECKLIST_FIRST)
    expect(locks.results).toBe(CHECKLIST_FIRST)
    expect(locks.publish).toBe(CHECKLIST_FIRST)
  })

  it('opens Review once the missing CCA is marked not submitting', () => {
    const state = reducer(oneMissing(), { type: 'setNotSubmitting', mark: { ccaID: 'C2', note: '', at: AT } })
    const locks = stepLocks(state, 0)
    expect(locks.review).toBeNull()
    expect(locks.summary).toBeNull()
    expect(locks.results).toBeNull()
  })

  it('opens Summary once Review is open and the import computes', () => {
    expect(stepLocks(load(), 0).summary).toBeNull()
  })

  it('opens every step on a clean import', () => {
    const locks = stepLocks(load(), 1)
    expect(Object.values(locks).every((lock) => lock === null)).toBe(true)
  })

  it('locks Summary, Results and Publish with the block reason while the import has errors', () => {
    const state = badMatric()
    const locks = stepLocks(state, 0)
    expect(locks.review).toBeNull()
    expect(locks.summary).toBe('1 error to fix')
    expect(locks.results).toBe('1 error to fix')
    expect(locks.publish).toBe('1 error to fix')
  })

  it('keeps Results and Publish (not Summary) reachable when the settings caused the block', () => {
    const locks = stepLocks(badMatric(), 0, true)
    expect(locks.summary).toBe('1 error to fix')
    expect(locks.results).toBeNull()
    expect(locks.publish).toBeNull()
  })

  it('does not let the settings exception skip an incomplete checklist', () => {
    const locks = stepLocks(oneMissing(), 0, true)
    expect(locks.results).toBe(CHECKLIST_FIRST)
  })

  it('locks Compare until data passes and a scenario is saved', () => {
    expect(stepLocks(badMatric(), 3).compare).toBe(COMPARE_NEEDS_DATA)
    expect(stepLocks(load(), 0).compare).toBe(COMPARE_NEEDS_SCENARIO)
    expect(stepLocks(load(), 2).compare).toBeNull()
  })
})
