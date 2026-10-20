import { Download, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { compareRuns, type ScenarioConfig } from '../../engine'
import { Button } from '../common/controls'
import { LIST_KEYS, LIST_TITLES, downloadCsv, entryCounts, exportStamp, type ListKey } from '../export/exportCsv'
import { ListTabs, panelId, tabId } from '../results/ListTabs'
import type { Scenario } from '../state/scenarios'
import { sandboxInputOf } from '../../workspace'
import { entryOptions, type AppState } from '../state/store'
import { CURRENT, buildComparisonCsv, configDifferences, runSide } from './compareData'
import { CompareTable, sortRows } from './CompareTable'

interface CompareScreenProps {
  readonly state: AppState
  readonly scenarios: readonly Scenario[]
}

function SidePicker({ label, value, scenarios, onChange }: { readonly label: string; readonly value: string; readonly scenarios: readonly Scenario[]; readonly onChange: (v: string) => void }) {
  return (
    <label className="flex items-center gap-2 text-body">
      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-ink text-cap font-semibold text-paper">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="motion h-9 rounded-[3px] border border-ink/20 bg-card px-2 text-body hover:border-ink/50">
        <option value={CURRENT}>Current settings</option>
        {scenarios.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
      </select>
    </label>
  )
}

/** Runs two settings side by side on the same imported files; never touches live results. */
export function CompareScreen({ state, scenarios }: CompareScreenProps) {
  const [sideA, setSideA] = useState(CURRENT)
  const [sideB, setSideB] = useState(scenarios[0]?.id ?? CURRENT)
  const [active, setActive] = useState<ListKey>('maleStaying')
  const [changedOnly, setChangedOnly] = useState(true)
  const [search, setSearch] = useState('')
  const configOf = (id: string): ScenarioConfig => scenarios.find((s) => s.id === id)?.config ?? state.config
  const labelOf = (id: string): string => scenarios.find((s) => s.id === id)?.name ?? 'Current settings'
  const configA = configOf(sideA)
  const configB = configOf(sideB)
  const { finalOverrides, discretion, resolutions } = state
  const entries = useMemo(() => entryOptions({ finalOverrides, discretion, resolutions }), [finalOverrides, discretion, resolutions])
  const { ccaLevels, review } = state
  const sandbox = useMemo(() => sandboxInputOf({ ccaLevels, review }), [ccaLevels, review])
  const runA = useMemo(() => runSide(state.files, configA, entries, sandbox), [state.files, configA, entries, sandbox])
  const runB = useMemo(() => runSide(state.files, configB, entries, sandbox), [state.files, configB, entries, sandbox])
  const comparison = useMemo(() => (runA.ok && runB.ok ? compareRuns(runA.run, runB.run) : null), [runA, runB])
  const diffs = configDifferences(configA, configB)
  const query = search.trim().toLowerCase()
  const rows = comparison
    ? sortRows(comparison[active].rows.filter((r) => (!changedOnly || r.changed) && (query === '' || r.name.toLowerCase().includes(query) || r.matric.toLowerCase().includes(query))))
    : []
  const counts = Object.fromEntries(LIST_KEYS.map((k) => [k, comparison ? comparison[k].rows.filter((r) => r.changed).length : 0])) as Record<ListKey, number>

  return (
    <main className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-wrap items-center gap-4 border-b border-rule px-6 py-4">
        <h1 className="text-display font-semibold tracking-tight">Compare</h1>
        <SidePicker label="A" value={sideA} scenarios={scenarios} onChange={setSideA} />
        <SidePicker label="B" value={sideB} scenarios={scenarios} onChange={setSideB} />
        <Button className="ml-auto" disabled={!comparison} onClick={() => comparison && downloadCsv(`rhps_comparison_${exportStamp(new Date())}.csv`, buildComparisonCsv(comparison, state.report.outOfRange, { a: labelOf(sideA), b: labelOf(sideB) }, entryCounts(null, state.report.review, state.report.perCca), { perCca: state.report.perCca, levels: state.config.levels }))}>
          <Download aria-hidden size={15} /> Export comparison
        </Button>
      </div>
      {!runA.ok && <p role="alert" className="border-b border-error/30 bg-error-bg px-6 py-2 text-body text-error">A: {runA.error}.</p>}
      {!runB.ok && <p role="alert" className="border-b border-error/30 bg-error-bg px-6 py-2 text-body text-error">B: {runB.error}.</p>}
      {comparison && (
        <>
          <ul className="grid grid-cols-1 gap-x-8 border-b border-rule px-6 py-3 text-body lg:grid-cols-2 xl:grid-cols-3">
            {LIST_KEYS.map((key) => (
              <li key={key} className="py-0.5">
                <span className="font-medium">{LIST_TITLES[key]}:</span>{' '}
                <span className="text-muted">
                  {comparison[key].moves.length === 0 ? 'no status changes' : comparison[key].moves.map((m) => `${m.count} ${m.from}→${m.to}`).join(' · ')}
                </span>
              </li>
            ))}
          </ul>
          <details className="border-b border-rule px-6 py-2 text-body">
            <summary className="cursor-pointer font-medium">Settings differences · {diffs.length}</summary>
            {diffs.length === 0 ? <p className="py-1 text-muted">A and B use the same settings.</p> : (
              <table className="mt-1 w-full border-collapse text-cap">
                <thead><tr className="text-left text-muted"><th className="py-1 pr-4">Setting</th><th className="py-1 pr-4">A</th><th className="py-1">B</th></tr></thead>
                <tbody>{diffs.map((d) => <tr key={d.key} className="border-t border-rule/70"><td className="py-1 pr-4 font-mono">{d.key}</td><td className="py-1 pr-4 font-mono break-all">{d.a}</td><td className="py-1 font-mono break-all">{d.b}</td></tr>)}</tbody>
              </table>
            )}
          </details>
          <ListTabs counts={counts} active={active} onChange={setActive} />
          <div className="flex flex-wrap items-center gap-3 px-6 py-3">
            <label className="relative flex items-center">
              <Search aria-hidden size={14} className="pointer-events-none absolute left-2.5 text-muted" />
              <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name or matric" aria-label="Search name or matric" className="motion h-9 w-72 rounded-[3px] border border-ink/20 bg-card pr-2 pl-8 text-body hover:border-ink/50" />
            </label>
            <button type="button" role="switch" aria-checked={changedOnly} onClick={() => setChangedOnly(!changedOnly)} className="motion flex items-center gap-2 rounded-[3px] px-1 text-body hover:bg-ink/5">
              <span className={`motion relative h-5 w-9 rounded-full ${changedOnly ? 'bg-raffles' : 'bg-ink/20'}`}>
                <span className={`motion absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow ${changedOnly ? 'translate-x-4' : ''}`} />
              </span>
              Changed only
            </button>
            <span className="text-cap text-muted">{rows.length} shown · tab counts are changed residents</span>
          </div>
          <div id={panelId} role="tabpanel" aria-labelledby={tabId(active)} className="flex min-h-0 flex-1 flex-col">
            <CompareTable rows={rows} />
          </div>
        </>
      )}
    </main>
  )
}
