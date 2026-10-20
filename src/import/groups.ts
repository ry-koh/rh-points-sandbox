/** A named group of CCAs on the Review step (e.g. a portfolio). Ids and names only: no resident data. */
export interface CcaGroup {
  readonly id: string
  readonly name: string
  readonly ccaIDs: readonly string[]
}

type Rec = Record<string, unknown>
const isRec = (v: unknown): v is Rec => typeof v === 'object' && v !== null && !Array.isArray(v)
const isStr = (v: unknown): v is string => typeof v === 'string'

const isGroup = (v: unknown): v is CcaGroup =>
  isRec(v) && isStr(v.id) && isStr(v.name) && Array.isArray(v.ccaIDs) && v.ccaIDs.every(isStr)

/** True for a list of well-shaped groups. Shape only; normalising is done elsewhere. */
export function isGroupList(v: unknown): v is CcaGroup[] {
  return Array.isArray(v) && v.every(isGroup)
}
