import { describe, expect, it } from 'vitest'
import { DEFAULT_CONFIG } from '../../engine'
import { deepFreeze } from '../../engine/__tests__/helpers'
import { checklistComplete, checklistRows, type ChecklistRow } from '../checklist'
import type { NotSubmittingMark } from '../review'
import { validateImport } from '../validate'
import type { ImportReport, SourceFile } from '../types'
import { DEMO_LEVELS, flatCca, flatRows, leaderRows, patchRow, scenario } from './fixtures'

const mark = (ccaID: string, note = ''): NotSubmittingMark => ({ ccaID, note, at: '2027-04-02T10:00:00.000Z' })

/** C1 (file), C2 (file), C3 flat, C4 "Archery" (no file), C5 "band" sport with no type, result or cap (no file). */
const ccas = [
  ...patchRow(
    [
      { ccaID: 'C1', ccaName: 'Test CCA One', type: '1x' },
      { ccaID: 'C2', ccaName: 'Test CCA Two', type: '0.5x' },
    ],
    0,
    { sport: 'Y', ihgResult: '2nd', ihgCap: '12' },
  ),
  flatCca('C3', '9'),
  { ccaID: 'C4', ccaName: 'Archery', type: '1x' },
  { ccaID: 'C5', ccaName: 'band', type: '', sport: 'Y' },
]

const reportOf = (files: readonly SourceFile[] = scenario({ ccas, flat: flatRows('C3', '9') })): ImportReport =>
  validateImport(files, DEFAULT_CONFIG, { ccaLevels: DEMO_LEVELS })

const byId = (rows: readonly ChecklistRow[], ccaID: string): ChecklistRow | undefined => rows.find((r) => r.ccaID === ccaID)

describe('checklistRows', () => {
  it("lists the bundle's CCAs in review order with what the bundle and the report say", () => {
    const rows = checklistRows(reportOf(), [])
    expect(rows.map((r) => r.name)).toEqual(['Archery', 'band', 'Test CCA One', 'Test CCA Two', 'Test Flat C3'])
    expect(byId(rows, 'C1')).toEqual({
      ccaID: 'C1',
      name: 'Test CCA One',
      status: 'present',
      fileName: 'points_C1_20270401.csv',
      note: null,
      type: '1x',
      isSport: true,
      ihgResult: '2nd',
      ihgCap: 12,
      level: 'High Gold',
      flatPoints: null,
    })
  })

  it('passes nullable type, IHG result, cap and level through (the UI shows "not set")', () => {
    expect(byId(checklistRows(reportOf(), []), 'C5')).toMatchObject({
      status: 'missing', type: null, isSport: true, ihgResult: null, ihgCap: null, level: null, fileName: null,
    })
  })

  it('a flat CCA is flat, with its value', () => {
    expect(byId(checklistRows(reportOf(), []), 'C3')).toMatchObject({ status: 'flat', flatPoints: 9 })
  })

  it('not submitting = a mark and no file; superseded = a mark and a file; both keep the note', () => {
    const rows = checklistRows(reportOf(), [mark('C4', 'Inactive this year'), mark('C1', 'Thought it was late')])
    expect(byId(rows, 'C4')).toMatchObject({ status: 'not_submitting', note: 'Inactive this year', fileName: null })
    expect(byId(rows, 'C1')).toMatchObject({ status: 'superseded', note: 'Thought it was late', fileName: 'points_C1_20270401.csv' })
  })

  it('a mark on a flat CCA leaves it flat', () => {
    expect(byId(checklistRows(reportOf(), [mark('C3')]), 'C3')?.status).toBe('flat')
  })

  it('a leader file with row errors is still present', () => {
    const files = scenario({ ccas, flat: flatRows('C3', '9'), leaders: { C1: patchRow(leaderRows('C1'), 0, { basePoints: '25' }), C2: leaderRows('C2') } })
    const report = reportOf(files)
    expect(report.canCompute).toBe(false)
    expect(byId(checklistRows(report, []), 'C1')?.status).toBe('present')
  })

  it('ignores a mark for a CCA that is not in the bundle', () => {
    const rows = checklistRows(reportOf(), [mark('C9')])
    expect(rows.map((r) => r.ccaID)).not.toContain('C9')
    expect(rows).toEqual(checklistRows(reportOf(), []))
  })

  it('is empty without a bundle', () => {
    expect(checklistRows(reportOf(scenario({ bundle: null })), [mark('C1')])).toEqual([])
  })

  it('does not mutate its inputs', () => {
    expect(() => checklistRows(deepFreeze(reportOf()), deepFreeze([mark('C4')]))).not.toThrow()
  })
})

describe('checklistComplete', () => {
  it('is false while any CCA is missing', () => {
    expect(checklistComplete(checklistRows(reportOf(), []))).toBe(false)
    expect(checklistComplete(checklistRows(reportOf(), [mark('C4')]))).toBe(false)
  })

  it('is true once every CCA is present, flat, not submitting or superseded', () => {
    expect(checklistComplete(checklistRows(reportOf(), [mark('C4'), mark('C5'), mark('C1')]))).toBe(true)
  })

  it('is false for an empty list', () => {
    expect(checklistComplete([])).toBe(false)
  })
})
