import { describe, expect, it } from 'vitest'
import { DEFAULT_CONFIG } from '../../engine'
import { leaderFileName, scenario } from '../../import/__tests__/fixtures'
import {
  WORKSPACE_FORMAT,
  encryptWorkspace,
  parseWorkspaceFile,
  restoreWorkspace,
  serializeWorkspace,
  workspaceFilename,
  type Workspace,
} from '../index'

const TIMEOUT = 30_000
const PASSWORD = 'correct horse'

const workspace: Workspace = {
  format: WORKSPACE_FORMAT,
  version: 1,
  savedAt: '2027-04-01T09:30:00.000Z',
  files: scenario(),
  meanSdOverrides: ['C1'],
  config: { ...DEFAULT_CONFIG, headcounts: { ...DEFAULT_CONFIG.headcounts, maleGreen: 2, maleGrey: 1, sem2Green: 1 } },
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
  it('round-trips exactly', async () => {
    expect(await ok(serializeWorkspace(workspace))).toEqual(workspace)
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
    expect(await codeOf(JSON.stringify({ ...workspace, version: 2 }))).toBe('UNSUPPORTED_VERSION')
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
})

describe('config migration on load', () => {
  it('turns headcounts.sem2Spots into sem2Green (sem2Grey 0) and fills new settings', async () => {
    const { sem2Green: _g, sem2Grey: _y, ...rest } = workspace.config.headcounts
    const config: Record<string, unknown> = { ...workspace.config, headcounts: { ...rest, sem2Spots: 7 } }
    delete config.jcrcFullYearOffset
    delete config.jcrcExchangeFactor
    const loaded = await ok(JSON.stringify({ ...workspace, config }))
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
    const restored = restoreWorkspace({ ...workspace, files, meanSdOverrides: [] })
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

  it('does not change the workspace it was given', () => {
    const before = JSON.stringify(workspace)
    restoreWorkspace(workspace)
    expect(JSON.stringify(workspace)).toBe(before)
  })
})
