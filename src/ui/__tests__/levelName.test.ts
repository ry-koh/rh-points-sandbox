import { describe, expect, it } from 'vitest'
import { DEFAULT_CONFIG } from '../../engine'
import { levelNameProblem } from '../settings/tableSections'

const levels = DEFAULT_CONFIG.levels
const pass = levels.findIndex((level) => level.name === 'Pass')

describe('a typed level name is stored only when it is usable (D24)', () => {
  it('commits a new, non-blank name', () => {
    expect(levelNameProblem('Merit', pass, levels)).toBeNull()
  })

  it('commits the level keeping its own name, and ignores surrounding spaces', () => {
    expect(levelNameProblem('Pass', pass, levels)).toBeNull()
    expect(levelNameProblem('  Merit  ', pass, levels)).toBeNull()
  })

  it.each(['', '   '])('refuses a blank name ("%s")', (draft) => {
    expect(levelNameProblem(draft, pass, levels)).toBe("Name can't be blank")
  })

  it("refuses another level's name, so a half-typed duplicate never reaches the store", () => {
    expect(levelNameProblem('High Gold', pass, levels)).toBe('Another level is already called High Gold')
    expect(levelNameProblem(' Low Gold ', pass, levels)).toBe('Another level is already called Low Gold')
  })

  it('is case-sensitive, like the level lookup', () => {
    expect(levelNameProblem('high gold', pass, levels)).toBeNull()
  })
})
