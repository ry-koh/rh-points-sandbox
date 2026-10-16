import {
  buildPublishedLists,
  type Lists,
  type PublishedList,
  type PublishedLists,
  type UnresolvedTie,
  type WheelResolution,
} from '../../engine'
import type { ListKey } from '../export/exportCsv'

/** The published list for each results tab (the sem-2 tab publishes as sem2Staying). */
export const PUBLISHED_KEY: Readonly<Record<ListKey, keyof PublishedLists>> = {
  maleStaying: 'maleStaying',
  femaleStaying: 'femaleStaying',
  maleBidding: 'maleBidding',
  femaleBidding: 'femaleBidding',
  sem2: 'sem2Staying',
}

export const DEFAULT_TITLES: Readonly<Record<ListKey, string>> = {
  maleStaying: 'MALE STAYING LIST',
  femaleStaying: 'FEMALE STAYING LIST',
  maleBidding: 'MALE BIDDING LIST',
  femaleBidding: 'FEMALE BIDDING LIST',
  sem2: 'SEM 2 STAYING LIST',
}

export type Readiness =
  | { readonly ok: true; readonly lists: PublishedLists }
  | { readonly ok: false; readonly finalised: boolean; readonly unresolved: readonly UnresolvedTie[] }

/** Publishing needs finalised lists AND every boundary tie settled by the wheel (spec 5.7). */
export function publishReadiness(
  lists: Lists | null,
  finalised: boolean,
  resolutions: readonly WheelResolution[],
): Readiness {
  if (!lists) return { ok: false, finalised, unresolved: [] }
  const result = buildPublishedLists(lists, resolutions)
  if (finalised && result.ok) return { ok: true, lists: result.lists }
  return { ok: false, finalised, unresolved: result.ok ? [] : result.unresolved }
}

/** One printable list: its title line (or null) and its rows. */
export interface PrintItem {
  readonly key: ListKey
  readonly title: string | null
  readonly list: PublishedList
}
