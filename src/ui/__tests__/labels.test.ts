import { describe, expect, it } from 'vitest'
import { DEFAULT_CONFIG, type ScenarioConfig } from '../../engine'
import { HEADCOUNT_LABELS, SETTINGS_TEXT, SECTION_TITLES } from '../settings/labels'
import { SECTIONS } from '../settings/SettingsPanel'

const KEYS = Object.keys(DEFAULT_CONFIG) as (keyof ScenarioConfig)[]

describe('plain-English settings text', () => {
  it.each(KEYS)('%s has a label and a help line', (key) => {
    expect(SETTINGS_TEXT[key].label.trim().length).toBeGreaterThan(0)
    expect(SETTINGS_TEXT[key].help.trim().length).toBeGreaterThan(0)
  })

  it('names every headcount', () => {
    expect(Object.keys(HEADCOUNT_LABELS).sort()).toEqual(Object.keys(DEFAULT_CONFIG.headcounts).sort())
    expect(HEADCOUNT_LABELS.maleGreen).toBe('Male — definitely stay (green)')
    expect(HEADCOUNT_LABELS.sem2Grey).toBe('Sem-2 — waiting list (grey)')
  })

  it('uses the agreed wording', () => {
    expect(SECTION_TITLES.headcounts).toBe('How many stay')
    expect(SETTINGS_TEXT.headcounts.help).toBe('Everyone below green + grey is white and cannot stay.')
    expect(SETTINGS_TEXT.stackingMode.label).toBe('If someone is both outgoing and incoming in the same CCA')
    expect(SETTINGS_TEXT.stayingWeightTail.label).toBe('After the last one listed: keep halving')
    expect(SETTINGS_TEXT.jcrcExchangeFactor.label).toBe('On exchange: % of highest other bidding points')
    expect(SECTION_TITLES.levels).toBe('CCA levels')
    expect(SETTINGS_TEXT.levels.label).toBe('Levels')
    expect(SETTINGS_TEXT.halfCcaPlacementHalved.label).toBe('Also halve the level bonus for half-year CCAs')
    expect(SETTINGS_TEXT.halfCcaPlacementHalved.help).toBe('Off: a High Gold half-year CCA still gets +4. On: +2.')
  })

  it('shows How many stay first and puts every key in exactly one section', () => {
    expect(SECTIONS[0]?.id).toBe('headcounts')
    const keys = SECTIONS.flatMap((s) => s.keys)
    expect([...keys].sort()).toEqual([...KEYS].sort())
    expect(new Set(keys).size).toBe(keys.length)
    expect(SECTIONS.find((s) => s.id === 'levels')?.keys).toEqual(['levels'])
    expect(SECTIONS.find((s) => s.id === 'leaders')?.keys).toEqual(['incomingMultiplier', 'stackingMode'])
  })
})
