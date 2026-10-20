import { reviewOrder } from './review'

/** A named group of CCAs on the Review step (e.g. a portfolio). Ids and names only: no resident data. */
export interface CcaGroup {
  readonly id: string
  readonly name: string
  readonly ccaIDs: readonly string[]
}

/** The longest group name kept; longer names are cut. */
export const MAX_GROUP_NAME_LENGTH = 40

/** The section for CCAs that are in no group. It always comes last. */
export const UNGROUPED_NAME = 'Ungrouped'

type Rec = Record<string, unknown>
const isRec = (v: unknown): v is Rec => typeof v === 'object' && v !== null && !Array.isArray(v)
const isStr = (v: unknown): v is string => typeof v === 'string'

const isGroup = (v: unknown): v is CcaGroup =>
  isRec(v) && isStr(v.id) && isStr(v.name) && Array.isArray(v.ccaIDs) && v.ccaIDs.every(isStr)

/** True for a list of well-shaped groups. Shape only; normalising is done elsewhere. */
export function isGroupList(v: unknown): v is CcaGroup[] {
  return Array.isArray(v) && v.every(isGroup)
}

const cleanName = (name: string): string => name.trim().slice(0, MAX_GROUP_NAME_LENGTH).trim()
const sameName = (a: string, b: string): boolean => a.toLowerCase() === b.toLowerCase()

/**
 * Cleans a group list read from storage or a file (R14): drops entries that are not groups or have a
 * blank id or name, keeps the first of a repeated id, trims names, and keeps a CCA only in the first
 * group that names it. CCA ids the bundle may lack are kept.
 */
export function normaliseGroups(raw: unknown): CcaGroup[] {
  if (!Array.isArray(raw)) return []
  const seenIds = new Set<string>()
  const seenCcas = new Set<string>()
  const groups: CcaGroup[] = []
  for (const entry of raw) {
    if (!isGroup(entry)) continue
    const name = cleanName(entry.name)
    if (entry.id === '' || name === '' || seenIds.has(entry.id)) continue
    seenIds.add(entry.id)
    const ccaIDs = entry.ccaIDs.filter((id) => {
      if (id === '' || seenCcas.has(id)) return false
      seenCcas.add(id)
      return true
    })
    groups.push({ id: entry.id, name, ccaIDs })
  }
  return groups
}

export type GroupError = 'BLANK_NAME' | 'DUPLICATE_NAME' | 'DUPLICATE_ID' | 'UNKNOWN_GROUP'

export type GroupResult = { readonly ok: true; readonly groups: readonly CcaGroup[] } | { readonly ok: false; readonly error: GroupError }

const fail = (error: GroupError): GroupResult => ({ ok: false, error })

/** Adds an empty group at the end. The caller supplies the id, so this stays pure. */
export function addGroup(groups: readonly CcaGroup[], name: string, id: string): GroupResult {
  const clean = cleanName(name)
  if (clean === '') return fail('BLANK_NAME')
  if (groups.some((group) => sameName(group.name, clean))) return fail('DUPLICATE_NAME')
  if (groups.some((group) => group.id === id)) return fail('DUPLICATE_ID')
  return { ok: true, groups: [...groups, { id, name: clean, ccaIDs: [] }] }
}

/** Renames a group. Another group's name (any case) is refused; its own name in another case is fine. */
export function renameGroup(groups: readonly CcaGroup[], id: string, name: string): GroupResult {
  if (!groups.some((group) => group.id === id)) return fail('UNKNOWN_GROUP')
  const clean = cleanName(name)
  if (clean === '') return fail('BLANK_NAME')
  if (groups.some((group) => group.id !== id && sameName(group.name, clean))) return fail('DUPLICATE_NAME')
  return { ok: true, groups: groups.map((group) => (group.id === id ? { ...group, name: clean } : group)) }
}

/** Removes a group; its CCAs are then in no group, so they show as ungrouped. */
export function removeGroup(groups: readonly CcaGroup[], id: string): readonly CcaGroup[] {
  return groups.some((group) => group.id === id) ? groups.filter((group) => group.id !== id) : groups
}

/** Moves a group one place up (-1) or down (+1); at an end, or for an unknown id, nothing changes. */
export function moveGroup(groups: readonly CcaGroup[], id: string, step: -1 | 1): readonly CcaGroup[] {
  const from = groups.findIndex((group) => group.id === id)
  const to = from + step
  const moved = groups[from]
  const swapped = groups[to]
  if (from < 0 || !moved || !swapped) return groups
  return groups.map((group, i) => (i === from ? swapped : i === to ? moved : group))
}

/** Puts a CCA in one group (removing it from any other), or in none with null. Unknown group: no change. */
export function assignCca(groups: readonly CcaGroup[], ccaID: string, groupId: string | null): readonly CcaGroup[] {
  if (groupId !== null && !groups.some((group) => group.id === groupId)) return groups
  return groups.map((group) => {
    const without = group.ccaIDs.filter((id) => id !== ccaID)
    return group.id === groupId ? { ...group, ccaIDs: [...without, ccaID] } : { ...group, ccaIDs: without }
  })
}

/** One section of the CCA list. `groupId` is null for Ungrouped. */
export interface GroupSection<T> {
  readonly groupId: string | null
  readonly name: string
  readonly ccas: readonly T[]
}

/**
 * The CCA list in sections: groups in their order, CCAs A–Z inside each (as the Review step orders
 * them), then Ungrouped last. Empty groups are kept; ids the bundle lacks are left out of the sections.
 */
export function groupedOrder<T extends { readonly ccaID: string; readonly name: string }>(
  perCca: readonly T[],
  groups: readonly CcaGroup[],
): GroupSection<T>[] {
  const byId = new Map(perCca.map((cca) => [cca.ccaID, cca]))
  const placed = new Set<string>()
  const sections = groups.map((group): GroupSection<T> => {
    const members = group.ccaIDs.flatMap((id) => {
      const cca = byId.get(id)
      if (!cca || placed.has(id)) return []
      placed.add(id)
      return [cca]
    })
    return { groupId: group.id, name: group.name, ccas: reviewOrder(members) }
  })
  const rest = perCca.filter((cca) => !placed.has(cca.ccaID))
  return [...sections, { groupId: null, name: UNGROUPED_NAME, ccas: reviewOrder(rest) }]
}

/**
 * D3 = A: opening a workspace whose file has at least one group replaces this computer's groups;
 * a file with none leaves them alone. `replaced` lets Open workspace say so.
 */
export function groupsOnLoad(local: readonly CcaGroup[], fromFile: unknown): { readonly groups: readonly CcaGroup[]; readonly replaced: boolean } {
  const groups = normaliseGroups(fromFile)
  return groups.length > 0 ? { groups, replaced: true } : { groups: local, replaced: false }
}
