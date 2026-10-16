import { describe, expect, it } from 'vitest'
import { DEFAULT_CONFIG } from '../../engine'
import { SETTINGS_KEY, loadSettings, saveSettings, type SettingsStore } from '../state/settingsStorage'

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
    throw new Error('quota')
  },
}

describe('settings persistence', () => {
  it('saves under rhps.settings.v1 and loads the same settings back', () => {
    const store = memoryStore()
    const changed = { ...DEFAULT_CONFIG, sem2Factor: 3, headcounts: { ...DEFAULT_CONFIG.headcounts, maleGreen: 120 } }
    expect(saveSettings(changed, store)).toBe(true)
    expect(Object.keys(store.data)).toEqual([SETTINGS_KEY])
    expect(loadSettings(store)).toEqual(changed)
  })

  it('falls back to the defaults when nothing is stored', () => {
    expect(loadSettings(memoryStore())).toBe(DEFAULT_CONFIG)
  })

  it('falls back to the defaults on corrupt JSON', () => {
    expect(loadSettings(memoryStore({ [SETTINGS_KEY]: '{not json' }))).toBe(DEFAULT_CONFIG)
  })

  it('falls back to the defaults when the shape is wrong', () => {
    const missingKey = JSON.stringify({ ...DEFAULT_CONFIG, auxTable: undefined })
    const wrongType = JSON.stringify({ ...DEFAULT_CONFIG, sem2Mode: 'sometimes' })
    expect(loadSettings(memoryStore({ [SETTINGS_KEY]: missingKey }))).toBe(DEFAULT_CONFIG)
    expect(loadSettings(memoryStore({ [SETTINGS_KEY]: wrongType }))).toBe(DEFAULT_CONFIG)
    expect(loadSettings(memoryStore({ [SETTINGS_KEY]: '[1,2]' }))).toBe(DEFAULT_CONFIG)
  })

  it('survives storage that throws', () => {
    expect(loadSettings(throwingStore)).toBe(DEFAULT_CONFIG)
    expect(saveSettings(DEFAULT_CONFIG, throwingStore)).toBe(false)
  })

  it('does nothing without storage', () => {
    expect(loadSettings(null)).toBe(DEFAULT_CONFIG)
    expect(saveSettings(DEFAULT_CONFIG, null)).toBe(false)
  })
})
