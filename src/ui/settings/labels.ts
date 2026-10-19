import type { Headcounts, ScenarioConfig } from '../../engine'

/**
 * Plain-English text for every setting, written for JCRC members who are not engineers.
 * The stored config keys never change; only what people read does.
 */
export interface SettingText {
  readonly label: string
  readonly help: string
}

const LEADER_HELP = 'Multiplies their score in that CCA. 15 × 1.2 = 18. Counts for staying and bidding.'
const JCRC_HELP = "'Highest other' = the top bidding score among everyone who isn't JCRC or sem-2."
const AUX_HELP = 'AUX are earned at JCRC events. 5 AUX = 0, each extra AUX = +2, each missing = −2 (by default).'

export const SETTINGS_TEXT: Readonly<Record<keyof ScenarioConfig, SettingText>> = {
  headcounts: { label: 'How many stay', help: 'Everyone below green + grey is white and cannot stay.' },
  levels: {
    label: 'Levels',
    help: 'Each CCA is given one level on the Review step. Members get the bonus added once (never multiplied); outgoing Heads / Vice Heads get the multiplier (bidding only).',
  },
  incomingMultiplier: { label: 'Incoming leader bonus (×)', help: LEADER_HELP },
  stackingMode: {
    label: 'If someone is both outgoing and incoming in the same CCA',
    help: 'With ×1.2 and ×2.0: bigger = ×2.0, add = ×2.2, multiply = ×2.4.',
  },
  stayingWeights: {
    label: 'How much each CCA counts for staying (best first)',
    help: 'Your CCAs are ranked by points. 1st–4th count fully, 5th counts 50%, 6th 25%…',
  },
  stayingWeightTail: {
    label: 'After the last one listed: keep halving',
    help: 'Each CCA after the last one listed counts half as much as the one before it.',
  },
  halfCcaBaseFactor: { label: 'Half-year CCA points (×)', help: "A leader's 16 counts as 8 at ×0.5." },
  halfCcaPlacementHalved: {
    label: 'Also halve the level bonus for half-year CCAs',
    help: 'Off: a High Gold half-year CCA still gets +4. On: +2.',
  },
  mergeHalfCcas: {
    label: 'Count two half-year CCAs as one',
    help: 'Lets two half-year CCAs share one top-4 slot. The best pair is picked for each person automatically.',
  },
  semesterOnlyFactor: {
    label: '1-semester members in full-year CCAs (×)',
    help: "When a leader picks '1 sem', a 14 counts as 7. The leader's average check still used 14.",
  },
  droppedRoleBase: {
    label: 'Points kept if an incoming leader drops the role',
    help: 'Their score in that CCA is cut to at most this, and the leader bonus is removed.',
  },
  auxTable: { label: 'AUX points → hall points', help: AUX_HELP },
  auxCap: { label: 'Most AUX points counted', help: 'Anyone with more AUX is counted as having this many.' },
  ihgPoints: {
    label: 'IHG placement bonus',
    help: 'Points for each IHG result: 1st, 2nd, 3rd, or 3rd/4th with no placement match.',
  },
  ihgInSportNet: {
    label: "Count IHG bonus inside the sport's score",
    help:
      "Off: added straight onto the total, always in full. On: added to that sport's CCA score, so it can lift the sport into the top 4 — or be cut to 50%/25% if the sport is a 5th/6th CCA. Never added to flat or final-points CCAs.",
  },
  sem2Mode: {
    label: 'When do semester-2 residents pick rooms?',
    help: "Mixed: a sem-2 resident with 40 points goes into their gender's bidding list at 80, within their colour.",
  },
  sem2Factor: { label: 'Multiply sem-2 points by', help: 'Only used when sem-2 residents are mixed in with everyone.' },
  jcrcFullYearOffset: { label: 'Full year: highest other bidding points +', help: JCRC_HELP },
  jcrcExchangeFactor: { label: 'On exchange: % of highest other bidding points', help: JCRC_HELP },
  meanSdDefault: {
    label: 'Allowed average and spread (default)',
    help: 'Used to re-check leader files for CCAs without a waiver.',
  },
}

export const SECTION_TITLES = {
  headcounts: 'How many stay',
  levels: 'CCA levels',
  leaders: 'Leader bonuses',
  weights: 'How much each CCA counts for staying',
  half: 'Half-year CCAs (like RHag, Flag)',
  dropped: 'Points kept if an incoming leader drops the role',
  aux: 'AUX points',
  ihg: 'IHG placement bonus',
  sem2: 'Semester-2 residents',
  jcrc: 'JCRC members',
  meanSd: 'Allowed average and spread (default)',
} as const

export const HEADCOUNT_LABELS: Readonly<Record<keyof Headcounts, string>> = {
  maleGreen: 'Male — definitely stay (green)',
  maleGrey: 'Male — waiting list (grey)',
  femaleGreen: 'Female — definitely stay (green)',
  femaleGrey: 'Female — waiting list (grey)',
  sem2Green: 'Sem-2 — definitely stay (green)',
  sem2Grey: 'Sem-2 — waiting list (grey)',
}

export const INCOMING_LABELS = { head: 'Incoming Head bonus (×)', vice_head: 'Incoming Vice Head bonus (×)' } as const

export const STACKING_OPTIONS = [
  { value: 'max', label: 'Use the bigger one' },
  { value: 'additive', label: 'Add the bonuses' },
  { value: 'multiplicative', label: 'Multiply them' },
] as const

export const SEM2_MODE_OPTIONS = [
  { value: 'separate', label: 'On their own list' },
  { value: 'merged', label: 'Mixed in with everyone (points × factor)' },
] as const

export const MEAN_SD_LABELS = {
  meanMin: 'Average, lowest',
  meanMax: 'Average, highest',
  sdMin: 'Spread (SD), lowest',
  sdMax: 'Spread (SD), highest',
} as const
