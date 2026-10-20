import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import type { CheckedMembershipEdit, FlatEdit, IhgTickEdit, LeaderRow, MembershipEdit } from '../../import'
import {
  BUNDLE_FILE_NAME,
  LEADER_COLS,
  baseCcas,
  flatCca,
  flatRows,
  leaderFileName,
  leaderRows,
  matricOf,
  scenario,
  toCsv,
} from '../../import/__tests__/fixtures'
import { CcaHeader } from '../review/CcaHeader'
import { EditLog } from '../review/EditLog'
import { ReviewScreen } from '../review/ReviewScreen'
import { ScoreTable, type ScoreRow } from '../review/ScoreTable'
import { FLAT_PROBLEMS, flatAction, membershipAction, mergeEditLogs, tickAction } from '../review/reviewHelpers'
import { initialState, reducer, vettableCcas, type AppState } from '../state/store'

const AT = '2027-04-02T10:00:00.000Z'
const SPORT = { ccaID: 'C4', ccaName: 'Touch Rugby (W)', type: '1x', sport: 'Y', ihgResult: '1st', ihgCap: '3' }
const load = (ihg: readonly number[] = [0, 1]): AppState =>
  reducer(
    initialState(),
    {
      type: 'addFiles',
      files: scenario({
        ccas: [...baseCcas(), flatCca('C3'), SPORT],
        flat: flatRows('C3'),
        leaders: { C1: leaderRows('C1'), C2: leaderRows('C2'), C4: leaderRows('C4', undefined, { ihg }) },
      }),
    },
  )
const vetAll = (state: AppState): AppState =>
  vettableCcas(state.report).reduce((s, c) => reducer(s, { type: 'setVetted', ccaID: c.ccaID, at: AT }), state)

const render = (state: AppState, dispatch = vi.fn()): string =>
  renderToStaticMarkup(
    createElement(ReviewScreen, { state, dispatch, openSections: new Set<string>(), onOpenSectionsChange: () => undefined, levelUsage: {} }),
  )
const tags = (html: string, name: string): string[] => html.match(new RegExp(`<${name}\\b[^>]*>`, 'g')) ?? []
/** The `disabled` attribute, not a `disabled:` utility class. */
const isDisabled = (tag: string): boolean => /\sdisabled(=|\s|>)/.test(tag)
const member = (n: number, ihg: boolean): LeaderRow => ({
  ccaID: 'C4',
  ccaName: 'Touch Rugby (W)',
  line: n + 1,
  matric: matricOf(n),
  name: `Test Resident ${String(n).padStart(3, '0')}`,
  basePoints: 10,
  semesterOnly: false,
  outgoingRole: 'none',
  incomingRole: 'none',
  ihg,
})
const tickEdit = (n: number, to: boolean, at = AT, reason = ''): IhgTickEdit => ({ matric: matricOf(n), ccaID: 'C4', from: !to, to, reason, at })
const row = (n: number, ihg: boolean, edit: ScoreRow['tickEdit'] = null, membershipEdits: readonly CheckedMembershipEdit[] = []): ScoreRow => ({
  member: member(n, ihg),
  edit: null,
  tickEdit: edit,
  membershipEdits,
  hasFinalOverride: false,
})
const table = (rows: readonly ScoreRow[], over: { isSport?: boolean; locked?: boolean } = {}): string =>
  renderToStaticMarkup(
    createElement(ScoreTable, {
      rows,
      isSport: over.isSport ?? true,
      locked: over.locked ?? false,
      onSave: () => null,
      onTick: () => undefined,
      onMembership: () => undefined,
    }),
  )

describe('tickAction', () => {
  const base = { matric: matricOf(1), ccaID: 'C4', at: AT }

  it("records the FILE's tick as `from`, whatever is shown (R7)", () => {
    expect(tickAction({ ...base, fileTick: true, to: false, reason: 'left', hasEdit: false })).toEqual({
      type: 'setTickEdit',
      entry: { ...base, from: true, to: false, reason: 'left' },
    })
    // A second change on an already edited membership still uses the file value.
    expect(tickAction({ ...base, fileTick: true, to: false, reason: 'new reason', hasEdit: true })).toMatchObject({
      type: 'setTickEdit',
      entry: { from: true, to: false, reason: 'new reason' },
    })
  })

  it('going back to the file tick removes the edit, or does nothing when there is none', () => {
    expect(tickAction({ ...base, fileTick: true, to: true, reason: '', hasEdit: true })).toEqual({
      type: 'removeTickEdit',
      matric: matricOf(1),
      ccaID: 'C4',
      at: AT,
    })
    expect(tickAction({ ...base, fileTick: true, to: true, reason: '', hasEdit: false })).toBeNull()
  })
})

describe('mergeEditLogs', () => {
  const score = { matric: matricOf(1), ccaID: 'C1', from: 10, to: 12, reason: 'r', at: '2027-04-02T10:00:00.000Z', kind: 'edit' as const }
  const tick = { ...tickEdit(2, false, '2027-04-02T11:00:00.000Z'), kind: 'edit' as const }
  const flat: FlatEdit & { kind: 'edit' | 'remove' } = { matric: matricOf(3), ccaID: 'C3', from: 12, to: 10, reason: '', at: '2027-04-02T09:00:00.000Z', kind: 'edit' }

  it('lists score, tick and flat entries newest first with what they are', () => {
    const lines = mergeEditLogs([score], [tick], [flat])
    expect(lines.map((l) => l.what)).toEqual(['IHG tick', 'score', 'flat value'])
    expect(lines.map((l) => l.at)).toEqual([tick.at, score.at, flat.at])
  })

  it('writes tick values in words and score and flat values as numbers', () => {
    const lines = mergeEditLogs([score], [tick, { ...tickEdit(2, true, '2027-04-02T12:00:00.000Z'), kind: 'remove' }], [flat])
    expect(lines[0]).toMatchObject({ what: 'IHG tick', from: 'not ticked', to: 'ticked', kind: 'remove' })
    expect(lines.find((l) => l.what === 'IHG tick' && l.kind === 'edit')).toMatchObject({ from: 'ticked', to: 'not ticked' })
    expect(lines.find((l) => l.what === 'score')).toMatchObject({ from: '10', to: '12' })
    expect(lines.find((l) => l.what === 'flat value')).toMatchObject({ from: '12', to: '10' })
  })

  it('keeps the latest entry of one source first when times tie', () => {
    const first = { ...score, to: 11 }
    const second = { ...score, to: 13 }
    expect(mergeEditLogs([first, second], [], []).map((l) => l.to)).toEqual(['13', '11'])
  })

  it('shows the merged log with a What column', () => {
    const html = renderToStaticMarkup(
      createElement(EditLog, {
        log: [{ ...score, ccaID: 'C4' }],
        tickLog: [tick],
        flatLog: [{ ...flat, ccaID: 'C4' }],
        selected: 'C4',
        ccaName: (id: string) => id,
        memberName: (m: string) => m,
      }),
    )
    expect(html).toContain('>What<')
    expect(html).toContain('IHG tick')
    expect(html).toContain('ticked')
    expect(html).toContain('not ticked')
    expect(html).toContain('flat value')
    expect(html.indexOf('IHG tick')).toBeLessThan(html.indexOf('flat value'))
  })
})

describe('ScoreTable IHG ticks', () => {
  it('shows a real checkbox per member for a sport, with the EDITED tick', () => {
    const judged = { entry: tickEdit(1, false), status: 'applied' as const, current: true }
    const html = table([row(1, true, judged), row(2, true)])
    const boxes = tags(html, 'input').filter((t) => t.includes('type="checkbox"') && t.includes('IHG tick for'))
    expect(boxes).toHaveLength(2)
    expect(boxes[0]).not.toContain('checked')
    expect(boxes[1]).toContain('checked')
  })

  it('tints an edited tick gold, asks for a reason only then, and notes a moved file', () => {
    const applied = { entry: tickEdit(1, false, AT, 'left early'), status: 'applied' as const, current: true }
    const html = table([row(1, true, applied), row(2, true)])
    expect(html).toContain('bg-gold-soft')
    expect(tags(html, 'input').filter((t) => t.includes('Reason for') && t.includes('IHG tick'))).toHaveLength(1)
    expect(html).toContain('left early')

    const changed = { entry: tickEdit(1, false), status: 'changed' as const, current: false }
    const moved = table([row(1, false, changed)])
    expect(moved).toContain('the file changed')
    // A tick edit the file has overtaken is not shown as an edit.
    expect(tags(moved, 'input').filter((t) => t.includes('type="checkbox"') && t.includes('IHG tick for'))[0]).not.toContain('checked')
    expect(moved).not.toContain('Reason for Test Resident 001&#x27;s IHG tick')
  })

  it('has no checkbox for a CCA that is not a sport', () => {
    const html = table([row(1, true)], { isSport: false })
    expect(tags(html, 'input').filter((t) => t.includes('type="checkbox"') && t.includes('IHG tick for'))).toHaveLength(0)
  })

  it('disables every input, including the tick boxes, when locked', () => {
    const applied = { entry: tickEdit(1, false), status: 'applied' as const, current: true }
    const inputs = tags(table([row(1, true, applied), row(2, false)], { locked: true }), 'input')
    expect(inputs.length).toBeGreaterThan(4)
    expect(inputs.filter((t) => !isDisabled(t))).toEqual([])
  })
})

describe('CcaHeader IHG count', () => {
  const header = (state: AppState): string => {
    const cca = state.report.perCca.find((c) => c.ccaID === 'C4')!
    return renderToStaticMarkup(
      createElement(CcaHeader, {
        cca,
        entry: null,
        levels: state.config.levels,
        locked: false,
        levelNotSet: null,
        levelChange: null,
        groups: [],
        checkEntry: () => null,
        onSetEntry: () => undefined,
        onEditLevels: () => undefined,
        onAssignGroup: () => undefined,
      }),
    )
  }

  it('warns "over cap · allowed" when more members are ticked than the cap', () => {
    const html = header(load([0, 1, 2, 3]))
    expect(html).toContain('4 of 3 ticked')
    expect(html).toContain('over cap · allowed')
  })

  it('shows no chip at or under the cap', () => {
    expect(header(load([0, 1, 2]))).not.toContain('over cap')
    expect(header(load([0]))).toContain('1 of 3 ticked')
  })

  it('counts an unticked member in the edited count', () => {
    const edited = reducer(load([0, 1, 2, 3]), { type: 'setTickEdit', entry: tickEdit(1, false) })
    const html = header(edited)
    expect(html).toContain('3 of 3 ticked')
    expect(html).not.toContain('over cap')
  })
})

describe('ReviewScreen lock line', () => {
  it('shows the vetted lock and disables every score, level, tweak and tick control', () => {
    const dispatch = vi.fn()
    const html = render(vetAll(load()), dispatch)
    expect(html).toContain('Vetted · locked. Clear vetted to change the level, tweaks, scores, flat values or IHG ticks.')
    const controls = [...tags(html, 'input'), ...tags(html, 'select')].filter((t) => !t.includes('class="accent-raffles"'))
    expect(controls.length).toBeGreaterThan(3)
    expect(controls.filter((t) => !isDisabled(t))).toEqual([])
    expect(dispatch).not.toHaveBeenCalled()
  })

  it('shows no lock line for a CCA that is not vetted', () => {
    const html = render(load())
    expect(html).not.toContain('Vetted · locked')
    expect(tags(html, 'select').filter((t) => !isDisabled(t))).not.toHaveLength(0)
  })

  it('adds "to pick another level" when the vetted CCA names a level that no longer exists (R18)', () => {
    const vetted = vetAll(load())
    const first = vetted.report.perCca.map((c) => c.ccaID).sort()[0]!
    const html = render({ ...vetted, ccaLevels: [{ ccaID: first, level: 'No Such Level', bonusOverride: null, multiplierOverride: null }] })
    expect(html).toContain('to pick another level')
  })

  it('shows the finalised line first, then the vetted line', () => {
    const vetted = vetAll(load())
    const html = render({ ...vetted, finalised: { penalty: { cutoffs: { M: null, F: null }, applied: [], removed: [] }, log: [] } })
    expect(html.indexOf('Finalised · review locked')).toBeGreaterThanOrEqual(0)
    expect(html.indexOf('Finalised · review locked')).toBeLessThan(html.indexOf('Vetted · locked'))
  })
})

describe('ReviewScreen not-applied panel', () => {
  const withFile = (state: AppState, ccaID: string, ihg: readonly number[]): AppState =>
    reducer(state, {
      type: 'addFiles',
      files: [{ name: leaderFileName(ccaID), text: toCsv(LEADER_COLS, leaderRows(ccaID, undefined, { ihg })) }],
    })

  it('lists a tick edit the leader file has overtaken, with Remove', () => {
    const set = reducer(load([0, 1]), { type: 'setTickEdit', entry: tickEdit(1, false) })
    expect(set.report.review.tickEdits.map((e) => e.status)).toEqual(['applied'])
    const moved = withFile(set, 'C4', [1])
    expect(moved.report.review.tickEdits.map((e) => e.status)).toEqual(['changed'])
    const html = render(moved)
    expect(html).toContain('Not applied')
    expect(html).toContain('IHG tick')
    expect(html).toContain('Touch Rugby (W)')
    const remove = html.slice(html.indexOf('IHG tick')).match(/<button[^>]*>[^<]*Remove/)
    expect(remove).not.toBeNull()
    expect(isDisabled(remove![0])).toBe(false)
  })

  it('lists a flat edit that no longer applies, with Remove', () => {
    const flat: FlatEdit = { matric: matricOf(1), ccaID: 'C3', from: 12, to: 10, reason: '', at: AT }
    const set = reducer(load(), { type: 'setFlatEdit', entry: flat })
    expect(set.report.review.flatEdits.map((e) => e.status)).toEqual(['applied'])
    const files = scenario({
      ccas: [...baseCcas(), flatCca('C3', '11'), SPORT],
      flat: flatRows('C3', '11'),
      leaders: { C1: leaderRows('C1'), C2: leaderRows('C2'), C4: leaderRows('C4', undefined, { ihg: [0, 1] }) },
    })
    const moved = reducer(set, { type: 'addFiles', files: files.filter((f) => f.name === BUNDLE_FILE_NAME) })
    expect(moved.report.review.flatEdits.map((e) => e.status)).toEqual(['changed'])
    const html = render(moved)
    expect(html).toContain('flat value')
    expect(html).toMatch(/flat value[\s\S]*Remove/)
  })
})

describe('flatAction', () => {
  const base = { matric: matricOf(1), ccaID: 'C3', fileValue: 12, reason: '', hasEdit: false, at: AT }

  it("records the RH-app value as `from` when a member moves 12 → 10", () => {
    expect(flatAction({ ...base, to: '10' })).toEqual({
      action: { type: 'setFlatEdit', entry: { matric: matricOf(1), ccaID: 'C3', from: 12, to: 10, reason: '', at: AT } },
      problem: null,
    })
  })

  it('going back to the RH-app value removes the edit, or does nothing when there is none', () => {
    expect(flatAction({ ...base, to: '12', hasEdit: true })).toEqual({
      action: { type: 'removeFlatEdit', matric: matricOf(1), ccaID: 'C3', at: AT },
      problem: null,
    })
    expect(flatAction({ ...base, to: '12' })).toEqual({ action: null, problem: null })
  })

  it('refuses an empty, negative or non-numeric value with a plain message and dispatches nothing', () => {
    for (const to of ['', '-1', 'abc']) {
      const result = flatAction({ ...base, to })
      expect(result.action).toBeNull()
      expect(result.problem).toBe(FLAT_PROBLEMS.BAD_FLAT_VALUE)
    }
  })
})

describe('ReviewScreen flat CCA', () => {
  const flatOnly = (): AppState =>
    reducer(initialState(), { type: 'addFiles', files: scenario({ ccas: [flatCca('C3')], flat: flatRows('C3') }) })
  const edit = (to: number): FlatEdit => ({ matric: matricOf(1), ccaID: 'C3', from: 12, to, reason: 'moved halls', at: AT })

  it('lists every member with the RH-app value and an input, and offers Mark vetted', () => {
    const html = render(flatOnly())
    expect(html).toContain('RH-app value')
    expect(tags(html, 'input').filter((t) => t.includes('Flat value for'))).toHaveLength(6)
    expect(html).toContain('Mark vetted')
    expect(html).not.toContain('Read-only: flat CCAs')
  })

  it('tints an edited member gold, shows the edited value and its reason', () => {
    const html = render(reducer(flatOnly(), { type: 'setFlatEdit', entry: edit(10) }))
    expect(html).toContain('bg-gold-soft')
    expect(html).toContain('value="10"')
    expect(html).toContain('moved halls')
  })

  it('disables every input and dispatches nothing once the flat CCA is vetted', () => {
    const dispatch = vi.fn()
    const vetted = reducer(flatOnly(), { type: 'setVetted', ccaID: 'C3', at: AT })
    const html = render(vetted, dispatch)
    expect(html).toContain('Vetted · locked')
    const inputs = tags(html, 'input').filter((t) => t.includes('Flat value for') || t.includes('Reason for'))
    expect(inputs).toHaveLength(12)
    expect(inputs.filter((t) => !isDisabled(t))).toEqual([])
    expect(dispatch).not.toHaveBeenCalled()
  })

  it('shows the gold override chip for a member with a final-points override (R9)', () => {
    const state: AppState = { ...flatOnly(), finalOverrides: [{ matric: matricOf(2), ccaID: 'C3', finalPoints: 5, reason: 'r' }] }
    const html = render(state)
    expect(html.match(/final points set on Results — wins over this value/g)).toHaveLength(1)
    expect(render(flatOnly())).not.toContain('wins over this value')
  })

  it('does not show the flat table for a leader-file CCA', () => {
    expect(render(load())).not.toContain('Change a flat member')
  })
})
