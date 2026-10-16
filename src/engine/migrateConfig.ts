import { DEFAULT_CONFIG } from './defaults'

type Rec = Record<string, unknown>
const isRec = (v: unknown): v is Rec => typeof v === 'object' && v !== null && !Array.isArray(v)

/**
 * Brings a config saved by an older version up to the current shape (spec 3, "Migration"):
 * `headcounts.sem2Spots` becomes `sem2Green` with `sem2Grey` 0, and the JCRC settings that
 * did not exist yet take their defaults. Anything that is not a config is returned unchanged,
 * so the caller's shape check still decides whether it is valid. Pure: never mutates `raw`.
 */
export function migrateConfig(raw: unknown): unknown {
  if (!isRec(raw)) return raw
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
