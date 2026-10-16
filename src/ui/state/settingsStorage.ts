import { DEFAULT_CONFIG, type ScenarioConfig } from '../../engine'
import { isScenarioConfig } from './configShape'

// The ONLY module allowed to touch browser storage. It keeps the current settings,
// never resident data.
export const SETTINGS_KEY = 'rhps.settings.v1'

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

export function loadSettings(store: SettingsStore | null = browserStore()): ScenarioConfig {
  try {
    const raw = store?.getItem(SETTINGS_KEY)
    if (!raw) return DEFAULT_CONFIG
    const parsed: unknown = JSON.parse(raw)
    return isScenarioConfig(parsed) ? parsed : DEFAULT_CONFIG
  } catch {
    return DEFAULT_CONFIG
  }
}

export function saveSettings(
  config: ScenarioConfig,
  store: SettingsStore | null = browserStore(),
): boolean {
  try {
    store?.setItem(SETTINGS_KEY, JSON.stringify(config))
    return store !== null
  } catch {
    return false
  }
}
