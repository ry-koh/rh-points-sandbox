import { Lock, Printer } from 'lucide-react'
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Button } from '../common/controls'
import { LIST_KEYS, LIST_TITLES, type ListKey } from '../export/exportCsv'
import { ListTabs, panelId, tabId } from '../results/ListTabs'
import { plural } from '../shell/blockReason'
import type { AppState } from '../state/store'
import { PublishedTable } from './PublishedTable'
import { DEFAULT_TITLES, PUBLISHED_KEY, publishReadiness, type PrintItem } from './publishData'

interface PublishScreenProps {
  readonly state: AppState
  readonly onGoToResults: () => void
}

const ALL_TITLE = 'RH published lists'

/** Prints `items` through the browser (Save as PDF), with the list name as the document title. */
function usePrint(): { readonly printing: readonly PrintItem[] | null; readonly print: (items: readonly PrintItem[], name: string) => void } {
  const [job, setJob] = useState<{ items: readonly PrintItem[]; name: string } | null>(null)
  useEffect(() => {
    if (!job) return undefined
    const previous = document.title
    document.title = job.name
    const done = (): void => {
      document.title = previous
      setJob(null)
    }
    window.addEventListener('afterprint', done, { once: true })
    window.print()
    return () => window.removeEventListener('afterprint', done)
  }, [job])
  return { printing: job?.items ?? null, print: (items, name) => setJob({ items, name }) }
}

function NotReady({ finalised, ties, onGoToResults }: { readonly finalised: boolean; readonly ties: number; readonly onGoToResults: () => void }) {
  return (
    <div role="alert" className="mx-6 mt-6 max-w-2xl border-l-4 border-gold bg-gold-soft px-4 py-3 text-body">
      <p className="flex items-center gap-2 font-semibold"><Lock aria-hidden size={14} /> Not ready to publish yet</p>
      <ul className="mt-1 list-disc pl-5">
        {!finalised && <li>Finalise first: lock the lists on the Results step.</li>}
        {ties > 0 && <li>{plural(ties, 'tie')} need{ties === 1 ? 's' : ''} a wheel result: use “Ties to resolve” on the Results step.</li>}
      </ul>
      <Button small className="mt-2" onClick={onGoToResults}>Go to Results</Button>
    </div>
  )
}

/** The fifth step: print-ready lists for residents, A4 portrait, exactly last year's look. */
export function PublishScreen({ state, onGoToResults }: PublishScreenProps) {
  const [active, setActive] = useState<ListKey>('maleStaying')
  const [showTitle, setShowTitle] = useState(true)
  const [titles, setTitles] = useState<Readonly<Record<ListKey, string>>>(DEFAULT_TITLES)
  const { printing, print } = usePrint()
  const readiness = publishReadiness(state.results?.lists ?? null, state.finalised !== null, state.resolutions)
  const itemOf = (key: ListKey): PrintItem | null =>
    readiness.ok ? { key, title: showTitle ? titles[key] : null, list: readiness.lists[PUBLISHED_KEY[key]] } : null
  const current = itemOf(active)
  const all = LIST_KEYS.flatMap((key) => {
    const item = itemOf(key)
    return item ? [item] : []
  })

  return (
    <main className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-wrap items-end gap-4 border-b border-rule px-6 py-4">
        <div>
          <h1 className="text-display font-semibold tracking-tight">Publish</h1>
          <p className="mt-1 max-w-2xl text-ui text-muted">Print-ready lists for residents: names and whole-number points only, no matric numbers.</p>
        </div>
        {readiness.ok && (
          <div className="ml-auto flex gap-2">
            <Button onClick={() => current && print([current], titles[active])}>
              <Printer aria-hidden size={15} /> Print / Save as PDF
            </Button>
            <Button variant="primary" onClick={() => print(all, ALL_TITLE)}>
              <Printer aria-hidden size={15} /> Print all 5
            </Button>
          </div>
        )}
      </div>
      {!readiness.ok ? (
        <NotReady finalised={readiness.finalised} ties={readiness.unresolved.length} onGoToResults={onGoToResults} />
      ) : (
        <>
          <ListTabs counts={Object.fromEntries(LIST_KEYS.map((k) => [k, readiness.lists[PUBLISHED_KEY[k]].rows.length])) as Record<ListKey, number>} active={active} onChange={setActive} />
          <div className="flex flex-wrap items-center gap-4 px-6 py-3 text-body">
            <label className="flex items-center gap-2 font-medium">
              <input type="checkbox" checked={showTitle} onChange={(e) => setShowTitle(e.target.checked)} className="accent-raffles" />
              Show title
            </label>
            <label className="flex items-center gap-2">
              <span className="text-muted">Title for {LIST_TITLES[active]}</span>
              <input
                value={titles[active]}
                disabled={!showTitle}
                onChange={(e) => setTitles({ ...titles, [active]: e.target.value })}
                className="motion h-8 w-72 rounded-[3px] border border-ink/20 bg-card px-2 text-body hover:border-ink/50 disabled:opacity-50"
              />
            </label>
          </div>
          <div id={panelId} role="tabpanel" aria-labelledby={tabId(active)} className="min-h-0 flex-1 overflow-auto bg-ink/[0.04] px-6 py-6">
            {current && (
              <div className="pub-sheet mx-auto w-[210mm] max-w-full p-[15mm] shadow-md">
                <PublishedTable item={current} />
              </div>
            )}
          </div>
        </>
      )}
      {printing && createPortal(
        <div className="pub-print">
          {printing.map((item) => <PublishedTable key={item.key} item={item} />)}
        </div>,
        document.body,
      )}
    </main>
  )
}
