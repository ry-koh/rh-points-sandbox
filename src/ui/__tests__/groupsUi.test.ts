import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import type { CcaGroup } from '../../import/groups'
import { baseCcas, flatCca, flatRows, leaderRows, scenario } from '../../import/__tests__/fixtures'
import { CcaHeader } from '../review/CcaHeader'
import { GroupManager } from '../review/GroupManager'
import { ReviewScreen } from '../review/ReviewScreen'
import { groupAction } from '../review/reviewHelpers'
import { initialState, reducer, vettableCcas, type AppState } from '../state/store'

const AT = '2027-04-02T10:00:00.000Z'
const group = (id: string, name: string, ccaIDs: readonly string[] = []): CcaGroup => ({ id, name, ccaIDs })
const SPORTS = group('g1', 'Sports', ['C2'])
const CULTURE = group('g2', 'Culture')

const load = (): AppState =>
  reducer(initialState(), {
    type: 'addFiles',
    files: scenario({
      ccas: [...baseCcas(), flatCca('C3')],
      flat: flatRows('C3'),
      leaders: { C1: leaderRows('C1'), C2: leaderRows('C2') },
    }),
  })
const withLevel = (state: AppState, ccaID: string, level: string, bonusOverride: number | null = null): AppState =>
  reducer(state, { type: 'setCcaLevel', entry: { ccaID, level, bonusOverride, multiplierOverride: null } })
const vet = (state: AppState, ...ccaIDs: readonly string[]): AppState =>
  ccaIDs.reduce((s, ccaID) => reducer(s, { type: 'setVetted', ccaID, at: AT }), state)
const withGroups = (state: AppState, groups: readonly CcaGroup[]): AppState => reducer(state, { type: 'setGroups', groups })

const render = (state: AppState, dispatch = vi.fn()): string =>
  renderToStaticMarkup(
    createElement(ReviewScreen, { state, dispatch, openSections: new Set<string>(), onOpenSectionsChange: () => undefined, levelUsage: {} }),
  )
/** Only the left CCA list. */
const listOf = (html: string): string => html.slice(html.indexOf('<nav aria-label="CCAs"'), html.indexOf('</nav>'))
/** The list row (a button) that holds this CCA's name. */
const rowOf = (html: string, name: string): string => {
  const list = listOf(html)
  const at = list.indexOf(name)
  return list.slice(list.lastIndexOf('<button', at), list.indexOf('</button>', at))
}
const tags = (html: string, name: string): string[] => html.match(new RegExp(`<${name}\\b[^>]*>`, 'g')) ?? []

describe('groupAction', () => {
  it('adds an empty group at the end with the id it is given', () => {
    const { action, problem } = groupAction([SPORTS], { type: 'add', name: '  Culture ', id: 'g2' })
    expect(problem).toBeNull()
    expect(action).toEqual({ type: 'setGroups', groups: [SPORTS, CULTURE] })
  })

  it('refuses a blank or repeated name in words and dispatches nothing', () => {
    expect(groupAction([SPORTS], { type: 'add', name: '   ', id: 'g2' })).toEqual({ action: null, problem: 'Type a group name.' })
    expect(groupAction([SPORTS], { type: 'add', name: 'sports', id: 'g2' })).toEqual({ action: null, problem: 'A group with this name already exists.' })
    expect(groupAction([SPORTS, CULTURE], { type: 'rename', id: 'g2', name: 'SPORTS' }).action).toBeNull()
  })

  it('renames a group, keeping its CCAs', () => {
    const { action } = groupAction([SPORTS, CULTURE], { type: 'rename', id: 'g1', name: 'Sport' })
    expect(action).toEqual({ type: 'setGroups', groups: [group('g1', 'Sport', ['C2']), CULTURE] })
  })

  it('deletes a group so its CCAs fall back to Ungrouped', () => {
    expect(groupAction([SPORTS, CULTURE], { type: 'remove', id: 'g1' }).action).toEqual({ type: 'setGroups', groups: [CULTURE] })
  })

  it('moves a group up or down, and does nothing at an end', () => {
    expect(groupAction([SPORTS, CULTURE], { type: 'move', id: 'g2', step: -1 }).action).toEqual({ type: 'setGroups', groups: [CULTURE, SPORTS] })
    expect(groupAction([SPORTS, CULTURE], { type: 'move', id: 'g1', step: 1 }).action).toEqual({ type: 'setGroups', groups: [CULTURE, SPORTS] })
    expect(groupAction([SPORTS, CULTURE], { type: 'move', id: 'g1', step: -1 }).action).toBeNull()
    expect(groupAction([SPORTS, CULTURE], { type: 'move', id: 'g2', step: 1 }).action).toBeNull()
  })

  it('moves a CCA into one group, out of another, or to none', () => {
    const into = groupAction([SPORTS, CULTURE], { type: 'assign', ccaID: 'C2', groupId: 'g2' }).action
    expect(into).toEqual({ type: 'setGroups', groups: [group('g1', 'Sports'), group('g2', 'Culture', ['C2'])] })
    const none = groupAction([SPORTS, CULTURE], { type: 'assign', ccaID: 'C2', groupId: null }).action
    expect(none).toEqual({ type: 'setGroups', groups: [group('g1', 'Sports'), CULTURE] })
  })

  it('says so for a group that is not there', () => {
    expect(groupAction([SPORTS], { type: 'rename', id: 'nope', name: 'X' }).problem).toMatch(/could not be changed/)
    expect(groupAction([SPORTS], { type: 'assign', ccaID: 'C2', groupId: 'nope' }).action).toBeNull()
  })
})

describe('GroupManager', () => {
  const manager = (groups: readonly CcaGroup[], open = true): string =>
    renderToStaticMarkup(createElement(GroupManager, { open, groups, dispatch: () => undefined, onClose: () => undefined }))

  it('lists each group in order with rename, move up, move down and delete controls', () => {
    const html = manager([SPORTS, CULTURE])
    expect(html).toContain('value="Sports"')
    expect(html.indexOf('value="Sports"')).toBeLessThan(html.indexOf('value="Culture"'))
    for (const label of ['Move Sports up', 'Move Sports down', 'Delete Sports', 'Move Culture up', 'Move Culture down', 'Delete Culture']) {
      expect(html).toContain(`aria-label="${label}"`)
    }
    expect(html).toContain('Add group')
  })

  it('disables Up on the first group and Down on the last', () => {
    const html = manager([SPORTS, CULTURE])
    const disabled = (label: string): boolean => /\sdisabled(=|\s|>)/.test(tags(html, 'button').find((t) => t.includes(`aria-label="${label}"`)) ?? '')
    expect(disabled('Move Sports up')).toBe(true)
    expect(disabled('Move Culture down')).toBe(true)
    expect(disabled('Move Sports down')).toBe(false)
    expect(disabled('Move Culture up')).toBe(false)
  })

  it('says there are no groups yet, and renders nothing while closed', () => {
    expect(manager([])).toContain('No groups yet')
    expect(manager([SPORTS], false)).not.toContain('Move Sports up')
  })

  it('is all buttons and inputs: nothing is drag-only and nothing is skipped by Tab', () => {
    const html = manager([SPORTS, CULTURE])
    expect(html).not.toMatch(/draggable|onDrag|tabindex="-1"/i)
    expect(tags(html, 'button').every((t) => t.includes('type="button"'))).toBe(true)
  })
})

describe('vetted row', () => {
  it('has the ok background, a solid bar, a check icon, the word Vetted and the level on a second line', () => {
    const row = rowOf(render(vet(withLevel(load(), 'C1', 'High Gold'), 'C1')), 'Test CCA One')
    expect(row).toContain('bg-ok-bg')
    expect(row).toContain('bg-ok')
    expect(row).toContain('lucide-check')
    expect(row).toContain('Vetted')
    expect(row).toContain('High Gold')
    expect(row).not.toContain('tweaked')
  })

  it('adds "tweaked" to the level line when the CCA has its own number', () => {
    const row = rowOf(render(vet(withLevel(load(), 'C1', 'High Gold', 4.5), 'C1')), 'Test CCA One')
    expect(row).toContain('High Gold · tweaked')
  })

  it('shows a flat CCA as "Flat · N pts" in place of a level', () => {
    const row = rowOf(render(vet(load(), 'C3')), 'Test Flat C3')
    expect(row).toContain('Vetted')
    expect(row).toContain('Flat · 12 pts')
  })

  it('leaves a row that is not vetted plain, with no tick and no level line', () => {
    const row = rowOf(render(withLevel(load(), 'C1', 'High Gold')), 'Test CCA One')
    expect(row).not.toContain('bg-ok-bg')
    expect(row).not.toContain('Vetted')
    expect(row).not.toContain('lucide-check')
    expect(row).not.toContain('High Gold')
  })

  it('keeps the warning chip when the file changed after vetting', () => {
    const vetted = vet(load(), 'C1')
    const changed = reducer(vetted, {
      type: 'addFiles',
      files: scenario({ ccas: [...baseCcas(), flatCca('C3')], flat: flatRows('C3'), leaders: { C1: leaderRows('C1', [9, 10, 12, 14, 16, 18]), C2: leaderRows('C2') } }),
    })
    const row = rowOf(render(changed), 'Test CCA One')
    expect(row).toContain('file changed')
    expect(row).not.toContain('Vetted')
  })

  it('counts flat CCAs in the header progress (D1)', () => {
    const state = vet(load(), 'C1', 'C2', 'C3')
    expect(vettableCcas(state.report)).toHaveLength(3)
    expect(listOf(render(state))).toContain('3 of 3 vetted')
    expect(listOf(render(vet(load(), 'C1')))).toContain('1 of 3 vetted')
  })

  it('has a Groups button in the list header', () => {
    expect(listOf(render(load()))).toContain('Groups')
  })
})

describe('grouped sections', () => {
  it('lists groups in their order, A–Z inside, with Ungrouped last', () => {
    const list = listOf(render(withGroups(load(), [CULTURE, group('g1', 'Sports', ['C3', 'C2'])])))
    const at = (text: string): number => list.indexOf(text)
    expect(at('Culture')).toBeGreaterThan(-1)
    expect(at('Culture')).toBeLessThan(at('Sports'))
    expect(at('Sports')).toBeLessThan(at('Test CCA Two'))
    expect(at('Test CCA Two')).toBeLessThan(at('Test Flat C3'))
    expect(at('Test Flat C3')).toBeLessThan(at('Ungrouped'))
    expect(at('Ungrouped')).toBeLessThan(at('Test CCA One'))
  })

  it('shows "n of N vetted" per section and "No CCAs yet" for an empty group', () => {
    const state = vet(withGroups(load(), [group('g1', 'Sports', ['C1', 'C2']), CULTURE]), 'C1')
    const list = listOf(render(state))
    expect(list).toContain('1 of 2 vetted')
    expect(list).toContain('No CCAs yet')
  })

  it('looks as it did with no groups: one list, no Ungrouped header', () => {
    const list = listOf(render(load()))
    expect(list).not.toContain('Ungrouped')
    expect(list).not.toContain('No CCAs yet')
    expect(list.indexOf('Test CCA One')).toBeLessThan(list.indexOf('Test CCA Two'))
  })

  it('leaves out an Ungrouped header when every CCA is in a group', () => {
    expect(listOf(render(withGroups(load(), [group('g1', 'All', ['C1', 'C2', 'C3'])])))).not.toContain('Ungrouped')
  })

  it('selects the first CCA in the shown order', () => {
    const html = render(withGroups(load(), [group('g1', 'Sports', ['C2'])]))
    expect(html).toContain('<h1 class="text-display font-semibold tracking-tight">Test CCA Two</h1>')
  })

  it('keeps the list buttons reachable: every row is a button', () => {
    const list = listOf(render(withGroups(load(), [SPORTS])))
    expect(tags(list, 'button').filter((t) => t.includes('aria-current') || t.includes('type="button"')).length).toBeGreaterThanOrEqual(4)
    expect(list).not.toMatch(/draggable|tabindex="-1"/i)
  })
})

describe('CcaHeader Group select', () => {
  const header = (state: AppState, ccaID: string, over: { locked?: boolean } = {}): string => {
    const cca = state.report.perCca.find((c) => c.ccaID === ccaID)!
    return renderToStaticMarkup(
      createElement(CcaHeader, {
        cca,
        entry: null,
        levels: state.config.levels,
        locked: over.locked ?? false,
        levelNotSet: null,
        levelChange: null,
        groups: state.groups,
        checkEntry: () => null,
        onSetEntry: () => undefined,
        onEditLevels: () => undefined,
        onAssignGroup: () => undefined,
      }),
    )
  }
  const groupSelect = (html: string): string => html.slice(html.indexOf('<select', html.indexOf('>Group<')), html.indexOf('</select>', html.indexOf('>Group<')))

  it('offers Ungrouped and every group, with the CCA\'s own group selected', () => {
    const select = groupSelect(header(withGroups(load(), [SPORTS, CULTURE]), 'C2'))
    expect(select).toContain('Ungrouped')
    expect(select).toContain('>Sports<')
    expect(select).toContain('>Culture<')
    expect(select).toMatch(/<option value="g1" selected/)
  })

  it('is not locked by finalising or vetting (the select stays enabled)', () => {
    const select = groupSelect(header(withGroups(load(), [SPORTS]), 'C1', { locked: true }))
    expect(/\sdisabled(=|\s|>)/.test(select.slice(0, select.indexOf('>')))).toBe(false)
  })

  it('is left out while there are no groups', () => {
    expect(header(load(), 'C1')).not.toContain('>Group<')
  })

  it('moves the CCA when the user picks a group (via groupAction)', () => {
    const state = withGroups(load(), [SPORTS, CULTURE])
    const action = groupAction(state.groups, { type: 'assign', ccaID: 'C1', groupId: 'g2' }).action
    expect(action).not.toBeNull()
    const next = reducer(state, action!)
    expect(next.groups.find((g) => g.id === 'g2')?.ccaIDs).toEqual(['C1'])
  })

  it('works while the lists are finalised (grouping is not a points input)', () => {
    const state = withGroups(load(), [SPORTS])
    const action = groupAction(state.groups, { type: 'assign', ccaID: 'C1', groupId: 'g1' }).action!
    expect(reducer({ ...state, finalised: { at: AT } as unknown as AppState['finalised'] }, action).groups[0]?.ccaIDs).toContain('C1')
  })

  it('describes a flat CCA accurately, without "No scores, level or vetting here"', () => {
    const html = header(load(), 'C3')
    expect(html).not.toContain('No scores, level or vetting here')
    expect(html).toContain('to every member, set in the RH app. Change one member')
    expect(html).toContain('vet it when checked')
  })
})
