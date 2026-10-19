import { Check, TriangleAlert } from 'lucide-react'
import { useEffect, useState, type KeyboardEvent } from 'react'
import { BASE_POINTS_MAX, BASE_POINTS_MIN, MAX_REASON_LENGTH } from '../../engine'
import type { CheckedReviewEdit, LeaderRow } from '../../import'
import { Chip } from '../common/controls'
import { roleLabel } from '../drawer/drawerData'

export interface ScoreRow {
  readonly member: LeaderRow
  /** This membership's edit as last judged; null when it has none. */
  readonly edit: CheckedReviewEdit | null
  readonly hasFinalOverride: boolean
}

interface ScoreTableProps {
  readonly rows: readonly ScoreRow[]
  readonly isSport: boolean
  readonly locked: boolean
  /** Stores (or reverts) a reviewed score; returns the problem in words, or null. */
  readonly onSave: (member: LeaderRow, score: string, reason: string) => string | null
}

const SCORE_ATTR = 'data-score-index'

const focusScore = (index: number): void => {
  document.querySelector<HTMLInputElement>(`[${SCORE_ATTR}="${index}"]`)?.focus()
}

function ScoreLine({ row, index, isSport, locked, onSave }: {
  readonly row: ScoreRow
  readonly index: number
  readonly isSport: boolean
  readonly locked: boolean
  readonly onSave: ScoreTableProps['onSave']
}) {
  const { member, edit } = row
  const applied = edit?.status === 'applied' ? edit.entry : null
  const storedScore = String(applied?.to ?? member.basePoints)
  const storedReason = applied?.reason ?? ''
  const [score, setScore] = useState(storedScore)
  const [reason, setReason] = useState(storedReason)
  const [problem, setProblem] = useState<string | null>(null)
  useEffect(() => {
    setScore(storedScore)
    setReason(storedReason)
    setProblem(null)
  }, [storedScore, storedReason])
  const dirty = score !== storedScore || reason !== storedReason
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === 'Enter') {
      event.preventDefault()
      const found = dirty ? onSave(member, score, reason) : null
      setProblem(found)
      if (found === null) focusScore(index + 1)
    }
    if (event.key === 'Escape') {
      setScore(storedScore)
      setReason(storedReason)
      setProblem(null)
    }
  }
  const changed = edit?.status === 'changed'
  return (
    <tr className={`border-b border-rule align-top ${applied ? 'bg-gold-soft/50' : 'hover:bg-ink/[0.03]'}`}>
      <td className="py-1.5 pr-3">
        <div className="font-medium">{member.name}</div>
        <div className="font-mono text-cap text-muted">{member.matric}</div>
      </td>
      <td className="num py-1.5 pr-3 text-right text-muted">{member.basePoints}</td>
      <td className="py-1.5 pr-3">
        <input
          type="number"
          inputMode="numeric"
          min={BASE_POINTS_MIN}
          max={BASE_POINTS_MAX}
          step={1}
          value={score}
          disabled={locked}
          aria-label={`Reviewed score for ${member.name}`}
          aria-invalid={problem !== null}
          data-score-index={index}
          onChange={(event) => setScore(event.target.value)}
          onKeyDown={onKeyDown}
          onFocus={(event) => event.target.select()}
          className={`motion h-8 w-16 rounded-[3px] border bg-card px-2 text-right text-ui disabled:opacity-60 ${
            problem ? 'border-error' : applied ? 'border-gold' : 'border-ink/20 hover:border-ink/50'
          }`}
        />
      </td>
      <td className="py-1.5 pr-3">
        <input
          type="text"
          value={reason}
          maxLength={MAX_REASON_LENGTH}
          disabled={locked}
          placeholder={applied || score !== storedScore ? 'Reason (optional)' : ''}
          aria-label={`Reason for ${member.name}'s score`}
          onChange={(event) => setReason(event.target.value)}
          onKeyDown={onKeyDown}
          className="motion h-8 w-full min-w-40 rounded-[3px] border border-ink/20 bg-card px-2 text-body hover:border-ink/50 disabled:opacity-60"
        />
        {dirty && !problem && <p className="mt-0.5 text-cap text-muted">Enter saves · Esc cancels</p>}
        {problem && <p role="alert" className="mt-0.5 text-cap text-error">{problem}</p>}
        {changed && edit && (
          <p className="mt-0.5 flex items-center gap-1 text-cap text-warning">
            <TriangleAlert aria-hidden size={12} /> Edit to {edit.entry.to} not applied: the file changed ({edit.entry.from} → {edit.fileValue}).
          </p>
        )}
      </td>
      <td className="num py-1.5 pr-3 text-body">
        {roleLabel(member.outgoingRole)} / {roleLabel(member.incomingRole)}
      </td>
      <td className="py-1.5 pr-3 text-body">{member.semesterOnly ? 'Yes' : <span className="text-muted">—</span>}</td>
      {isSport && (
        <td className="py-1.5 pr-3">
          {member.ihg ? <Check aria-label="Ticked for IHG" size={15} className="text-ok" /> : <span className="text-muted">—</span>}
        </td>
      )}
      <td className="py-1.5">{row.hasFinalOverride && <Chip tone="gold">final points set on Results</Chip>}</td>
    </tr>
  )
}

/** The leader file's members: the reviewed score is the only editable value (spec 6.4). */
export function ScoreTable({ rows, isSport, locked, onSave }: ScoreTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[880px] border-collapse text-body">
        <thead>
          <tr className="border-b border-rule text-left text-cap font-semibold text-muted">
            <th scope="col" className="py-2 pr-3">Member</th>
            <th scope="col" className="py-2 pr-3 text-right" title="The leader file's score">File</th>
            <th scope="col" className="py-2 pr-3">Reviewed</th>
            <th scope="col" className="py-2 pr-3">Reason</th>
            <th scope="col" className="py-2 pr-3" title="Outgoing / incoming role">Out / In</th>
            <th scope="col" className="py-2 pr-3" title="Semester-only">Sem</th>
            {isSport && <th scope="col" className="py-2 pr-3" title="Ticked for IHG points in the RH app">IHG</th>}
            <th scope="col" className="py-2"><span className="sr-only">Notes</span></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <ScoreLine key={row.member.matric} row={row} index={i} isSport={isSport} locked={locked} onSave={onSave} />
          ))}
        </tbody>
      </table>
    </div>
  )
}
