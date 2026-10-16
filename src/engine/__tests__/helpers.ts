import type {
  Cca,
  CcaType,
  IhgEntry,
  Membership,
  PlacementLevel,
  Resident,
} from '../types'

export const TEST_MATRIC = 'A0000001A'

/** AUX 5 maps to 0 points in the default table. */
const NEUTRAL_AUX = 5

export function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value)
    Object.values(value).forEach(deepFreeze)
  }
  return value
}

export function makeCca(
  ccaID: string,
  placement: PlacementLevel = 'pass',
  type: CcaType = '1x',
  overrides: Partial<Cca> = {},
): Cca {
  return {
    ccaID,
    ccaName: ccaID,
    type,
    placement,
    outgoingTier: null,
    outgoingMultiplier: null,
    meanMin: null,
    meanMax: null,
    sdMin: null,
    sdMax: null,
    ...overrides,
  }
}

export function makeMembership(
  ccaID: string,
  basePoints: number,
  overrides: Partial<Membership> = {},
): Membership {
  return {
    matric: TEST_MATRIC,
    ccaID,
    basePoints,
    semesterOnly: false,
    outgoingRole: 'none',
    incomingRole: 'none',
    roleDropped: false,
    ...overrides,
  }
}

export function makeResident(overrides: Partial<Resident> = {}): Resident {
  return {
    matric: TEST_MATRIC,
    name: 'Test Resident',
    gender: 'M',
    sem2: false,
    aux: NEUTRAL_AUX,
    ...overrides,
  }
}

export function makeIhg(ccaID: string, placement: IhgEntry['placement']): IhgEntry {
  return { matric: TEST_MATRIC, ccaID, placement }
}

export function ccaMap(ccas: readonly Cca[]): Readonly<Record<string, Cca>> {
  return Object.fromEntries(ccas.map((cca) => [cca.ccaID, cca]))
}

/** The six CCAs of spec example E1 as [ccaID, base, placement]. */
export const E1_ROWS: readonly (readonly [string, number, PlacementLevel])[] = [
  ['Handball', 18, 'gold'],
  ['Arts', 15, 'bronze'],
  ['Welfare', 10, 'bronze'],
  ['Unplugged', 9, 'silver'],
  ['Rhebels', 8, 'gold'],
  ['Social', 7, 'gold'],
]

export function e1Ccas(): readonly Cca[] {
  return E1_ROWS.map(([id, , placement]) => makeCca(id, placement))
}

export function e1Memberships(
  handballOverrides: Partial<Membership> = {},
): readonly Membership[] {
  return E1_ROWS.map(([id, base]) =>
    makeMembership(id, base, id === 'Handball' ? handballOverrides : {}),
  )
}
