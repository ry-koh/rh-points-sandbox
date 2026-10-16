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
const TIERS = ['Unsatisfactory', 'Pass', 'Low Bronze', 'High Bronze', 'Low Silver', 'High Silver', 'Low Gold', 'High Gold']
const PLACEMENTS = ['pass', 'bronze', 'silver', 'gold']

const LEADER_COLS = ['formatVersion', 'ccaID', 'ccaName', 'matric', 'name', 'basePoints', 'semesterOnly', 'outgoingRole', 'incomingRole', 'exportedAt']
const RESIDENT_COLS = ['matric', 'name', 'gender', 'sem2', 'aux']
const IHG_COLS = ['matric', 'ccaID', 'placement']
const CCA_COLS = ['ccaID', 'ccaName', 'type', 'placement', 'outgoingTier', 'outgoingMultiplier', 'meanMin', 'meanMax', 'sdMin', 'sdMax']

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
    return { matric: matricOf(n), name: nameOf(n), gender: male ? 'M' : 'F', sem2: sem2 ? 'Y' : 'N', aux }
  })
}

function makeCcas() {
  return Array.from({ length: 12 }, (_, i) => {
    const id = `C${pad(i + 1, 2)}`
    const waiver = WAIVERS[id] ?? {}
    return {
      ccaID: id,
      ccaName: `Test CCA ${pad(i + 1, 2)}`,
      type: i < 9 ? '1x' : '0.5x',
      placement: PLACEMENTS[i % PLACEMENTS.length],
      outgoingTier: '',
      outgoingMultiplier: '',
      meanMin: waiver.meanMin ?? '',
      meanMax: waiver.meanMax ?? '',
      sdMin: waiver.sdMin ?? '',
      sdMax: waiver.sdMax ?? '',
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
  rowsByCca.forEach((rows, i) => {
    const cca = ccas[i]
    byCca[cca.ccaID] = rows
    if (rows.some((r) => r.outgoingRole !== 'none')) cca.outgoingTier = TIERS[(i * 3) % TIERS.length]
  })
  write(dir, 'residents.csv', toCsv(RESIDENT_COLS, residents))
  write(dir, 'ccas.csv', toCsv(CCA_COLS, ccas))
  ccas.forEach((cca, i) => write(dir, `points_${cca.ccaID}_20270401.csv`, toLeaderCsv(cca, rowsByCca[i])))
  write(dir, 'ihg.csv', toCsv(IHG_COLS, makeIhg(byCca)))
}

// ---------- broken samples ----------
const BASE_SCORES = [8, 10, 12, 14, 16, 18]

function baseScenario() {
  const residents = Array.from({ length: 10 }, (_, i) => ({
    matric: matricOf(i + 1), name: nameOf(i + 1), gender: i % 2 === 0 ? 'M' : 'F', sem2: 'N', aux: 5,
  }))
  const blank = { outgoingTier: '', outgoingMultiplier: '', meanMin: '', meanMax: '', sdMin: '', sdMax: '' }
  const ccas = [
    { ccaID: 'C1', ccaName: 'Test CCA One', type: '1x', placement: 'gold', ...blank },
    { ccaID: 'C2', ccaName: 'Test CCA Two', type: '0.5x', placement: 'bronze', ...blank },
  ]
  const leader = (id, scores = BASE_SCORES) =>
    scores.map((score, i) => ({
      formatVersion: 1, ccaID: id, ccaName: `Test CCA ${id}`, matric: matricOf(i + 1), name: nameOf(i + 1),
      basePoints: score, semesterOnly: 'N', outgoingRole: 'none', incomingRole: 'none', exportedAt: EXPORTED_AT,
    }))
  return { residents, ccas, leaders: { C1: leader('C1'), C2: leader('C2') }, ihg: null, extra: [], leader }
}

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
  ['missing-ccas-file', ['MISSING_CCAS_FILE'], (s) => (s.ccas = null)],
  ['duplicate-residents-file', ['DUPLICATE_RESIDENTS_OR_CCAS_FILE'], (s) => s.extra.push({ name: 'residents_old.csv', text: toCsv(RESIDENT_COLS, s.residents) })],
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
  ['unknown-tier', ['UNKNOWN_TIER'], (s) => (s.ccas[0] = { ...s.ccas[0], outgoingTier: 'Platinum' })],
  ['bad-manual-multiplier', ['BAD_MANUAL_MULTIPLIER'], (s) => (s.ccas[0] = { ...s.ccas[0], outgoingMultiplier: -2 })],
  ['missing-outgoing-multiplier', ['MISSING_OUTGOING_MULTIPLIER'], (s) => (s.leaders.C1 = patchLast(s.leaders.C1, { outgoingRole: 'head' }))],
  ['duplicate-cca', ['DUPLICATE_CCA'], (s) => s.ccas.push({ ...s.ccas[0] })],
  ['bad-range', ['BAD_RANGE'], (s) => (s.ccas[0] = { ...s.ccas[0], meanMin: 'low' })],
  ['mean-sd-out-of-range', ['MEAN_SD_OUT_OF_RANGE'], (s) => (s.leaders.C1 = s.leader('C1', [20, 20, 20, 20, 20, 20]))],
]

function writeBroken([folder, codes, edit]) {
  const dir = join(SAMPLES, 'broken', folder)
  const s = baseScenario()
  s.textEdits = {}
  edit(s)
  const files = []
  if (s.residents) files.push(['residents.csv', toCsv(RESIDENT_COLS, s.residents)])
  if (s.ccas) files.push(['ccas.csv', toCsv(CCA_COLS, s.ccas)])
  for (const [id, rows] of Object.entries(s.leaders)) files.push([`points_${id}_20270401.csv`, toCsv(LEADER_COLS, rows)])
  if (s.ihg) files.push(['ihg.csv', toCsv(IHG_COLS, s.ihg)])
  for (const extra of s.extra) files.push([extra.name, extra.text])
  for (const [name, text] of files) write(dir, name, (s.textEdits[name] ?? ((t) => t))(text))
  write(dir, 'expected.json', `${JSON.stringify({ codes }, null, 2)}\n`)
}

writeValid()
BROKEN_CASES.forEach(writeBroken)
console.log(`Wrote samples/valid and ${BROKEN_CASES.length} cases in samples/broken`)
