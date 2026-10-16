import { describe, expect, it } from 'vitest'
import { DEFAULT_CONFIG, computeAll, type ListRow } from '../../engine'
import { makeInput } from '../../engine/__tests__/helpers'
import { EXPORT_COLUMNS, buildListCsv, exportFileName, overridesLine } from '../export/exportCsv'
import { bandRows } from '../results/bands'

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
  it('starts with the overrides line, then the column header', () => {
    const lines = buildListCsv(lists.maleStaying, []).split('\n')
    expect(lines[0]).toBe('# overrides: none')
    expect(lines[1]).toBe('rank,position,matric,name,points,status,tieFlags,labels')
    expect(EXPORT_COLUMNS).toHaveLength(8)
  })

  it('names every overridden CCA', () => {
    expect(overridesLine(['Test CCA 03', 'Test CCA 07'])).toBe('# overrides: Test CCA 03, Test CCA 07')
    expect(buildListCsv([], [{ name: 'Test CCA 03' }]).split('\n')[0]).toBe('# overrides: Test CCA 03')
  })

  it('writes one row per resident with 3-decimal points, status and tie flags', () => {
    const lines = buildListCsv(lists.maleStaying, []).trimEnd().split('\n')
    expect(lines).toHaveLength(2 + 3)
    expect(lines[2]).toBe('1,1,A9900001Z,A9900001Z,15.000,green,,')
    expect(lines[3]).toBe('2,2,A9900002Z,A9900002Z,12.000,grey,TIE grey/white — 1 of 2 seats,')
  })

  it('quotes cells containing commas or quotes', () => {
    const row: ListRow = { ...(lists.maleStaying[0] as ListRow), name: 'Resident, "Test"', labels: ['sem-2', 'informational'] }
    const line = buildListCsv([row], []).split('\n')[2]
    expect(line).toContain('"Resident, ""Test"""')
    expect(line?.endsWith('sem-2; informational')).toBe(true)
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
