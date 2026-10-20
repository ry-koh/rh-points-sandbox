import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import type { CheckedMembershipEdit, LeaderRow, MembershipEdit } from '../../import'
import {
  baseCcas,
  flatCca,
  flatRows,
  leaderFileName,
  leaderRows,
  matricOf,
  scenario,
} from '../../import/__tests__/fixtures'
import { EditLog } from '../review/EditLog'
import { ReviewScreen } from '../review/ReviewScreen'
import { ScoreTable, type ScoreRow } from '../review/ScoreTable'
import { membershipAction, mergeEditLogs } from '../review/reviewHelpers'
import { initialState, reducer, vettableCcas, type AppState } from '../state/store'

const AT = '2027-04-02T10:00:00.000Z'
const load = (): AppState =>
  reducer(initialState(), {
    type: 'addFiles',
    files: scenario({ ccas: [...baseCcas(), flatCca('C3')], flat: flatRows('C3'), leaders: { C1: leaderRows('C1'), C2: leaderRows('C2') } }),
  })
const vetAll = (state: AppState): AppState =>
  vettableCcas(state.report).reduce((s, c) => reducer(s, { type: 'setVetted', ccaID: c.ccaID, at: AT }), state)
const render = (state: AppState, dispatch = vi.fn()): string =>
  renderToStaticMarkup(
    createElement(ReviewScreen, { state, dispatch, openSections: new Set<string>(), onOpenSectionsChange: () => undefined, levelUsage: {} }),
  )
const tags = (html: string, name: string): string[] => html.match(new RegExp(`<${name}\\b[^>]*>`, 'g')) ?? []
const isDisabled = (tag: string): boolean => /\sdisabled(=|\s|>)/.test(tag)

const member = (n: number): LeaderRow => ({
  ccaID: 'C1',
  ccaName: 'Test CCA C1',
  line: n + 1,
  matric: matricOf(n),
  name: `Test Resident ${String(n).padStart(3, '0')}`,
  basePoints: 10,
  semesterOnly: false,
  outgoingRole: 'none',
  incomingRole: 'none',
  ihg: false,
})
const row = (n: number, membershipEdits: readonly CheckedMembershipEdit[] = []): ScoreRow => ({
  member: member(n),
  edit: null,
  tickEdit: null,
  membershipEdits,
  hasFinalOverride: false,
})
const table = (rows: readonly ScoreRow[], locked = false): string =>
  renderToStaticMarkup(
    createElement(ScoreTable, { rows, isSport: false, locked, onSave: () => null, onTick: () => undefined, onMembership: () => undefined }),
  )

const role: MembershipEdit = { matric: matricOf(1), ccaID: 'C1', field: 'outgoingRole', from: 'none', to: 'head', reason: 'took over', at: AT }
const incoming: MembershipEdit = { ...role, field: 'incomingRole', from: 'head', to: 'vice_head', at: '2027-04-02T11:00:00.000Z' }
const sem: MembershipEdit = { matric: matricOf(2), ccaID: 'C1', field: 'semesterOnly', from: false, to: true, reason: '', at: '2027-04-02T12:00:00.000Z' }

describe('membershipAction', () => {
  const base = { matric: matricOf(1), ccaID: 'C1', reason: '', at: AT }

  it("records the FILE's role as `from`, whatever is shown", () => {
    expect(membershipAction({ ...base, field: 'outgoingRole', fileValue: 'none', to: 'head', hasEdit: false })).toEqual({
      type: 'setMembershipEdit',
      entry: { ...base, field: 'outgoingRole', from: 'none', to: 'head' },
    })
    // A second change on an already edited field still uses the file value.
    expect(membershipAction({ ...base, field: 'outgoingRole', fileValue: 'none', to: 'vice_head', reason: 'r', hasEdit: true })).toMatchObject({
      type: 'setMembershipEdit',
      entry: { from: 'none', to: 'vice_head', reason: 'r' },
    })
  })

  it('records the file semester flag for a full year / 1 sem change', () => {
    expect(membershipAction({ ...base, field: 'semesterOnly', fileValue: false, to: true, hasEdit: false })).toEqual({
      type: 'setMembershipEdit',
      entry: { ...base, field: 'semesterOnly', from: false, to: true },
    })
  })

  it('going back to the file value removes the edit, or does nothing when there is none', () => {
    expect(membershipAction({ ...base, field: 'incomingRole', fileValue: 'head', to: 'head', hasEdit: true })).toEqual({
      type: 'removeMembershipEdit',
      matric: matricOf(1),
      ccaID: 'C1',
      field: 'incomingRole',
      at: AT,
    })
    expect(membershipAction({ ...base, field: 'incomingRole', fileValue: 'head', to: 'head', hasEdit: false })).toBeNull()
  })
})

describe('membership log', () => {
  it('writes each field in words: roles as none → head, semester as full year → 1 sem', () => {
    const lines = mergeEditLogs([], [], [], [
      { ...role, kind: 'edit' },
      { ...incoming, kind: 'edit' },
      { ...sem, kind: 'edit' },
      { ...sem, from: true, to: false, at: '2027-04-02T13:00:00.000Z', kind: 'remove' },
    ])
    expect(lines.map((l) => l.what)).toEqual(['full year / 1 sem', 'full year / 1 sem', 'incoming role', 'outgoing role'])
    expect(lines.map((l) => `${l.from} → ${l.to}`)).toEqual(['1 sem → full year', 'full year → 1 sem', 'head → vice head', 'none → head'])
  })

  it('shows the lines in the Edit log table', () => {
    const html = renderToStaticMarkup(
      createElement(EditLog, {
        log: [],
        tickLog: [],
        flatLog: [],
        membershipLog: [{ ...role, kind: 'edit' }, { ...sem, kind: 'edit' }],
        selected: 'C1',
        ccaName: (id: string) => id,
        memberName: (m: string) => m,
      }),
    )
    expect(html).toContain('outgoing role')
    expect(html).toContain('none → head')
    expect(html).toContain('full year / 1 sem')
    expect(html).toContain('full year → 1 sem')
  })
})

describe('ScoreTable role and semester cells', () => {
  const edit = (field: 'outgoingRole' | 'semesterOnly', status: 'applied' | 'changed', reason = ''): CheckedMembershipEdit =>
    field === 'semesterOnly'
      ? { entry: { matric: matricOf(1), ccaID: 'C1', field, from: false, to: true, reason, at: AT }, status, current: status === 'applied' ? false : true }
      : { entry: { matric: matricOf(1), ccaID: 'C1', field, from: 'none', to: 'head', reason, at: AT }, status, current: status === 'applied' ? 'none' : 'vice_head' }

  it('has an Out and an In select and a Sem checkbox per member', () => {
    const html = table([row(1), row(2)])
    expect(tags(html, 'select').filter((t) => t.includes('Outgoing role for'))).toHaveLength(2)
    expect(tags(html, 'select').filter((t) => t.includes('Incoming role for'))).toHaveLength(2)
    expect(tags(html, 'input').filter((t) => t.includes('1 sem for'))).toHaveLength(2)
    expect(html).toContain('Full year')
    expect(html).toContain('>Vice head</option>')
  })

  it('shows the EDITED value, tints it gold and asks for a reason only for the edited cell', () => {
    const html = table([row(1, [edit('outgoingRole', 'applied', 'took over')])])
    expect(html).toMatch(/<option value="head" selected[^>]*>Head<\/option>/)
    expect(html).toContain('bg-gold-soft')
    expect(tags(html, 'input').filter((t) => t.includes('outgoing role') && t.includes('Reason for'))).toHaveLength(1)
    expect(html).toContain('took over')
    expect(tags(html, 'input').filter((t) => t.includes('Reason for') && !t.includes('outgoing role') && !t.includes('score'))).toHaveLength(0)
  })

  it('shows 1 sem for an edited semester flag', () => {
    const html = table([row(1, [edit('semesterOnly', 'applied')])])
    expect(html).toContain('>1 sem<')
    expect(tags(html, 'input').filter((t) => t.includes('1 sem for'))[0]).toContain('checked')
  })

  it('shows the file value and a note when the file moved past the edit', () => {
    const html = table([row(1, [edit('outgoingRole', 'changed')])])
    expect(html).toContain('Edit to head not applied: the file changed.')
    expect(html).not.toMatch(/<option value="head" selected/)
  })

  it('disables the selects, the toggle and the reasons when locked', () => {
    const html = table([row(1, [edit('outgoingRole', 'applied')])], true)
    const controls = [...tags(html, 'select'), ...tags(html, 'input')]
    expect(controls.length).toBeGreaterThan(5)
    expect(controls.filter((t) => !isDisabled(t))).toEqual([])
  })
})

describe('ReviewScreen role and semester edits', () => {
  it('says the mean/SD check uses full scores', () => {
    expect(render(load())).toContain('The mean/SD check uses full scores, so changing someone to 1 sem moves the lists, not this meter.')
  })

  it("the header's outgoing count reflects the edit", () => {
    const set = reducer(load(), { type: 'setMembershipEdit', entry: role })
    expect(set.report.perCca.find((c) => c.ccaID === 'C1')?.outgoingLeaders).toBe(1)
    expect(render(set)).toMatch(/Outgoing leaders<\/dt><dd[^>]*>1</)
  })

  it('disables the role selects and the semester toggle once vetted, and dispatches nothing', () => {
    const dispatch = vi.fn()
    const html = render(vetAll(load()), dispatch)
    const controls = [
      ...tags(html, 'select').filter((t) => t.includes('role for')),
      ...tags(html, 'input').filter((t) => t.includes('1 sem for')),
    ]
    expect(controls).toHaveLength(18)
    expect(controls.filter((t) => !isDisabled(t))).toEqual([])
    expect(dispatch).not.toHaveBeenCalled()
  })

  it('lists a membership edit the file has overtaken in the not-applied panel, with a usable Remove', () => {
    const set = reducer(load(), { type: 'setMembershipEdit', entry: role })
    const c1 = scenario().find((f) => f.name === leaderFileName('C1'))!
    const text = c1.text.replace(/(A9900001Z,[^\n]*?,N,)none,none/, '$1vice_head,none')
    expect(text).not.toBe(c1.text)
    const moved = reducer(set, { type: 'addFiles', files: [{ ...c1, text }] })
    expect(moved.report.review.membershipEdits.map((e) => e.status)).toEqual(['changed'])
    const html = render(moved)
    expect(html).toContain('Not applied')
    expect(html).toContain('outgoing role none → head')
    expect(html).toContain('the leader file now says vice head')
    const remove = html.slice(html.indexOf('outgoing role none')).match(/<button[^>]*>[^<]*Remove/)
    expect(remove).not.toBeNull()
    expect(isDisabled(remove![0])).toBe(false)
  })
})
