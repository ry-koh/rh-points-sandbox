import { DEFAULT_CONFIG } from '../defaults'

type Rec = Record<string, unknown>

/** A config as saved before levels existed (spec 3, "Migration"): the default one unless overridden. */
export function oldLevelConfig(overrides: Rec = {}): Rec {
  const { levels: _levels, ...rest } = DEFAULT_CONFIG
  return {
    ...rest,
    placementBonus: { pass: 0, bronze: 0.5, silver: 1.5, gold: 4 },
    outgoingMode: 'tier',
    outgoingTiers: DEFAULT_CONFIG.levels.map(({ name, multiplier }) => ({ name, multiplier })),
    ...overrides,
  }
}

/** The old placement bonus with a custom gold value, as an override for `oldLevelConfig`. */
export const goldBonus = (gold: number): Rec => ({ placementBonus: { pass: 0, bronze: 0.5, silver: 1.5, gold } })

/** Old outgoing tiers, as an override for `oldLevelConfig`. */
export const tiers = (rows: readonly { readonly name: string; readonly multiplier: number }[]): Rec => ({ outgoingTiers: rows })

/** The old keys that must be gone after migration. */
export const OLD_LEVEL_KEYS = ['placementBonus', 'outgoingMode', 'outgoingTiers'] as const
