import { AlertTriangle, CheckCircle2, XCircle } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { Issue } from '../../import'
import { Chip } from '../common/controls'

type Filter = 'all' | 'error' | 'warning'

const FILTERS: readonly { value: Filter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'error', label: 'Errors' },
  { value: 'warning', label: 'Warnings' },
]

const GENERAL = 'General'

function groupByFile(issues: readonly Issue[]): [string, Issue[]][] {
  const groups = new Map<string, Issue[]>()
  for (const issue of issues) {
    const key = issue.fileName === '' ? GENERAL : issue.fileName
    groups.set(key, [...(groups.get(key) ?? []), issue])
  }
  const errorsFirst = (list: readonly Issue[]): number => (list.some((i) => i.severity === 'error') ? 0 : 1)
  return [...groups.entries()].sort(([a, x], [b, y]) => errorsFirst(x) - errorsFirst(y) || a.localeCompare(b))
}

const bySeverity = (a: Issue, b: Issue): number =>
  (a.severity === 'error' ? 0 : 1) - (b.severity === 'error' ? 0 : 1)

function IssueItem({ issue }: { readonly issue: Issue }) {
  const isError = issue.severity === 'error'
  const Icon = isError ? XCircle : AlertTriangle
  const hint = !isError
    ? null
    : issue.overridden
      ? 'Overridden — listed on every export.'
      : issue.overridable
        ? 'You can override this in the mean and SD table below.'
        : 'Fix the file and drop it again.'
  return (
    <li className="flex gap-2 py-2">
      <Icon aria-hidden size={15} className={`mt-0.5 shrink-0 ${isError && !issue.overridden ? 'text-error' : 'text-warning'}`} />
      <div className="min-w-0">
        <p className="text-body break-words">{issue.message}</p>
        {hint && <p className="mt-0.5 text-cap text-muted">{hint}</p>}
      </div>
    </li>
  )
}

export function IssuesPanel({ issues }: { readonly issues: readonly Issue[] }) {
  const [filter, setFilter] = useState<Filter>('all')
  const errors = issues.filter((i) => i.severity === 'error' && !i.overridden).length
  const warnings = issues.filter((i) => i.severity === 'warning').length
  const groups = useMemo(
    () => groupByFile(issues.filter((i) => filter === 'all' || i.severity === filter)),
    [issues, filter],
  )
  return (
    <section aria-labelledby="issues-title" className="flex min-h-0 flex-col">
      <div className="flex items-center gap-3 border-b-2 border-ink pb-2">
        <h2 id="issues-title" className="text-title font-semibold">
          Issues
        </h2>
        <Chip tone={errors > 0 ? 'error' : 'grey'}>{errors} errors</Chip>
        <Chip tone={warnings > 0 ? 'warning' : 'grey'}>{warnings} warnings</Chip>
        <div role="radiogroup" aria-label="Show" className="ml-auto flex rounded-[3px] border border-rule bg-card p-0.5">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              role="radio"
              aria-checked={filter === f.value}
              onClick={() => setFilter(f.value)}
              className={`motion rounded-[2px] px-2 py-0.5 text-cap font-medium ${
                filter === f.value ? 'bg-ink text-paper' : 'text-muted hover:text-ink'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>
      {groups.length === 0 ? (
        <p className="flex items-center gap-2 py-4 text-body text-ok">
          <CheckCircle2 aria-hidden size={16} />
          {issues.length === 0 ? 'No issues found.' : 'Nothing in this filter.'}
        </p>
      ) : (
        <div className="max-h-[440px] overflow-y-auto pr-1">
          {groups.map(([file, list]) => (
            <div key={file} className="border-b border-rule py-2 last:border-b-0">
              <h3 className="font-mono text-cap font-medium text-muted">{file}</h3>
              <ul className="divide-y divide-rule/60">
                {[...list].sort(bySeverity).map((issue, i) => (
                  <IssueItem key={`${issue.code}-${issue.line ?? ''}-${i}`} issue={issue} />
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
