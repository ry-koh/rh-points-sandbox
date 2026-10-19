import { useState } from 'react'
import type { ReviewLogEntry } from '../../import'
import { Eyebrow } from '../common/controls'
import { localTime } from '../checklist/ChecklistScreen'

interface EditLogProps {
  readonly log: readonly ReviewLogEntry[]
  readonly selected: string | null
  readonly ccaName: (ccaID: string) => string
  readonly memberName: (matric: string) => string
}

/** Every score edit and removal, newest first; no reviewer is recorded (D5 = B). */
export function EditLog({ log, selected, ccaName, memberName }: EditLogProps) {
  const [onlySelected, setOnlySelected] = useState(true)
  const lines = [...log].reverse().filter((line) => !onlySelected || line.ccaID === selected)
  return (
    <section aria-labelledby="edit-log-title" className="mt-10">
      <div className="flex flex-wrap items-baseline justify-between gap-3 border-b-2 border-ink pb-2">
        <h2 id="edit-log-title" className="text-title font-semibold">
          Edit log
        </h2>
        <div className="flex items-center gap-3">
          <Eyebrow>
            <span className="num">{lines.length} of {log.length}</span>
          </Eyebrow>
          <label className="flex items-center gap-1.5 text-body">
            <input type="checkbox" checked={onlySelected} onChange={(event) => setOnlySelected(event.target.checked)} className="accent-raffles" />
            This CCA only
          </label>
        </div>
      </div>
      {lines.length === 0 ? (
        <p className="py-3 text-body text-muted">No edits{onlySelected ? ' for this CCA' : ''} yet.</p>
      ) : (
        <table className="w-full border-collapse text-body">
          <thead>
            <tr className="border-b border-rule text-left text-cap font-semibold text-muted">
              <th scope="col" className="py-2 pr-3">CCA</th>
              <th scope="col" className="py-2 pr-3">Member</th>
              <th scope="col" className="py-2 pr-3">Score</th>
              <th scope="col" className="py-2 pr-3">Reason</th>
              <th scope="col" className="py-2">Time</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line, i) => (
              <tr key={`${line.at}-${line.matric}-${i}`} className="border-b border-rule">
                <td className="py-1.5 pr-3">{ccaName(line.ccaID)}</td>
                <td className="py-1.5 pr-3">
                  {memberName(line.matric)} <span className="font-mono text-cap text-muted">{line.matric}</span>
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
    </section>
  )
}
