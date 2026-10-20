import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { baseCcas, baseResidents, flatCca, flatRows, leaderRows, matricOf, scenario } from '../../import/__tests__/fixtures'
import type { ImportReport } from '../../import'
import { initialState, reducer, type AppState } from '../state/store'
import { AUX_PROBLEMS, auxAction } from '../summary/auxAction'
import { ResidentSummary } from '../summary/ResidentSummary'
import { SummaryScreen } from '../summary/SummaryScreen'
import { SummaryTable } from '../summary/SummaryTable'
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
    expect(summaryCounts(rowsOf(state))).toEqual({ residents: 10, discretion: 1, edits: 1, ihgRecipients: 1, auxEdits: 0, flatEdits: 0 })
  })

  it('counts applied AUX edits and flat edits', () => {
    let state = flatLoad()
    state = reducer(state, { type: 'setAuxEdit', entry: auxEdit(2, 5, 7) })
    state = reducer(state, { type: 'setFlatEdit', entry: { matric: matricOf(1), ccaID: 'C3', from: 12, to: 10, reason: '', at: AT } })
    expect(summaryCounts(rowsOf(state))).toMatchObject({ auxEdits: 1, flatEdits: 1 })
  })
})

const auxEdit = (n: number, from: number, to: number, reason = '') => ({ matric: matricOf(n), from, to, reason, at: AT })

function flatLoad(): AppState {
  const files = scenario({ ccas: [...baseCcas(), flatCca('C3', '12')], flat: flatRows('C3', '12', 6) })
  return reducer(initialState(), { type: 'addFiles', files })
}

describe('AUX and flat edit fields', () => {
  it('shows the count in use, the file count and the checked status', () => {
    const state = reducer(load(), { type: 'setAuxEdit', entry: auxEdit(2, 7, 9, 'recount') })
    const row = rowsOf(state).find((r) => r.matric === matricOf(2))
    expect(row).toMatchObject({ aux: 9, auxFile: 7, auxEdit: 'applied' })
    expect(rowsOf(state).find((r) => r.matric === matricOf(1))).toMatchObject({ aux: 5, auxFile: 5, auxEdit: null })
  })

  it('removing the edit returns to the file count', () => {
    let state = reducer(load(), { type: 'setAuxEdit', entry: auxEdit(2, 7, 9) })
    state = reducer(state, { type: 'removeAuxEdit', matric: matricOf(2), at: AT })
    expect(rowsOf(state).find((r) => r.matric === matricOf(2))).toMatchObject({ aux: 7, auxFile: 7, auxEdit: null })
  })

  it('marks an edited flat membership with the file value', () => {
    const state = reducer(flatLoad(), { type: 'setFlatEdit', entry: { matric: matricOf(1), ccaID: 'C3', from: 12, to: 10, reason: '', at: AT } })
    const rows = rowsOf(state)
    expect(rows.find((r) => r.matric === matricOf(1))?.memberships.find((m) => m.ccaID === 'C3')).toMatchObject({ flatPoints: 10, flatEdited: true, flatFile: 12 })
    expect(rows.find((r) => r.matric === matricOf(2))?.memberships.find((m) => m.ccaID === 'C3')).toMatchObject({ flatPoints: 12, flatEdited: false, flatFile: 12 })
    expect(rows.find((r) => r.matric === matricOf(1))?.memberships.find((m) => m.ccaID === 'C1')?.flatFile).toBeNull()
  })

  it('carries no points, totals or amounts (R12)', () => {
    const state = reducer(load(), { type: 'setAuxEdit', entry: auxEdit(2, 7, 9) })
    const keys = new Set(rowsOf(state).flatMap((r) => [...Object.keys(r), ...r.memberships.flatMap((m) => Object.keys(m))]))
    for (const key of keys) expect(key).not.toMatch(/staying|bidding|total|auxPoints|ihgPoints|amount|final/i)
  })
})

describe('auxAction', () => {
  const base = { matric: matricOf(2), fileValue: 6, reason: '', hasEdit: false, at: AT }

  it('dispatches setAuxEdit from the FILE value when 6 becomes 7', () => {
    expect(auxAction({ ...base, to: '7' })).toEqual({
      action: { type: 'setAuxEdit', entry: { matric: matricOf(2), from: 6, to: 7, reason: '', at: AT } },
      problem: null,
    })
  })

  it('removes the edit when the count is back at the file value', () => {
    expect(auxAction({ ...base, to: '6', hasEdit: true }).action).toEqual({ type: 'removeAuxEdit', matric: matricOf(2), at: AT })
    expect(auxAction({ ...base, to: '6' }).action).toBeNull()
  })

  it('refuses a non-whole or negative count', () => {
    for (const to of ['', '1.5', '-1', 'x']) expect(auxAction({ ...base, to })).toEqual({ action: null, problem: AUX_PROBLEMS.BAD_AUX_EDIT })
  })

  it('refuses a reason that is too long', () => {
    expect(auxAction({ ...base, to: '7', reason: 'x'.repeat(500) }).problem).toBe(AUX_PROBLEMS.MISSING_REASON)
  })

  it('dispatches into the store and the edit applies', () => {
    const { action } = auxAction({ ...base, fileValue: 7, to: '9' })
    expect(action).not.toBeNull()
    const row = rowsOf(reducer(load(), action!)).find((r) => r.matric === matricOf(2))
    expect(row).toMatchObject({ aux: 9, auxFile: 7 })
  })
})

describe('Summary markup', () => {
  const noop = () => undefined
  const table = (state: AppState) =>
    renderToStaticMarkup(
      createElement(SummaryTable, {
        rows: rowsOf(state),
        editing: { locked: state.finalised !== null } as never,
        auxCap: 10,
        locked: state.finalised !== null,
        dispatch: noop,
        expanded: new Set<string>(),
        discretionOpen: new Set<string>(),
        onToggleExpanded: noop,
        onToggleDiscretion: noop,
      }),
    )

  it('shows the edited chip with the file count', () => {
    expect(table(reducer(load(), { type: 'setAuxEdit', entry: auxEdit(2, 7, 9) }))).toContain('edited (was 7)')
  })

  it('says only the cap counts above the cap, as a fact about the input', () => {
    expect(table(reducer(load(), { type: 'setAuxEdit', entry: auxEdit(2, 7, 14) }))).toContain('only 10 count')
    expect(table(load())).not.toContain('only 10 count')
  })

  it('shows the JCRC note for a JCRC member', () => {
    expect(table(load())).toContain(JCRC_NOTE)
  })

  it('shows "flat 10 (was 12)" for an edited flat membership', () => {
    const state = reducer(flatLoad(), { type: 'setFlatEdit', entry: { matric: matricOf(1), ccaID: 'C3', from: 12, to: 10, reason: '', at: AT } })
    const rows = rowsOf(state)
    const edited = renderToStaticMarkup(createElement(ResidentSummary, { row: rows.find((r) => r.matric === matricOf(1))! }))
    expect(edited).toContain('flat 10')
    expect(edited).toContain('(was 12)')
    const other = renderToStaticMarkup(createElement(ResidentSummary, { row: rows.find((r) => r.matric === matricOf(2))! }))
    expect(other).toContain('flat 12')
    expect(other).not.toContain('(was')
  })

  it('lists the AUX log newest first with no reviewer, and shows no points', () => {
    let state = reducer(load(), { type: 'setAuxEdit', entry: auxEdit(2, 7, 9, 'recount') })
    state = reducer(state, { type: 'setAuxEdit', entry: { ...auxEdit(4, 5, 8), at: '2027-04-02T11:00:00.000Z' } })
    const html = renderToStaticMarkup(createElement(SummaryScreen, { state, dispatch: noop })).replace(/<!-- -->/g, '')
    expect(html).toContain('AUX log')
    expect(html).toContain('recount')
    expect(html.indexOf('5 → 8')).toBeLessThan(html.indexOf('7 → 9'))
    expect(html).not.toMatch(/reviewer/i)
    expect(html).toContain('2 AUX edits')
    expect(html).not.toMatch(/staying points|bidding points|AUX points/i)
  })
})
