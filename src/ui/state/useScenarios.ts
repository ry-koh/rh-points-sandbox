import { useEffect, useState } from 'react'
import type { ScenarioConfig } from '../../engine'
import type { Scenario } from './scenarios'
import { loadScenarios, saveScenarios } from './settingsStorage'

export interface ScenarioStore {
  readonly scenarios: readonly Scenario[]
  readonly add: (name: string, note: string, config: ScenarioConfig) => Scenario
  readonly rename: (id: string, name: string) => void
  readonly duplicate: (id: string) => void
  readonly remove: (id: string) => void
}

const newId = (): string => crypto.randomUUID()
const now = (): string => new Date().toISOString()

/** Saved scenarios (settings only), kept in React state and mirrored to storage. */
export function useScenarios(): ScenarioStore {
  const [scenarios, setScenarios] = useState<readonly Scenario[]>(() => loadScenarios())

  useEffect(() => {
    saveScenarios(scenarios)
  }, [scenarios])

  const add = (name: string, note: string, config: ScenarioConfig): Scenario => {
    const scenario: Scenario = { id: newId(), name, note, savedAt: now(), config }
    setScenarios((list) => [...list, scenario])
    return scenario
  }
  const rename = (id: string, name: string): void =>
    setScenarios((list) => list.map((s) => (s.id === id ? { ...s, name } : s)))
  const duplicate = (id: string): void =>
    setScenarios((list) => {
      const source = list.find((s) => s.id === id)
      return source ? [...list, { ...source, id: newId(), name: `${source.name} (copy)`, savedAt: now() }] : list
    })
  const remove = (id: string): void => setScenarios((list) => list.filter((s) => s.id !== id))

  return { scenarios, add, rename, duplicate, remove }
}
