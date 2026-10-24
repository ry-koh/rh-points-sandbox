import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { DEFAULT_CONFIG } from '../../engine'
import { fnv1a32 } from '../../import'
import {
  BASE_SCORES,
  baseCcas,
  baseResidents,
  leaderFileName,
  leaderRows,
  matricOf,
  patchRow,
  scenario,
} from '../../import/__tests__/fixtures'
import {
  LEVELS_MIGRATED_NOTE,
  RETIRED_FILES_NOTE,
  WORKSPACE_FORMAT,
  encryptWorkspace,
  migrateWorkspace,
  parseWorkspaceFile,
  restoreWorkspace,
  sandboxInputOf,
  serializeWorkspace,
  workspaceFilename,
  type Workspace,
} from '../index'

const TIMEOUT = 30_000
const PASSWORD = 'correct horse'

const AT = '2027-04-02T10:00:00.000Z'
const files = scenario()
const c1File = files.find((f) => f.name === leaderFileName('C1'))?.text ?? ''

const EMPTY_NEW_LISTS = { tickEdits: [], tickLog: [], flatEdits: [], flatLog: [], auxEdits: [], auxLog: [] }
const EMPTY_MEMBERSHIP_LISTS = { membershipEdits: [], membershipLog: [] }

const workspace: Workspace = {
  format: WORKSPACE_FORMAT,
  version: 4,
  savedAt: '2027-04-01T09:30:00.000Z',
  files,
  config: { ...DEFAULT_CONFIG, headcounts: { ...DEFAULT_CONFIG.headcounts, maleGreen: 2, maleGrey: 1, sem2Green: 1 } },
  ccaLevels: [
    { ccaID: 'C1', level: 'High Gold', bonusOverride: null, multiplierOverride: null },
    { ccaID: 'C2', level: 'Low Bronze', bonusOverride: 0.75, multiplierOverride: 1.1 },
  ],
  review: {
    edits: [{ matric: matricOf(1), ccaID: 'C1', from: 8, to: 9, reason: 'typo', at: AT }],
    log: [
      { matric: matricOf(1), ccaID: 'C1', from: 8, to: 10, reason: '', at: AT, kind: 'edit' },
      { matric: matricOf(1), ccaID: 'C1', from: 10, to: 8, reason: '', at: AT, kind: 'remove' },
      { matric: matricOf(1), ccaID: 'C1', from: 8, to: 9, reason: 'typo', at: AT, kind: 'edit' },
    ],
    vetted: [{ ccaID: 'C1', fileHash: fnv1a32(c1File), at: AT }],
    notSubmitting: [{ ccaID: 'C9', note: 'disbanded', at: AT }],
    ...EMPTY_NEW_LISTS,
    ...EMPTY_MEMBERSHIP_LISTS,
  },
  step: 'review',
  finalOverrides: [{ matric: 'A9900001Z', ccaID: 'C1', finalPoints: 5, reason: 'withdrawn' }],
  discretion: [{ matric: 'A9900002Z', stayingDelta: 2, biddingDelta: -1, reason: 'service' }],
  resolutions: [{ list: 'maleStaying', order: ['A9900003Z', 'A9900001Z'] }],
  finalised: null,
  groups: null,
}

const tickEdit = { matric: matricOf(3), ccaID: 'C1', from: false, to: true, reason: 'played', at: AT }
const flatEdit = { matric: matricOf(2), ccaID: 'C3', from: 12, to: 10, reason: '', at: AT }
const auxEdit = { matric: matricOf(4), from: 5, to: 7, reason: 'late form', at: AT }
const roleEdit = { matric: matricOf(1), ccaID: 'C1', field: 'outgoingRole' as const, from: 'none' as const, to: 'head' as const, reason: 'took over', at: AT }
const semEdit = { matric: matricOf(2), ccaID: 'C1', field: 'semesterOnly' as const, from: false, to: true, reason: '', at: AT }

/** A workspace with every v3 list and a group filled. */
const filled: Workspace = {
  ...workspace,
  review: {
    ...workspace.review,
    tickEdits: [tickEdit],
    tickLog: [{ ...tickEdit, kind: 'edit' }],
    flatEdits: [flatEdit],
    flatLog: [{ ...flatEdit, kind: 'edit' }, { ...flatEdit, kind: 'remove' }],
    auxEdits: [auxEdit],
    auxLog: [{ ...auxEdit, kind: 'edit' }],
  },
  groups: [
    { id: 'g1', name: 'Sports', ccaIDs: ['C1'] },
    { id: 'g2', name: 'Empty', ccaIDs: [] },
  ],
}

/** A v4 workspace with the membership lists filled as well. */
const filledV4: Workspace = {
  ...filled,
  review: {
    ...filled.review,
    membershipEdits: [roleEdit, semEdit],
    membershipLog: [
      { ...roleEdit, kind: 'edit' },
      { ...semEdit, kind: 'edit' },
      { ...semEdit, from: true, to: false, reason: '', kind: 'remove' },
    ],
  },
}

const ok = async (text: string, password?: string) => {
  const result = await parseWorkspaceFile(text, password)
  if (!result.ok) throw new Error(`expected ok, got ${result.code}`)
  return result.workspace
}
const codeOf = async (text: string, password?: string) => {
  const result = await parseWorkspaceFile(text, password)
  return result.ok ? 'ok' : result.code
}

describe('plain workspace', () => {
  it('round-trips exactly, every v2 field included', async () => {
    const parsed = await parseWorkspaceFile(serializeWorkspace(workspace))
    expect(parsed).toEqual({ ok: true, workspace, notes: [] })
    expect(workspace.ccaLevels).toHaveLength(2)
  })

  it('round-trips the v3 tick, flat and AUX edits, their logs and the groups', async () => {
    expect(await parseWorkspaceFile(serializeWorkspace(filled))).toEqual({ ok: true, workspace: filled, notes: [] })
  })

  it('round-trips the v4 role and semester edits and their log', async () => {
    expect(await parseWorkspaceFile(serializeWorkspace(filledV4))).toEqual({ ok: true, workspace: filledV4, notes: [] })
  })

  it('is written as version 4, with the level table and no meanSdOverrides', () => {
    const written = JSON.parse(serializeWorkspace(workspace)) as Record<string, unknown>
    expect(written.version).toBe(4)
    expect(written.ccaLevels).toEqual(workspace.ccaLevels)
    expect('meanSdOverrides' in written).toBe(false)
  })

  it('keeps a finalised penalty state', async () => {
    const finalised = { cutoffs: { M: 18, F: null }, applied: [{ matric: 'A9900001Z', ccaID: 'C1' }], removed: ['A9900001Z'] }
    expect((await ok(serializeWorkspace({ ...workspace, finalised }))).finalised).toEqual(finalised)
  })

  it('is named rhps_workspace_<YYYYMMDD-HHmm>.rhps', () => {
    expect(workspaceFilename(new Date(2027, 3, 1, 9, 5))).toBe('rhps_workspace_20270401-0905.rhps')
  })
})

describe('encrypted workspace', () => {
  it('round-trips with the password', { timeout: TIMEOUT }, async () => {
    const envelope = await encryptWorkspace(serializeWorkspace(workspace), PASSWORD)
    expect(await ok(envelope, PASSWORD)).toEqual(workspace)
  })

  it('round-trips a filled v3 workspace with the password', { timeout: TIMEOUT }, async () => {
    const envelope = await encryptWorkspace(serializeWorkspace(filled), PASSWORD)
    expect(await ok(envelope, PASSWORD)).toEqual(filled)
  })

  it('round-trips a filled v4 workspace with the password', { timeout: TIMEOUT }, async () => {
    const envelope = await encryptWorkspace(serializeWorkspace(filledV4), PASSWORD)
    expect(await ok(envelope, PASSWORD)).toEqual(filledV4)
  })

  it('writes the specified envelope and hides the data', { timeout: TIMEOUT }, async () => {
    const envelope = await encryptWorkspace(serializeWorkspace(workspace), PASSWORD)
    const parsed = JSON.parse(envelope) as Record<string, any>
    expect(parsed.format).toBe('rhps-workspace-encrypted')
    expect(parsed.version).toBe(1)
    expect(parsed.kdf).toMatchObject({ name: 'PBKDF2', hash: 'SHA-256', iterations: 310000 })
    expect(parsed.kdf.salt).toMatch(/^[A-Za-z0-9+/]+=*$/)
    expect(parsed.cipher.name).toBe('AES-GCM')
    expect(parsed.cipher.iv).toMatch(/^[A-Za-z0-9+/]+=*$/)
    expect(parsed.data).toMatch(/^[A-Za-z0-9+/]+=*$/)
    expect(envelope).not.toContain('Test Resident')
    expect(envelope).not.toContain('A9900001Z')
  })

  it('uses a fresh salt and iv every time', { timeout: TIMEOUT }, async () => {
    const a = JSON.parse(await encryptWorkspace('{}', PASSWORD)) as Record<string, any>
    const b = JSON.parse(await encryptWorkspace('{}', PASSWORD)) as Record<string, any>
    expect(a.kdf.salt).not.toBe(b.kdf.salt)
    expect(a.cipher.iv).not.toBe(b.cipher.iv)
  })

  it('needs a password to encrypt', async () => {
    await expect(encryptWorkspace('{}', '')).rejects.toThrow()
  })

  it('PASSWORD_REQUIRED without a password', { timeout: TIMEOUT }, async () => {
    const envelope = await encryptWorkspace(serializeWorkspace(workspace), PASSWORD)
    expect(await codeOf(envelope)).toBe('PASSWORD_REQUIRED')
    expect(await codeOf(envelope, '')).toBe('PASSWORD_REQUIRED')
  })

  it('WRONG_PASSWORD for another password', { timeout: TIMEOUT }, async () => {
    const envelope = await encryptWorkspace(serializeWorkspace(workspace), PASSWORD)
    expect(await codeOf(envelope, 'battery staple')).toBe('WRONG_PASSWORD')
  })

  it('CORRUPT when the ciphertext was tampered with', { timeout: TIMEOUT }, async () => {
    const envelope = JSON.parse(await encryptWorkspace(serializeWorkspace(workspace), PASSWORD)) as Record<string, any>
    const data: string = envelope.data
    const middle = Math.floor(data.length / 2)
    const flipped = data[middle] === 'A' ? 'B' : 'A'
    envelope.data = data.slice(0, middle) + flipped + data.slice(middle + 1)
    expect(await codeOf(JSON.stringify(envelope), PASSWORD)).toBe('CORRUPT')
  })

  it('CORRUPT when the envelope is damaged', { timeout: TIMEOUT }, async () => {
    const envelope = JSON.parse(await encryptWorkspace(serializeWorkspace(workspace), PASSWORD)) as Record<string, any>
    expect(await codeOf(JSON.stringify({ ...envelope, data: '***not base64***' }), PASSWORD)).toBe('CORRUPT')
    expect(await codeOf(JSON.stringify({ ...envelope, kdf: undefined }), PASSWORD)).toBe('CORRUPT')
    expect(await codeOf(JSON.stringify({ ...envelope, cipher: { name: 'AES-GCM', iv: 'AAAA' } }), PASSWORD)).toBe('CORRUPT')
  })

  it('a file written now still has envelope version 1', { timeout: TIMEOUT }, async () => {
    const envelope = JSON.parse(await encryptWorkspace(serializeWorkspace(workspace), PASSWORD)) as Record<string, any>
    expect(envelope.version).toBe(1)
  })

  it('UNSUPPORTED_VERSION for another envelope version', { timeout: TIMEOUT }, async () => {
    const envelope = JSON.parse(await encryptWorkspace('{}', PASSWORD)) as Record<string, any>
    expect(await codeOf(JSON.stringify({ ...envelope, version: 2 }), PASSWORD)).toBe('UNSUPPORTED_VERSION')
  })
})

describe('rejecting other files', () => {
  it('NOT_A_WORKSPACE for anything else', async () => {
    for (const text of ['', 'not json', '[1,2]', '{}', '{"format":"scenario"}', 'null', '42']) {
      expect(await codeOf(text)).toBe('NOT_A_WORKSPACE')
    }
  })

  it('UNSUPPORTED_VERSION for another workspace version', async () => {
    expect(await codeOf(JSON.stringify({ ...workspace, version: 5 }))).toBe('UNSUPPORTED_VERSION')
    expect(await codeOf(JSON.stringify({ ...workspace, version: 0 }))).toBe('UNSUPPORTED_VERSION')
    expect(await codeOf(JSON.stringify({ ...workspace, version: undefined }))).toBe('UNSUPPORTED_VERSION')
  })

  it('CORRUPT for a workspace with a wrong-shaped field', async () => {
    expect(await codeOf(JSON.stringify({ ...workspace, files: 'nope' }))).toBe('CORRUPT')
    expect(await codeOf(JSON.stringify({ ...workspace, files: [{ name: 1 }] }))).toBe('CORRUPT')
    expect(await codeOf(JSON.stringify({ ...workspace, finalOverrides: [{ matric: 'x' }] }))).toBe('CORRUPT')
    expect(await codeOf(JSON.stringify({ ...workspace, discretion: 'x' }))).toBe('CORRUPT')
    expect(await codeOf(JSON.stringify({ ...workspace, resolutions: [{ list: 'bogus', order: [] }] }))).toBe('CORRUPT')
    expect(await codeOf(JSON.stringify({ ...workspace, config: { headcounts: 3 } }))).toBe('CORRUPT')
  })

  it('CORRUPT for a wrong-shaped review, level table or step', async () => {
    const review = workspace.review
    for (const bad of [
      { review: undefined },
      { review: [] },
      { review: { ...review, edits: [{ matric: 'x', ccaID: 'C1', from: 8, to: '9', reason: '', at: AT }] } },
      { review: { ...review, log: [{ ...review.edits[0], kind: 'undo' }] } },
      { review: { ...review, vetted: [{ ccaID: 'C1', fileHash: 1, at: AT }] } },
      { review: { ...review, notSubmitting: [{ ccaID: 'C1', at: AT }] } },
      { ccaLevels: undefined },
      { ccaLevels: [{ ccaID: 'C1', level: 3, bonusOverride: null, multiplierOverride: null }] },
      { ccaLevels: [{ ccaID: 'C1', level: null, bonusOverride: 'x', multiplierOverride: null }] },
      { step: 'nowhere' },
    ]) {
      expect(await codeOf(JSON.stringify({ ...workspace, ...bad }))).toBe('CORRUPT')
    }
  })

  it('CORRUPT for a tick edit whose to is not a boolean', async () => {
    const bad = { ...filled, review: { ...filled.review, tickEdits: [{ ...tickEdit, to: 'yes' }] } }
    expect(await codeOf(JSON.stringify(bad))).toBe('CORRUPT')
  })

  it('CORRUPT for any wrong-shaped v3 list, log entry or group', async () => {
    const review = filled.review
    const { tickLog: _t, ...noTickLog } = review
    for (const bad of [
      { review: noTickLog },
      { review: { ...review, tickEdits: [{ ...tickEdit, from: 0 }] } },
      { review: { ...review, tickEdits: [{ ...tickEdit, matric: 1 }] } },
      { review: { ...review, tickLog: [{ ...tickEdit, kind: 'undo' }] } },
      { review: { ...review, tickLog: [tickEdit] } },
      { review: { ...review, flatEdits: [{ ...flatEdit, to: '10' }] } },
      { review: { ...review, flatEdits: [{ ...flatEdit, ccaID: null }] } },
      { review: { ...review, flatLog: [{ ...flatEdit, kind: 'set' }] } },
      { review: { ...review, auxEdits: [{ ...auxEdit, to: true }] } },
      { review: { ...review, auxEdits: [{ ...auxEdit, reason: undefined }] } },
      { review: { ...review, auxLog: [{ ...auxEdit, at: 5, kind: 'edit' }] } },
      { review: { ...review, flatEdits: 'none' } },
      { groups: undefined },
      { groups: {} },
      { groups: [{ id: 'g1', name: 'Sports' }] },
      { groups: [{ id: 'g1', name: 2, ccaIDs: [] }] },
      { groups: [{ id: 'g1', name: 'Sports', ccaIDs: [1] }] },
    ]) {
      expect(await codeOf(JSON.stringify({ ...filled, ...bad }))).toBe('CORRUPT')
    }
  })
})

describe('CORRUPT v4 membership lists', () => {
  const review = filledV4.review
  const bad = (patch: Record<string, unknown>) => ({ ...filledV4, review: { ...review, ...patch } })

  it('a role value outside ROLES is CORRUPT', async () => {
    expect(await codeOf(JSON.stringify(bad({ membershipEdits: [{ ...roleEdit, to: 'boss' }] })))).toBe('CORRUPT')
    expect(await codeOf(JSON.stringify(bad({ membershipEdits: [{ ...roleEdit, from: 'boss' }] })))).toBe('CORRUPT')
    expect(await codeOf(JSON.stringify(bad({ membershipLog: [{ ...roleEdit, to: 'boss', kind: 'edit' }] })))).toBe('CORRUPT')
  })

  it('a semesterOnly value that is not a boolean is CORRUPT', async () => {
    expect(await codeOf(JSON.stringify(bad({ membershipEdits: [{ ...semEdit, to: 'yes' }] })))).toBe('CORRUPT')
    expect(await codeOf(JSON.stringify(bad({ membershipEdits: [{ ...semEdit, from: 0 }] })))).toBe('CORRUPT')
  })

  it('a value of the wrong type for its field is CORRUPT', async () => {
    expect(await codeOf(JSON.stringify(bad({ membershipEdits: [{ ...roleEdit, to: true }] })))).toBe('CORRUPT')
    expect(await codeOf(JSON.stringify(bad({ membershipEdits: [{ ...semEdit, to: 'head' }] })))).toBe('CORRUPT')
  })

  it('an unknown field, a non-string matric, ccaID, reason or at, or a bad kind is CORRUPT', async () => {
    for (const entry of [
      { ...roleEdit, field: 'level' },
      { ...roleEdit, field: undefined },
      { ...roleEdit, matric: 1 },
      { ...roleEdit, ccaID: null },
      { ...roleEdit, reason: undefined },
      { ...roleEdit, at: 5 },
    ]) {
      expect(await codeOf(JSON.stringify(bad({ membershipEdits: [entry] })))).toBe('CORRUPT')
    }
    expect(await codeOf(JSON.stringify(bad({ membershipLog: [{ ...roleEdit, kind: 'undo' }] })))).toBe('CORRUPT')
    expect(await codeOf(JSON.stringify(bad({ membershipLog: [roleEdit] })))).toBe('CORRUPT')
  })

  it('a missing or non-list membership list is CORRUPT', async () => {
    const { membershipLog: _l, ...noLog } = review
    expect(await codeOf(JSON.stringify({ ...filledV4, review: noLog }))).toBe('CORRUPT')
    expect(await codeOf(JSON.stringify(bad({ membershipEdits: 'none' })))).toBe('CORRUPT')
  })
})

describe('version 1 files (spec 8b migration)', () => {
  const v1Text = readFileSync('src/workspace/__tests__/v1-fixture.json', 'utf8')
  const v1 = JSON.parse(v1Text) as Record<string, any>

  it('opens the literal v1 fixture with exactly two notes', async () => {
    const parsed = await parseWorkspaceFile(v1Text)
    if (!parsed.ok) throw new Error(`expected ok, got ${parsed.code}`)
    expect(parsed.notes).toEqual([RETIRED_FILES_NOTE, LEVELS_MIGRATED_NOTE])
    const opened = parsed.workspace
    expect(opened.version).toBe(4)
    expect(opened.review).toEqual({ edits: [], log: [], vetted: [], notSubmitting: [], ...EMPTY_NEW_LISTS, ...EMPTY_MEMBERSHIP_LISTS })
    expect(opened.groups).toBeNull()
    expect(opened.ccaLevels).toEqual([])
    expect(opened.step).toBe('import')
    expect('meanSdOverrides' in opened).toBe(false)
    expect(opened.files.map((f) => f.name)).toEqual(['residents.csv', 'points_C1_20260401.csv', 'points_C2_20260401.csv'])
    expect(opened.config.levels).toEqual(DEFAULT_CONFIG.levels)
    expect('placementBonus' in opened.config).toBe(false)
    expect(opened.discretion).toEqual(v1.discretion)
  })

  it('restoring it passes the notes through and asks for the bundle', async () => {
    const parsed = await parseWorkspaceFile(v1Text)
    if (!parsed.ok) throw new Error('expected ok')
    const restored = restoreWorkspace(parsed.workspace, parsed.notes)
    expect(restored.notes).toEqual(parsed.notes)
    expect(restored.report.bundle).toBeNull()
    expect(restored.report.issues.map((i) => i.code)).not.toContain('CCAS_FILE_RETIRED')
    expect(restored.report.issues.map((i) => i.code)).not.toContain('IHG_FILE_RETIRED')
  })

  it('waits for the bundle: nothing is listed as stale, both groups are unchecked', async () => {
    const parsed = await parseWorkspaceFile(v1Text)
    if (!parsed.ok) throw new Error('expected ok')
    const restored = restoreWorkspace(parsed.workspace, parsed.notes)
    expect(restored.notes).toHaveLength(2)
    expect(restored.unchecked).toEqual({ review: true, computed: true, aux: true })
    expect(restored.stale).toEqual({
      overrides: [],
      discretion: [],
      resolutions: [],
      edits: [],
      vetted: [],
      ccaLevels: [],
      tickEdits: [],
      flatEdits: [],
      auxEdits: [],
      membershipEdits: [],
    })
    expect(restored.workspace.discretion).toEqual(v1.discretion)
  })

  it('drops a retired file by its header whatever its name, and by its name whatever its text', () => {
    const files = [
      { name: 'levels.csv', text: v1.files[1].text },
      { name: 'my-ihg.csv', text: v1.files[2].text },
      { name: 'CCAs (old).csv', text: 'anything' },
      { name: 'IHG.csv', text: '' },
      { name: 'residents.csv', text: v1.files[0].text },
    ]
    const { raw, notes } = migrateWorkspace({ ...v1, files })
    expect((raw.files as { name: string }[]).map((f) => f.name)).toEqual(['residents.csv'])
    expect(notes).toEqual([RETIRED_FILES_NOTE, LEVELS_MIGRATED_NOTE])
  })

  it('adds no note when nothing was dropped and the config was already new', () => {
    const { raw, notes } = migrateWorkspace({ ...v1, files: [v1.files[0]], config: DEFAULT_CONFIG })
    expect(notes).toEqual([])
    expect(raw.config).toEqual(DEFAULT_CONFIG)
  })

  it('leaves a version 4 object alone and never changes its input', () => {
    const v4 = JSON.parse(serializeWorkspace(workspace)) as Record<string, unknown>
    expect(migrateWorkspace(v4)).toEqual({ raw: v4, notes: [] })
    expect(migrateWorkspace(v4).raw).toBe(v4)
    const before = JSON.stringify(v1)
    migrateWorkspace(v1)
    expect(JSON.stringify(v1)).toBe(before)
  })

  it('a v1 file with a broken config is CORRUPT', async () => {
    expect(await codeOf(JSON.stringify({ ...v1, config: { headcounts: 3 } }))).toBe('CORRUPT')
    expect(await codeOf(JSON.stringify({ ...v1, files: 'nope' }))).toBe('CORRUPT')
  })
})

describe('version 2 files (R4 migration)', () => {
  const v2Text = readFileSync('src/workspace/__tests__/v2-fixture.json', 'utf8')
  const v2 = JSON.parse(v2Text) as Record<string, any>

  it('opens the literal v2 fixture as v4 with everything intact, empty new lists, no groups and no note', async () => {
    const parsed = await parseWorkspaceFile(v2Text)
    if (!parsed.ok) throw new Error(`expected ok, got ${parsed.code}`)
    expect(v2.version).toBe(2)
    expect(parsed.notes).toEqual([])
    const opened = parsed.workspace
    expect(opened.version).toBe(4)
    expect(opened.groups).toBeNull()
    expect(opened.review).toEqual({ ...v2.review, ...EMPTY_NEW_LISTS, ...EMPTY_MEMBERSHIP_LISTS })
    expect(opened.review.edits).toHaveLength(1)
    expect(opened.review.log).toHaveLength(1)
    expect(opened.review.vetted).toHaveLength(1)
    expect(opened.review.notSubmitting).toHaveLength(1)
    expect(opened.ccaLevels).toEqual(v2.ccaLevels)
    expect(opened.ccaLevels).toHaveLength(1)
    expect(opened.step).toBe('review')
    expect(opened.files).toEqual(v2.files)
    expect(opened.savedAt).toBe(v2.savedAt)
  })

  it('restores the v2 fixture with its edit, vetted mark and level all still applying', async () => {
    const parsed = await parseWorkspaceFile(v2Text)
    if (!parsed.ok) throw new Error('expected ok')
    const restored = restoreWorkspace(parsed.workspace, parsed.notes)
    expect(restored.report.canCompute).toBe(true)
    expect(restored.unchecked).toEqual({ review: false, computed: false, aux: false })
    expect(restored.stale.edits).toEqual([])
    expect(restored.stale.vetted).toEqual([])
    expect(restored.stale.ccaLevels).toEqual([])
  })

  it('migrates v2 to v4 without changing its input', () => {
    const before = JSON.stringify(v2)
    const { raw, notes } = migrateWorkspace(v2)
    expect(notes).toEqual([])
    expect(raw.version).toBe(4)
    expect(raw.groups).toBeNull()
    expect(JSON.stringify(v2)).toBe(before)
  })

  it('a v2 file with a broken review is CORRUPT', async () => {
    expect(await codeOf(JSON.stringify({ ...v2, review: 'nope' }))).toBe('CORRUPT')
    expect(await codeOf(JSON.stringify({ ...v2, review: { ...v2.review, edits: [{ matric: 1 }] } }))).toBe('CORRUPT')
  })
})

describe('version 3 files (v3 to v4 migration)', () => {
  const v3Text = readFileSync('src/workspace/__tests__/v3-fixture.json', 'utf8')
  const v3 = JSON.parse(v3Text) as Record<string, any>

  it('opens the literal v3 fixture as v4 with every edit, the vetted mark and the group intact, and empty membership lists', async () => {
    const parsed = await parseWorkspaceFile(v3Text)
    if (!parsed.ok) throw new Error(`expected ok, got ${parsed.code}`)
    expect(v3.version).toBe(3)
    expect(parsed.notes).toEqual([])
    const opened = parsed.workspace
    expect(opened.version).toBe(4)
    expect(opened.review).toEqual({ ...v3.review, ...EMPTY_MEMBERSHIP_LISTS })
    expect(opened.review.tickEdits).toHaveLength(1)
    expect(opened.review.flatEdits).toHaveLength(1)
    expect(opened.review.auxEdits).toHaveLength(1)
    expect(opened.review.vetted).toHaveLength(1)
    expect(opened.groups).toEqual(v3.groups)
    expect(opened.groups).toHaveLength(1)
    expect(opened.files).toEqual(v3.files)
    expect(opened.ccaLevels).toEqual(v3.ccaLevels)
    expect(opened.step).toBe('review')
  })

  it('migrates v3 to v4 without changing its input, and adds only the two lists', () => {
    const before = JSON.stringify(v3)
    const { raw, notes } = migrateWorkspace(v3)
    expect(notes).toEqual([])
    expect(raw.version).toBe(4)
    expect(raw.review).toEqual({ ...v3.review, ...EMPTY_MEMBERSHIP_LISTS })
    expect(raw.groups).toEqual(v3.groups)
    expect(JSON.stringify(v3)).toBe(before)
  })

  it('a v3 file with a broken review is CORRUPT', async () => {
    expect(await codeOf(JSON.stringify({ ...v3, review: 'nope' }))).toBe('CORRUPT')
    expect(await codeOf(JSON.stringify({ ...v3, review: { ...v3.review, tickEdits: [{ matric: 1 }] } }))).toBe('CORRUPT')
  })

  it('restores with no membership edits listed as stale', async () => {
    const parsed = await parseWorkspaceFile(v3Text)
    if (!parsed.ok) throw new Error('expected ok')
    const restored = restoreWorkspace(parsed.workspace, parsed.notes)
    expect(restored.stale.membershipEdits).toEqual([])
    expect(restored.stale.edits).toEqual([])
  })
})

describe('config migration on load', () => {
  it('turns headcounts.sem2Spots into sem2Green (sem2Grey 0) and fills new settings', async () => {
    const { sem2Green: _g, sem2Grey: _y, ...rest } = workspace.config.headcounts
    const config: Record<string, unknown> = { ...workspace.config, headcounts: { ...rest, sem2Spots: 7 } }
    delete config.jcrcFullYearOffset
    delete config.jcrcExchangeFactor
    const loaded = await ok(JSON.stringify({ ...workspace, config }))
    expect('ccaLevels' in loaded).toBe(true)
    expect(loaded.config.headcounts).toMatchObject({ maleGreen: 2, sem2Green: 7, sem2Grey: 0 })
    expect('sem2Spots' in loaded.config.headcounts).toBe(false)
    expect(loaded.config.jcrcFullYearOffset).toBe(DEFAULT_CONFIG.jcrcFullYearOffset)
    expect(loaded.config.jcrcExchangeFactor).toBe(DEFAULT_CONFIG.jcrcExchangeFactor)
  })
})

describe('restoreWorkspace re-validates the saved files', () => {
  it('applies everything that still matches', () => {
    const restored = restoreWorkspace(workspace)
    expect(restored.report.canCompute).toBe(true)
    expect(restored.stale.overrides).toEqual([])
    expect(restored.stale.discretion).toEqual([])
    expect(restored.workspace.finalOverrides).toEqual(workspace.finalOverrides)
  })

  it('reports an override whose membership vanished after a changed file', () => {
    const files = workspace.files.filter((f) => f.name !== leaderFileName('C1'))
    const restored = restoreWorkspace({ ...workspace, files })
    expect(restored.report.canCompute).toBe(true)
    expect(restored.stale.overrides).toEqual(workspace.finalOverrides)
    expect(restored.stale.discretion).toEqual([])
  })

  it('still lists discretion for a resident who is not in the residents list, when the import is good', () => {
    const gone = { matric: 'A9999999Z', stayingDelta: 1, biddingDelta: 1, reason: 'left' }
    const restored = restoreWorkspace({ ...workspace, discretion: [...workspace.discretion, gone] })
    expect(restored.report.canCompute).toBe(true)
    expect(restored.unchecked).toEqual({ review: false, computed: false, aux: false })
    expect(restored.stale.discretion).toEqual([gone])
  })

  it('reports a wheel resolution that no longer matches a tie group', () => {
    expect(restoreWorkspace(workspace).stale.resolutions).toEqual(workspace.resolutions)
  })

  it('leaves computed entries unchecked while the import has an error, and checks review items', () => {
    const files = workspace.files.filter((f) => f.name !== 'residents.csv')
    const restored = restoreWorkspace({ ...workspace, files })
    expect(restored.report.canCompute).toBe(false)
    expect(restored.report.bundle).not.toBeNull()
    expect(restored.unchecked).toEqual({ review: false, computed: true, aux: true })
    expect(restored.stale.overrides).toEqual([])
    expect(restored.stale.discretion).toEqual([])
    expect(restored.stale.resolutions).toEqual([])
    expect(restored.stale.ccaLevels).toEqual([])
  })

  it('has nothing unchecked when the import computes', () => {
    expect(restoreWorkspace(workspace).unchecked).toEqual({ review: false, computed: false, aux: false })
  })

  it('reports nothing about review or levels while everything still matches', () => {
    const restored = restoreWorkspace(workspace)
    expect(restored.stale.edits).toEqual([])
    expect(restored.stale.vetted).toEqual([])
    expect(restored.stale.ccaLevels).toEqual([])
    expect(restored.notes).toEqual([])
  })

  it('lists an edit as stale when its leader file was removed', () => {
    const files = workspace.files.filter((f) => f.name !== leaderFileName('C1'))
    const restored = restoreWorkspace({ ...workspace, files })
    expect(restored.stale.edits).toEqual([{ entry: workspace.review.edits[0], status: 'stale', fileValue: null }])
  })

  it('lists an edit as changed, and the vetted mark, when the file value moved', () => {
    const moved = scenario({ leaders: { C1: leaderRows('C1', [15, 10, 12, 14, 16, 18]), C2: leaderRows('C2') } })
    const restored = restoreWorkspace({ ...workspace, files: moved })
    expect(restored.stale.edits).toEqual([{ entry: workspace.review.edits[0], status: 'changed', fileValue: 15 }])
    expect(restored.stale.vetted).toEqual(workspace.review.vetted)
  })

  it('lists a level entry whose ccaID is not in the bundle', () => {
    const extra = { ccaID: 'C7', level: 'Pass', bonusOverride: null, multiplierOverride: null }
    const restored = restoreWorkspace({ ...workspace, ccaLevels: [...workspace.ccaLevels, extra] })
    expect(restored.stale.ccaLevels).toEqual([extra])
  })

  it('does not change the workspace it was given', () => {
    const before = JSON.stringify(workspace)
    restoreWorkspace(workspace)
    expect(JSON.stringify(workspace)).toBe(before)
  })

  const sportC1 = patchRow(baseCcas(), 0, { sport: 'Y', ihgResult: '1st', ihgCap: '3' })
  const withTick = (review: Partial<Workspace['review']>, files = scenario({ ccas: sportC1 })) =>
    restoreWorkspace({ ...workspace, files, review: { ...workspace.review, vetted: [], ...review } })

  it('lists nothing for a tick edit and an AUX edit that still apply', () => {
    const restored = withTick({ tickEdits: [tickEdit], auxEdits: [auxEdit] })
    expect(restored.report.review.tickEdits.map((e) => e.status)).toEqual(['applied'])
    expect(restored.stale.tickEdits).toEqual([])
    expect(restored.stale.auxEdits).toEqual([])
  })

  it('lists a tick edit as changed when the file now ticks that member', () => {
    const files = scenario({ ccas: sportC1, leaders: { C1: leaderRows('C1', BASE_SCORES, { ihg: [2] }), C2: leaderRows('C2') } })
    const restored = withTick({ tickEdits: [tickEdit] }, files)
    expect(restored.stale.tickEdits).toEqual([{ entry: tickEdit, status: 'changed', current: true }])
  })

  it('lists an AUX edit as stale when its resident left the residents list, and changed when the count moved', () => {
    const gone = withTick({ auxEdits: [auxEdit] }, scenario({ ccas: sportC1, residents: baseResidents(3) }))
    expect(gone.stale.auxEdits).toEqual([{ entry: auxEdit, status: 'stale', current: null }])
    const residents = patchRow(baseResidents(), 3, { aux: '6' })
    const moved = withTick({ auxEdits: [auxEdit] }, scenario({ ccas: sportC1, residents }))
    expect(moved.stale.auxEdits).toEqual([{ entry: auxEdit, status: 'changed', current: 6 }])
  })

  it('lists a flat edit whose member is not in any flat CCA', () => {
    const restored = withTick({ flatEdits: [flatEdit] })
    expect(restored.stale.flatEdits).toEqual([{ entry: flatEdit, status: 'stale', current: null }])
  })

  const roleRows = patchRow(leaderRows('C1'), 0, { outgoingRole: 'head' })
  const roleFile = scenario({ leaders: { C1: roleRows, C2: leaderRows('C2') } })
  const withMembership = (review: Partial<Workspace['review']>, files = workspace.files) =>
    restoreWorkspace({ ...workspace, files, review: { ...workspace.review, vetted: [], ...review } })

  it('lists nothing for role and semester edits that still apply', () => {
    const restored = withMembership({ membershipEdits: [roleEdit, semEdit] })
    expect(restored.report.review.membershipEdits.map((e) => e.status)).toEqual(['applied', 'applied'])
    expect(restored.stale.membershipEdits).toEqual([])
  })

  it('lists a membership edit as changed when the file now says something else, and stale when the membership is gone', () => {
    const moved = withMembership({ membershipEdits: [roleEdit] }, roleFile)
    expect(moved.stale.membershipEdits).toEqual([{ entry: roleEdit, status: 'changed', current: 'head' }])
    const files = workspace.files.filter((f) => f.name !== leaderFileName('C1'))
    const gone = withMembership({ membershipEdits: [roleEdit, semEdit] }, files)
    expect(gone.stale.membershipEdits).toEqual([
      { entry: roleEdit, status: 'stale', current: null },
      { entry: semEdit, status: 'stale', current: null },
    ])
  })

  it('leaves membership edits unchecked with no bundle', () => {
    const noBundle = withMembership({ membershipEdits: [roleEdit] }, scenario({ bundle: null }))
    expect(noBundle.unchecked.review).toBe(true)
    expect(noBundle.stale.membershipEdits).toEqual([])
  })

  it('leaves AUX edits unchecked with no residents list or no bundle, and tick and flat edits with no bundle', () => {
    const noResidents = withTick({ auxEdits: [auxEdit] }, scenario({ ccas: sportC1, residents: null }))
    expect(noResidents.unchecked.aux).toBe(true)
    expect(noResidents.stale.auxEdits).toEqual([])
    const noBundle = withTick({ tickEdits: [tickEdit], flatEdits: [flatEdit], auxEdits: [auxEdit] }, scenario({ bundle: null }))
    expect(noBundle.unchecked).toEqual({ review: true, computed: true, aux: true })
    expect(noBundle.stale.tickEdits).toEqual([])
    expect(noBundle.stale.flatEdits).toEqual([])
    expect(noBundle.stale.auxEdits).toEqual([])
  })
})

describe('sandboxInputOf', () => {
  it('maps the review lists', () => {
    expect(sandboxInputOf(workspace)).toEqual({
      ccaLevels: workspace.ccaLevels,
      edits: workspace.review.edits,
      notSubmitting: ['C9'],
      tickEdits: [],
      flatEdits: [],
      auxEdits: [],
      membershipEdits: [],
    })
  })

  it('passes the membership edits through', () => {
    const review: Workspace['review'] = { ...workspace.review, membershipEdits: [roleEdit, semEdit] }
    expect(sandboxInputOf({ ccaLevels: [], review }).membershipEdits).toEqual([roleEdit, semEdit])
  })

  it('passes tick, flat and AUX lists through when the review holds them (what Compare and the store use)', () => {
    const tickEdits = [{ matric: matricOf(1), ccaID: 'C1', from: false, to: true, reason: '', at: AT }]
    const flatEdits = [{ matric: matricOf(2), ccaID: 'C3', from: 12, to: 10, reason: '', at: AT }]
    const auxEdits = [{ matric: matricOf(3), from: 5, to: 7, reason: '', at: AT }]
    const review: Workspace['review'] = { ...workspace.review, tickEdits, flatEdits, auxEdits }
    expect(sandboxInputOf({ ccaLevels: [], review })).toMatchObject({ tickEdits, flatEdits, auxEdits })
  })
})
