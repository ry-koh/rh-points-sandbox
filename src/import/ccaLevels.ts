import type { ScenarioConfig } from '../engine'
import { makeIssue } from './parseCommon'
import type { CcaLevelEntry, Issue } from './types'

const isTweak = (value: number | null, ok: (n: number) => boolean): boolean =>
  value === null || (Number.isFinite(value) && ok(value))

/** A bonus tweak is blank (null) or a number of 0 or more. */
export const isBonusTweak = (value: number | null): boolean => isTweak(value, (n) => n >= 0)

/** A multiplier tweak is blank (null) or a number above 0. */
export const isMultiplierTweak = (value: number | null): boolean => isTweak(value, (n) => n > 0)

/** One DUPLICATE_LEVEL_NAME per name used by more than one level in Settings (R44). */
export function levelProblems(config: Pick<ScenarioConfig, 'levels'>): Issue[] {
  const names = config.levels.map((level) => level.name)
  const repeated = names.filter((name, i) => names.indexOf(name) !== i)
  return [...new Set(repeated)].map((name) =>
    makeIssue('DUPLICATE_LEVEL_NAME', '', `two levels are named "${name}" in Settings; rename one of them.`),
  )
}

/**
 * Checks one CCA's level entry (spec 3b): the level must be one of the levels in Settings, a
 * bonus tweak a number of 0 or more, a multiplier tweak a number above 0, and the CCA must be in
 * the bundle (otherwise the entry is ignored, with a warning).
 */
export function validateCcaLevelEntry(
  entry: CcaLevelEntry,
  config: Pick<ScenarioConfig, 'levels'>,
  ccaIds: ReadonlySet<string>,
): Issue[] {
  const { ccaID } = entry
  const names = config.levels.map((level) => level.name)
  const issues: Issue[] = []
  if (!ccaIds.has(ccaID)) {
    issues.push(makeIssue('LEVEL_UNKNOWN_CCA', '', `${ccaID} has a level set but is not in the bundle; the entry is ignored.`, { ccaID }))
  }
  if (entry.level !== null && !names.includes(entry.level)) {
    const text =
      `${ccaID}: level "${entry.level}" is not one of the levels in Settings (${names.join(', ')}). ` +
      'Pick another level on the Review step or add it back in Settings.'
    issues.push(makeIssue('UNKNOWN_LEVEL', '', text, { ccaID }))
  }
  if (!isBonusTweak(entry.bonusOverride)) {
    issues.push(makeIssue('BAD_LEVEL_TWEAK', '', `${ccaID}: the bonus tweak "${entry.bonusOverride}" must be a number of 0 or more.`, { ccaID }))
  }
  if (!isMultiplierTweak(entry.multiplierOverride)) {
    issues.push(makeIssue('BAD_LEVEL_TWEAK', '', `${ccaID}: the multiplier tweak "${entry.multiplierOverride}" must be a number above 0.`, { ccaID }))
  }
  return issues
}

/** The entry for a CCA, or null when it has none. */
export function ccaLevelFor(list: readonly CcaLevelEntry[], ccaID: string): CcaLevelEntry | null {
  return list.find((entry) => entry.ccaID === ccaID) ?? null
}

const isEmpty = (entry: CcaLevelEntry): boolean =>
  entry.level === null && entry.bonusOverride === null && entry.multiplierOverride === null

/** Sets a CCA's entry, replacing any earlier one; an entry with nothing set removes it. */
export function upsertCcaLevel(list: readonly CcaLevelEntry[], entry: CcaLevelEntry): CcaLevelEntry[] {
  if (isEmpty(entry)) return list.filter((item) => item.ccaID !== entry.ccaID)
  const exists = list.some((item) => item.ccaID === entry.ccaID)
  return exists ? list.map((item) => (item.ccaID === entry.ccaID ? entry : item)) : [...list, entry]
}

/** Moves every entry on level `from` to level `to` (a level renamed in Settings, R44). */
export function renameLevelInEntries(list: readonly CcaLevelEntry[], from: string, to: string): CcaLevelEntry[] {
  return list.map((entry) => (entry.level === from ? { ...entry, level: to } : entry))
}
