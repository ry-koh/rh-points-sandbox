import { describe, expect, it } from 'vitest'
import { DEFAULT_CONFIG, computeAll, createPenaltyState } from '../../engine'
import type { SourceFile } from '../../import'
import {
  BUNDLE_FILE_NAME,
  DEMO_LEVELS,
  baseCcas,
  leaderFileName,
  leaderRows,
  matricOf,
  patchRow,
  scenario,
  settingsDefaultRow,
  settingsWaiverRow,
} from '../../import/__tests__/fixtures'
import { parseWorkspaceFile, restoreWorkspace, serializeWorkspace } from '../../workspace'
import {
  BUNDLE_REQUIRED_REASON,
  effectiveConfig,
  finaliseBlock,
  initialState,
  reducer,
  type AppState,
} from '../state/store'
import { fromRestored, toWorkspace } from '../state/workspaceState'

const AT = '2027-04-02T10:00:00.000Z'
const load = (files = scenario()): AppState => reducer(initialState(), { type: 'addFiles', files })
/** Levels picked and every CCA that has a leader file vetted: nothing left to block Finalise. */
const ready = (files: SourceFile[] = scenario(), levels = DEMO_LEVELS): AppState => {
  const base = reducer(load(files), { type: 'setCcaLevelsAll', list: levels })
  return base.report.perCca
    .filter((c) => c.fileHash !== null)
    .reduce((state, c) => reducer(state, { type: 'setVetted', ccaID: c.ccaID, at: AT }), base)
}
const SPORT = { ccaID: 'C4', ccaName: 'Touch Rugby (W)', type: '1x', sport: 'Y', ihgResult: '1st', ihgCap: '3' }
const withC4 = (patch: Record<string, string> = {}, leaders = true): SourceFile[] =>
  scenario({
    ccas: [...baseCcas(), { ...SPORT, ...patch }],
    leaders: { C1: leaderRows('C1'), C2: leaderRows('C2'), ...(leaders ? { C4: leaderRows('C4', undefined, { ihg: [0] }) } : {}) },
  })
const finaliseAction = (state: AppState) => {
  const input = state.report.input
  if (!input) throw new Error('expected input')
  return { type: 'finalise', penalty: createPenaltyState(computeAll(input, state.config).lists) } as const
}

describe('Finalise needs the RH-app bundle', () => {
  it('is refused with the reason "Load the RH-app bundle before finalising." when no bundle is loaded', () => {
    const state = load(scenario({ bundle: null }))
    expect(state.report.canCompute).toBe(false)
    expect(finaliseBlock(state)).toBe('Load the RH-app bundle before finalising.')
    expect(BUNDLE_REQUIRED_REASON).toBe('Load the RH-app bundle before finalising.')
    expect(reducer(state, { type: 'finalise', penalty: { cutoffs: { M: null, F: null }, applied: [], removed: [] } }).finalised).toBeNull()
  })

  it('is allowed once the bundle is loaded, the levels are picked and every CCA is vetted', () => {
    const state = ready()
    expect(finaliseBlock(state)).toBeNull()
    expect(reducer(state, finaliseAction(state)).finalised).not.toBeNull()
  })

  it('still needs the import to be clean, as before', () => {
    const state = ready(scenario({ leaders: { C1: patchRow(leaderRows('C1'), -1, { matric: matricOf(99) }), C2: leaderRows('C2') } }))
    expect(state.report.canCompute).toBe(false)
    expect(finaliseBlock(state)).toBe('Fix the import errors before finalising.')
    expect(finaliseBlock(state)).not.toBeNull()
    expect(reducer(state, { type: 'finalise', penalty: { cutoffs: { M: null, F: null }, applied: [], removed: [] } }).finalised).toBeNull()
  })

  it('is refused again if the bundle is removed', () => {
    const state = reducer(ready(), { type: 'removeFile', name: BUNDLE_FILE_NAME })
    expect(finaliseBlock(state)).toBe(BUNDLE_REQUIRED_REASON)
  })

  it("is refused when the bundle's settings are broken", () => {
    const state = load(scenario({ settings: [settingsWaiverRow('C1')] }))
    expect(state.report.settings).toBeNull()
    expect(finaliseBlock(state)).toBe(BUNDLE_REQUIRED_REASON)
  })
})

describe('Finalise needs a complete, vetted, fully set workflow', () => {
  it('names every "not set" item in ONE message, in the groups that have items', () => {
    const files = scenario({
      ccas: [{ ccaID: 'C1', ccaName: 'RHag', type: '' }, baseCcas()[1] ?? {}, { ...SPORT, ihgCap: '' }],
      leaders: { C1: leaderRows('C1'), C2: leaderRows('C2'), C4: leaderRows('C4') },
    })
    const state = ready(files, [])
    expect(finaliseBlock(state)).toBe(
      'Set these in the RH app and download the bundle again — type: RHag; IHG result or cap: Touch Rugby (W). ' +
        'Pick a level on the Review step for: RHag, Test CCA Two, Touch Rugby (W).',
    )
  })

  it('leaves out an empty group, and gives the level group alone when only levels are missing', () => {
    expect(finaliseBlock(ready(scenario(), []))).toBe('Pick a level on the Review step for: Test CCA One, Test CCA Two.')
    const typeOnly = ready(scenario({ ccas: [{ ccaID: 'C1', ccaName: 'RHag', type: '' }, baseCcas()[1] ?? {}] }))
    expect(finaliseBlock(typeOnly)).toBe('Set these in the RH app and download the bundle again — type: RHag.')
  })

  it('asks for IHG only on sports with a leader file, and a level only on CCAs with a file', () => {
    const noFile = ready(withC4({ ihgCap: '', type: '' }, false))
    expect(noFile.report.perCca.find((c) => c.ccaID === 'C4')?.fileHash).toBeNull()
    // C4 has no file and is not marked: the checklist is incomplete, but its type is still named.
    expect(finaliseBlock(noFile)).toBe('Set these in the RH app and download the bundle again — type: Touch Rugby (W).')
  })

  it('never counts a not-submitting CCA, in any group', () => {
    const base = ready(withC4({ ihgCap: '', type: '' }, false))
    const marked = reducer(base, { type: 'setNotSubmitting', mark: { ccaID: 'C4', note: '', at: AT } })
    expect(finaliseBlock(marked)).toBeNull()
  })

  it('never counts a flat CCA', () => {
    const files = scenario({
      ccas: [...baseCcas(), { ccaID: 'C3', ccaName: 'Flat One', flatPoints: '12' }],
      flat: [],
    })
    expect(finaliseBlock(ready(files))).toBeNull()
  })

  it('refuses an incomplete checklist before vetting', () => {
    const state = reducer(load(withC4({}, false)), { type: 'setCcaLevelsAll', list: DEMO_LEVELS })
    expect(finaliseBlock(state)).toBe('Complete the checklist before finalising.')
  })

  it('refuses until every CCA with a file is vetted, counting only those', () => {
    const base = reducer(load(scenario()), { type: 'setCcaLevelsAll', list: DEMO_LEVELS })
    expect(finaliseBlock(base)).toBe('Vet every CCA before finalising (0 of 2 vetted).')
    const one = reducer(base, { type: 'setVetted', ccaID: 'C1', at: AT })
    expect(finaliseBlock(one)).toBe('Vet every CCA before finalising (1 of 2 vetted).')
  })

  it('does not count a vetted mark whose file changed', () => {
    const state = ready()
    const changed = reducer(state, {
      type: 'addFiles',
      files: [{ name: leaderFileName('C1'), text: scenario({ leaders: { C1: leaderRows('C1', [9, 10, 12, 14, 16, 18]), C2: leaderRows('C2') } }).find((f) => f.name === leaderFileName('C1'))?.text ?? '' }],
    })
    expect(finaliseBlock(changed)).toBe('Vet every CCA before finalising (1 of 2 vetted).')
  })
})

describe("the bundle's default range is the effective default", () => {
  const range = { meanMin: 11, meanMax: 13, sdMin: 1, sdMax: 4 }
  const withFile = (): AppState => load(scenario({ settings: [settingsDefaultRow({ meanMin: '11', meanMax: '13', sdMin: '1', sdMax: '4' })] }))

  it("equals the file's default while loaded", () => {
    expect(effectiveConfig(withFile()).meanSdDefault).toEqual(range)
  })

  it("is the sandbox's own default when no bundle is loaded", () => {
    expect(effectiveConfig(load(scenario({ bundle: null }))).meanSdDefault).toEqual(DEFAULT_CONFIG.meanSdDefault)
  })

  it('is not overridden by loading a scenario (setConfig) while the file is loaded', () => {
    const scenarioConfig = { ...DEFAULT_CONFIG, meanSdDefault: { meanMin: 0, meanMax: 20, sdMin: 0, sdMax: 10 }, sem2Factor: 3 }
    const state = reducer(withFile(), { type: 'setConfig', config: scenarioConfig })
    expect(state.config.sem2Factor).toBe(3)
    expect(effectiveConfig(state).meanSdDefault).toEqual(range)
  })

  it("changes nothing else in the config", () => {
    const state = withFile()
    expect({ ...effectiveConfig(state), meanSdDefault: DEFAULT_CONFIG.meanSdDefault }).toEqual(state.config)
  })

  it('returns the config itself when no bundle is loaded', () => {
    const state = load(scenario({ bundle: null }))
    expect(effectiveConfig(state)).toBe(state.config)
  })
})

describe('the bundle travels in the workspace file', () => {
  it('is saved with the other files and re-checked on open, so Finalise stays allowed', async () => {
    const before = ready(scenario({ settings: [settingsDefaultRow(), settingsWaiverRow('C1')] }))
    const workspace = toWorkspace(before, new Date(2027, 3, 1))
    expect(workspace.files.map((f) => f.name)).toContain(BUNDLE_FILE_NAME)
    const parsed = await parseWorkspaceFile(serializeWorkspace(workspace))
    if (!parsed.ok) throw new Error('expected the workspace to open')
    const opened = reducer(initialState(), { type: 'loadWorkspace', workspace: fromRestored(restoreWorkspace(parsed.workspace)) })
    expect(opened.report.settings?.waivers['C1']).toMatchObject({ meanMin: 12, meanMax: 15 })
    expect(finaliseBlock(opened)).toBeNull()
  })
})
