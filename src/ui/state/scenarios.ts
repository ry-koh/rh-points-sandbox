import type { ScenarioConfig } from '../../engine'
import { readConfig } from './configShape'

export const SCENARIO_FILE_VERSION = 1

/** A named set of SETTINGS. It never holds resident data. */
export interface Scenario {
  readonly id: string
  readonly name: string
  readonly note: string
  readonly savedAt: string
  readonly config: ScenarioConfig
}

export interface ScenarioFile {
  readonly version: number
  readonly name: string
  readonly note: string
  readonly savedAt: string
  readonly config: ScenarioConfig
}

export type ScenarioParse =
  | { readonly ok: true; readonly file: ScenarioFile }
  | { readonly ok: false; readonly error: string }

export function serialiseScenario(scenario: Scenario): string {
  const file: ScenarioFile = {
    version: SCENARIO_FILE_VERSION,
    name: scenario.name,
    note: scenario.note,
    savedAt: scenario.savedAt,
    config: scenario.config,
  }
  return `${JSON.stringify(file, null, 2)}\n`
}

const text = (v: unknown, fallback: string): string => (typeof v === 'string' ? v : fallback)

/** Reads an exported scenario file; every problem comes back as a plain-English message. */
export function parseScenarioFile(raw: string, fallbackName: string): ScenarioParse {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return { ok: false, error: 'This file is not a scenario file (it is not valid JSON).' }
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return { ok: false, error: 'This file is not a scenario file.' }
  }
  const data = parsed as Record<string, unknown>
  if (data.version !== SCENARIO_FILE_VERSION) {
    return { ok: false, error: `This scenario file is version ${String(data.version)}; only version ${SCENARIO_FILE_VERSION} can be read.` }
  }
  const config = readConfig(data.config)
  if (!config.ok) return { ok: false, error: config.error }
  return {
    ok: true,
    file: {
      version: SCENARIO_FILE_VERSION,
      name: text(data.name, fallbackName).trim() || fallbackName,
      note: text(data.note, ''),
      savedAt: text(data.savedAt, ''),
      config: config.config,
    },
  }
}

/** Valid stored scenario lists only; anything malformed is dropped. */
export function readScenarioList(v: unknown): Scenario[] {
  if (!Array.isArray(v)) return []
  return v.flatMap((item: unknown) => {
    if (typeof item !== 'object' || item === null) return []
    const s = item as Record<string, unknown>
    const config = readConfig(s.config)
    if (!config.ok || typeof s.id !== 'string' || typeof s.name !== 'string') return []
    return [{ id: s.id, name: s.name, note: text(s.note, ''), savedAt: text(s.savedAt, ''), config: config.config }]
  })
}
