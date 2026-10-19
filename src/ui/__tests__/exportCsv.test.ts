import { describe, expect, it } from 'vitest'
import { DEFAULT_CONFIG, compareRuns, computeAll, type ListRow } from '../../engine'
import { makeInput } from '../../engine/__tests__/helpers'
import { EXPORT_COLUMNS, buildListCsv, exportFileName, meanSdOutOfRangeLine } from '../export/exportCsv'
import { buildComparisonCsv } from '../compare/compareData'
import { bandRows } from '../results/bands'

const NL = String.fromCharCode(10)
const config = { ...DEFAULT_CONFIG, headcounts: { ...DEFAULT_CONFIG.headcounts, maleGreen: 1, maleGrey: 1 } }
const { lists } = computeAll(
  makeInput([
    { id: 'A9900001Z', base: 15 },
    { id: 'A9900002Z', base: 12 },
    { id: 'A9900003Z', base: 12 },
  ]),
  config,
)

describe('CSV export', () => {
  it('starts with the three comment lines, then the column header', () => {
    const lines = buildListCsv(lists.maleStaying, []).split('\n')
    expect(lines[0]).toBe('# mean/SD out of range: none')
    expect(lines[1]).toBe('# final-points overrides: 0')
    expect(lines[2]).toBe('# discretion adjustments: 0')
    expect(lines[3]).toBe('rank,position,matric,name,points,status,tieFlags,labels')
    expect(EXPORT_COLUMNS).toHaveLength(8)
  })

  it('counts the final-points overrides and discretion adjustments in force', () => {
    const lines = buildListCsv(lists.maleStaying, [], null, { finalOverrides: 3, discretion: 2 }).split('\n')
    expect(lines.slice(0, 3)).toEqual([
      '# mean/SD out of range: none',
      '# final-points overrides: 3',
      '# discretion adjustments: 2',
    ])
  })

  it('names every out-of-range CCA', () => {
    expect(meanSdOutOfRangeLine(['Test CCA 03', 'Test CCA 07'])).toBe('# mean/SD out of range: Test CCA 03, Test CCA 07')
    expect(buildListCsv([], [{ name: 'Test CCA 03' }]).split('\n')[0]).toBe('# mean/SD out of range: Test CCA 03')
  })

  it('writes one row per resident with 3-decimal points, status and tie flags', () => {
    const lines = buildListCsv(lists.maleStaying, []).trimEnd().split('\n')
    expect(lines).toHaveLength(4 + 3)
    expect(lines[4]).toBe('1,1,A9900001Z,A9900001Z,15.000,green,,')
    expect(lines[5]).toBe('2,2,A9900002Z,A9900002Z,12.000,grey,TIE grey/white — 1 of 2 seats,')
  })

  it('quotes cells containing commas or quotes', () => {
    const row: ListRow = { ...(lists.maleStaying[0] as ListRow), name: 'Resident, "Test"', labels: ['sem-2', 'informational'] }
    const line = buildListCsv([row], []).split('\n')[4]
    expect(line).toContain('"Resident, ""Test"""')
    expect(line?.endsWith('sem-2; informational')).toBe(true)
  })

  it('adds the finalised line after the three comment lines while finalised', () => {
    const lines = buildListCsv(lists.maleStaying, [{ name: 'Test CCA 03' }], 2).split(NL)
    expect(lines.slice(0, 5)).toEqual([
      '# mean/SD out of range: Test CCA 03',
      '# final-points overrides: 0',
      '# discretion adjustments: 0',
      '# finalised: yes · penalties: 2',
      'rank,position,matric,name,points,status,tieFlags,labels',
    ])
    expect(buildListCsv(lists.maleStaying, [], 0).split(NL)[3]).toBe('# finalised: yes · penalties: 0')
  })

  it('starts a comparison export with the comment lines', () => {
    const run = computeAll(makeInput([{ id: 'A9900001Z', base: 15 }]), config)
    const lines = buildComparisonCsv(compareRuns(run, run), [], { a: 'Current settings', b: 'Draft' }).split(NL)
    expect(lines[0]).toBe('# mean/SD out of range: none')
    expect(lines[1]).toBe('# final-points overrides: 0')
    expect(lines[2]).toBe('# discretion adjustments: 0')
    expect(lines[3]).toBe('# A: Current settings · B: Draft')
    expect(lines[4]?.startsWith('list,matric,name,statusA,statusB')).toBe(true)
  })

  it('names files rhps_<list>_<YYYYMMDD-HHmm>.csv', () => {
    const at = new Date(2027, 3, 1, 9, 5)
    expect(exportFileName('maleStaying', at)).toBe('rhps_male-staying_20270401-0905.csv')
    expect(exportFileName('sem2', at)).toBe('rhps_sem2_20270401-0905.csv')
  })
})

describe('band dividers', () => {
  it('keeps every band when a search filters rows out', () => {
    const bands = bandRows('maleStaying', lists.maleStaying, config, '0003')
    expect(bands.map((b) => b.label)).toEqual(['Green · 1 seat', 'Grey · 1 seat', 'White'])
    expect(bands.map((b) => b.rows.length)).toEqual([0, 0, 1])
  })

  it('gives bidding lists a single unlabelled band', () => {
    const bands = bandRows('maleBidding', lists.maleBidding, config, '')
    expect(bands).toHaveLength(1)
    expect(bands[0]?.label).toBe('')
  })
})
