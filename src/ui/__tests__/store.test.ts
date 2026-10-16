import { describe, expect, it } from 'vitest'
import { DEFAULT_CONFIG, computeAll } from '../../engine'
import { leaderFileName, leaderRows, scenario } from '../../import/__tests__/fixtures'
import { initialState, reducer, type AppState } from '../state/store'

const failingC1 = scenario({
  leaders: { C1: leaderRows('C1', [20, 20, 20, 20, 20, 20]), C2: leaderRows('C2') },
})

const withFiles = (files = scenario()): AppState => reducer(initialState(), { type: 'addFiles', files })

describe('app reducer', () => {
  it('starts empty and blocked', () => {
    const state = initialState()
    expect(state.files).toEqual([])
    expect(state.report.canCompute).toBe(false)
    expect(state.results).toBeNull()
  })

  it('validates as soon as files are added', () => {
    const state = withFiles()
    expect(state.report.canCompute).toBe(true)
    expect(state.report.input?.residents).toHaveLength(10)
  })

  it('replaces a file dropped again under the same name', () => {
    const broken = withFiles(failingC1)
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

  it('toggles an override on and off', () => {
    const on = reducer(withFiles(failingC1), { type: 'toggleOverride', ccaID: 'C1' })
    expect(on.overrides).toEqual(['C1'])
    expect(on.report.canCompute).toBe(true)
    expect(on.report.perCca[0]?.status).toBe('overridden')
    const off = reducer(on, { type: 'toggleOverride', ccaID: 'C1' })
    expect(off.overrides).toEqual([])
    expect(off.report.canCompute).toBe(false)
  })

  it('re-validates on a config change and keeps state immutable', () => {
    const before = withFiles()
    const config = { ...DEFAULT_CONFIG, meanSdDefault: { ...DEFAULT_CONFIG.meanSdDefault, meanMax: 11 } }
    const after = reducer(before, { type: 'setConfig', config })
    expect(after.report.canCompute).toBe(false)
    expect(before.report.canCompute).toBe(true)
    expect(after).not.toBe(before)
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
