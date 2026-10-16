import { Download, Search } from 'lucide-react'
import { useState, type Dispatch } from 'react'
import { removePenalty, type Lists, type PenaltyKey } from '../../engine'
import { Button } from '../common/controls'
import type { DrawerEditing } from '../drawer/Editors'
import { ResidentDrawer } from '../drawer/ResidentDrawer'
import { LIST_KEYS, LIST_TITLES, buildListCsv, downloadCsv, entryCounts, exportFileName, type ListKey } from '../export/exportCsv'
import { PenaltiesStrip } from '../penalty/PenaltiesStrip'
import { PenaltyDialog } from '../penalty/PenaltyDialog'
import { SettingsPanel } from '../settings/SettingsPanel'
import { entryOptions, type Action, type AppState, type PenaltyLogEntry } from '../state/store'
import type { ScenarioStore } from '../state/useScenarios'
import { AdjustmentsStrip } from './AdjustmentsStrip'
import { bandRows } from './bands'
import { ListTable } from './ListTable'
import { ListTabs, panelId, tabId } from './ListTabs'
import { ResultsBanner } from './ResultsBanner'
import { ResultsHeader } from './ResultsHeader'
import { TiesPanel } from './TiesPanel'
import { WheelDialog } from './WheelDialog'
import { groupMatrics, groupOf, isWheelList, staleResolutions, tieGroups, type TieGroup } from './wheel'

interface ResultsScreenProps {
  readonly state: AppState
  readonly dispatch: Dispatch<Action>
  readonly scenarios: ScenarioStore
  readonly blockedReason: string | null
  readonly openSections: ReadonlySet<string>
  readonly onOpenSectionsChange: (open: ReadonlySet<string>) => void
  readonly onBackToImport: () => void
}

function exportLists(lists: Lists, keys: readonly ListKey[], state: AppState): void {
  const now = new Date()
  const penalties = state.finalised ? state.finalised.log.length : null
  const counts = entryCounts(state.results)
  for (const key of keys) downloadCsv(exportFileName(key, now), buildListCsv(lists[key], state.report.overrides, penalties, counts))
}

const focusRow = (matric: string): void => {
  window.requestAnimationFrame(() => document.querySelector<HTMLElement>(`[data-row-matric="${CSS.escape(matric)}"]`)?.focus())
}

/** Final-points and discretion editing for the drawer; locked while finalised. */
function drawerEditing(state: AppState, dispatch: Dispatch<Action>): DrawerEditing | null {
  const input = state.report.input
  if (!input) return null
  return {
    locked: state.finalised !== null,
    input,
    overrides: state.finalOverrides,
    discretion: state.discretion,
    setOverride: (entry) => dispatch({ type: 'setFinalOverride', entry }),
    removeOverride: (matric, ccaID) => dispatch({ type: 'removeFinalOverride', matric, ccaID }),
    setDiscretion: (entry) => dispatch({ type: 'setDiscretion', entry }),
    removeDiscretion: (matric) => dispatch({ type: 'removeDiscretion', matric }),
  }
}

export function ResultsScreen(props: ResultsScreenProps) {
  const { state, dispatch, scenarios, blockedReason, openSections, onOpenSectionsChange, onBackToImport } = props
  const [active, setActive] = useState<ListKey>('maleStaying')
  const [search, setSearch] = useState('')
  const [openMatric, setOpenMatric] = useState<string | null>(null)
  const [dropTarget, setDropTarget] = useState<PenaltyKey | null>(null)
  const [undoError, setUndoError] = useState<string | null>(null)
  const [wheelGroup, setWheelGroup] = useState<TieGroup | null>(null)
  const { results, report, config, computeError, finalised } = state
  const lists = results?.lists ?? null
  const input = report.input
  const order = lists ? bandRows(active, lists[active], config, search).flatMap((b) => b.rows.map((r) => r.matric)) : []
  const groups = lists ? tieGroups(lists) : []

  const closeDrawer = (): void => {
    if (openMatric) focusRow(openMatric)
    setOpenMatric(null)
  }
  const undo = (entry: PenaltyLogEntry): void => {
    if (!finalised || !input) return
    const result = removePenalty(input, config, finalised.penalty, entry.key, entryOptions(state))
    setUndoError(result.ok ? null : result.error)
    if (result.ok) dispatch({ type: 'undoPenalty', penalty: result.state, key: entry.key })
  }
  const resolve = (group: TieGroup): void => {
    setActive(group.list)
    setWheelGroup(group)
  }
  const tieOf = (matric: string): TieGroup | null => (lists ? groupOf(lists, active, matric) : null)
  const wheelList = isWheelList(active)

  return (
    <div className="grid min-h-0 flex-1 grid-cols-[300px_minmax(0,1fr)] grid-rows-[minmax(0,1fr)] xl:grid-cols-[340px_minmax(0,1fr)]">
      <SettingsPanel
        config={config}
        locked={finalised !== null}
        onChange={(next) => dispatch({ type: 'setConfig', config: next })}
        openSections={openSections}
        onOpenSectionsChange={onOpenSectionsChange}
      />
      <main className="flex min-h-0 min-w-0 flex-col">
        <ResultsHeader state={state} lists={lists} dispatch={dispatch} scenarios={scenarios} />
        {finalised && lists && <PenaltiesStrip finalised={finalised} lists={lists} undoError={undoError} onUndo={undo} />}
        <ResultsBanner report={report} onBackToImport={onBackToImport} />
        {results && (
          <AdjustmentsStrip
            overrides={results.overrides}
            discretion={results.discretion}
            input={input}
            locked={finalised !== null}
            onOpen={setOpenMatric}
            onRemoveOverride={(matric, ccaID) => dispatch({ type: 'removeFinalOverride', matric, ccaID })}
            onRemoveDiscretion={(matric) => dispatch({ type: 'removeDiscretion', matric })}
          />
        )}
        <TiesPanel
          unresolved={groups.filter((g) => !g.resolved)}
          stale={staleResolutions(results?.resolutions)}
          input={input}
          onResolve={resolve}
          onRemoveStale={(r) => dispatch({ type: 'clearResolution', list: r.list, matrics: r.order })}
        />
        {computeError && (
          <p role="alert" className="border-b border-error/30 bg-error-bg px-6 py-2 text-body text-error">
            These settings cannot be calculated: {computeError}
          </p>
        )}
        {blockedReason !== null ? (
          <div role="alert" className="mx-6 mt-6 border-l-4 border-error bg-error-bg px-4 py-3 text-body">
            <p className="font-medium text-error">The current settings stop the import from passing: {blockedReason}.</p>
            <p className="mt-1">
              Change the settings on the left, or{' '}
              <button type="button" onClick={onBackToImport} className="motion rounded-[2px] font-medium underline underline-offset-2 hover:text-raffles">
                review the issues in Import
              </button>
              .
            </p>
          </div>
        ) : !lists ? (
          <p className="px-6 py-10 text-muted">{computeError ? 'Change the settings to continue.' : 'Calculating…'}</p>
        ) : (
          <>
            <ListTabs counts={Object.fromEntries(LIST_KEYS.map((k) => [k, lists[k].length])) as Record<ListKey, number>} active={active} onChange={setActive} />
            <div className="flex flex-wrap items-center gap-3 px-6 py-3">
              <label className="relative flex items-center">
                <Search aria-hidden size={14} className="pointer-events-none absolute left-2.5 text-muted" />
                <input
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search name or matric"
                  aria-label="Search name or matric"
                  className="motion h-9 w-72 rounded-[3px] border border-ink/20 bg-card pr-2 pl-8 text-body hover:border-ink/50"
                />
              </label>
              <span className="text-cap text-muted">{LIST_TITLES[active]} · {lists[active].length} residents · click a row for its breakdown</span>
              <div className="ml-auto flex gap-2">
                <Button onClick={() => exportLists(lists, [active], state)}>
                  <Download aria-hidden size={15} /> Export this list
                </Button>
                <Button variant="primary" onClick={() => exportLists(lists, LIST_KEYS, state)}>
                  <Download aria-hidden size={15} /> Export all 5
                </Button>
              </div>
            </div>
            <div id={panelId} role="tabpanel" aria-labelledby={tabId(active)} className="flex min-h-0 flex-1 flex-col">
              <ListTable
                list={active}
                rows={lists[active]}
                config={config}
                search={search}
                onOpen={setOpenMatric}
                onTie={wheelList ? (matric) => setWheelGroup(tieOf(matric)) : undefined}
                onClearTie={wheelList ? (matric) => {
                  const group = tieOf(matric)
                  if (group) dispatch({ type: 'clearResolution', list: group.list, matrics: groupMatrics(group) })
                } : undefined}
              />
            </div>
            <ResidentDrawer
              matric={openMatric}
              order={order}
              lists={lists}
              input={input}
              config={config}
              penalty={finalised?.penalty}
              onNavigate={(m) => setOpenMatric(m)}
              onClose={closeDrawer}
              onDropRole={finalised ? setDropTarget : null}
              editing={drawerEditing(state, dispatch)}
            />
            {finalised && input && (
              <PenaltyDialog
                target={dropTarget}
                input={input}
                config={config}
                penalty={finalised.penalty}
                entries={entryOptions(state)}
                lists={lists}
                onCancel={() => setDropTarget(null)}
                onConfirm={(penalty, entry) => {
                  dispatch({ type: 'applyPenalty', penalty, entry })
                  setDropTarget(null)
                }}
              />
            )}
            <WheelDialog
              group={wheelGroup}
              onClose={() => setWheelGroup(null)}
              onSave={(resolution) => {
                dispatch({ type: 'setResolution', resolution })
                setWheelGroup(null)
              }}
            />
          </>
        )}
      </main>
    </div>
  )
}
