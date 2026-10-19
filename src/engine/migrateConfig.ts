import { DEFAULT_CONFIG } from './defaults'

type Rec = Record<string, unknown>
const isRec = (v: unknown): v is Rec => typeof v === 'object' && v !== null && !Array.isArray(v)

const METAL_WORDS: readonly string[] = ['gold', 'silver', 'bronze']

/** The old placement a level named `name` stands for: its first metal word, else pass. */
function placementOf(name: string): string {
  return name.toLowerCase().split(/[^a-z]+/).find((w) => METAL_WORDS.includes(w)) ?? 'pass'
}

/** The old placement bonus for `name`, or the default level bonus for that placement. */
function bonusFor(name: string, bonuses: Rec | null): unknown {
  const placement = placementOf(name)
  const fallback = DEFAULT_CONFIG.levels.find((l) => placementOf(l.name) === placement)?.bonus ?? 0
  return bonuses?.[placement] ?? fallback
}

/**
 * R43: one level per old `outgoingTiers` row (name and multiplier kept), its bonus taken from the
 * old `placementBonus`; the default levels when there are no tiers. Unreadable rows are passed
 * through so the caller's shape check rejects them.
 */
function levelsFromOld(raw: Rec): unknown[] {
  const bonuses = isRec(raw.placementBonus) ? raw.placementBonus : null
  const tiers = Array.isArray(raw.outgoingTiers) && raw.outgoingTiers.length > 0 ? raw.outgoingTiers : null
  const source: readonly unknown[] = tiers ?? DEFAULT_CONFIG.levels
  return source.map((row) =>
    isRec(row) && typeof row.name === 'string'
      ? { name: row.name, bonus: bonusFor(row.name, bonuses), multiplier: row.multiplier }
      : row,
  )
}

const OLD_LEVEL_KEYS = ['placementBonus', 'outgoingMode', 'outgoingTiers'] as const

/** True when `raw` has no `levels` but carries the keys they are built from (R43). */
export function hasOldLevelKeys(raw: unknown): boolean {
  return isRec(raw) && !('levels' in raw) && OLD_LEVEL_KEYS.some((key) => key in raw)
}

/** Replaces `placementBonus`, `outgoingMode` and `outgoingTiers` with `levels` when it is missing. */
function withLevels(raw: Rec): Rec {
  if ('levels' in raw) return raw
  const { placementBonus: _bonus, outgoingMode: _mode, outgoingTiers: _tiers, ...rest } = raw
  return { ...rest, levels: levelsFromOld(raw) }
}

/**
 * Brings a config saved by an older version up to the current shape (spec 3, "Migration"):
 * `headcounts.sem2Spots` becomes `sem2Green` with `sem2Grey` 0, the JCRC settings that
 * did not exist yet take their defaults, and `levels` is built from the old placement bonus
 * and outgoing tiers (R43); a config that already has `levels` keeps them. Anything that is
 * not a config is returned unchanged, so the caller's shape check still decides whether it
 * is valid. Pure: never mutates `input`.
 */
export function migrateConfig(input: unknown): unknown {
  if (!isRec(input)) return input
  const raw = withLevels(input)
  const withJcrc: Rec = {
    ...raw,
    jcrcFullYearOffset: raw.jcrcFullYearOffset ?? DEFAULT_CONFIG.jcrcFullYearOffset,
    jcrcExchangeFactor: raw.jcrcExchangeFactor ?? DEFAULT_CONFIG.jcrcExchangeFactor,
  }
  const headcounts = raw.headcounts
  if (!isRec(headcounts) || !('sem2Spots' in headcounts)) return withJcrc
  const { sem2Spots, ...rest } = headcounts
  return {
    ...withJcrc,
    headcounts: { ...rest, sem2Green: headcounts.sem2Green ?? sem2Spots, sem2Grey: headcounts.sem2Grey ?? 0 },
  }
}
