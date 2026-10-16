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
