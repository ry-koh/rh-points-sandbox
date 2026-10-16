import { DEFAULT_CONFIG } from '../defaults'
import type {
  Cca,
  CcaType,
  Gender,
  Headcounts,
  IhgEntry,
  Membership,
  PipelineInput,
  PlacementLevel,
  Resident,
  Role,
  ScenarioConfig,
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

export interface RowSpec {
  readonly id: string
  readonly gender?: Gender
  readonly sem2?: boolean
  /** Base in CCA "X" (pass placement, so the staying/bidding net equals the base). */
  readonly base?: number
  readonly incoming?: Role
  /** Extra [ccaID, base] memberships, e.g. in CCA "Y". */
  readonly extra?: readonly (readonly [string, number])[]
  readonly aux?: number
}

/** Synthetic dataset: matric = id, every membership in the plain 1x CCAs "X" and "Y". */
export function makeInput(rows: readonly RowSpec[]): PipelineInput {
  const residents = rows.map((row) =>
    makeResident({
      matric: row.id,
      name: row.id,
      gender: row.gender ?? 'M',
      sem2: row.sem2 ?? false,
      aux: row.aux ?? NEUTRAL_AUX,
    }),
  )
  const memberships = rows.flatMap((row) => [
    ...(row.base === undefined
      ? []
      : [makeMembership('X', row.base, { matric: row.id, incomingRole: row.incoming ?? 'none' })]),
    ...(row.extra ?? []).map(([ccaID, base]) => makeMembership(ccaID, base, { matric: row.id })),
  ])
  return { residents, ccas: [makeCca('X'), makeCca('Y')], memberships, ihg: [] }
}

export function configWith(
  headcounts: Partial<Headcounts>,
  overrides: Partial<ScenarioConfig> = {},
): ScenarioConfig {
  return {
    ...DEFAULT_CONFIG,
    ...overrides,
    headcounts: { ...DEFAULT_CONFIG.headcounts, ...headcounts },
  }
}
