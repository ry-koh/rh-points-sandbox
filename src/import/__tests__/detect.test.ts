import { describe, expect, it } from 'vitest'
import { detectFileKind } from '../detect'

const LEADER = [
  'formatVersion', 'ccaID', 'ccaName', 'matric', 'name',
  'basePoints', 'semesterOnly', 'outgoingRole', 'incomingRole', 'exportedAt',
]
const RESIDENTS = ['matric', 'name', 'gender', 'sem2', 'aux', 'jcrc']
const FLAT = ['formatVersion', 'ccaID', 'ccaName', 'matric', 'name', 'flatPoints', 'exportedAt']
const SETTINGS = ['formatVersion', 'scope', 'ccaID', 'ccaName', 'meanMin', 'meanMax', 'sdMin', 'sdMax', 'note', 'exportedAt']
const IHG = ['matric', 'ccaID', 'placement']
const CCAS = [
  'ccaID', 'ccaName', 'type', 'placement', 'outgoingTier', 'outgoingMultiplier',
  'meanMin', 'meanMax', 'sdMin', 'sdMax',
]

const reversed = (header: readonly string[]): string[] => [...header].reverse()

describe('detectFileKind', () => {
  it.each([
    ['leader', LEADER],
    ['residents', RESIDENTS],
    ['ihg', IHG],
    ['ccas', CCAS],
    ['flat', FLAT],
    ['settings', SETTINGS],
  ] as const)('recognises the %s header', (kind, header) => {
    expect(detectFileKind(header)).toBe(kind)
  })

  it.each([
    ['leader', LEADER],
    ['residents', RESIDENTS],
    ['ihg', IHG],
    ['ccas', CCAS],
    ['flat', FLAT],
  ] as const)('recognises the %s header in any column order', (kind, header) => {
    expect(detectFileKind(reversed(header))).toBe(kind)
  })

  it('requires exact column names (case-sensitive)', () => {
    expect(detectFileKind(['Matric', 'name', 'gender', 'sem2', 'aux', 'jcrc'])).toBeNull()
  })

  it('rejects a header with a missing column', () => {
    expect(detectFileKind(RESIDENTS.slice(1))).toBeNull()
  })

  it('rejects a header with an extra column', () => {
    expect(detectFileKind([...RESIDENTS, 'extra'])).toBeNull()
  })

  it('rejects a repeated column name', () => {
    expect(detectFileKind(['matric', 'matric', 'gender', 'sem2', 'aux', 'jcrc'])).toBeNull()
  })

  it('no longer recognises a residents header without the jcrc column', () => {
    expect(detectFileKind(['matric', 'name', 'gender', 'sem2', 'aux'])).toBeNull()
  })

  it('returns null for an unknown or empty header', () => {
    expect(detectFileKind(['foo', 'bar'])).toBeNull()
    expect(detectFileKind([])).toBeNull()
  })
})
