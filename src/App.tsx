import { useEffect, useMemo, useState } from 'react'
import { DEFAULT_CONFIG } from './engine'
import { validateImport } from './import'
import { CompareScreen } from './ui/compare/CompareScreen'
import { ImportScreen } from './ui/import/ImportScreen'
import { PublishScreen } from './ui/publish/PublishScreen'
import { ResultsScreen } from './ui/results/ResultsScreen'
import { blockReason } from './ui/shell/blockReason'
import { TopBar, type Screen } from './ui/shell/TopBar'
import { useAppStore } from './ui/state/useAppStore'
import { useScenarios } from './ui/state/useScenarios'
import { hasResidentData } from './ui/state/workspaceState'
import { WorkspaceControls } from './ui/workspace/WorkspaceControls'

export function App() {
  const { state, dispatch } = useAppStore()
  const scenarios = useScenarios()
  const [screen, setScreen] = useState<Screen>('import')
  // Settings sections' open/closed state lives in memory so it survives screen changes.
  const [openSections, setOpenSections] = useState<ReadonlySet<string>>(() => new Set(['headcounts']))
  const reason = blockReason(state.report, state.files.length)
  // When the files pass with default settings, the current settings caused the block:
  // keep Results (and its settings panel) reachable so they can be changed back.
  const settingsCause = useMemo(
    () =>
      reason !== null &&
      state.files.length > 0 &&
      validateImport(state.files, DEFAULT_CONFIG, state.overrides.map((ccaID) => ({ ccaID }))).canCompute,
    [reason, state.files, state.overrides],
  )
  // Closing the tab with unsaved resident data loses it: ask the browser to warn.
  const warnOnLeave = state.dirty && hasResidentData(state)
  useEffect(() => {
    if (!warnOnLeave) return undefined
    const warn = (event: BeforeUnloadEvent): void => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [warnOnLeave])
  const resultsLock = settingsCause ? null : reason
  const locks: Record<Screen, string | null> = {
    import: null,
    results: resultsLock,
    publish: resultsLock,
    compare: reason !== null ? 'Load data that passes the checks first' : scenarios.scenarios.length === 0 ? 'Save a scenario first' : null,
  }
  const shown: Screen = locks[screen] === null ? screen : 'import'
  const fullHeight = shown !== 'import'

  return (
    <div className={`bg-paper text-ink ${fullHeight ? 'flex h-screen flex-col overflow-hidden' : 'min-h-screen'}`}>
      <TopBar
        screen={shown}
        locks={locks}
        finalised={state.finalised !== null}
        onNavigate={setScreen}
        actions={<WorkspaceControls state={state} dispatch={dispatch} />}
      />
      {shown === 'import' && (
        <ImportScreen
          state={state}
          dispatch={dispatch}
          blockedReason={reason}
          settingsCause={settingsCause}
          onViewResults={() => setScreen('results')}
        />
      )}
      {shown === 'results' && (
        <ResultsScreen
          state={state}
          dispatch={dispatch}
          scenarios={scenarios}
          blockedReason={reason}
          openSections={openSections}
          onOpenSectionsChange={setOpenSections}
          onBackToImport={() => setScreen('import')}
        />
      )}
      {shown === 'publish' && <PublishScreen state={state} onGoToResults={() => setScreen('results')} />}
      {shown === 'compare' && <CompareScreen state={state} scenarios={scenarios.scenarios} />}
    </div>
  )
}
