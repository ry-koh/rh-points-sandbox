import { useMemo, useState } from 'react'
import { DEFAULT_CONFIG } from './engine'
import { validateImport } from './import'
import { ImportScreen } from './ui/import/ImportScreen'
import { ResultsScreen } from './ui/results/ResultsScreen'
import { blockReason } from './ui/shell/blockReason'
import { TopBar, type Screen } from './ui/shell/TopBar'
import { useAppStore } from './ui/state/useAppStore'

export function App() {
  const { state, dispatch } = useAppStore()
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
  const resultsLock = settingsCause ? null : reason
  const shown: Screen = screen === 'results' && resultsLock === null ? 'results' : 'import'

  return (
    <div className={`bg-paper text-ink ${shown === 'results' ? 'flex h-screen flex-col overflow-hidden' : 'min-h-screen'}`}>
      <TopBar screen={shown} resultsBlockedReason={resultsLock} onNavigate={setScreen} />
      {shown === 'import' ? (
        <ImportScreen
          state={state}
          dispatch={dispatch}
          blockedReason={reason}
          settingsCause={settingsCause}
          onViewResults={() => setScreen('results')}
        />
      ) : (
        <ResultsScreen
          state={state}
          dispatch={dispatch}
          blockedReason={reason}
          openSections={openSections}
          onOpenSectionsChange={setOpenSections}
          onBackToImport={() => setScreen('import')}
        />
      )}
    </div>
  )
}
