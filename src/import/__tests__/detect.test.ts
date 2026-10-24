import { describe, expect, it } from 'vitest'
import { BUNDLE_V1_COLUMNS, FILE_COLUMNS, LEADER_V1_COLUMNS, RETIRED_CCAS_COLUMNS, RETIRED_IHG_COLUMNS, detectFileKind } from '../detect'

const LEADER = [
  'formatVersion', 'ccaID', 'ccaName', 'matric', 'name',
  'basePoints', 'semesterOnly', 'outgoingRole', 'incomingRole', 'ihg', 'exportedAt',
]
const LEADER_V1 = LEADER.filter((col) => col !== 'ihg')
const RESIDENTS = ['matric', 'name', 'gender', 'sem2', 'aux', 'jcrc']
const FLAT = ['formatVersion', 'ccaID', 'ccaName', 'matric', 'name', 'flatPoints', 'exportedAt']
const SETTINGS = ['formatVersion', 'scope', 'ccaID', 'ccaName', 'meanMin', 'meanMax', 'sdMin', 'sdMax', 'note', 'exportedAt']
const BUNDLE = [
  'formatVersion', 'section', 'scope', 'ccaID', 'ccaName', 'matric', 'name', 'flatPoints', 'type', 'sport',
  'ihgResult', 'ihgCap', 'meanMin', 'meanMax', 'sdMin', 'sdMax', 'note', 'aux', 'exportedAt',
]
const BUNDLE_V1 = BUNDLE.filter((col) => col !== 'aux')

const reversed = (header: readonly string[]): string[] => [...header].reverse()

describe('detectFileKind', () => {
  it.each([
    ['leader', LEADER],
    ['leader', LEADER_V1],
    ['residents', RESIDENTS],
    ['flat', FLAT],
    ['settings', SETTINGS],
    ['bundle', BUNDLE],
    ['bundle', BUNDLE_V1],
  ] as const)('recognises the %s header', (kind, header) => {
    expect(detectFileKind(header)).toBe(kind)
  })

  it.each([
    ['leader', LEADER],
    ['leader', LEADER_V1],
    ['residents', RESIDENTS],
    ['flat', FLAT],
    ['bundle', BUNDLE],
    ['bundle', BUNDLE_V1],
  ] as const)('recognises the %s header in any column order', (kind, header) => {
    expect(detectFileKind(reversed(header))).toBe(kind)
  })

  it('bundle formatVersion 2 has the 19 columns the RH-app writes; version 1 is the same without aux', () => {
    expect(FILE_COLUMNS.bundle).toEqual(BUNDLE)
    expect(FILE_COLUMNS.bundle.length).toBe(19)
    expect(BUNDLE_V1_COLUMNS).toEqual(BUNDLE_V1)
  })

  it('never accepts a bundle superset', () => {
    expect(detectFileKind([...BUNDLE, 'extra'])).toBeNull()
    expect(detectFileKind([...BUNDLE_V1, 'extra'])).toBeNull()
  })

  it('leader formatVersion 2 has the 11 columns the RH-app writes; version 1 is the same without ihg', () => {
    expect(FILE_COLUMNS.leader).toEqual(LEADER)
    expect(LEADER_V1_COLUMNS).toEqual(LEADER_V1)
    expect(detectFileKind(LEADER_V1)).not.toBeNull()
  })

  it('never accepts a leader superset or a partial ihg header', () => {
    expect(detectFileKind([...LEADER, 'extra'])).toBeNull()
    expect(detectFileKind([...LEADER_V1, 'extra'])).toBeNull()
    expect(detectFileKind(LEADER_V1.slice(1))).toBeNull()
  })

  it('does not recognise the retired ihg.csv header as any kind', () => {
    expect(detectFileKind(RETIRED_IHG_COLUMNS)).toBeNull()
    expect(Object.keys(FILE_COLUMNS)).not.toContain('ihg')
  })

  it('does not recognise the retired ccas.csv header as any kind', () => {
    expect(detectFileKind(RETIRED_CCAS_COLUMNS)).toBeNull()
    expect(Object.keys(FILE_COLUMNS)).not.toContain('ccas')
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
