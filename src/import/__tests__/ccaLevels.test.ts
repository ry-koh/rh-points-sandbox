import { describe, expect, it } from 'vitest'
import { DEFAULT_CONFIG } from '../../engine'
import { deepFreeze } from '../../engine/__tests__/helpers'
import {
  ccaLevelFor,
  isBonusTweak,
  isMultiplierTweak,
  levelProblems,
  renameLevelInEntries,
  upsertCcaLevel,
  validateCcaLevelEntry,
} from '../ccaLevels'
import type { CcaLevelEntry } from '../types'

const entry = (ccaID: string, patch: Partial<CcaLevelEntry> = {}): CcaLevelEntry => ({
  ccaID, level: null, bonusOverride: null, multiplierOverride: null, ...patch,
})
const ids = new Set(['C1', 'C2'])
const codes = (e: CcaLevelEntry, config = DEFAULT_CONFIG) => validateCcaLevelEntry(e, config, ids).map((i) => i.code)

describe('levelProblems', () => {
  it('is empty for the default levels', () => {
    expect(levelProblems(DEFAULT_CONFIG)).toEqual([])
  })

  it('reports each repeated name once, as an error with no file', () => {
    const levels = [...DEFAULT_CONFIG.levels, { name: 'Pass', bonus: 1, multiplier: 1 }, { name: 'Pass', bonus: 2, multiplier: 1 }]
    const issues = levelProblems({ levels })
    expect(issues).toEqual([
      { severity: 'error', code: 'DUPLICATE_LEVEL_NAME', fileName: '', message: 'two levels are named "Pass" in Settings; rename one of them.' },
    ])
  })
})

describe('validateCcaLevelEntry', () => {
  it('accepts a known level, with or without tweaks', () => {
    expect(codes(entry('C1', { level: 'Low Gold' }))).toEqual([])
    expect(codes(entry('C1', { level: 'Low Gold', bonusOverride: 0, multiplierOverride: 1.31 }))).toEqual([])
    expect(codes(entry('C1', { bonusOverride: 2 }))).toEqual([])
  })

  it('UNKNOWN_LEVEL for a name not in Settings, naming the CCA and the levels (R44)', () => {
    const [issue] = validateCcaLevelEntry(entry('C1', { level: 'Gold' }), DEFAULT_CONFIG, ids)
    expect(issue).toMatchObject({ severity: 'error', code: 'UNKNOWN_LEVEL', ccaID: 'C1' })
    expect(issue?.message).toBe(
      'C1: level "Gold" is not one of the levels in Settings (Unsatisfactory, Pass, Low Bronze, High Bronze, Low Silver, High Silver, Low Gold, High Gold). ' +
        'Pick another level on the Review step or add it back in Settings.',
    )
  })

  it('UNKNOWN_LEVEL when the level was removed from Settings', () => {
    const config = { ...DEFAULT_CONFIG, levels: DEFAULT_CONFIG.levels.filter((l) => l.name !== 'Low Gold') }
    expect(codes(entry('C1', { level: 'Low Gold' }), config)).toEqual(['UNKNOWN_LEVEL'])
  })

  it.each([
    ['a negative bonus', { bonusOverride: -0.5 }],
    ['a NaN bonus', { bonusOverride: Number.NaN }],
    ['an infinite bonus', { bonusOverride: Number.POSITIVE_INFINITY }],
    ['a zero multiplier', { multiplierOverride: 0 }],
    ['a negative multiplier', { multiplierOverride: -2 }],
    ['a NaN multiplier', { multiplierOverride: Number.NaN }],
  ])('BAD_LEVEL_TWEAK for %s', (_label, patch) => {
    expect(codes(entry('C1', { level: 'Pass', ...patch }))).toEqual(['BAD_LEVEL_TWEAK'])
  })

  it('LEVEL_UNKNOWN_CCA (a warning) for a CCA not in the bundle (R57)', () => {
    const [issue] = validateCcaLevelEntry(entry('C09', { level: 'Pass' }), DEFAULT_CONFIG, ids)
    expect(issue).toMatchObject({ severity: 'warning', code: 'LEVEL_UNKNOWN_CCA', ccaID: 'C09' })
    expect(issue?.message).toBe('C09 has a level set but is not in the bundle; the entry is ignored.')
  })

  it('reports every problem of one entry', () => {
    expect(codes(entry('C9', { level: 'Gold', bonusOverride: -1, multiplierOverride: 0 }))).toEqual([
      'LEVEL_UNKNOWN_CCA', 'UNKNOWN_LEVEL', 'BAD_LEVEL_TWEAK', 'BAD_LEVEL_TWEAK',
    ])
  })
})

describe('the tweak predicates', () => {
  it('a bonus is null or 0 or more; a multiplier is null or above 0', () => {
    expect([null, 0, 2.5].map(isBonusTweak)).toEqual([true, true, true])
    expect([null, 0.01, 2].map(isMultiplierTweak)).toEqual([true, true, true])
    expect(isBonusTweak(-1)).toBe(false)
    expect(isMultiplierTweak(0)).toBe(false)
  })
})

describe('the table helpers never mutate', () => {
  const list = deepFreeze([entry('C1', { level: 'Pass' }), entry('C2', { level: 'Low Gold' })])

  it('ccaLevelFor finds by ccaID, or null', () => {
    expect(ccaLevelFor(list, 'C2')?.level).toBe('Low Gold')
    expect(ccaLevelFor(list, 'C9')).toBeNull()
  })

  it('upsertCcaLevel replaces in place, adds at the end, and removes an empty entry', () => {
    expect(upsertCcaLevel(list, entry('C1', { level: 'High Gold' })).map((e) => [e.ccaID, e.level])).toEqual([['C1', 'High Gold'], ['C2', 'Low Gold']])
    expect(upsertCcaLevel(list, entry('C3', { multiplierOverride: 1.1 })).map((e) => e.ccaID)).toEqual(['C1', 'C2', 'C3'])
    expect(upsertCcaLevel(list, entry('C1')).map((e) => e.ccaID)).toEqual(['C2'])
    expect(upsertCcaLevel(list, entry('C9')).map((e) => e.ccaID)).toEqual(['C1', 'C2'])
  })

  it('renameLevelInEntries moves every entry on the old name and nothing else', () => {
    const many = deepFreeze([...list, entry('C3', { level: 'Pass', bonusOverride: 1 })])
    expect(renameLevelInEntries(many, 'Pass', 'Pass+')).toEqual([
      entry('C1', { level: 'Pass+' }),
      entry('C2', { level: 'Low Gold' }),
      entry('C3', { level: 'Pass+', bonusOverride: 1 }),
    ])
  })
})
