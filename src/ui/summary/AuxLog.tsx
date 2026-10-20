import type { AuxLogEntry } from '../../import'
import { localTime } from '../checklist/ChecklistScreen'
import { Eyebrow } from '../common/controls'

/** Every AUX count edit and removal, newest first. No reviewer is recorded. */
export function AuxLog({ log, nameOf }: { readonly log: readonly AuxLogEntry[]; readonly nameOf: (matric: string) => string }) {
  const lines = log
    .map((line, order) => ({ line, order }))
    .sort((a, b) => b.line.at.localeCompare(a.line.at) || b.order - a.order)
    .map((t) => t.line)
  return (
    <details className="mt-10">
      <summary className="flex cursor-pointer flex-wrap items-baseline justify-between gap-2 border-b-2 border-ink pb-2 text-title font-semibold">
        AUX log
        <Eyebrow>
          <span className="num">{lines.length}</span> {lines.length === 1 ? 'line' : 'lines'}
        </Eyebrow>
      </summary>
      {lines.length === 0 ? (
        <p className="py-3 text-body text-muted">No AUX edits yet.</p>
      ) : (
        <table className="w-full border-collapse text-body">
          <thead>
            <tr className="border-b border-rule text-left text-cap font-semibold text-muted">
              <th scope="col" className="py-2 pr-3">Resident</th>
              <th scope="col" className="py-2 pr-3">Change</th>
              <th scope="col" className="py-2 pr-3">Reason</th>
              <th scope="col" className="py-2">Time</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line, i) => (
              <tr key={`${line.at}-${line.matric}-${i}`} className="border-b border-rule">
                <td className="py-1.5 pr-3">
                  {nameOf(line.matric)} <span className="font-mono text-cap text-muted">{line.matric}</span>
                </td>
                <td className="num py-1.5 pr-3">
                  {line.from} → {line.to}
                  {line.kind === 'remove' && <span className="ml-1.5 font-sans text-cap text-muted">(edit removed)</span>}
                </td>
                <td className="py-1.5 pr-3 text-muted">{line.reason || '—'}</td>
                <td className="num py-1.5 text-cap text-muted">{localTime(line.at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </details>
  )
}
