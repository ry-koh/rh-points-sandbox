import { DEFAULT_CONFIG, type ScenarioConfig } from '../../engine'
import { normaliseGroups, type CcaGroup } from '../../import/groups'
import { readStoredConfig } from './configShape'
import { readScenarioList, type Scenario } from './scenarios'

// The ONLY module allowed to touch browser storage. It keeps the current settings, saved
// scenarios (settings only) and CCA groups (ids and names only), never resident data.
export const SETTINGS_KEY = 'rhps.settings.v1'
export const SCENARIOS_KEY = 'rhps.scenarios.v1'
export const GROUPS_KEY = 'rhps.groups.v1'

/** The subset of the Storage API this module needs (injectable for tests). */
export interface SettingsStore {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

function browserStore(): SettingsStore | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage
  } catch {
    return null
  }
}

function readJson(store: SettingsStore | null, key: string): unknown {
  try {
    const raw = store?.getItem(key)
    return raw ? (JSON.parse(raw) as unknown) : null
  } catch {
    return null
  }
}

function writeJson(store: SettingsStore | null, key: string, value: unknown): boolean {
  try {
    store?.setItem(key, JSON.stringify(value))
    return store !== null
  } catch {
    return false
  }
}

export function loadSettings(store: SettingsStore | null = browserStore()): ScenarioConfig {
  return readStoredConfig(readJson(store, SETTINGS_KEY)) ?? DEFAULT_CONFIG
}

export function saveSettings(config: ScenarioConfig, store: SettingsStore | null = browserStore()): boolean {
  return writeJson(store, SETTINGS_KEY, config)
}

export function loadScenarios(store: SettingsStore | null = browserStore()): Scenario[] {
  return readScenarioList(readJson(store, SCENARIOS_KEY))
}

/** Stores only id, name, note, savedAt and the settings of each scenario. */
export function saveScenarios(scenarios: readonly Scenario[], store: SettingsStore | null = browserStore()): boolean {
  const settingsOnly = scenarios.map(({ id, name, note, savedAt, config }) => ({ id, name, note, savedAt, config }))
  return writeJson(store, SCENARIOS_KEY, settingsOnly)
}

export function loadGroups(store: SettingsStore | null = browserStore()): CcaGroup[] {
  return normaliseGroups(readJson(store, GROUPS_KEY))
}

/** Stores only id, name and ccaIDs of each group (R13): no CCA names, no resident data. */
export function saveGroups(groups: readonly CcaGroup[], store: SettingsStore | null = browserStore()): boolean {
  const idsAndNames = groups.map(({ id, name, ccaIDs }) => ({ id, name, ccaIDs }))
  return writeJson(store, GROUPS_KEY, idsAndNames)
}
