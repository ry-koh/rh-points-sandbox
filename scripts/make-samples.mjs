// Generates the synthetic sample data in samples/valid and samples/broken.
// Plain Node, no dependencies, seeded PRNG: running it twice gives identical files.
// Every name is "Test Resident NNN" and every matric is A99xxxxxZ. Nothing here is real.
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const SEED = 20270401
const SAMPLES = join(dirname(fileURLToPath(import.meta.url)), '..', 'samples')
const EXPORTED_AT = '2027-04-01T00:00:00Z'
const DEFAULT_RANGE = { meanMin: 10, meanMax: 14, sdMin: 2, sdMax: 5 } // placeholder defaults
const MARGIN = 0.3
// The default level names (D22); demo-levels.json picks one per CCA from these.
const LEVELS = ['Unsatisfactory', 'Pass', 'Low Bronze', 'High Bronze', 'Low Silver', 'High Silver', 'Low Gold', 'High Gold']

const LEADER_COLS = ['formatVersion', 'ccaID', 'ccaName', 'matric', 'name', 'basePoints', 'semesterOnly', 'outgoingRole', 'incomingRole', 'exportedAt']
const RESIDENT_COLS = ['matric', 'name', 'gender', 'sem2', 'aux', 'jcrc']
const FLAT_COLS = ['formatVersion', 'ccaID', 'ccaName', 'matric', 'name', 'flatPoints', 'exportedAt']
const IHG_COLS = ['matric', 'ccaID', 'placement']
const SETTINGS_COLS = ['formatVersion', 'scope', 'ccaID', 'ccaName', 'meanMin', 'meanMax', 'sdMin', 'sdMax', 'note', 'exportedAt']
const BUNDLE_COLS = [
  'formatVersion', 'section', 'scope', 'ccaID', 'ccaName', 'matric', 'name', 'flatPoints', 'type', 'sport',
  'ihgResult', 'ihgCap', 'meanMin', 'meanMax', 'sdMin', 'sdMax', 'note', 'exportedAt',
]
// The header of the retired ccas.csv, used only to show that the sandbox refuses such a file.
const RETIRED_CCA_COLS = ['ccaID', 'ccaName', 'type', 'placement', 'outgoingTier', 'outgoingMultiplier', 'meanMin', 'meanMax', 'sdMin', 'sdMax']

// ---------- helpers ----------
function mulberry32(seed) {
  let a = seed
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const rand = mulberry32(SEED)
const randInt = (lo, hi) => lo + Math.floor(rand() * (hi - lo + 1))
const normal = () => Math.sqrt(-2 * Math.log(1 - rand())) * Math.cos(2 * Math.PI * rand())
const shuffle = (items) => {
  const out = [...items]
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = randInt(0, i)
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}
const pad = (n, width) => String(n).padStart(width, '0')
const matricOf = (n) => `A99${pad(n, 5)}Z`
const nameOf = (n) => `Test Resident ${pad(n, 3)}`
const quote = (cell) => (/[",\n]/.test(cell) ? `"${cell.replaceAll('"', '""')}"` : cell)
const toCsv = (cols, rows) =>
  [cols.join(','), ...rows.map((row) => cols.map((col) => quote(String(row[col] ?? ''))).join(','))].join('\n') + '\n'

function write(dir, name, text) {
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, name), text, 'utf8')
}

function meanSd(values) {
  const mean = values.reduce((a, b) => a + b, 0) / values.length
  const sd = Math.sqrt(values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length)
  return { mean, sd }
}
const insideWithMargin = (values, range) => {
  const { mean, sd } = meanSd(values)
  return (
    mean >= range.meanMin + MARGIN && mean <= range.meanMax - MARGIN &&
    sd >= range.sdMin + MARGIN && sd <= range.sdMax - MARGIN
  )
}

// ---------- valid sample ----------
const RESIDENT_COUNT = 80
const ZERO_CCA_RESIDENTS = [30, 31, 70, 71]
const TIE_GROUP = [1, 2, 3, 4]
const MULTI_RESIDENT = 5
// JCRC residents: 2 male and 1 female full year, 1 (female) exchange. Their CCA data is ignored.
const JCRC = { 34: 'FULL', 35: 'FULL', 60: 'FULL', 61: 'EXCHANGE' }
// One flat CCA (no leader file): ~8 members, one value for all of them.
const FLAT_CCA_ID = 'C13'
const FLAT_VALUE = 9
const FLAT_MEMBERS = [10, 11, 12, 13, 14, 15, 16, 17]
// The sports in the bundle, with the IHG result JCRC set in RH-app; each has a cap of IHG_CAP.
const SPORTS = { C01: '1st', C02: '2nd', C04: '3rd', C05: '3rd4th_no_match', C06: '2nd', C08: '1st' }
const IHG_CAP = 3
const WAIVERS = {
  C03: { meanMin: 14, meanMax: 17, sdMin: 1, sdMax: 3, mu: 15.5, sigma: 1.6 },
  C07: { meanMin: 7, meanMax: 10, sdMin: 2, sdMax: 6, mu: 8.5, sigma: 3.5 },
}

function makeResidents() {
  return Array.from({ length: RESIDENT_COUNT }, (_, i) => {
    const n = i + 1
    const sem2 = n > 72
    const male = n <= 36 || (n > 72 && n <= 76)
    const special = { [MULTI_RESIDENT]: 11, 20: 12 }[n]
    const aux = TIE_GROUP.includes(n) ? 5 : (special ?? randInt(0, 10))
    return { matric: matricOf(n), name: nameOf(n), gender: male ? 'M' : 'F', sem2: sem2 ? 'Y' : 'N', aux, jcrc: JCRC[n] ?? 'N' }
  })
}

/** The CCAs as the bundle's cca rows describe them. */
function makeCcas() {
  return Array.from({ length: 12 }, (_, i) => {
    const id = `C${pad(i + 1, 2)}`
    const ihgResult = SPORTS[id]
    return {
      ccaID: id,
      ccaName: `Test CCA ${pad(i + 1, 2)}`,
      type: i < 9 ? '1x' : '0.5x',
      ...(ihgResult ? { sport: 'Y', ihgResult, ihgCap: IHG_CAP } : {}),
    }
  })
}

/** Members each CCA must contain, with fixed bases: the tie group and the many-CCA resident. */
function forcedMembers() {
  const forced = {}
  const add = (id, n, base) => (forced[id] = [...(forced[id] ?? []), { n, base }])
  for (const n of TIE_GROUP) {
    add('C05', n, 14)
    add('C06', n, 12)
  }
  const bases = { C01: 17, C02: 16, C03: 15, C04: 14, C10: 12, C11: 11, C12: 10 }
  for (const [id, base] of Object.entries(bases)) add(id, MULTI_RESIDENT, base)
  return forced
}

function pickScores(count, range) {
  const { mu, sigma } = { mu: (range.meanMin + range.meanMax) / 2, sigma: 3, ...range }
  return (fixed) => {
    for (let attempt = 0; attempt < 5000; attempt += 1) {
      const free = Array.from({ length: count - fixed.length }, () => Math.min(20, Math.max(0, Math.round(mu + sigma * normal()))))
      if (insideWithMargin([...fixed, ...free], range)) return free
    }
    throw new Error('could not generate scores inside the range')
  }
}

function buildLeaderRows(ccaIndex, cca, residents, forced) {
  const pool = shuffle(
    residents
      .map((_, i) => i + 1)
      .filter((n) => !ZERO_CCA_RESIDENTS.includes(n) && !TIE_GROUP.includes(n) && n !== MULTI_RESIDENT),
  )
  const mine = forced[cca.ccaID] ?? []
  const members = pool.slice(0, randInt(12, 22))
  const range = { ...DEFAULT_RANGE, ...(WAIVERS[cca.ccaID] ?? {}) }
  const free = pickScores(mine.length + members.length, range)(mine.map((f) => f.base))
  const rows = [
    ...mine.map(({ n, base }) => ({ n, base, special: true })),
    ...members.map((n, i) => ({ n, base: free[i], special: false })),
  ]
  return assignRoles(ccaIndex, cca, rows)
}

/** Heads and Vice Heads (incoming and outgoing) and semester-only ticks on plain members. */
function assignRoles(ccaIndex, cca, rows) {
  const plain = rows.filter((r) => !r.special)
  const roles = new Map()
  const give = (slot, field, value) => {
    const row = plain[slot]
    if (row) roles.set(row.n, { ...roles.get(row.n), [field]: value })
  }
  give(0, 'incomingRole', 'head')
  if (ccaIndex % 2 === 0) give(1, 'incomingRole', 'vice_head')
  if (ccaIndex % 3 !== 2) give(2, 'outgoingRole', 'head')
  if (ccaIndex % 3 === 0) give(3, 'outgoingRole', 'vice_head')
  if (ccaIndex === 0) give(0, 'outgoingRole', 'head') // outgoing AND incoming in one CCA
  const half = cca.type === '0.5x'
  return rows.map((r) => ({
    ...r,
    outgoingRole: 'none',
    incomingRole: 'none',
    ...roles.get(r.n),
    semesterOnly: !half && !r.special && !roles.has(r.n) && rand() < 0.12 ? 'Y' : 'N',
  }))
}

function toLeaderCsv(cca, rows) {
  const out = rows.map((r) => ({
    formatVersion: 1, ccaID: cca.ccaID, ccaName: cca.ccaName, matric: matricOf(r.n), name: nameOf(r.n),
    basePoints: r.base, semesterOnly: r.semesterOnly, outgoingRole: r.outgoingRole, incomingRole: r.incomingRole,
    exportedAt: EXPORTED_AT,
  }))
  return toCsv(LEADER_COLS, out)
}

/** JCRC's points settings file (spec 2g): the default row, then one waiver row per waived CCA. */
function settingsRows(waivers) {
  const row = (scope, ccaID, ccaName, range, note) => ({
    formatVersion: 1, scope, ccaID, ccaName, meanMin: range.meanMin, meanMax: range.meanMax,
    sdMin: range.sdMin, sdMax: range.sdMax, note, exportedAt: EXPORTED_AT,
  })
  return [
    row('default', '', '', DEFAULT_RANGE, ''),
    ...waivers.map(({ ccaID, ccaName, range }) => row('waiver', ccaID, ccaName, range, 'Small CCA')),
  ]
}

function makeFlatCca(ccaID = FLAT_CCA_ID, value = FLAT_VALUE) {
  return { ccaID, ccaName: `Test Flat CCA ${ccaID.slice(1)}`, type: '1x', flatPoints: value }
}

function flatRows(ccaID, value, members) {
  const cca = makeFlatCca(ccaID, value)
  return members.map((n) => ({
    formatVersion: 1, ccaID, ccaName: cca.ccaName, matric: matricOf(n), name: nameOf(n),
    flatPoints: value, exportedAt: EXPORTED_AT,
  }))
}

/** The RH-app bundle (spec 2d): settings rows, then cca rows, then flat member rows. */
function toBundleCsv(settings, ccas, flat) {
  const ccaRow = (cca) => ({
    formatVersion: 1, section: 'cca', ccaID: cca.ccaID, ccaName: cca.ccaName, flatPoints: cca.flatPoints ?? '',
    type: cca.type, sport: cca.sport ?? 'N', ihgResult: cca.ihgResult ?? '', ihgCap: cca.ihgCap ?? '', exportedAt: EXPORTED_AT,
  })
  return toCsv(BUNDLE_COLS, [
    ...settings.map((row) => ({ ...row, section: 'settings' })),
    ...ccas.map(ccaRow),
    ...flat.map((row) => ({ ...row, section: 'flat' })),
  ])
}

function makeIhg(byCca) {
  const picks = [['C01', '1st'], ['C02', '2nd'], ['C04', '3rd'], ['C05', '3rd4th_no_match'], ['C06', '2nd'], ['C08', '1st']]
  return picks.map(([id, placement], i) => ({ matric: matricOf(byCca[id][i % byCca[id].length].n), ccaID: id, placement }))
}

function writeValid() {
  const dir = join(SAMPLES, 'valid')
  const residents = makeResidents()
  const ccas = makeCcas()
  const forced = forcedMembers()
  const byCca = {}
  const rowsByCca = ccas.map((cca, i) => buildLeaderRows(i, cca, residents, forced))
  rowsByCca.forEach((rows, i) => (byCca[ccas[i].ccaID] = rows))
  write(dir, 'residents.csv', toCsv(RESIDENT_COLS, residents))
  ccas.forEach((cca, i) => write(dir, `points_${cca.ccaID}_20270401.csv`, toLeaderCsv(cca, rowsByCca[i])))
  write(dir, 'ihg.csv', toCsv(IHG_COLS, makeIhg(byCca)))
  const waivers = ccas
    .filter((cca) => WAIVERS[cca.ccaID])
    .map((cca) => ({ ccaID: cca.ccaID, ccaName: cca.ccaName, range: { ...DEFAULT_RANGE, ...WAIVERS[cca.ccaID] } }))
  const flat = flatRows(FLAT_CCA_ID, FLAT_VALUE, FLAT_MEMBERS)
  write(dir, 'points_bundle_20270401.csv', toBundleCsv(settingsRows(waivers), [...ccas, makeFlatCca()], flat))
  // The sandbox's level table for the demo (entered in the sandbox, not an input file): one level per non-flat CCA.
  const levels = ccas.map((cca, i) => ({ ccaID: cca.ccaID, level: LEVELS[(i * 3) % LEVELS.length], bonusOverride: null, multiplierOverride: null }))
  write(dir, 'demo-levels.json', `${JSON.stringify(levels, null, 2)}\n`)
}

// ---------- broken samples ----------
const BASE_SCORES = [8, 10, 12, 14, 16, 18]

function baseScenario() {
  const residents = Array.from({ length: 10 }, (_, i) => ({
    matric: matricOf(i + 1), name: nameOf(i + 1), gender: i % 2 === 0 ? 'M' : 'F', sem2: 'N', aux: 5, jcrc: 'N',
  }))
  const ccas = [
    { ccaID: 'C1', ccaName: 'Test CCA One', type: '1x' },
    { ccaID: 'C2', ccaName: 'Test CCA Two', type: '0.5x' },
  ]
  const leader = (id, scores = BASE_SCORES) =>
    scores.map((score, i) => ({
      formatVersion: 1, ccaID: id, ccaName: `Test CCA ${id}`, matric: matricOf(i + 1), name: nameOf(i + 1),
      basePoints: score, semesterOnly: 'N', outgoingRole: 'none', incomingRole: 'none', exportedAt: EXPORTED_AT,
    }))
  const settings = settingsRows([])
  return { residents, ccas, bundle: true, leaders: { C1: leader('C1'), C2: leader('C2') }, ihg: null, flat: [], settings, extra: [], leader }
}

/** Adds a flat CCA (C3, no leader file) to the scenario's bundle: its cca row and six flat member rows. */
const withFlatCca = (s, value = 12) => {
  s.ccas.push(makeFlatCca('C3', value))
  s.flat = flatRows('C3', value, [1, 2, 3, 4, 5, 6])
}

const SETTINGS_WAIVER = { ccaID: 'C1', ccaName: 'Test CCA One', range: { meanMin: 12, meanMax: 15, sdMin: 1.5, sdMax: 5 } }
/** Replaces the bundle's settings rows (the base scenario has the default row only). */
const withSettings = (s, rows = settingsRows([SETTINGS_WAIVER])) => (s.settings = rows)

const patchLast = (rows, patch) => rows.map((r, i) => (i === rows.length - 1 ? { ...r, ...patch } : r))

/** Each case edits the base scenario and lists exactly the issue codes it must produce. */
const BROKEN_CASES = [
  ['unrecognised-file', ['UNRECOGNISED_FILE'], (s) => s.extra.push({ name: 'notes.csv', text: 'foo,bar\n1,2\n' })],
  ['csv-syntax-unterminated-quote', ['CSV_SYNTAX'], (s) => (s.textEdits = { 'points_C1_20270401.csv': (t) => `${t}1,C1,"Test\n` })],
  ['csv-syntax-wrong-cell-count', ['CSV_SYNTAX'], (s) => (s.textEdits = { 'residents.csv': (t) => `${t}A9900011Z,Test Resident 011,M\n` })],
  ['bad-header', ['BAD_HEADER', 'NO_LEADER_FILE'], (s) => (s.textEdits = { 'points_C1_20270401.csv': (t) => t.replace('basePoints', 'basePoint') })],
  ['bad-format-version', ['BAD_FORMAT_VERSION'], (s) => (s.leaders.C1 = patchLast(s.leaders.C1, { formatVersion: 2 }))],
  ['mixed-cca-id', ['MIXED_CCA_ID'], (s) => (s.leaders.C1 = patchLast(s.leaders.C1, { ccaID: 'C2' }))],
  ['duplicate-cca-file', ['DUPLICATE_CCA_FILE'], (s) => s.extra.push({ name: 'points_C1_20270402.csv', text: toCsv(LEADER_COLS, s.leaders.C1) })],
  ['missing-residents-file', ['MISSING_RESIDENTS_FILE'], (s) => (s.residents = null)],
  ['missing-bundle-file', ['MISSING_BUNDLE_FILE'], (s) => (s.bundle = false)],
  ['duplicate-bundle-file', ['DUPLICATE_BUNDLE_FILE'], (s) => s.extra.push({ name: 'points_bundle_20270301.csv', text: toBundleCsv(s.settings, s.ccas, s.flat) })],
  ['bad-bundle-section', ['BAD_BUNDLE_FILE'], (s) => (s.extraBundleRows = [{ formatVersion: 1, section: 'notes', note: 'not a section', exportedAt: EXPORTED_AT }])],
  ['bad-bundle-column', ['BAD_BUNDLE_FILE'], (s) => {
    withFlatCca(s)
    s.flat[0] = { ...s.flat[0], type: '1x' }
  }],
  ['bad-bundle-type', ['BAD_ENUM'], (s) => (s.ccas[0] = { ...s.ccas[0], type: '2x' })],
  ['ccas-file-retired', ['CCAS_FILE_RETIRED'], (s) => s.extra.push({
    name: 'ccas_20260401.csv',
    text: toCsv(RETIRED_CCA_COLS, [{ ccaID: 'C1', ccaName: 'Test CCA One', type: '1x', placement: 'gold' }]),
  })],
  ['type-not-set', ['TYPE_NOT_SET'], (s) => (s.ccas[0] = { ...s.ccas[0], type: '' })],
  ['level-not-set', ['LEVEL_NOT_SET'], () => {}],
  ['duplicate-residents-file', ['DUPLICATE_RESIDENTS_OR_IHG_FILE'], (s) => s.extra.push({ name: 'residents_old.csv', text: toCsv(RESIDENT_COLS, s.residents) })],
  ['bad-matric', ['BAD_MATRIC'], (s) => (s.leaders.C1 = patchLast(s.leaders.C1, { matric: 'XYZ' }))],
  ['unknown-matric', ['UNKNOWN_MATRIC'], (s) => (s.leaders.C1 = patchLast(s.leaders.C1, { matric: matricOf(99) }))],
  ['duplicate-matric-in-file', ['DUPLICATE_MATRIC_IN_FILE'], (s) => s.leaders.C1.push({ ...s.leaders.C1[0] })],
  ['duplicate-resident', ['DUPLICATE_RESIDENT'], (s) => s.residents.push({ ...s.residents[9] })],
  ['bad-base-points', ['BAD_BASE_POINTS'], (s) => (s.leaders.C1 = patchLast(s.leaders.C1, { basePoints: 21 }))],
  ['bad-enum', ['BAD_ENUM'], (s) => (s.leaders.C1 = patchLast(s.leaders.C1, { outgoingRole: 'captain' }))],
  ['bad-yn', ['BAD_YN'], (s) => (s.leaders.C1 = patchLast(s.leaders.C1, { semesterOnly: 'yes' }))],
  ['bad-gender', ['BAD_GENDER'], (s) => (s.residents[9] = { ...s.residents[9], gender: 'X' })],
  ['bad-aux', ['BAD_AUX'], (s) => (s.residents[9] = { ...s.residents[9], aux: -1 })],
  ['unknown-cca', ['UNKNOWN_CCA'], (s) => (s.leaders.C9 = s.leader('C9'))],
  ['ihg-unknown-matric', ['IHG_UNKNOWN_MATRIC'], (s) => (s.ihg = [{ matric: matricOf(99), ccaID: 'C1', placement: '1st' }])],
  ['ihg-unknown-cca', ['IHG_UNKNOWN_CCA'], (s) => (s.ihg = [{ matric: matricOf(1), ccaID: 'C9', placement: '2nd' }])],
  ['duplicate-cca', ['DUPLICATE_CCA'], (s) => s.ccas.push({ ...s.ccas[0] })],
  ['bad-jcrc', ['BAD_JCRC'], (s) => (s.residents[9] = { ...s.residents[9], jcrc: 'maybe' })],
  ['jcrc-and-sem2', ['JCRC_AND_SEM2'], (s) => (s.residents[9] = { ...s.residents[9], jcrc: 'FULL', sem2: 'Y' })],
  ['bad-flat-points', ['BAD_FLAT_POINTS'], (s) => {
    withFlatCca(s)
    s.flat = patchLast(s.flat, { flatPoints: -5 })
  }],
  ['flat-value-mismatch', ['FLAT_VALUE_MISMATCH'], (s) => {
    withFlatCca(s)
    s.flat = patchLast(s.flat, { flatPoints: 13 })
  }],
  ['flat-and-leader-file', ['FLAT_AND_LEADER_FILE'], (s) => (s.flat = flatRows('C1', 12, [1, 2, 3, 4, 5, 6]))],
  ['duplicate-flat-file', ['DUPLICATE_FLAT_FILE'], (s) => {
    withFlatCca(s)
    s.extra.push({ name: 'flat_points_20270401.csv', text: toCsv(FLAT_COLS, s.flat) })
  }],
  ['bad-settings-file', ['BAD_SETTINGS_FILE'], (s) => {
    const rows = settingsRows([SETTINGS_WAIVER])
    withSettings(s, [rows[0], rows[0], rows[1]])
  }],
  ['bad-settings-range', ['BAD_RANGE'], (s) => {
    const rows = settingsRows([SETTINGS_WAIVER])
    withSettings(s, [rows[0], { ...rows[1], meanMin: 'low' }])
  }],
  ['duplicate-waiver', ['DUPLICATE_WAIVER'], (s) => {
    const rows = settingsRows([SETTINGS_WAIVER])
    withSettings(s, [...rows, rows[1]])
  }],
  ['duplicate-settings-file', ['DUPLICATE_SETTINGS_FILE'], (s) => {
    withSettings(s)
    s.extra.push({ name: 'points_settings_20270401.csv', text: toCsv(SETTINGS_COLS, s.settings) })
  }],
  ['settings-unknown-cca', ['SETTINGS_UNKNOWN_CCA'], (s) => {
    withSettings(s, settingsRows([SETTINGS_WAIVER, { ...SETTINGS_WAIVER, ccaID: 'C9', ccaName: 'Test CCA Nine' }]))
  }],
  ['mean-sd-out-of-range', ['MEAN_SD_OUT_OF_RANGE'], (s) => (s.leaders.C1 = s.leader('C1', [20, 20, 20, 20, 20, 20]))],
]

function writeBroken([folder, codes, edit]) {
  const dir = join(SAMPLES, 'broken', folder)
  const s = baseScenario()
  s.textEdits = {}
  edit(s)
  const files = []
  if (s.residents) files.push(['residents.csv', toCsv(RESIDENT_COLS, s.residents)])
  if (s.bundle) {
    const extraLines = (s.extraBundleRows ?? []).map((row) => toCsv(BUNDLE_COLS, [row]).split('\n')[1])
    files.push(['points_bundle_20270401.csv', toBundleCsv(s.settings, s.ccas, s.flat) + extraLines.map((line) => `${line}\n`).join('')])
  }
  for (const [id, rows] of Object.entries(s.leaders)) files.push([`points_${id}_20270401.csv`, toCsv(LEADER_COLS, rows)])
  if (s.ihg) files.push(['ihg.csv', toCsv(IHG_COLS, s.ihg)])
  for (const extra of s.extra) files.push([extra.name, extra.text])
  for (const [name, text] of files) write(dir, name, (s.textEdits[name] ?? ((t) => t))(text))
  write(dir, 'expected.json', `${JSON.stringify({ codes }, null, 2)}\n`)
}

writeValid()
BROKEN_CASES.forEach(writeBroken)
console.log(`Wrote samples/valid and ${BROKEN_CASES.length} cases in samples/broken`)
