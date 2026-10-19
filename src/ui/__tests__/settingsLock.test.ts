import { describe, expect, it } from 'vitest'
import { DEFAULT_CONFIG, computeAll, createPenaltyState } from '../../engine'
import {
  BUNDLE_FILE_NAME,
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

const load = (files = scenario()): AppState => reducer(initialState(), { type: 'addFiles', files })
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

  it('is allowed once the bundle is loaded', () => {
    const state = load(scenario())
    expect(finaliseBlock(state)).toBeNull()
    expect(reducer(state, finaliseAction(state)).finalised).not.toBeNull()
  })

  it('still needs the import to be clean, as before', () => {
    const state = load(scenario({ leaders: { C1: patchRow(leaderRows('C1'), -1, { matric: matricOf(99) }), C2: leaderRows('C2') } }))
    expect(state.report.canCompute).toBe(false)
    expect(finaliseBlock(state)).not.toBeNull()
    expect(reducer(state, { type: 'finalise', penalty: { cutoffs: { M: null, F: null }, applied: [], removed: [] } }).finalised).toBeNull()
  })

  it('is refused again if the bundle is removed', () => {
    const state = reducer(load(scenario()), { type: 'removeFile', name: BUNDLE_FILE_NAME })
    expect(finaliseBlock(state)).toBe(BUNDLE_REQUIRED_REASON)
  })

  it("is refused when the bundle's settings are broken", () => {
    const state = load(scenario({ settings: [settingsWaiverRow('C1')] }))
    expect(state.report.settings).toBeNull()
    expect(finaliseBlock(state)).not.toBeNull()
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
    const before = load(scenario({ settings: [settingsDefaultRow(), settingsWaiverRow('C1')] }))
    const workspace = toWorkspace(before, new Date(2027, 3, 1))
    expect(workspace.files.map((f) => f.name)).toContain(BUNDLE_FILE_NAME)
    const parsed = await parseWorkspaceFile(serializeWorkspace(workspace))
    if (!parsed.ok) throw new Error('expected the workspace to open')
    const opened = reducer(initialState(), { type: 'loadWorkspace', workspace: fromRestored(restoreWorkspace(parsed.workspace)) })
    expect(opened.report.settings?.waivers['C1']).toMatchObject({ meanMin: 12, meanMax: 15 })
    expect(finaliseBlock(opened)).toBeNull()
  })
})
