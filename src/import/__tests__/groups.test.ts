import { describe, expect, it } from 'vitest'
import {
  MAX_GROUP_NAME_LENGTH,
  UNGROUPED_NAME,
  addGroup,
  assignCca,
  groupedOrder,
  groupsOnLoad,
  isGroupList,
  moveGroup,
  normaliseGroups,
  removeGroup,
  renameGroup,
  type CcaGroup,
} from '../groups'

const g = (id: string, name: string, ccaIDs: string[] = []): CcaGroup => ({ id, name, ccaIDs })

const SPORTS = g('g1', 'Sports', ['C2', 'C1'])
const CULTURE = g('g2', 'Culture', ['C3'])

function ok(result: ReturnType<typeof addGroup>): readonly CcaGroup[] {
  if (!result.ok) throw new Error(`expected ok, got ${result.error}`)
  return result.groups
}

describe('isGroupList', () => {
  it('accepts well-shaped groups and refuses anything else', () => {
    expect(isGroupList([SPORTS])).toBe(true)
    expect(isGroupList([])).toBe(true)
    expect(isGroupList('x')).toBe(false)
    expect(isGroupList([{ id: 'a', name: 'b' }])).toBe(false)
    expect(isGroupList([{ id: 'a', name: 'b', ccaIDs: [1] }])).toBe(false)
    expect(isGroupList([null])).toBe(false)
  })
})

describe('normaliseGroups', () => {
  it('drops invalid entries and groups with a blank name or id', () => {
    const raw = [SPORTS, null, 5, { id: 'x' }, g('g3', '   '), g('', 'No id'), CULTURE]
    expect(normaliseGroups(raw)).toEqual([SPORTS, CULTURE])
  })

  it('keeps a CCA only in its first group', () => {
    const result = normaliseGroups([g('g1', 'A', ['C1', 'C2']), g('g2', 'B', ['C2', 'C3'])])
    expect(result.map((x) => x.ccaIDs)).toEqual([['C1', 'C2'], ['C3']])
  })

  it('drops a CCA repeated inside one group and a blank ccaID', () => {
    expect(normaliseGroups([g('g1', 'A', ['C1', 'C1', '', 'C2'])])[0]?.ccaIDs).toEqual(['C1', 'C2'])
  })

  it('trims names and cuts them to the maximum length', () => {
    const long = 'x'.repeat(MAX_GROUP_NAME_LENGTH + 10)
    const result = normaliseGroups([g('g1', '  Sports  '), g('g2', long)])
    expect(result[0]?.name).toBe('Sports')
    expect(result[1]?.name).toHaveLength(MAX_GROUP_NAME_LENGTH)
  })

  it('keeps the first of two groups with the same id', () => {
    expect(normaliseGroups([g('g1', 'A'), g('g1', 'B')]).map((x) => x.name)).toEqual(['A'])
  })

  it('returns [] for something that is not a list and never mutates its input', () => {
    expect(normaliseGroups('nope')).toEqual([])
    expect(normaliseGroups(undefined)).toEqual([])
    const input = [g('g1', ' A ', ['C1', 'C1'])]
    const snapshot = JSON.stringify(input)
    normaliseGroups(input)
    expect(JSON.stringify(input)).toBe(snapshot)
  })
})

describe('addGroup', () => {
  it('appends a trimmed group with no CCAs, without touching the input', () => {
    const before = [SPORTS]
    const after = ok(addGroup(before, '  Culture ', 'g2'))
    expect(after).toEqual([SPORTS, g('g2', 'Culture')])
    expect(before).toEqual([SPORTS])
  })

  it('cuts a long name to the maximum length', () => {
    const after = ok(addGroup([], 'y'.repeat(MAX_GROUP_NAME_LENGTH + 5), 'g1'))
    expect(after[0]?.name).toHaveLength(MAX_GROUP_NAME_LENGTH)
  })

  it('refuses a blank name and a duplicate name, ignoring case', () => {
    expect(addGroup([SPORTS], '   ', 'g9')).toEqual({ ok: false, error: 'BLANK_NAME' })
    expect(addGroup([SPORTS], 'sPoRtS', 'g9')).toEqual({ ok: false, error: 'DUPLICATE_NAME' })
  })

  it('refuses an id that is already used', () => {
    expect(addGroup([SPORTS], 'Other', 'g1')).toEqual({ ok: false, error: 'DUPLICATE_ID' })
  })
})

describe('renameGroup', () => {
  it('renames one group and keeps its CCAs and place', () => {
    const after = ok(renameGroup([SPORTS, CULTURE], 'g1', ' Athletics '))
    expect(after).toEqual([g('g1', 'Athletics', ['C2', 'C1']), CULTURE])
  })

  it('allows keeping the same name (other case) for the same group', () => {
    expect(ok(renameGroup([SPORTS], 'g1', 'SPORTS'))[0]?.name).toBe('SPORTS')
  })

  it('refuses another group’s name (case-insensitive), a blank name and an unknown id', () => {
    expect(renameGroup([SPORTS, CULTURE], 'g1', 'culture')).toEqual({ ok: false, error: 'DUPLICATE_NAME' })
    expect(renameGroup([SPORTS], 'g1', '  ')).toEqual({ ok: false, error: 'BLANK_NAME' })
    expect(renameGroup([SPORTS], 'nope', 'X')).toEqual({ ok: false, error: 'UNKNOWN_GROUP' })
  })
})

describe('removeGroup', () => {
  it('removes the group; its CCAs are no longer in any group', () => {
    const after = removeGroup([SPORTS, CULTURE], 'g1')
    expect(after).toEqual([CULTURE])
    expect(groupedOrder([{ ccaID: 'C1', name: 'One' }], after).at(-1)?.ccas.map((c) => c.ccaID)).toEqual(['C1'])
  })

  it('returns the same list for an unknown id', () => {
    const list = [SPORTS]
    expect(removeGroup(list, 'zzz')).toBe(list)
  })
})

describe('moveGroup', () => {
  const three = [g('a', 'A'), g('b', 'B'), g('c', 'C')]

  it('moves a group one place up or down', () => {
    expect(moveGroup(three, 'b', -1).map((x) => x.id)).toEqual(['b', 'a', 'c'])
    expect(moveGroup(three, 'b', 1).map((x) => x.id)).toEqual(['a', 'c', 'b'])
  })

  it('stops at the ends and ignores an unknown id', () => {
    expect(moveGroup(three, 'a', -1)).toBe(three)
    expect(moveGroup(three, 'c', 1)).toBe(three)
    expect(moveGroup(three, 'zzz', 1)).toBe(three)
  })

  it('does not change the list it was given', () => {
    const frozen = Object.freeze([...three])
    expect(moveGroup(frozen, 'a', 1).map((x) => x.id)).toEqual(['b', 'a', 'c'])
    expect(frozen.map((x) => x.id)).toEqual(['a', 'b', 'c'])
  })
})

describe('assignCca', () => {
  it('moves a CCA out of its old group into the new one', () => {
    const after = assignCca([SPORTS, CULTURE], 'C1', 'g2')
    expect(after).toEqual([g('g1', 'Sports', ['C2']), g('g2', 'Culture', ['C3', 'C1'])])
  })

  it('null makes a CCA ungrouped', () => {
    expect(assignCca([SPORTS], 'C1', null)).toEqual([g('g1', 'Sports', ['C2'])])
  })

  it('assigning to the group it is already in changes nothing about membership', () => {
    expect(assignCca([SPORTS], 'C1', 'g1')[0]?.ccaIDs).toEqual(['C2', 'C1'])
  })

  it('an unknown target group leaves the CCA where it was', () => {
    const list = [SPORTS]
    expect(assignCca(list, 'C1', 'nope')).toBe(list)
  })

  it('never mutates its input', () => {
    const input = [g('g1', 'Sports', ['C1']), g('g2', 'Culture')]
    const snapshot = JSON.stringify(input)
    assignCca(input, 'C1', 'g2')
    expect(JSON.stringify(input)).toBe(snapshot)
  })
})

describe('groupedOrder', () => {
  const perCca = [
    { ccaID: 'C1', name: 'Soccer' },
    { ccaID: 'C2', name: 'Badminton' },
    { ccaID: 'C3', name: 'Choir' },
    { ccaID: 'C4', name: 'Zumba' },
    { ccaID: 'C5', name: 'Art' },
  ]

  it('lists groups in group order, A–Z inside each, and Ungrouped last', () => {
    const sections = groupedOrder(perCca, [g('g1', 'Sports', ['C1', 'C2']), g('g2', 'Culture', ['C3'])])
    expect(sections.map((s) => s.name)).toEqual(['Sports', 'Culture', UNGROUPED_NAME])
    expect(sections.map((s) => s.ccas.map((c) => c.ccaID))).toEqual([['C2', 'C1'], ['C3'], ['C5', 'C4']])
    expect(sections.map((s) => s.groupId)).toEqual(['g1', 'g2', null])
  })

  it('keeps empty groups, with no CCAs', () => {
    const sections = groupedOrder(perCca, [g('g1', 'Empty')])
    expect(sections[0]).toMatchObject({ groupId: 'g1', name: 'Empty', ccas: [] })
    expect(sections).toHaveLength(2)
  })

  it('hides CCA ids the bundle does not have, without dropping them from the group', () => {
    const groups = [g('g1', 'Sports', ['C1', 'GONE'])]
    const sections = groupedOrder(perCca, groups)
    expect(sections[0]?.ccas.map((c) => c.ccaID)).toEqual(['C1'])
    expect(groups[0]?.ccaIDs).toEqual(['C1', 'GONE'])
  })

  it('puts a CCA that is in two groups in the first only', () => {
    const sections = groupedOrder(perCca, [g('g1', 'A', ['C1']), g('g2', 'B', ['C1'])])
    expect(sections.map((s) => s.ccas.length)).toEqual([1, 0, 4])
  })

  it('with no groups returns just the Ungrouped section, A–Z', () => {
    const sections = groupedOrder(perCca, [])
    expect(sections).toHaveLength(1)
    expect(sections[0]?.ccas.map((c) => c.name)).toEqual(['Art', 'Badminton', 'Choir', 'Soccer', 'Zumba'])
  })

  it('still returns an (empty) Ungrouped section when every CCA is grouped', () => {
    const sections = groupedOrder(perCca.slice(0, 1), [g('g1', 'All', ['C1'])])
    expect(sections.at(-1)).toMatchObject({ groupId: null, name: UNGROUPED_NAME, ccas: [] })
  })
})

describe('groupsOnLoad (D3 = A)', () => {
  const local = [g('l1', 'Mine', ['C1'])]
  const file = [g('f1', 'Theirs', ['C2'])]

  it('a file with at least one group replaces the local groups', () => {
    expect(groupsOnLoad(local, file)).toEqual({ groups: file, replaced: true })
  })

  it('a file with no groups (null or empty) leaves the local groups alone', () => {
    expect(groupsOnLoad(local, null)).toEqual({ groups: local, replaced: false })
    expect(groupsOnLoad(local, [])).toEqual({ groups: local, replaced: false })
  })

  it('normalises the file’s groups, and a file that normalises to nothing replaces nothing', () => {
    expect(groupsOnLoad(local, [g('f1', ' Theirs ', ['C2', 'C2'])]).groups).toEqual(file)
    expect(groupsOnLoad(local, [g('f1', '   ')])).toEqual({ groups: local, replaced: false })
  })
})
