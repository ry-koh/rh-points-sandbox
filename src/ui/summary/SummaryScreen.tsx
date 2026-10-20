import { Lock, Search } from 'lucide-react'
import { useMemo, useState, type Dispatch } from 'react'
import { Eyebrow } from '../common/controls'
import { drawerEditing } from '../state/editing'
import type { Action, AppState } from '../state/store'
import { AuxLog } from './AuxLog'
import { SummaryTable } from './SummaryTable'
import { summaryCounts, summaryRows } from './summaryData'

interface SummaryScreenProps {
  readonly state: AppState
  readonly dispatch: Dispatch<Action>
}

const toggled = (set: ReadonlySet<string>, key: string): Set<string> => {
  const next = new Set(set)
  if (!next.delete(key)) next.add(key)
  return next
}

/** Per person, inputs only: reviewed scores, roles, AUX, IHG ticks; JCRC gives discretion points here. */
export function SummaryScreen({ state, dispatch }: SummaryScreenProps) {
  const { report, review, ccaLevels, discretion } = state
  const [search, setSearch] = useState('')
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => new Set())
  const [discretionOpen, setDiscretionOpen] = useState<ReadonlySet<string>>(() => new Set())
  const rows = useMemo(() => summaryRows(report, review, ccaLevels, discretion), [report, review, ccaLevels, discretion])
  const counts = summaryCounts(rows)
  const query = search.trim().toLowerCase()
  const shown = query ? rows.filter((r) => r.name.toLowerCase().includes(query) || r.matric.toLowerCase().includes(query)) : rows
  const editing = drawerEditing(state, dispatch)
  return (
    <main className="mx-auto w-full max-w-[1600px] min-h-0 flex-1 overflow-y-auto px-6 pt-8 pb-16">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-rule pb-5">
        <div>
          <h1 className="text-display font-semibold tracking-tight">Summary</h1>
          <p className="mt-1 max-w-2xl text-body text-muted">
            Each resident&rsquo;s inputs after review. No points are computed here; give JCRC discretion
            points in the last column.
          </p>
        </div>
        <label className="relative">
          <span className="sr-only">Search by name or matric</span>
          <Search aria-hidden size={15} className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-muted" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name or matric"
            className="motion h-9 w-72 rounded-[3px] border border-ink/20 bg-card pr-2 pl-8 text-body hover:border-ink/50"
          />
        </label>
      </div>
      {state.finalised !== null && (
        <p role="status" className="mt-6 flex items-center gap-2 border-l-4 border-gold bg-gold-soft px-4 py-3 text-body font-medium">
          <Lock aria-hidden size={15} /> Finalised · discretion and AUX locked. Unlock the lists on the Results screen to change them.
        </p>
      )}
      <section aria-labelledby="summary-title" className="mt-8">
        <div className="flex flex-wrap items-baseline justify-between gap-2 border-b-2 border-ink pb-2">
          <h2 id="summary-title" className="text-title font-semibold">Residents</h2>
          <Eyebrow>
            {counts.residents} residents · {counts.discretion} with discretion · {counts.edits} reviewed-score edits · {counts.ihgRecipients} IHG recipients · {counts.auxEdits} AUX edits · {counts.flatEdits} flat edits
          </Eyebrow>
        </div>
        {editing === null ? (
          <p className="py-3 text-body text-muted">Nothing to show yet.</p>
        ) : shown.length === 0 ? (
          <p className="py-3 text-body text-muted">No resident matches &ldquo;{search.trim()}&rdquo;.</p>
        ) : (
          <SummaryTable
            rows={shown}
            editing={editing}
            auxCap={state.config.auxCap}
            locked={state.finalised !== null}
            dispatch={dispatch}
            expanded={expanded}
            discretionOpen={discretionOpen}
            onToggleExpanded={(matric) => setExpanded(toggled(expanded, matric))}
            onToggleDiscretion={(matric) => setDiscretionOpen(toggled(discretionOpen, matric))}
          />
        )}
      </section>
      {editing !== null && <AuxLog log={review.auxLog} nameOf={(matric) => rows.find((r) => r.matric === matric)?.name ?? matric} />}
    </main>
  )
}
