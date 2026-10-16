import { Download, Search } from 'lucide-react'
import { useState, type Dispatch } from 'react'
import type { Lists } from '../../engine'
import { Button } from '../common/controls'
import { LIST_KEYS, LIST_TITLES, buildListCsv, downloadCsv, exportFileName, type ListKey } from '../export/exportCsv'
import { SettingsPanel } from '../settings/SettingsPanel'
import type { Action, AppState } from '../state/store'
import { ListTable } from './ListTable'
import { ListTabs, panelId, tabId } from './ListTabs'
import { ResultsBanner } from './ResultsBanner'

interface ResultsScreenProps {
  readonly state: AppState
  readonly dispatch: Dispatch<Action>
  readonly blockedReason: string | null
  readonly openSections: ReadonlySet<string>
  readonly onOpenSectionsChange: (open: ReadonlySet<string>) => void
  readonly onBackToImport: () => void
}

function exportLists(lists: Lists, keys: readonly ListKey[], overrides: AppState['report']['overrides']): void {
  const now = new Date()
  for (const key of keys) downloadCsv(exportFileName(key, now), buildListCsv(lists[key], overrides))
}

export function ResultsScreen({ state, dispatch, blockedReason, openSections, onOpenSectionsChange, onBackToImport }: ResultsScreenProps) {
  const [active, setActive] = useState<ListKey>('maleStaying')
  const [search, setSearch] = useState('')
  const { results, report, config, computeError } = state
  const lists = results?.lists ?? null

  return (
    <div className="grid min-h-0 flex-1 grid-cols-[300px_minmax(0,1fr)] grid-rows-[minmax(0,1fr)] xl:grid-cols-[340px_minmax(0,1fr)]">
      <SettingsPanel
        config={config}
        onChange={(next) => dispatch({ type: 'setConfig', config: next })}
        openSections={openSections}
        onOpenSectionsChange={onOpenSectionsChange}
      />
      <main className="flex min-h-0 min-w-0 flex-col">
        <ResultsBanner report={report} onBackToImport={onBackToImport} />
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
            <ListTabs lists={lists} active={active} onChange={setActive} />
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
              <span className="text-cap text-muted">{LIST_TITLES[active]} · {lists[active].length} residents</span>
              <div className="ml-auto flex gap-2">
                <Button onClick={() => exportLists(lists, [active], report.overrides)}>
                  <Download aria-hidden size={15} /> Export this list
                </Button>
                <Button variant="primary" onClick={() => exportLists(lists, LIST_KEYS, report.overrides)}>
                  <Download aria-hidden size={15} /> Export all 5
                </Button>
              </div>
            </div>
            <div id={panelId} role="tabpanel" aria-labelledby={tabId(active)} className="flex min-h-0 flex-1 flex-col">
              <ListTable list={active} rows={lists[active]} config={config} search={search} />
            </div>
          </>
        )}
      </main>
    </div>
  )
}
