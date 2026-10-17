import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { DEFAULT_CONFIG, computeAll } from '../../engine'
import { parseCsv } from '../csv'
import { detectFileKind } from '../detect'
import { validateImport } from '../validate'
import type { SourceFile } from '../types'

// Contract test: samples/app-export/points_9101_20270401.csv is SYNTHETIC but
// byte-for-byte in the format RH-app's buildPointsCsv writes
// (src/lib/points/exportCsv.ts there): CRLF with a trailing CRLF, RFC 4180
// quoting, an apostrophe formula guard on free text, Y/N, numeric ccaID and an
// ISO timestamp with milliseconds. If the app's format drifts, change this
// sample to match the app and this test says whether the sandbox still reads it.
const DIR = 'samples/app-export'
const LEADER = 'points_9101_20270401.csv'

const read = (name: string): SourceFile => ({ name, text: readFileSync(`${DIR}/${name}`, 'utf8') })
const files = [read(LEADER), read('residents.csv'), read('ccas.csv')]

describe('RH-app export format', () => {
  const text = files[0]!.text

  it('uses CRLF line endings with a trailing CRLF, as the app writes', () => {
    expect(text.endsWith('\r\n')).toBe(true)
    expect(text.replace(/\r\n/g, '')).not.toMatch(/[\r\n]/)
  })

  it('is detected as a leader file', () => {
    expect(detectFileKind(parseCsv(text).header)).toBe('leader')
  })
})

describe('RH-app export imports cleanly', () => {
  const report = validateImport(files, DEFAULT_CONFIG, [])

  it('has no issues and can compute', () => {
    expect(report.issues).toEqual([])
    expect(report.canCompute).toBe(true)
    expect(report.perCca).toEqual([expect.objectContaining({ ccaID: '9101', status: 'ok' })])
  })

  it('reads every column the app writes', () => {
    const rows = report.input?.memberships ?? []
    expect(rows).toHaveLength(6)
    expect(rows.map((m) => m.basePoints)).toEqual([10, 14, 12, 8, 16, 12])
    expect(rows.every((m) => m.ccaID === '9101')).toBe(true)
    expect(rows.filter((m) => m.semesterOnly).map((m) => m.matric)).toEqual(['A9910104X'])
    expect(rows.map((m) => `${m.outgoingRole}/${m.incomingRole}`)).toEqual([
      'head/none',
      'none/head',
      'none/vice_head',
      'none/none',
      'vice_head/none',
      'none/none',
    ])
  })

  it('keeps the quoted CCA name, comma and all', () => {
    expect(report.input?.ccas.find((c) => c.ccaID === '9101')?.ccaName).toBe('Drama, Film & Theatre')
  })

  it('runs through the engine', () => {
    if (!report.input) throw new Error('expected an engine input')
    const { lists } = computeAll(report.input, DEFAULT_CONFIG)
    expect(lists.maleStaying.length + lists.femaleStaying.length).toBe(6)
    expect(lists.maleBidding.length + lists.femaleBidding.length).toBe(6)
  })
})

// Contract test for the flat-points file: samples/app-export/flat/flat_points_20270401.csv is
// byte-for-byte what RH-app's buildFlatPointsCsv writes (src/lib/points/flatCsv.ts there;
// its test holds the same fixture): CRLF with a trailing CRLF, a quoted name with a comma,
// an apostrophe formula guard on ccaName and name, a fractional value and one ISO exportedAt.
const FLAT = 'flat_points_20270401.csv'
const flatRead = (name: string): SourceFile => ({ name, text: readFileSync(`${DIR}/flat/${name}`, 'utf8') })
const flatFiles = [flatRead(FLAT), flatRead('residents.csv'), flatRead('ccas.csv')]

describe('RH-app flat-points export', () => {
  const text = flatFiles[0]!.text
  const report = validateImport(flatFiles, DEFAULT_CONFIG, [])

  it('uses CRLF line endings with a trailing CRLF, as the app writes', () => {
    expect(text.startsWith('formatVersion,ccaID,ccaName,matric,name,flatPoints,exportedAt\r\n')).toBe(true)
    expect(text.endsWith('\r\n')).toBe(true)
    expect(text.replace(/\r\n/g, '')).not.toMatch(/[\r\n]/)
  })

  it('is detected as a flat file', () => {
    expect(detectFileKind(parseCsv(text).header)).toBe('flat')
  })

  it('has no errors: flat CCAs have no mean/SD check and need no leader file', () => {
    expect(report.issues).toEqual([])
    expect(report.canCompute).toBe(true)
    expect(report.perCca.filter((c) => c.status === 'flat').map((c) => [c.ccaID, c.flatPoints, c.mean, c.sd])).toEqual([
      ['9001', 12, null, null],
      ['9002', 7.5, null, null],
    ])
  })

  it('gives each member exactly the flat value for that CCA', () => {
    if (!report.input) throw new Error('expected an engine input')
    const { results } = computeAll(report.input, DEFAULT_CONFIG)
    const netOf = (matric: string, ccaID: string) =>
      results.find((r) => r.matric === matric)?.memberships.find((m) => m.ccaID === ccaID)
    expect(netOf('A9910101X', '9001')).toMatchObject({ stayNet: 12, bidNet: 12 })
    expect(netOf('A9910102X', '9001')).toMatchObject({ stayNet: 12, bidNet: 12 })
    expect(netOf('A9910103X', '9002')).toMatchObject({ stayNet: 7.5, bidNet: 7.5 })
  })
})

// Contract test for the points settings file: samples/app-export/settings/points_settings_20270401.csv
// is byte-for-byte what RH-app's buildSettingsCsv writes (src/lib/points/settingsCsv.ts there; its
// test holds the same fixture): CRLF with a trailing CRLF, one default row, one waiver row with a
// quoted CCA name and the waiver's effective range.
const SETTINGS = 'points_settings_20270401.csv'
const settingsRead = (name: string): SourceFile => ({ name, text: readFileSync(`${DIR}/settings/${name}`, 'utf8') })
const settingsFiles = [settingsRead(SETTINGS), settingsRead('points_9101_20270401.csv'), settingsRead('residents.csv'), settingsRead('ccas.csv')]

describe('RH-app points settings export', () => {
  const text = settingsFiles[0]!.text
  const report = validateImport(settingsFiles, DEFAULT_CONFIG, [])

  it('is exactly the bytes the app writes', () => {
    expect(text).toBe(
      'formatVersion,scope,ccaID,ccaName,meanMin,meanMax,sdMin,sdMax,note,exportedAt\r\n' +
        '1,default,,,10,14,2,5,,2027-04-01T09:30:00.000Z\r\n' +
        '1,waiver,9101,"Hall Choir, Senior",12,15,1.5,5,Small CCA (<10 members),2027-04-01T09:30:00.000Z\r\n',
    )
  })

  it('is detected as a settings file', () => {
    expect(detectFileKind(parseCsv(text).header)).toBe('settings')
  })

  it('has no errors', () => {
    expect(report.issues.filter((i) => i.severity === 'error')).toEqual([])
    expect(report.canCompute).toBe(true)
  })

  it('judges 9101 by the waiver range, which the default range would fail', () => {
    expect(report.perCca).toEqual([
      expect.objectContaining({ ccaID: '9101', status: 'ok', range: { meanMin: 12, meanMax: 15, sdMin: 1.5, sdMax: 5 } }),
    ])
    const without = validateImport(settingsFiles.filter((f) => f.name !== SETTINGS), DEFAULT_CONFIG, [])
    expect(without.perCca[0]).toMatchObject({ status: 'out_of_range' })
  })
})
