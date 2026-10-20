import { describe, expect, it } from 'vitest'
import { DEFAULT_CONFIG, createPenaltyState } from '../../engine'
import type { CcaGroup } from '../../import/groups'
import { restoreWorkspace } from '../../workspace'
import { GROUPS_KEY, loadGroups, saveGroups, type SettingsStore } from '../state/settingsStorage'
import { initialState, reducer } from '../state/store'
import { fromRestored, toWorkspace } from '../state/workspaceState'

function memoryStore(initial: Record<string, string> = {}): SettingsStore & { data: Record<string, string> } {
  const data = { ...initial }
  return {
    data,
    getItem: (key) => data[key] ?? null,
    setItem: (key, value) => {
      data[key] = value
    },
  }
}

const throwingStore: SettingsStore = {
  getItem: () => {
    throw new Error('blocked')
  },
  setItem: () => {
    throw new Error('blocked')
  },
}

const group = (id: string, name: string, ccaIDs: string[] = []): CcaGroup => ({ id, name, ccaIDs })
const LOCAL = [group('l1', 'Mine', ['C1'])]
const FILE = [group('f1', 'Theirs', ['C2'])]

describe('groups in browser storage', () => {
  it('round-trips ids, names and CCA ids', () => {
    const store = memoryStore()
    expect(saveGroups(LOCAL, store)).toBe(true)
    expect(loadGroups(store)).toEqual(LOCAL)
  })

  it('writes only id, name and ccaIDs per group, whatever else the object carries', () => {
    const store = memoryStore()
    const leaky = [{ ...group('g1', 'Sports', ['C1']), members: ['A1234567B'], n: 12, fileName: 'soccer.csv' }]
    saveGroups(leaky, store)
    const stored = JSON.parse(store.data[GROUPS_KEY] ?? 'null') as Record<string, unknown>[]
    expect(stored).toEqual([{ id: 'g1', name: 'Sports', ccaIDs: ['C1'] }])
    expect(Object.keys(stored[0] ?? {}).sort()).toEqual(['ccaIDs', 'id', 'name'])
  })

  it('reads bad JSON, a wrong shape or nothing as no groups', () => {
    expect(loadGroups(memoryStore())).toEqual([])
    expect(loadGroups(memoryStore({ [GROUPS_KEY]: '{not json' }))).toEqual([])
    expect(loadGroups(memoryStore({ [GROUPS_KEY]: '{"a":1}' }))).toEqual([])
    expect(loadGroups(memoryStore({ [GROUPS_KEY]: '[{"id":1}]' }))).toEqual([])
    expect(loadGroups(null)).toEqual([])
    expect(loadGroups(throwingStore)).toEqual([])
  })

  it('cleans what it reads: a CCA in two groups stays in the first', () => {
    const raw = JSON.stringify([group('a', 'A', ['C1']), group('b', 'B', ['C1', 'C2'])])
    expect(loadGroups(memoryStore({ [GROUPS_KEY]: raw })).map((g) => g.ccaIDs)).toEqual([['C1'], ['C2']])
  })

  it('says it could not save when storage is missing or blocked', () => {
    expect(saveGroups(LOCAL, null)).toBe(false)
    expect(saveGroups(LOCAL, throwingStore)).toBe(false)
  })
})

describe('groups in the app state', () => {
  it('start from the groups given, or none', () => {
    expect(initialState().groups).toEqual([])
    expect(initialState(DEFAULT_CONFIG, LOCAL).groups).toEqual(LOCAL)
  })

  it('setGroups changes them and marks the workspace unsaved', () => {
    const state = reducer(initialState(), { type: 'setGroups', groups: LOCAL })
    expect(state.groups).toEqual(LOCAL)
    expect(state.dirty).toBe(true)
  })

  it('setGroups with the same groups is not a change', () => {
    const start = initialState(DEFAULT_CONFIG, LOCAL)
    expect(reducer(start, { type: 'setGroups', groups: [...LOCAL] })).toBe(start)
  })

  it('setGroups cleans what it is given', () => {
    const state = reducer(initialState(), { type: 'setGroups', groups: [group('a', ' A ', ['C1', 'C1']), group('b', '  ')] })
    expect(state.groups).toEqual([group('a', 'A', ['C1'])])
  })

  it('setGroups is allowed while finalised and leaves the lists alone', () => {
    const finalised = { ...initialState(), finalised: { penalty: createPenaltyState({ maleStaying: [], femaleStaying: [], maleBidding: [], femaleBidding: [], sem2: [] }), log: [] } }
    const state = reducer(finalised, { type: 'setGroups', groups: LOCAL })
    expect(state.groups).toEqual(LOCAL)
    expect(state.finalised).toBe(finalised.finalised)
    expect(state.dirty).toBe(true)
  })
})

describe('groups in the workspace file (D3 = A)', () => {
  const open = (local: readonly CcaGroup[], file: readonly CcaGroup[]) => {
    const saved = toWorkspace(reducer(initialState(), { type: 'setGroups', groups: file }), new Date(2027, 0, 1))
    const loaded = fromRestored(restoreWorkspace(saved))
    return reducer(initialState(DEFAULT_CONFIG, local), { type: 'loadWorkspace', workspace: loaded })
  }

  it('toWorkspace writes the groups, or null when there are none', () => {
    const withGroups = reducer(initialState(), { type: 'setGroups', groups: LOCAL })
    expect(toWorkspace(withGroups, new Date(2027, 0, 1)).groups).toEqual(LOCAL)
    expect(toWorkspace(initialState(), new Date(2027, 0, 1)).groups).toBeNull()
  })

  it('a file with groups replaces this computer’s groups and says so', () => {
    const opened = open(LOCAL, FILE)
    expect(opened.groups).toEqual(FILE)
    expect(opened.groupsReplaced).toBe(true)
    expect(opened.dirty).toBe(false)
  })

  it('a file with no groups keeps this computer’s groups', () => {
    const opened = open(LOCAL, [])
    expect(opened.groups).toEqual(LOCAL)
    expect(opened.groupsReplaced).toBe(false)
  })

  it('an older file (groups null) keeps this computer’s groups', () => {
    const saved = toWorkspace(initialState(), new Date(2027, 0, 1))
    expect(saved.groups).toBeNull()
    const loaded = fromRestored(restoreWorkspace(saved))
    expect(loaded.groups).toBeNull()
    const opened = reducer(initialState(DEFAULT_CONFIG, LOCAL), { type: 'loadWorkspace', workspace: loaded })
    expect(opened.groups).toEqual(LOCAL)
    expect(opened.groupsReplaced).toBe(false)
  })

  it('the replacing groups reach storage through the state, as setGroups does', () => {
    // useAppStore saves state.groups whenever it changes; this is what it would write.
    const store = memoryStore()
    saveGroups(open(LOCAL, FILE).groups, store)
    expect(loadGroups(store)).toEqual(FILE)
  })
})
