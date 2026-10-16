import type { Cca, ListRow, Lists, Membership, PenaltyState, PipelineInput, Resident, ResidentResult } from '../../engine'
import { LIST_KEYS, type ListKey } from '../export/exportCsv'

/** Inputs (as imported) shown next to the engine breakdown; nothing here is computed. */
export interface DrawerInputs {
  readonly resident: Resident | undefined
  readonly memberships: readonly Membership[]
  readonly ccas: ReadonlyMap<string, Cca>
}

export function drawerInputs(input: PipelineInput | undefined, matric: string): DrawerInputs {
  return {
    resident: input?.residents.find((r) => r.matric === matric),
    memberships: input?.memberships.filter((m) => m.matric === matric) ?? [],
    ccas: new Map((input?.ccas ?? []).map((c) => [c.ccaID, c])),
  }
}

export interface ListPlacement {
  readonly list: ListKey
  readonly row: ListRow
}

/** Where the resident appears in each of the five lists. */
export function placements(lists: Lists, matric: string): ListPlacement[] {
  return LIST_KEYS.flatMap((list) => {
    const row = lists[list].find((r) => r.matric === matric)
    return row ? [{ list, row }] : []
  })
}

export function findResult(lists: Lists, matric: string): ResidentResult | undefined {
  return placements(lists, matric)[0]?.row.result
}

export const isDropped = (penalty: PenaltyState | undefined, matric: string, ccaID: string): boolean =>
  penalty?.applied.some((k) => k.matric === matric && k.ccaID === ccaID) ?? false

export const cap = (text: string): string => text.charAt(0).toUpperCase() + text.slice(1)
export const roleLabel = (role: string): string => (role === 'none' ? '—' : role === 'vice_head' ? 'VH' : 'Head')
