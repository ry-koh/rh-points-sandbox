import { describe, expect, it } from 'vitest'
import { DEFAULT_CONFIG, computeAll, createPenaltyState, outgoingMult, type Membership, type ScenarioConfig } from '../../engine'
import type { AuxEdit, CcaLevelEntry, FlatEdit, IhgTickEdit, ReviewEdit } from '../../import'
import {
  BUNDLE_FILE_NAME,
  DEMO_LEVELS,
  baseCcas,
  flatCca,
  flatRows,
  leaderFileName,
  leaderRows,
  matricOf,
  patchRow,
  scenario,
} from '../../import/__tests__/fixtures'
import { initialState, reducer, vettableCcas, vettedLocked, type Action, type AppState } from '../state/store'

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
    const config = { ...DEFAULT_CONFIG, auxCap: 4 }
    const after = reducer(before, { type: 'setConfig', config })
    expect(after.report.issues.map((i) => i.code)).toContain('AUX_ABOVE_CAP')
    expect(after.report.canCompute).toBe(true)
    expect(before.report.issues.map((i) => i.code)).not.toContain('AUX_ABOVE_CAP')
    expect(after).not.toBe(before)
  })

  describe('finalise and penalties', () => {
    const ready = (): AppState => {
      const base = reducer(withFiles(scenario()), { type: 'setCcaLevelsAll', list: DEMO_LEVELS })
      const state = base.report.perCca.reduce((s, c) => reducer(s, { type: 'setVetted', ccaID: c.ccaID, at: '2027-04-02T10:00:00.000Z' }), base)
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
    const blocked = reducer(computed, { type: 'removeFile', name: BUNDLE_FILE_NAME })
    expect(blocked.results).toBeNull()
  })
})

const AT = '2027-04-02T10:00:00.000Z'
const run = (state: AppState, ...actions: Action[]): AppState => actions.reduce(reducer, state)
const codes = (state: AppState): string[] => state.report.issues.map((i) => i.code)
const edit = (to: number, patch: Partial<ReviewEdit> = {}): ReviewEdit =>
  ({ matric: matricOf(1), ccaID: 'C1', from: 8, to, reason: 'typo', at: AT, ...patch })
const levelEntry = (ccaID: string, level: string | null, patch: Partial<CcaLevelEntry> = {}): CcaLevelEntry =>
  ({ ccaID, level, bonusOverride: null, multiplierOverride: null, ...patch })

describe('review state', () => {
  it('starts empty, with no levels, on the import step', () => {
    const state = initialState()
    expect(state.review).toEqual({
      edits: [],
      log: [],
      vetted: [],
      notSubmitting: [],
      tickEdits: [],
      tickLog: [],
      flatEdits: [],
      flatLog: [],
      auxEdits: [],
      auxLog: [],
    })
    expect(state.ccaLevels).toEqual([])
    expect(state.step).toBe('import')
    expect(state.lastLevelChange).toBeNull()
  })

  it('keeps ONE active edit per matric+ccaID and logs every set', () => {
    const state = run(withFiles(), { type: 'setReviewEdit', entry: edit(9) }, { type: 'setReviewEdit', entry: edit(11, { reason: '' }) })
    expect(state.review.edits).toEqual([edit(11, { reason: '' })])
    expect(state.review.log).toEqual([{ ...edit(9), kind: 'edit' }, { ...edit(11, { reason: '' }), kind: 'edit' }])
    expect(state.report.review.edits.map((e) => e.status)).toEqual(['applied'])
  })

  it('removes an edit and logs it from the edited value back to the file value', () => {
    const state = run(withFiles(), { type: 'setReviewEdit', entry: edit(11) }, { type: 'removeReviewEdit', matric: matricOf(1), ccaID: 'C1', at: AT })
    expect(state.review.edits).toEqual([])
    expect(state.review.log.at(-1)).toEqual({ matric: matricOf(1), ccaID: 'C1', from: 11, to: 8, reason: '', at: AT, kind: 'remove' })
    expect(state.report.review.edits).toEqual([])
    expect(reducer(state, { type: 'removeReviewEdit', matric: matricOf(1), ccaID: 'C1', at: AT })).toBe(state)
  })

  it("setVetted stores the leader file's hash from the report, and clearVetted removes the mark", () => {
    const state = reducer(withFiles(), { type: 'setVetted', ccaID: 'C1', at: AT })
    const hash = state.report.perCca.find((c) => c.ccaID === 'C1')?.fileHash
    expect(hash).toMatch(/^[0-9a-f]{8}$/)
    expect(state.review.vetted).toEqual([{ ccaID: 'C1', fileHash: hash, at: AT }])
    expect(reducer(state, { type: 'setVetted', ccaID: 'C1', at: AT }).review.vetted).toHaveLength(1)
    expect(reducer(state, { type: 'clearVetted', ccaID: 'C1' }).review.vetted).toEqual([])
    expect(reducer(state, { type: 'clearVetted', ccaID: 'C2' })).toBe(state)
  })

  it('refuses to vet a CCA without a leader file (D25)', () => {
    const state = withFiles(scenario({ leaders: { C1: leaderRows('C1') } }))
    expect(reducer(state, { type: 'setVetted', ccaID: 'C2', at: AT })).toBe(state)
    expect(reducer(state, { type: 'setVetted', ccaID: 'NOPE', at: AT })).toBe(state)
  })

  it('a not-submitting mark reaches the validation, and clearing it brings the warning back', () => {
    const state = withFiles(scenario({ leaders: { C1: leaderRows('C1') } }))
    expect(codes(state)).toContain('NO_LEADER_FILE')
    const marked = reducer(state, { type: 'setNotSubmitting', mark: { ccaID: 'C2', note: '', at: AT } })
    expect(marked.review.notSubmitting).toEqual([{ ccaID: 'C2', note: '', at: AT }])
    expect(codes(marked)).not.toContain('NO_LEADER_FILE')
    const cleared = reducer(marked, { type: 'clearNotSubmitting', ccaID: 'C2' })
    expect(cleared.review.notSubmitting).toEqual([])
    expect(codes(cleared)).toContain('NO_LEADER_FILE')
    expect(reducer(cleared, { type: 'clearNotSubmitting', ccaID: 'C2' })).toBe(cleared)
  })
})

describe('level table', () => {
  it('a level entry turns a LEVEL_NOT_SET scenario into a clean one', () => {
    const state = withFiles()
    expect(codes(state)).toContain('LEVEL_NOT_SET')
    const set = run(state, ...DEMO_LEVELS.map((entry): Action => ({ type: 'setCcaLevel', entry })))
    expect(set.ccaLevels).toEqual(DEMO_LEVELS)
    expect(codes(set)).toEqual([])
  })

  it('setCcaLevel upserts, and an entry with nothing set removes it', () => {
    const state = run(withFiles(), { type: 'setCcaLevel', entry: levelEntry('C1', 'Pass') }, { type: 'setCcaLevel', entry: levelEntry('C1', 'High Gold') })
    expect(state.ccaLevels).toEqual([levelEntry('C1', 'High Gold')])
    expect(reducer(state, { type: 'setCcaLevel', entry: levelEntry('C1', null) }).ccaLevels).toEqual([])
  })

  it('setCcaLevelsAll replaces the table', () => {
    const state = run(withFiles(), { type: 'setCcaLevel', entry: levelEntry('C9', 'Pass') }, { type: 'setCcaLevelsAll', list: DEMO_LEVELS })
    expect(state.ccaLevels).toEqual(DEMO_LEVELS)
  })
})

describe('settings changes carry the level table (R44, D21)', () => {
  const levels = [
    { name: 'Pass', bonus: 0, multiplier: 1 },
    { name: 'Silver', bonus: 1.5, multiplier: 1.2 },
    { name: 'Gold', bonus: 4, multiplier: 1.3 },
  ]
  const config: ScenarioConfig = { ...DEFAULT_CONFIG, levels }
  type Levels = ScenarioConfig['levels']
  const withLevels = (next: Levels): Action => ({ type: 'setConfig', config: { ...config, levels: next } })
  const rename = (list: Levels, index: number, name: string): Levels => list.map((l, i) => (i === index ? { ...l, name } : l))
  const renumber = (name: string, patch: { bonus?: number; multiplier?: number }): Levels =>
    levels.map((l) => (l.name === name ? { ...l, ...patch } : l))
  const start = (): AppState =>
    run(initialState(config), { type: 'addFiles', files: scenario() }, { type: 'setCcaLevelsAll', list: [levelEntry('C1', 'Gold'), levelEntry('C2', 'Silver')] })
  const untouched = [levelEntry('C1', 'Gold'), levelEntry('C2', 'Silver')]

  it("renaming Gold to High Gold moves C1's entry", () => {
    const state = reducer(start(), withLevels(rename(levels, 2, 'High Gold')))
    expect(state.ccaLevels).toEqual([levelEntry('C1', 'High Gold'), levelEntry('C2', 'Silver')])
    expect(codes(state)).toEqual([])
  })

  it("typing a second 'Gold' then 'Gold 2' leaves the original Gold's CCAs alone", () => {
    const added = [...levels, { name: 'New level', bonus: 0, multiplier: 1 }]
    const state = run(start(), withLevels(added), withLevels(rename(added, 3, 'Gold')), withLevels(rename(added, 3, 'Gold 2')))
    expect(state.ccaLevels).toEqual(untouched)
  })

  it('removing a level does not touch entries (they become UNKNOWN_LEVEL)', () => {
    const state = reducer(start(), withLevels(levels.filter((l) => l.name !== 'Gold')))
    expect(state.ccaLevels).toEqual(untouched)
    expect(codes(state)).toContain('UNKNOWN_LEVEL')
  })

  it('Reset all does not touch entries', () => {
    const state = reducer(start(), { type: 'setConfig', config: DEFAULT_CONFIG })
    expect(state.ccaLevels).toEqual(untouched)
    expect(state.lastLevelChange).toBeNull()
  })

  it('a reorder renames and clears nothing', () => {
    expect(reducer(start(), withLevels([...levels].reverse())).ccaLevels).toEqual(untouched)
  })

  it('Gold ×1.3, Soccer tweaked to ×1.31, Gold → ×1.4 → Soccer has no multiplier tweak and uses ×1.4', () => {
    const before = reducer(start(), { type: 'setCcaLevel', entry: levelEntry('C1', 'Gold', { bonusOverride: 5, multiplierOverride: 1.31 }) })
    const state = reducer(before, withLevels(renumber('Gold', { multiplier: 1.4 })))
    expect(state.ccaLevels).toEqual([levelEntry('C1', 'Gold', { bonusOverride: 5 }), levelEntry('C2', 'Silver')])
    expect(state.lastLevelChange).toEqual({ level: 'Gold', clearedTweaks: 1 })
    const cca = state.report.input?.ccas.find((c) => c.ccaID === 'C1')
    if (!cca) throw new Error('expected C1')
    expect(outgoingMult({ outgoingRole: 'head' } as Membership, cca, state.config)).toBe(1.4)
  })

  it("editing a level's bonus clears only the bonus tweaks on that level", () => {
    const entries = [levelEntry('C1', 'Gold', { bonusOverride: 5, multiplierOverride: 1.31 }), levelEntry('C2', 'Silver', { bonusOverride: 2 })]
    const state = run(start(), { type: 'setCcaLevelsAll', list: entries }, withLevels(renumber('Gold', { bonus: 4.5 })))
    expect(state.ccaLevels).toEqual([levelEntry('C1', 'Gold', { multiplierOverride: 1.31 }), entries[1]])
    expect(state.lastLevelChange).toEqual({ level: 'Gold', clearedTweaks: 1 })
  })

  it('the cleared-tweaks note is dropped by the next unrelated change, but not by new results', () => {
    const state = run(start(), { type: 'setCcaLevel', entry: levelEntry('C1', 'Gold', { multiplierOverride: 1.31 }) }, withLevels(renumber('Gold', { multiplier: 1.4 })))
    expect(state.lastLevelChange).not.toBeNull()
    expect(reducer(state, { type: 'setResults', results: null, error: null }).lastLevelChange).not.toBeNull()
    expect(reducer(state, { type: 'setReviewEdit', entry: edit(9) }).lastLevelChange).toBeNull()
    expect(reducer(state, { type: 'setStep', step: 'results' }).lastLevelChange).toBeNull()
  })

  it('a number edit on a level no CCA tweaks records nothing', () => {
    expect(reducer(start(), withLevels(renumber('Pass', { bonus: 0.1 }))).lastLevelChange).toBeNull()
  })

  it('Gold ×1.3, Soccer vetted with tweak ×1.31, Gold → ×1.4 → no tweak, uses ×1.4, and is STILL vetted (D2 = B)', () => {
    const vetted = run(start(), { type: 'setCcaLevel', entry: levelEntry('C1', 'Gold', { multiplierOverride: 1.31 }) }, { type: 'setVetted', ccaID: 'C1', at: AT })
    const state = reducer(vetted, withLevels(renumber('Gold', { multiplier: 1.4 })))
    expect(state.ccaLevels).toEqual(untouched)
    expect(state.lastLevelChange).toEqual({ level: 'Gold', clearedTweaks: 1 })
    expect(state.review.vetted).toEqual(vetted.review.vetted)
    expect(vettedLocked(state, 'C1')).toBe(true)
    const cca = state.report.input?.ccas.find((c) => c.ccaID === 'C1')
    if (!cca) throw new Error('expected C1')
    expect(outgoingMult({ outgoingRole: 'head' } as Membership, cca, state.config)).toBe(1.4)
  })
})

describe('tick, flat and AUX edits', () => {
  const LATER = '2027-04-03T10:00:00.000Z'
  const SPORT = { ccaID: 'C4', ccaName: 'Touch Rugby (W)', type: '1x', sport: 'Y', ihgResult: '1st', ihgCap: '3' }
  const files = (flatValue = '12', c1 = leaderRows('C1')) =>
    scenario({
      ccas: [...baseCcas(), flatCca('C3', flatValue), SPORT],
      flat: flatRows('C3', flatValue),
      leaders: { C1: c1, C2: leaderRows('C2'), C4: leaderRows('C4', undefined, { ihg: [0] }) },
    })
  const loaded = (): AppState => reducer(reducer(initialState(), { type: 'addFiles', files: files() }), { type: 'markSaved', at: AT })
  const tick: IhgTickEdit = { matric: matricOf(1), ccaID: 'C4', from: true, to: false, reason: '', at: AT }
  const flat: FlatEdit = { matric: matricOf(1), ccaID: 'C3', from: 12, to: 10, reason: 'left early', at: AT }
  const aux: AuxEdit = { matric: matricOf(1), from: 5, to: 7, reason: '', at: AT }

  it('a tick edit is set once per membership, logged, and removed back to the file tick', () => {
    const set = run(loaded(), { type: 'setTickEdit', entry: { ...tick, reason: 'first' } }, { type: 'setTickEdit', entry: tick })
    expect(set.dirty).toBe(true)
    expect(set.review.tickEdits).toEqual([tick])
    expect(set.review.tickLog).toEqual([{ ...tick, reason: 'first', kind: 'edit' }, { ...tick, kind: 'edit' }])
    expect(set.report.review.tickEdits.map((e) => e.status)).toEqual(['applied'])
    const removed = reducer(set, { type: 'removeTickEdit', matric: matricOf(1), ccaID: 'C4', at: LATER })
    expect(removed.review.tickEdits).toEqual([])
    expect(removed.review.tickLog.at(-1)).toEqual({ matric: matricOf(1), ccaID: 'C4', from: false, to: true, reason: '', at: LATER, kind: 'remove' })
    expect(removed.report.review.tickEdits).toEqual([])
    expect(reducer(removed, { type: 'removeTickEdit', matric: matricOf(1), ccaID: 'C4', at: LATER })).toBe(removed)
  })

  it('a flat edit is set, logged, and removed from the edited value back to the flat value', () => {
    const set = reducer(loaded(), { type: 'setFlatEdit', entry: flat })
    expect(set.dirty).toBe(true)
    expect(set.review.flatEdits).toEqual([flat])
    expect(set.review.flatLog).toEqual([{ ...flat, kind: 'edit' }])
    expect(set.report.review.flatEdits.map((e) => e.status)).toEqual(['applied'])
    const removed = reducer(set, { type: 'removeFlatEdit', matric: matricOf(1), ccaID: 'C3', at: LATER })
    expect(removed.review.flatEdits).toEqual([])
    expect(removed.review.flatLog.at(-1)).toEqual({ matric: matricOf(1), ccaID: 'C3', from: 10, to: 12, reason: '', at: LATER, kind: 'remove' })
    expect(reducer(removed, { type: 'removeFlatEdit', matric: matricOf(1), ccaID: 'C3', at: LATER })).toBe(removed)
  })

  it('an AUX edit is set, logged, and removed back to the residents file count', () => {
    const set = reducer(loaded(), { type: 'setAuxEdit', entry: aux })
    expect(set.dirty).toBe(true)
    expect(set.review.auxEdits).toEqual([aux])
    expect(set.review.auxLog).toEqual([{ ...aux, kind: 'edit' }])
    expect(set.report.review.auxEdits.map((e) => e.status)).toEqual(['applied'])
    const removed = reducer(set, { type: 'removeAuxEdit', matric: matricOf(1), at: LATER })
    expect(removed.review.auxEdits).toEqual([])
    expect(removed.review.auxLog.at(-1)).toEqual({ matric: matricOf(1), from: 7, to: 5, reason: '', at: LATER, kind: 'remove' })
    expect(reducer(removed, { type: 'removeAuxEdit', matric: matricOf(1), at: LATER })).toBe(removed)
  })

  it('a removed edit whose membership is gone logs back to its own `from`', () => {
    const set = reducer(loaded(), { type: 'setTickEdit', entry: { ...tick, matric: matricOf(9) } })
    const removed = reducer(set, { type: 'removeTickEdit', matric: matricOf(9), ccaID: 'C4', at: LATER })
    expect(removed.review.tickLog.at(-1)).toMatchObject({ from: false, to: true, kind: 'remove' })
  })

  describe('vetting and the vetted lock (R1, R17, D1)', () => {
    const vetAll = (state: AppState): AppState =>
      vettableCcas(state.report).reduce((s, c) => reducer(s, { type: 'setVetted', ccaID: c.ccaID, at: AT }), state)
    const clean = (state: AppState): AppState => reducer(state, { type: 'markSaved', at: AT })
    const score = edit(11)

    it('vettable CCAs are those with a leader file or flat, not a not-submitting or missing one', () => {
      const withMore = scenario({
        ccas: [...baseCcas(), flatCca('C3'), SPORT, { ccaID: 'C5', ccaName: 'Gone', type: '1x' }, { ccaID: 'C6', ccaName: 'Silent', type: '1x' }],
        flat: flatRows('C3'),
        leaders: { C1: leaderRows('C1'), C2: leaderRows('C2'), C4: leaderRows('C4') },
      })
      const state = run(initialState(), { type: 'addFiles', files: withMore }, { type: 'setNotSubmitting', mark: { ccaID: 'C5', note: '', at: AT } })
      expect(vettableCcas(state.report).map((c) => c.ccaID).sort()).toEqual(['C1', 'C2', 'C3', 'C4'])
      expect(reducer(state, { type: 'setVetted', ccaID: 'C5', at: AT })).toBe(state)
      expect(reducer(state, { type: 'setVetted', ccaID: 'C6', at: AT })).toBe(state)
    })

    it('a flat CCA is vetted against its vetHash', () => {
      const state = reducer(loaded(), { type: 'setVetted', ccaID: 'C3', at: AT })
      const vetHash = state.report.perCca.find((c) => c.ccaID === 'C3')?.vetHash
      expect(vetHash).toMatch(/^[0-9a-f]{8}$/)
      expect(state.review.vetted).toEqual([{ ccaID: 'C3', fileHash: vetHash, at: AT }])
      expect(vettedLocked(state, 'C3')).toBe(true)
      expect(vettedLocked(state, 'C1')).toBe(false)
    })

    it.each<[string, Action, string]>([
      ['a score edit', { type: 'setReviewEdit', entry: score }, 'C1'],
      ['a tick edit', { type: 'setTickEdit', entry: tick }, 'C4'],
      ['a flat edit', { type: 'setFlatEdit', entry: flat }, 'C3'],
      ['a level pick', { type: 'setCcaLevel', entry: levelEntry('C1', 'Pass') }, 'C1'],
    ])('refuses %s on a vetted CCA without marking dirty, and allows it once vetted is cleared', (_, action, ccaID) => {
      const locked = clean(vetAll(loaded()))
      const refused = reducer(locked, action)
      expect(refused).toBe(locked)
      expect(refused.dirty).toBe(false)
      const unlocked = reducer(locked, { type: 'clearVetted', ccaID })
      const done = reducer(unlocked, action)
      expect(done).not.toBe(unlocked)
      expect(done.dirty).toBe(true)
    })

    it.each<[string, Action, Action, string]>([
      ['score', { type: 'setReviewEdit', entry: score }, { type: 'removeReviewEdit', matric: matricOf(1), ccaID: 'C1', at: AT }, 'C1'],
      ['tick', { type: 'setTickEdit', entry: tick }, { type: 'removeTickEdit', matric: matricOf(1), ccaID: 'C4', at: AT }, 'C4'],
      ['flat', { type: 'setFlatEdit', entry: flat }, { type: 'removeFlatEdit', matric: matricOf(1), ccaID: 'C3', at: AT }, 'C3'],
    ])('keeps an applied %s edit made before vetting, and refuses its removal while vetted', (_, set, remove, ccaID) => {
      const locked = clean(vetAll(reducer(loaded(), set)))
      expect(vettedLocked(locked, ccaID)).toBe(true)
      const refused = reducer(locked, remove)
      expect(refused).toBe(locked)
      expect(refused.dirty).toBe(false)
      expect(reducer(reducer(locked, { type: 'clearVetted', ccaID }), remove).dirty).toBe(true)
    })

    it('allows removing an edit that no longer applies on a vetted CCA', () => {
      const locked = clean(vetAll(reducer(loaded(), { type: 'setReviewEdit', entry: edit(11, { from: 9 }) })))
      expect(locked.report.review.edits.map((e) => e.status)).toEqual(['changed'])
      const removed = reducer(locked, { type: 'removeReviewEdit', matric: matricOf(1), ccaID: 'C1', at: AT })
      expect(removed.review.edits).toEqual([])
      expect(removed.dirty).toBe(true)
    })

    it('never locks AUX edits (AUX is not per CCA)', () => {
      const set = reducer(clean(vetAll(loaded())), { type: 'setAuxEdit', entry: aux })
      expect(set.review.auxEdits).toEqual([aux])
      expect(reducer(set, { type: 'removeAuxEdit', matric: matricOf(1), at: AT }).review.auxEdits).toEqual([])
    })

    it('an identical leader file dropped again keeps the lock; a changed one lifts it (R17)', () => {
      const locked = vetAll(loaded())
      const c1 = files().find((f) => f.name === leaderFileName('C1'))
      const c1Changed = files('12', leaderRows('C1', [9, 10, 12, 14, 16, 18])).find((f) => f.name === leaderFileName('C1'))
      if (!c1 || !c1Changed) throw new Error('fixture missing')
      const same = reducer(locked, { type: 'addFiles', files: [c1] })
      expect(vettedLocked(same, 'C1')).toBe(true)
      expect(reducer(same, { type: 'setReviewEdit', entry: score })).toBe(same)
      const changed = reducer(locked, { type: 'addFiles', files: [c1Changed] })
      expect(vettedLocked(changed, 'C1')).toBe(false)
      expect(reducer(changed, { type: 'setReviewEdit', entry: edit(11, { from: 9 }) }).review.edits).toHaveLength(1)
    })

    it('the same for a flat CCA: an identical bundle keeps the lock, a changed flat value lifts it', () => {
      const locked = vetAll(loaded())
      const bundle = (value: string) => files(value).find((f) => f.name === BUNDLE_FILE_NAME)
      const same = bundle('12')
      const changedBundle = bundle('10')
      if (!same || !changedBundle) throw new Error('fixture missing')
      expect(vettedLocked(reducer(locked, { type: 'addFiles', files: [same] }), 'C3')).toBe(true)
      const changed = reducer(locked, { type: 'addFiles', files: [changedBundle] })
      expect(vettedLocked(changed, 'C3')).toBe(false)
      expect(reducer(changed, { type: 'setFlatEdit', entry: { ...flat, from: 10, to: 8 } }).review.flatEdits).toHaveLength(1)
    })
  })
})
