import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { leaderFileName, leaderRows, matricOf, scenario } from '../../import/__tests__/fixtures'
import { initialState, reducer, type AppState } from '../state/store'
import { ResidentSummary } from '../summary/ResidentSummary'
import { summaryRows } from '../summary/summaryData'

const AT = '2027-04-02T10:00:00.000Z'
const files = scenario({ leaders: { C1: leaderRows('C1'), C2: leaderRows('C2') } })
const role = { matric: matricOf(1), ccaID: 'C1', field: 'outgoingRole' as const, from: 'none' as const, to: 'head' as const, reason: '', at: AT }
const sem = { matric: matricOf(1), ccaID: 'C2', field: 'semesterOnly' as const, from: false, to: true, reason: '', at: AT }
const edited = (): AppState =>
  reducer(reducer(reducer(initialState(), { type: 'addFiles', files }), { type: 'setMembershipEdit', entry: role }), { type: 'setMembershipEdit', entry: sem })
const rowsOf = (state: AppState) => summaryRows(state.report, state.review, state.ccaLevels, state.discretion)
const html = (state: AppState, n: number): string =>
  renderToStaticMarkup(createElement(ResidentSummary, { row: rowsOf(state).find((r) => r.matric === matricOf(n))! }))

describe('role and semester edits on the Summary', () => {
  it('shows "Head (was none)" and "1 sem (was full year)" for the edited member only', () => {
    const one = html(edited(), 1)
    expect(one).toContain('Head (was none)')
    expect(one).toContain('1 sem (was full year)')
    expect(html(edited(), 2)).not.toContain('(was')
  })

  it('carries the file values only for edited fields', () => {
    const m = rowsOf(edited()).find((r) => r.matric === matricOf(1))!.memberships
    expect(m.find((x) => x.ccaID === 'C1')).toMatchObject({ outgoingRole: 'head', outgoingWas: 'none', incomingWas: null, semesterWas: null })
    expect(m.find((x) => x.ccaID === 'C2')).toMatchObject({ semesterOnly: true, semesterWas: false, outgoingWas: null })
  })

  it('shows no marker for an edit the file has overtaken', () => {
    const c1 = files.find((f) => f.name === leaderFileName('C1'))!
    const text = c1.text.replace(/(A9900001Z,[^\n]*?,N,)none,none/, '$1vice_head,none')
    expect(text).not.toBe(c1.text)
    const moved = reducer(edited(), { type: 'addFiles', files: [{ ...c1, text }] })
    expect(moved.report.review.membershipEdits.some((e) => e.status === 'changed')).toBe(true)
    expect(html(moved, 1)).not.toContain('Head (was')
  })
})
