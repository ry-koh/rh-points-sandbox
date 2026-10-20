import { readFileSync, readdirSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { leaderRows, scenario } from '../../import/__tests__/fixtures'
import { GROUPS_KEY, saveGroups, type SettingsStore } from '../state/settingsStorage'
import { initialState, reducer } from '../state/store'

// Vitest runs from the project root.
const SRC = 'src'
const THIS_FILE = 'ui/__tests__/confidentiality.test.ts'
const SETTINGS_MODULE = 'ui/state/settingsStorage.ts'
const SOURCE_FILE = /\.(ts|tsx|css|html)$/

// Built from pieces so this file does not trip its own scan.
const word = (...parts: string[]): string => parts.join('')
const FORBIDDEN: readonly { readonly name: string; readonly pattern: RegExp }[] = [
  { name: 'fetch(', pattern: new RegExp(word('\\bfet', 'ch\\s*\\(')) },
  { name: 'XMLHttpRequest', pattern: new RegExp(word('XMLHttp', 'Request')) },
  { name: 'WebSocket', pattern: new RegExp(word('Web', 'Socket')) },
  { name: 'sendBeacon', pattern: new RegExp(word('send', 'Beacon')) },
  { name: 'http(s):// literal', pattern: new RegExp(word('https?', ':\\/\\/')) },
  { name: 'IndexedDB', pattern: new RegExp(word('indexed', 'DB'), 'i') },
  { name: 'sessionStorage', pattern: new RegExp(word('session', 'Storage')) },
]
const LOCAL_STORAGE = new RegExp(word('local', 'Storage'))

const files = readdirSync(SRC, { recursive: true })
  .map((path) => path.replaceAll('\\', '/'))
  .filter((path) => SOURCE_FILE.test(path) && path !== THIS_FILE)

const read = (path: string): string => readFileSync(`${SRC}/${path}`, 'utf8')

describe('confidentiality scan of src/', () => {
  it('finds the source files', () => {
    expect(files.length).toBeGreaterThan(20)
    expect(files).toContain(SETTINGS_MODULE)
  })

  it.each(FORBIDDEN)('no file uses $name', ({ pattern }) => {
    const offenders = files.filter((path) => pattern.test(read(path)))
    expect(offenders).toEqual([])
  })

  it('only the settings module touches browser storage', () => {
    const offenders = files.filter((path) => path !== SETTINGS_MODULE && LOCAL_STORAGE.test(read(path)))
    expect(offenders).toEqual([])
  })

  it('stored groups hold only ids, names and CCA ids, never a matric', () => {
    const data: Record<string, string> = {}
    const store: SettingsStore = { getItem: (key) => data[key] ?? null, setItem: (key, value) => void (data[key] = value) }
    // A state that holds residents: the groups saved from it must not carry any of them.
    const loaded = reducer(initialState(), { type: 'addFiles', files: scenario({ leaders: { C1: leaderRows('C1'), C2: leaderRows('C2') } }) })
    expect(loaded.report.input?.residents.length).toBeGreaterThan(0)
    const groups = [{ id: 'g1', name: 'Sports', ccaIDs: ['C1', 'C2'], members: loaded.report.input?.residents }]
    expect(saveGroups(groups, store)).toBe(true)
    const stored = data[GROUPS_KEY] ?? ''
    const parsed = JSON.parse(stored) as Record<string, unknown>[]
    expect(parsed.flatMap((group) => Object.keys(group)).sort()).toEqual(['ccaIDs', 'id', 'name'])
    expect(stored).not.toMatch(/A\d{7}[A-Z]/)
    for (const resident of loaded.report.input?.residents ?? []) expect(stored).not.toContain(resident.name)
  })
})
