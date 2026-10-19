import { describe, expect, it } from 'vitest'
import { DEFAULT_CONFIG, computeAll, createPenaltyState } from '../../engine'
import { leaderFileName, leaderRows, matricOf, patchRow, scenario, withSettings } from '../../import/__tests__/fixtures'
import { initialState, reducer, type AppState } from '../state/store'

const failingC1 = scenario({
  leaders: { C1: leaderRows('C1', [20, 20, 20, 20, 20, 20]), C2: leaderRows('C2') },
})

const unknownMatricC1 = scenario({
  leaders: { C1: patchRow(leaderRows('C1'), -1, { matric: matricOf(99) }), C2: leaderRows('C2') },
})

const withFiles = (files = scenario()): AppState => reducer(initialState(), { type: 'addFiles', files })

describe('app reducer', () => {
  it('starts empty and blocked', () => {
    const state = initialState()
    expect(state.files).toEqual([])
    expect(state.report.canCompute).toBe(false)
    expect(state.results).toBeNull()
  })

  it('starts with no final-points overrides, discretion or wheel resolutions', () => {
    const state = initialState()
    expect(state.finalOverrides).toEqual([])
    expect(state.discretion).toEqual([])
    expect(state.resolutions).toEqual([])
  })

  it('validates as soon as files are added', () => {
    const state = withFiles()
    expect(state.report.canCompute).toBe(true)
    expect(state.report.input?.residents).toHaveLength(10)
  })

  it('replaces a file dropped again under the same name', () => {
    const broken = withFiles(unknownMatricC1)
    expect(broken.report.canCompute).toBe(false)
    const fixed = scenario().find((f) => f.name === leaderFileName('C1'))
    if (!fixed) throw new Error('fixture missing')
    const next = reducer(broken, { type: 'addFiles', files: [fixed] })
    expect(next.files).toHaveLength(broken.files.length)
    expect(next.files.filter((f) => f.name === fixed.name)).toEqual([fixed])
    expect(next.report.canCompute).toBe(true)
  })

  it('removes a file by name', () => {
    const state = reducer(withFiles(), { type: 'removeFile', name: 'residents.csv' })
    expect(state.files.map((f) => f.name)).not.toContain('residents.csv')
    expect(state.report.issues.map((i) => i.code)).toContain('MISSING_RESIDENTS_FILE')
  })

  it('re-validates on a config change and keeps state immutable', () => {
    const before = withFiles()
    const config = { ...DEFAULT_CONFIG, meanSdDefault: { ...DEFAULT_CONFIG.meanSdDefault, meanMax: 11 } }
    const after = reducer(before, { type: 'setConfig', config })
    expect(after.report.perCca[0]?.status).toBe('out_of_range')
    expect(after.report.canCompute).toBe(true)
    expect(before.report.perCca[0]?.status).toBe('ok')
    expect(after).not.toBe(before)
  })

  describe('finalise and penalties', () => {
    const ready = (): AppState => {
      const state = withFiles(withSettings(scenario()))
      const input = state.report.input
      if (!input) throw new Error('expected input')
      return reducer(state, { type: 'setResults', results: computeAll(input, state.config), error: null })
    }
    const finalised = (): AppState => {
      const state = ready()
      if (!state.results) throw new Error('expected results')
      return reducer(state, { type: 'finalise', penalty: createPenaltyState(state.results.lists) })
    }
    const entry = { key: { matric: 'A9900001Z', ccaID: 'C1' }, residentName: 'Test Resident 001', ccaName: 'Test CCA One', outcome: 'Stays green' }

    it('locks settings and files', () => {
      const state = finalised()
      expect(state.finalised).not.toBeNull()
      expect(reducer(state, { type: 'setConfig', config: { ...state.config, sem2Factor: 9 } })).toBe(state)
      expect(reducer(state, { type: 'addFiles', files: failingC1 })).toBe(state)
      expect(reducer(state, { type: 'removeFile', name: 'residents.csv' })).toBe(state)
    })

    it('cannot finalise while the import is blocked', () => {
      const blocked = withFiles(unknownMatricC1)
      expect(reducer(blocked, { type: 'finalise', penalty: { cutoffs: { M: null, F: null }, applied: [], removed: [] } }).finalised).toBeNull()
    })

    it('records and undoes penalties', () => {
      const state = finalised()
      const penalty = { ...(state.finalised?.penalty ?? { cutoffs: { M: null, F: null }, removed: [] }), applied: [entry.key] }
      const applied = reducer(state, { type: 'applyPenalty', penalty, entry })
      expect(applied.finalised?.log).toEqual([entry])
      const undone = reducer(applied, { type: 'undoPenalty', penalty: { ...penalty, applied: [] }, key: entry.key })
      expect(undone.finalised?.log).toEqual([])
      expect(undone.finalised?.penalty.applied).toEqual([])
    })

    it('unlock clears every penalty and allows changes again', () => {
      const state = finalised()
      const withPenalty = reducer(state, { type: 'applyPenalty', penalty: state.finalised?.penalty ?? createPenaltyState({ maleStaying: [], femaleStaying: [], maleBidding: [], femaleBidding: [], sem2: [] }), entry })
      const unlocked = reducer(withPenalty, { type: 'unlock' })
      expect(unlocked.finalised).toBeNull()
      const changed = reducer(unlocked, { type: 'setConfig', config: { ...unlocked.config, sem2Factor: 9 } })
      expect(changed.config.sem2Factor).toBe(9)
    })

    it('ignores penalty actions when not finalised', () => {
      const state = ready()
      const penalty = { cutoffs: { M: null, F: null }, applied: [], removed: [] }
      expect(reducer(state, { type: 'applyPenalty', penalty, entry })).toBe(state)
      expect(reducer(state, { type: 'undoPenalty', penalty, key: entry.key })).toBe(state)
    })
  })

  it('stores results, and drops them when the import becomes blocked', () => {
    const state = withFiles()
    const input = state.report.input
    if (!input) throw new Error('expected input')
    const computed = reducer(state, { type: 'setResults', results: computeAll(input, state.config), error: null })
    expect(computed.results?.lists.maleStaying.length).toBeGreaterThan(0)
    const blocked = reducer(computed, { type: 'removeFile', name: 'ccas.csv' })
    expect(blocked.results).toBeNull()
  })
})
