import { describe, expect, it } from 'vitest'
import { baseCcas, baseResidents, flatCca, flatRows, leaderRows, matricOf, scenario } from '../../import/__tests__/fixtures'
import type { ImportReport } from '../../import'
import { initialState, reducer, type AppState } from '../state/store'
import { JCRC_NOTE, summaryCounts, summaryRows, type SummaryReport } from '../summary/summaryData'

const AT = '2027-04-02T10:00:00.000Z'

/** C1 is a sport with a 1st-place result and a cap of 2; resident 1 is ticked. R3 is JCRC, R2 has aux 7. */
function load(): AppState {
  const residents = baseResidents().map((row, i) =>
    i === 2 ? { ...row, jcrc: 'FULL' } : i === 1 ? { ...row, aux: '7' } : row,
  )
  const ccas = baseCcas().map((c, i) => (i === 0 ? { ...c, sport: 'Y', ihgResult: '1st', ihgCap: '2' } : c))
  const leaders = { C1: leaderRows('C1', undefined, { ihg: [0] }), C2: leaderRows('C2') }
  return reducer(initialState(), { type: 'addFiles', files: scenario({ residents, ccas, leaders }) })
}

const rowsOf = (state: AppState) =>
  summaryRows(state.report, state.review, state.ccaLevels, state.discretion)

describe('summaryRows', () => {
  it('returns one row per resident, sorted by name', () => {
    const rows = rowsOf(load())
    expect(rows).toHaveLength(10)
    const names = rows.map((r) => r.name)
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b, 'en', { numeric: true, sensitivity: 'base' })))
    expect(rows[0]).toMatchObject({ matric: matricOf(1), gender: 'M', sem2: false, aux: 5 })
  })

  it('shows AUX as the count and the JCRC status with its note', () => {
    const rows = rowsOf(load())
    expect(rows.find((r) => r.matric === matricOf(2))?.aux).toBe(7)
    const jcrc = rows.find((r) => r.matric === matricOf(3))
    expect(jcrc).toMatchObject({ jcrc: 'FULL', jcrcNote: JCRC_NOTE })
    expect(JCRC_NOTE).toBe('value set from H on Results')
    expect(rows.find((r) => r.matric === matricOf(1))).toMatchObject({ jcrc: 'N', jcrcNote: null })
  })

  it('lists the IHG entries and flags the ticked membership', () => {
    const row = rowsOf(load()).find((r) => r.matric === matricOf(1))
    expect(row?.ihg).toEqual([{ ccaID: 'C1', result: '1st' }])
    expect(row?.memberships.find((m) => m.ccaID === 'C1')?.ihg).toBe(true)
    expect(row?.memberships.find((m) => m.ccaID === 'C2')?.ihg).toBe(false)
    expect(rowsOf(load()).find((r) => r.matric === matricOf(2))?.ihg).toEqual([])
  })

  it('carries the reviewed score, edited flag, level name and tweak marker', () => {
    let state = load()
    state = reducer(state, { type: 'setCcaLevel', entry: { ccaID: 'C1', level: 'High Gold', bonusOverride: 1.5, multiplierOverride: null } })
    state = reducer(state, { type: 'setReviewEdit', entry: { matric: matricOf(1), ccaID: 'C1', from: 8, to: 11, reason: '', at: AT } })
    const row = rowsOf(state).find((r) => r.matric === matricOf(1))
    const c1 = row?.memberships.find((m) => m.ccaID === 'C1')
    expect(c1).toMatchObject({ basePoints: 11, edited: true, levelName: 'High Gold', tweaked: true, semesterOnly: false })
    const c2 = row?.memberships.find((m) => m.ccaID === 'C2')
    expect(c2).toMatchObject({ basePoints: 8, edited: false, tweaked: false, outgoingRole: 'none', incomingRole: 'none' })
  })

  it('carries flat points for a flat CCA membership', () => {
    const files = scenario({
      ccas: [...baseCcas(), flatCca('C3', '12')],
      flat: flatRows('C3', '12', 6),
    })
    const state = reducer(initialState(), { type: 'addFiles', files })
    const row = rowsOf(state).find((r) => r.matric === matricOf(1))
    expect(row?.memberships.find((m) => m.ccaID === 'C3')?.flatPoints).toBe(12)
    expect(row?.memberships.find((m) => m.ccaID === 'C1')?.flatPoints).toBeNull()
  })

  it('attaches the discretion entry', () => {
    const entry = { matric: matricOf(4), stayingDelta: 2, biddingDelta: -1, reason: 'Service' }
    const state = reducer(load(), { type: 'setDiscretion', entry })
    expect(rowsOf(state).find((r) => r.matric === matricOf(4))?.discretion).toEqual(entry)
    expect(rowsOf(state).find((r) => r.matric === matricOf(5))?.discretion).toBeNull()
  })

  it('works from a report that has no computed results at all', () => {
    const { input, perCca, review } = load().report
    const bare: SummaryReport = { input, perCca, review }
    const typed: Pick<ImportReport, 'input' | 'perCca' | 'review'> = bare
    expect(Object.keys(typed)).not.toContain('results')
    const state = load()
    const rows = summaryRows(bare, state.review, state.ccaLevels, [])
    expect(rows).toHaveLength(10)
  })

  it('returns nothing when the import has no input', () => {
    const state = load()
    expect(summaryRows({ ...state.report, input: undefined }, state.review, [], [])).toEqual([])
  })
})

describe('summaryCounts', () => {
  it('counts residents, discretion entries, applied edits and IHG recipients', () => {
    let state = load()
    state = reducer(state, { type: 'setDiscretion', entry: { matric: matricOf(4), stayingDelta: 1, biddingDelta: 1, reason: 'x' } })
    state = reducer(state, { type: 'setReviewEdit', entry: { matric: matricOf(1), ccaID: 'C1', from: 8, to: 11, reason: '', at: AT } })
    expect(summaryCounts(rowsOf(state))).toEqual({ residents: 10, discretion: 1, edits: 1, ihgRecipients: 1 })
  })
})
