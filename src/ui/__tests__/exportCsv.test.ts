import { describe, expect, it } from 'vitest'
import { DEFAULT_CONFIG, compareRuns, computeAll, type ListRow } from '../../engine'
import { makeInput } from '../../engine/__tests__/helpers'
import { EXPORT_COLUMNS, buildListCsv, entryCounts, exportFileName, levelsLine, meanSdOutOfRangeLine, tweaksLine } from '../export/exportCsv'
import { buildComparisonCsv } from '../compare/compareData'
import { bandRows } from '../results/bands'

const NL = String.fromCharCode(10)
const NO_REVIEW = { edits: [], flatIds: [], tickEdits: [], flatEdits: [], auxEdits: [], auxUnchecked: false, flats: [] }
const ZERO = { finalOverrides: 0, discretion: 0, reviewEdits: 0, tickEdits: 0, flatEdits: 0, auxEdits: 0, ihgOverCap: [] as string[] }
const config = { ...DEFAULT_CONFIG, headcounts: { ...DEFAULT_CONFIG.headcounts, maleGreen: 1, maleGrey: 1 } }
const { lists } = computeAll(
  makeInput([
    { id: 'A9900001Z', base: 15 },
    { id: 'A9900002Z', base: 12 },
    { id: 'A9900003Z', base: 12 },
  ]),
  config,
)

const LEVELS = [
  { name: 'Gold', bonus: 4, multiplier: 1.3 },
  { name: 'High Silver', bonus: 2, multiplier: 1.2 },
]
const cca = (ccaID: string, name: string, level: string | null, patch: Record<string, unknown> = {}) => ({
  ccaID, name, fileName: `points_${ccaID}.csv`, status: 'ok' as const, level, bonusOverride: null, multiplierOverride: null, ...patch,
})
const soccer = cca('C05', 'Soccer', 'Gold', { multiplierOverride: 1.31 })
const rugby = cca('C07', 'Rugby', 'Gold')

describe('levels and tweaks lines', () => {
  it('groups CCAs by level in Settings order, names inside, "not set" last', () => {
    const perCca = [cca('C09', 'Chess', null), cca('C02', 'Band', 'High Silver'), soccer, cca('C04', 'Archery', 'Gold')]
    expect(levelsLine(perCca, LEVELS)).toBe('# levels: Gold: C04, C05; High Silver: C02; not set: C09')
  })

  it('leaves out CCAs without a leader file and flat CCAs', () => {
    const perCca = [cca('C01', 'Flat', null, { status: 'flat' }), cca('C03', 'Quiet', null, { fileName: null }), rugby]
    expect(levelsLine(perCca, LEVELS)).toBe('# levels: Gold: C07')
    expect(levelsLine([], LEVELS)).toBe('# levels: none')
  })

  it('writes a tweak as the CCA, its level, the tweaked number and the level number', () => {
    expect(tweaksLine([soccer], LEVELS)).toBe('# level tweaks: Soccer (C05): Gold, multiplier 1.31 (level 1.3)')
    const both = cca('C02', 'Band', 'High Silver', { bonusOverride: 2.5, multiplierOverride: 1.25 })
    expect(tweaksLine([both], LEVELS)).toBe('# level tweaks: Band (C02): High Silver, bonus 2.5 (level 2), multiplier 1.25 (level 1.2)')
  })

  it('joins tweaks with " | " and says none when there are none', () => {
    const bonus = cca('C02', 'Band', 'High Silver', { bonusOverride: 3 })
    expect(tweaksLine([soccer, bonus], LEVELS)).toBe(
      '# level tweaks: Soccer (C05): Gold, multiplier 1.31 (level 1.3) | Band (C02): High Silver, bonus 3 (level 2)',
    )
    expect(tweaksLine([rugby], LEVELS)).toBe('# level tweaks: none')
  })

  it('counts only the applied review edits', () => {
    const edit = (status: 'applied' | 'changed' | 'stale') => ({ entry: { matric: 'A', ccaID: 'C1', from: 1, to: 2, reason: '', at: '' }, status, fileValue: 1 })
    const review = { ...NO_REVIEW, edits: [edit('applied'), edit('changed'), edit('stale'), edit('applied')] }
    expect(entryCounts(null, review).reviewEdits).toBe(2)
    expect(entryCounts(null).reviewEdits).toBe(0)
  })

  it('counts only the applied tick, flat and AUX edits', () => {
    const judged = (status: 'applied' | 'changed' | 'stale') => ({ entry: {}, status, fileValue: 1 })
    const review = {
      ...NO_REVIEW,
      tickEdits: [judged('applied'), judged('changed')],
      flatEdits: [judged('applied'), judged('applied'), judged('stale')],
      auxEdits: [judged('applied'), judged('changed')],
    } as unknown as Parameters<typeof entryCounts>[1]
    expect(entryCounts(null, review)).toMatchObject({ tickEdits: 1, flatEdits: 2, auxEdits: 1 })
    expect(entryCounts(null)).toMatchObject({ tickEdits: 0, flatEdits: 0, auxEdits: 0, ihgOverCap: [] })
  })

  it('lists the CCAs with more ticks than their cap, by name and id', () => {
    const sport = (ccaID: string, name: string, ihgTicked: number, ihgCap: number | null) => ({ ccaID, name, ihgTicked, ihgCap })
    const perCca = [sport('C09', 'Tennis', 3, 3), sport('C05', 'Soccer', 5, 4), sport('C02', 'Badminton', 2, null), sport('C01', 'Chess', 9, 2)]
    expect(entryCounts(null, NO_REVIEW, perCca).ihgOverCap).toEqual(['Soccer (C05)', 'Chess (C01)'])
  })
})

describe('CSV export', () => {
  it('starts with the ten comment lines, then the column header', () => {
    const lines = buildListCsv(lists.maleStaying, []).split(NL)
    expect(lines.slice(0, 10)).toEqual([
      '# mean/SD out of range: none',
      '# final-points overrides: 0',
      '# discretion adjustments: 0',
      '# review edits: 0',
      '# IHG tick edits: 0',
      '# flat value edits: 0',
      '# AUX edits: 0',
      '# IHG over cap: none',
      '# levels: none',
      '# level tweaks: none',
    ])
    expect(lines[10]).toBe('rank,position,matric,name,points,status,tieFlags,labels')
    expect(EXPORT_COLUMNS).toHaveLength(8)
  })

  it('writes the review, levels and tweaks lines before the finalised line', () => {
    const counts = { ...ZERO, reviewEdits: 4, tickEdits: 2, flatEdits: 1, auxEdits: 3, ihgOverCap: ['Soccer (C05)', 'Chess (C01)'] }
    const lines = buildListCsv(lists.maleStaying, [], 1, counts, { perCca: [soccer, rugby], levels: LEVELS }).split(NL)
    expect(lines.slice(3, 11)).toEqual([
      '# review edits: 4',
      '# IHG tick edits: 2',
      '# flat value edits: 1',
      '# AUX edits: 3',
      '# IHG over cap: Soccer (C05), Chess (C01)',
      '# levels: Gold: C07, C05',
      '# level tweaks: Soccer (C05): Gold, multiplier 1.31 (level 1.3)',
      '# finalised: yes · penalties: 1',
    ])
  })

  it('never puts a score or a resident name in a header line', () => {
    const csv = buildListCsv(lists.maleStaying, [], 0, { ...ZERO, finalOverrides: 1, discretion: 1, reviewEdits: 2, tickEdits: 1, flatEdits: 1, auxEdits: 1, ihgOverCap: ['Soccer (C05)'] }, { perCca: [soccer], levels: LEVELS })
    const header = csv.split(NL).filter((line) => line.startsWith('#')).join(NL)
    expect(header).not.toMatch(/A99\d{5}Z/)
    expect(header).not.toMatch(/Resident|Test Name/i)
    expect(header).not.toMatch(/\d+\.\d{3}/)
  })

  it('counts the final-points overrides and discretion adjustments in force', () => {
    const lines = buildListCsv(lists.maleStaying, [], null, { ...ZERO, finalOverrides: 3, discretion: 2 }).split('\n')
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
    expect(lines).toHaveLength(11 + 3)
    expect(lines[11]).toBe('1,1,A9900001Z,A9900001Z,15.000,green,,')
    expect(lines[12]).toBe('2,2,A9900002Z,A9900002Z,12.000,grey,TIE grey/white — 1 of 2 seats,')
  })

  it('quotes cells containing commas or quotes', () => {
    const row: ListRow = { ...(lists.maleStaying[0] as ListRow), name: 'Resident, "Test"', labels: ['sem-2', 'informational'] }
    const line = buildListCsv([row], []).split(NL)[11]
    expect(line).toContain('"Resident, ""Test"""')
    expect(line?.endsWith('sem-2; informational')).toBe(true)
  })

  it('adds the finalised line after the other comment lines while finalised', () => {
    const lines = buildListCsv(lists.maleStaying, [{ name: 'Test CCA 03' }], 2).split(NL)
    expect(lines.slice(0, 12)).toEqual([
      '# mean/SD out of range: Test CCA 03',
      '# final-points overrides: 0',
      '# discretion adjustments: 0',
      '# review edits: 0',
      '# IHG tick edits: 0',
      '# flat value edits: 0',
      '# AUX edits: 0',
      '# IHG over cap: none',
      '# levels: none',
      '# level tweaks: none',
      '# finalised: yes · penalties: 2',
      'rank,position,matric,name,points,status,tieFlags,labels',
    ])
    expect(buildListCsv(lists.maleStaying, [], 0).split(NL)[10]).toBe('# finalised: yes · penalties: 0')
  })

  it('starts a comparison export with the comment lines', () => {
    const run = computeAll(makeInput([{ id: 'A9900001Z', base: 15 }]), config)
    const lines = buildComparisonCsv(compareRuns(run, run), [], { a: 'Current settings', b: 'Draft' }).split(NL)
    expect(lines[0]).toBe('# mean/SD out of range: none')
    expect(lines[1]).toBe('# final-points overrides: 0')
    expect(lines[2]).toBe('# discretion adjustments: 0')
    expect(lines.slice(3, 10)).toEqual(['# review edits: 0', '# IHG tick edits: 0', '# flat value edits: 0', '# AUX edits: 0', '# IHG over cap: none', '# levels: none', '# level tweaks: none'])
    expect(lines[10]).toBe('# A: Current settings · B: Draft')
    expect(lines[11]?.startsWith('list,matric,name,statusA,statusB')).toBe(true)
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
