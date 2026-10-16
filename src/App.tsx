import { useMemo, useState } from 'react'
import { DEFAULT_CONFIG } from './engine'
import { validateImport } from './import'
import { CompareScreen } from './ui/compare/CompareScreen'
import { ImportScreen } from './ui/import/ImportScreen'
import { ResultsScreen } from './ui/results/ResultsScreen'
import { blockReason } from './ui/shell/blockReason'
import { TopBar, type Screen } from './ui/shell/TopBar'
import { useAppStore } from './ui/state/useAppStore'
import { useScenarios } from './ui/state/useScenarios'

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
  const locks: Record<Screen, string | null> = {
    import: null,
    results: settingsCause ? null : reason,
    compare: reason !== null ? 'Load data that passes the checks first' : scenarios.scenarios.length === 0 ? 'Save a scenario first' : null,
  }
  const shown: Screen = locks[screen] === null ? screen : 'import'
  const fullHeight = shown !== 'import'

  return (
    <div className={`bg-paper text-ink ${fullHeight ? 'flex h-screen flex-col overflow-hidden' : 'min-h-screen'}`}>
      <TopBar screen={shown} locks={locks} finalised={state.finalised !== null} onNavigate={setScreen} />
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
      {shown === 'compare' && <CompareScreen state={state} scenarios={scenarios.scenarios} />}
    </div>
  )
}
