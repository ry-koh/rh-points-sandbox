import { useCallback, useEffect, useMemo, useState } from 'react'
import { DEFAULT_CONFIG } from './engine'
import { validateImport } from './import'
import { ChecklistScreen } from './ui/checklist/ChecklistScreen'
import { CompareScreen } from './ui/compare/CompareScreen'
import { ImportScreen } from './ui/import/ImportScreen'
import { PublishScreen } from './ui/publish/PublishScreen'
import { ResultsScreen } from './ui/results/ResultsScreen'
import { ReviewScreen } from './ui/review/ReviewScreen'
import { levelUsageOf } from './ui/settings/SettingsPanel'
import { blockReason } from './ui/shell/blockReason'
import { TopBar, type Screen } from './ui/shell/TopBar'
import { stepLocks } from './ui/state/stepLocks'
import { useAppStore } from './ui/state/useAppStore'
import { useScenarios } from './ui/state/useScenarios'
import { WORKFLOW_STEPS, sandboxInputOf } from './workspace'
import { hasResidentData } from './ui/state/workspaceState'
import { WorkspaceControls } from './ui/workspace/WorkspaceControls'

/** The Summary screen arrives in the next phase (P9); until then the step stays locked. */
const SUMMARY_PENDING = 'Summary arrives in the next step'

export function App() {
  const { state, dispatch } = useAppStore()
  const scenarios = useScenarios()
  const screen = state.step
  const setScreen = useCallback((step: Screen) => dispatch({ type: 'setStep', step }), [dispatch])
  // Settings sections' open/closed state lives in memory so it survives screen changes.
  const [openSections, setOpenSections] = useState<ReadonlySet<string>>(() => new Set(['headcounts']))
  const reason = blockReason(state.report, state.files.length)
  // When the files pass with default settings, the current settings caused the block:
  // keep Results (and its settings panel) reachable so they can be changed back.
  const { ccaLevels, review } = state
  const settingsCause = useMemo(
    () =>
      reason !== null &&
      state.files.length > 0 &&
      validateImport(state.files, DEFAULT_CONFIG, sandboxInputOf({ ccaLevels, review })).canCompute,
    [reason, state.files, ccaLevels, review],
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
  const ruled = stepLocks(state, scenarios.scenarios.length, settingsCause)
  const locks: Record<Screen, string | null> = { ...ruled, summary: ruled.summary ?? SUMMARY_PENDING }
  // A locked step falls back to the first open one.
  const shown: Screen = locks[screen] === null ? screen : (WORKFLOW_STEPS.find((step) => locks[step] === null) ?? 'import')
  const levelUsage = useMemo(() => levelUsageOf(ccaLevels), [ccaLevels])
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
      {shown === 'checklist' && (
        <ChecklistScreen state={state} dispatch={dispatch} reviewLock={locks.review} onContinue={() => setScreen('review')} />
      )}
      {shown === 'review' && (
        <ReviewScreen
          state={state}
          dispatch={dispatch}
          openSections={openSections}
          onOpenSectionsChange={setOpenSections}
          levelUsage={levelUsage}
        />
      )}
      {shown === 'summary' && (
        <main className="mx-auto w-full max-w-[1600px] px-6 pt-8">
          <h1 className="text-display font-semibold tracking-tight">Summary</h1>
          <p className="mt-2 text-ui text-muted">{SUMMARY_PENDING}.</p>
        </main>
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
