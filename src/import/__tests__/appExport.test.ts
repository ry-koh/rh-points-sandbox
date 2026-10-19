import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { DEFAULT_CONFIG, computeAll } from '../../engine'
import { parseCsv } from '../csv'
import { detectFileKind } from '../detect'
import { parseFlat } from '../parseFlat'
import { parseSettings } from '../parseSettings'
import { validateImport } from '../validate'
import type { CcaLevelEntry, ImportReport, SourceFile } from '../types'

const DIR = 'samples/app-export'
const read = (path: string): SourceFile => ({ name: path.split('/').pop() ?? path, text: readFileSync(`${DIR}/${path}`, 'utf8') })
const codesOf = (report: ImportReport): string[] => [...new Set(report.issues.map((i) => i.code))].sort()

const LEVELS: readonly CcaLevelEntry[] = [{ ccaID: '9101', level: 'Low Silver', bonusOverride: null, multiplierOverride: null }]
const run = (files: readonly SourceFile[], ccaLevels: readonly CcaLevelEntry[] = LEVELS): ImportReport =>
  validateImport(files, DEFAULT_CONFIG, { ccaLevels })

// Contract test for the RH-app bundle: samples/app-export/bundle/points_bundle_20270401.csv is
// byte-for-byte what RH-app's buildBundleCsv writes (src/lib/points/bundleCsv.ts there; its test
// pins the same string): 18 columns, CRLF with a trailing CRLF, settings rows, then cca rows
// (type, sport, IHG result and cap), then flat rows, the apostrophe formula guard on free text,
// a blank type (9002) and one ISO exportedAt on every row. If the app's bytes change, change both.
const STAMP = '2027-04-01T09:30:00.000Z'
const BUNDLE_TEXT =
  [
    'formatVersion,section,scope,ccaID,ccaName,matric,name,flatPoints,type,sport,ihgResult,ihgCap,meanMin,meanMax,sdMin,sdMax,note,exportedAt',
    `1,settings,default,,,,,,,,,,10,14,2,5,,${STAMP}`,
    `1,settings,waiver,9101,"Drama, Film & Theatre",,,,,,,,12,15,1.5,5,Small CCA (<10 members),${STAMP}`,
    `1,cca,,9001,Hall Choir,,,12,1x,N,,,,,,,,${STAMP}`,
    `1,cca,,9002,"'=Dance, Crew",,,7.5,,N,,,,,,,,${STAMP}`,
    `1,cca,,9101,"Drama, Film & Theatre",,,,1x,N,,,,,,,,${STAMP}`,
    `1,cca,,9201,Soccer (M),,,,1x,Y,1st,12,,,,,,${STAMP}`,
    `1,cca,,9202,Touch Rugby (W),,,,1x,Y,,,,,,,,${STAMP}`,
    `1,flat,,9001,Hall Choir,A9910101X,"Tan, Test 01",12,,,,,,,,,,${STAMP}`,
    `1,flat,,9001,Hall Choir,A9910102X,Test Member 02,12,,,,,,,,,,${STAMP}`,
    `1,flat,,9002,"'=Dance, Crew",A9910103X,'@Test 03,7.5,,,,,,,,,,${STAMP}`,
  ].join('\r\n') + '\r\n'

const bundle = read('bundle/points_bundle_20270401.csv')
const bundleFiles = [read('bundle/points_9101_20270401.csv'), read('bundle/residents.csv'), bundle]

describe('RH-app bundle: the bytes', () => {
  it('is exactly the string the app writes', () => {
    expect(bundle.text).toBe(BUNDLE_TEXT)
  })

  it('is detected as a bundle', () => {
    expect(detectFileKind(parseCsv(bundle.text).header)).toBe('bundle')
  })
})

describe('RH-app bundle imports cleanly', () => {
  const report = run(bundleFiles)

  it('has no errors; the only warnings are the two sports with no points file', () => {
    expect(report.issues.filter((i) => i.severity === 'error')).toEqual([])
    expect(report.issues.map((i) => [i.code, i.ccaID])).toEqual([
      ['NO_LEADER_FILE', '9201'],
      ['NO_LEADER_FILE', '9202'],
    ])
    expect(report.canCompute).toBe(true)
  })

  it('reports every CCA of the bundle with its type, sport, IHG and level', () => {
    const waiver = { meanMin: 12, meanMax: 15, sdMin: 1.5, sdMax: 5 }
    expect(report.perCca.map((c) => [c.ccaID, c.status, c.n, c.flatPoints, c.type, c.isSport, c.ihgResult, c.ihgCap, c.level])).toEqual([
      ['9001', 'flat', 2, 12, '1x', false, null, null, null],
      ['9002', 'flat', 1, 7.5, null, false, null, null, null],
      ['9101', 'ok', 8, null, '1x', false, null, null, 'Low Silver'],
      ['9201', 'missing_file', 0, null, '1x', true, '1st', 12, null],
      ['9202', 'missing_file', 0, null, '1x', true, null, null, null],
    ])
    expect(report.perCca.find((c) => c.ccaID === '9101')?.range).toEqual(waiver)
    expect(report.settings?.waivers['9101']).toEqual(waiver)
  })

  it('lists the bundle CCAs in ccaID order, with the guard apostrophe kept for display', () => {
    expect(report.bundle).toEqual({
      fileName: 'points_bundle_20270401.csv',
      exportedAt: STAMP,
      ccas: [
        { ccaID: '9001', ccaName: 'Hall Choir', flatPoints: 12, type: '1x', isSport: false, ihgResult: null, ihgCap: null },
        { ccaID: '9002', ccaName: "'=Dance, Crew", flatPoints: 7.5, type: null, isSport: false, ihgResult: null, ihgCap: null },
        { ccaID: '9101', ccaName: 'Drama, Film & Theatre', flatPoints: null, type: '1x', isSport: false, ihgResult: null, ihgCap: null },
        { ccaID: '9201', ccaName: 'Soccer (M)', flatPoints: null, type: '1x', isSport: true, ihgResult: '1st', ihgCap: 12 },
        { ccaID: '9202', ccaName: 'Touch Rugby (W)', flatPoints: null, type: '1x', isSport: true, ihgResult: null, ihgCap: null },
      ],
    })
  })

  it('gives each flat member exactly the flat value for that CCA', () => {
    if (!report.input) throw new Error('expected an engine input')
    const { results } = computeAll(report.input, DEFAULT_CONFIG)
    const netOf = (matric: string, ccaID: string) =>
      results.find((r) => r.matric === matric)?.memberships.find((m) => m.ccaID === ccaID)
    expect(netOf('A9910101X', '9001')).toMatchObject({ stayNet: 12, bidNet: 12 })
    expect(netOf('A9910102X', '9001')).toMatchObject({ stayNet: 12, bidNet: 12 })
    expect(netOf('A9910103X', '9002')).toMatchObject({ stayNet: 7.5, bidNet: 7.5 })
  })

  it('needs the bundle: without it, MISSING_BUNDLE_FILE', () => {
    expect(codesOf(run(bundleFiles.filter((f) => f !== bundle)))).toEqual(['MISSING_BUNDLE_FILE'])
  })

  it('without the level entry, LEVEL_NOT_SET for 9101 only (9201 and 9202 have no file)', () => {
    const notSet = run(bundleFiles, []).issues.filter((i) => i.code === 'LEVEL_NOT_SET')
    expect(notSet.map((i) => i.ccaID)).toEqual(['9101'])
  })
})

// Contract test for the leader file: samples/app-export/points_9101_20270401.csv is SYNTHETIC but
// byte-for-byte in the format RH-app's buildPointsCsv writes (src/lib/points/exportCsv.ts there):
// CRLF with a trailing CRLF, RFC 4180 quoting, an apostrophe formula guard on free text, Y/N,
// numeric ccaID and an ISO timestamp with milliseconds. It is read beside the bundle fixture.
describe('RH-app leader export', () => {
  const leader = read('points_9101_20270401.csv')
  const report = run([leader, read('residents.csv'), bundle])

  it('uses CRLF line endings with a trailing CRLF, as the app writes', () => {
    expect(leader.text.endsWith('\r\n')).toBe(true)
    expect(leader.text.replace(/\r\n/g, '')).not.toMatch(/[\r\n]/)
  })

  it('is detected as a leader file', () => {
    expect(detectFileKind(parseCsv(leader.text).header)).toBe('leader')
  })

  it('imports with no errors beside the bundle', () => {
    expect(report.issues.filter((i) => i.severity === 'error')).toEqual([])
    expect(report.perCca.find((c) => c.ccaID === '9101')).toMatchObject({ status: 'ok', outgoingLeaders: 2 })
  })

  it('reads every column the app writes', () => {
    const rows = report.input?.memberships.filter((m) => m.ccaID === '9101') ?? []
    expect(rows).toHaveLength(6)
    expect(rows.map((m) => m.basePoints)).toEqual([10, 14, 12, 8, 16, 12])
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

  it('takes the CCA name from the bundle, comma and all', () => {
    expect(report.input?.ccas.find((c) => c.ccaID === '9101')?.ccaName).toBe('Drama, Film & Theatre')
  })

  it('runs through the engine', () => {
    if (!report.input) throw new Error('expected an engine input')
    const { lists } = computeAll(report.input, DEFAULT_CONFIG)
    expect(lists.maleStaying.length + lists.femaleStaying.length).toBe(6)
  })
})

// Parser fixtures for the older standalone exports (R33): samples/app-export/settings and
// samples/app-export/flat hold the bytes RH-app's buildSettingsCsv and buildFlatPointsCsv wrote.
// They are still recognised and parsed, but the bundle supersedes them.
describe('RH-app standalone settings file (superseded by the bundle)', () => {
  const settings = read('settings/points_settings_20270401.csv')

  it('is exactly the bytes the app wrote', () => {
    expect(settings.text).toBe(
      'formatVersion,scope,ccaID,ccaName,meanMin,meanMax,sdMin,sdMax,note,exportedAt\r\n' +
        '1,default,,,10,14,2,5,,2027-04-01T09:30:00.000Z\r\n' +
        '1,waiver,9101,"Hall Choir, Senior",12,15,1.5,5,Small CCA (<10 members),2027-04-01T09:30:00.000Z\r\n',
    )
  })

  it('is detected as a settings file and parses with no issues', () => {
    const csv = parseCsv(settings.text)
    expect(detectFileKind(csv.header)).toBe('settings')
    expect(parseSettings(settings.name, csv).issues).toEqual([])
  })

  it('alone: MISSING_BUNDLE_FILE', () => {
    const alone = [settings, read('settings/points_9101_20270401.csv'), read('settings/residents.csv')]
    expect(codesOf(run(alone))).toEqual(['MISSING_BUNDLE_FILE'])
  })

  it('beside the bundle: DUPLICATE_SETTINGS_FILE, and the bundle settings are used', () => {
    const report = run([settings, ...bundleFiles])
    expect(codesOf(report)).toEqual(['DUPLICATE_SETTINGS_FILE', 'NO_LEADER_FILE'])
    expect(report.settings?.fileName).toBe('points_bundle_20270401.csv')
  })
})

describe('RH-app standalone flat-points file (superseded by the bundle)', () => {
  const flat = read('flat/flat_points_20270401.csv')

  it('uses CRLF line endings with a trailing CRLF, as the app wrote', () => {
    expect(flat.text.startsWith('formatVersion,ccaID,ccaName,matric,name,flatPoints,exportedAt\r\n')).toBe(true)
    expect(flat.text.endsWith('\r\n')).toBe(true)
    expect(flat.text.replace(/\r\n/g, '')).not.toMatch(/[\r\n]/)
  })

  it('is detected as a flat file and parses with no issues', () => {
    const csv = parseCsv(flat.text)
    expect(detectFileKind(csv.header)).toBe('flat')
    expect(parseFlat(flat.name, csv).issues).toEqual([])
  })

  it('alone: MISSING_BUNDLE_FILE', () => {
    expect(codesOf(run([flat, read('flat/residents.csv')]))).toEqual(['MISSING_BUNDLE_FILE'])
  })

  it('beside the bundle: DUPLICATE_FLAT_FILE', () => {
    expect(codesOf(run([flat, ...bundleFiles]))).toEqual(['DUPLICATE_FLAT_FILE', 'NO_LEADER_FILE'])
  })
})
