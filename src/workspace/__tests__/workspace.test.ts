import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { DEFAULT_CONFIG } from '../../engine'
import { fnv1a32 } from '../../import'
import { leaderFileName, leaderRows, matricOf, scenario } from '../../import/__tests__/fixtures'
import {
  LEVELS_MIGRATED_NOTE,
  RETIRED_FILES_NOTE,
  WORKSPACE_FORMAT,
  encryptWorkspace,
  migrateWorkspace,
  parseWorkspaceFile,
  restoreWorkspace,
  serializeWorkspace,
  workspaceFilename,
  type Workspace,
} from '../index'

const TIMEOUT = 30_000
const PASSWORD = 'correct horse'

const AT = '2027-04-02T10:00:00.000Z'
const files = scenario()
const c1File = files.find((f) => f.name === leaderFileName('C1'))?.text ?? ''

const workspace: Workspace = {
  format: WORKSPACE_FORMAT,
  version: 2,
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
  },
  step: 'review',
  finalOverrides: [{ matric: 'A9900001Z', ccaID: 'C1', finalPoints: 5, reason: 'withdrawn' }],
  discretion: [{ matric: 'A9900002Z', stayingDelta: 2, biddingDelta: -1, reason: 'service' }],
  resolutions: [{ list: 'maleStaying', order: ['A9900003Z', 'A9900001Z'] }],
  finalised: null,
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

  it('is written as version 2, with the level table and no meanSdOverrides', () => {
    const written = JSON.parse(serializeWorkspace(workspace)) as Record<string, unknown>
    expect(written.version).toBe(2)
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
    expect(await codeOf(JSON.stringify({ ...workspace, version: 3 }))).toBe('UNSUPPORTED_VERSION')
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
})

describe('version 1 files (spec 8b migration)', () => {
  const v1Text = readFileSync('src/workspace/__tests__/v1-fixture.json', 'utf8')
  const v1 = JSON.parse(v1Text) as Record<string, any>

  it('opens the literal v1 fixture with exactly two notes', async () => {
    const parsed = await parseWorkspaceFile(v1Text)
    if (!parsed.ok) throw new Error(`expected ok, got ${parsed.code}`)
    expect(parsed.notes).toEqual([RETIRED_FILES_NOTE, LEVELS_MIGRATED_NOTE])
    const opened = parsed.workspace
    expect(opened.version).toBe(2)
    expect(opened.review).toEqual({ edits: [], log: [], vetted: [], notSubmitting: [] })
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

  it('leaves a version 2 object alone and never changes its input', () => {
    const v2 = JSON.parse(serializeWorkspace(workspace)) as Record<string, unknown>
    expect(migrateWorkspace(v2)).toEqual({ raw: v2, notes: [] })
    const before = JSON.stringify(v1)
    migrateWorkspace(v1)
    expect(JSON.stringify(v1)).toBe(before)
  })

  it('a v1 file with a broken config is CORRUPT', async () => {
    expect(await codeOf(JSON.stringify({ ...v1, config: { headcounts: 3 } }))).toBe('CORRUPT')
    expect(await codeOf(JSON.stringify({ ...v1, files: 'nope' }))).toBe('CORRUPT')
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

  it('reports discretion for a resident who left the residents list', () => {
    const files = workspace.files.map((f) =>
      f.name === 'residents.csv' ? { ...f, text: f.text.split('\n').filter((l) => !l.startsWith('A9900002Z')).join('\n') } : f,
    )
    const restored = restoreWorkspace({ ...workspace, files })
    expect(restored.stale.discretion).toEqual(workspace.discretion)
  })

  it('reports a wheel resolution that no longer matches a tie group', () => {
    expect(restoreWorkspace(workspace).stale.resolutions).toEqual(workspace.resolutions)
  })

  it('reports every item as stale while the saved files do not import', () => {
    const files = workspace.files.filter((f) => f.name !== 'residents.csv')
    const restored = restoreWorkspace({ ...workspace, files })
    expect(restored.report.canCompute).toBe(false)
    expect(restored.stale.overrides).toEqual(workspace.finalOverrides)
    expect(restored.stale.discretion).toEqual(workspace.discretion)
    expect(restored.stale.resolutions).toEqual(workspace.resolutions)
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
})
