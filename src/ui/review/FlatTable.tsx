import { TriangleAlert } from 'lucide-react'
import { useEffect, useState, type KeyboardEvent } from 'react'
import { MAX_REASON_LENGTH } from '../../engine'
import type { CheckedFlatEdit, FlatMemberRow } from '../../import'
import { Chip } from '../common/controls'

export interface FlatLineData {
  readonly member: FlatMemberRow
  /** This member's flat edit as last judged; null when it has none. */
  readonly edit: CheckedFlatEdit | null
  readonly hasFinalOverride: boolean
}

interface FlatTableProps {
  readonly rows: readonly FlatLineData[]
  readonly locked: boolean
  /** Stores (or reverts) a member's value; returns the problem in words, or null. */
  readonly onSave: (member: FlatMemberRow, value: string, reason: string) => string | null
}

const FLAT_ATTR = 'data-flat-index'

const focusFlat = (index: number): void => {
  document.querySelector<HTMLInputElement>(`[${FLAT_ATTR}="${index}"]`)?.focus()
}

function FlatLine({ row, index, locked, onSave }: {
  readonly row: FlatLineData
  readonly index: number
  readonly locked: boolean
  readonly onSave: FlatTableProps['onSave']
}) {
  const { member, edit } = row
  const applied = edit?.status === 'applied' ? edit.entry : null
  const storedValue = String(member.value)
  const storedReason = applied?.reason ?? ''
  const [value, setValue] = useState(storedValue)
  const [reason, setReason] = useState(storedReason)
  const [problem, setProblem] = useState<string | null>(null)
  useEffect(() => {
    setValue(storedValue)
    setReason(storedReason)
    setProblem(null)
  }, [storedValue, storedReason])
  const dirty = value !== storedValue || reason !== storedReason
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === 'Enter') {
      event.preventDefault()
      const found = dirty ? onSave(member, value, reason) : null
      setProblem(found)
      if (found === null) focusFlat(index + 1)
    }
    if (event.key === 'Escape') {
      setValue(storedValue)
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
      <td className="num py-1.5 pr-3 text-right text-muted">{member.fileValue}</td>
      <td className="py-1.5 pr-3">
        <input
          type="number"
          inputMode="decimal"
          min={0}
          step="any"
          value={value}
          disabled={locked}
          aria-label={`Flat value for ${member.name}`}
          aria-invalid={problem !== null}
          data-flat-index={index}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={onKeyDown}
          onFocus={(event) => event.target.select()}
          className={`motion h-8 w-20 rounded-[3px] border bg-card px-2 text-right text-ui disabled:opacity-60 ${
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
          placeholder={applied || value !== storedValue ? 'Reason (optional)' : ''}
          aria-label={`Reason for ${member.name}'s flat value`}
          onChange={(event) => setReason(event.target.value)}
          onKeyDown={onKeyDown}
          className="motion h-8 w-full min-w-40 rounded-[3px] border border-ink/20 bg-card px-2 text-body hover:border-ink/50 disabled:opacity-60"
        />
        {dirty && !problem && <p className="mt-0.5 text-cap text-muted">Enter saves · Esc cancels</p>}
        {problem && <p role="alert" className="mt-0.5 text-cap text-error">{problem}</p>}
        {changed && edit && (
          <p className="mt-0.5 flex items-center gap-1 text-cap text-warning">
            <TriangleAlert aria-hidden size={12} /> Edit to {edit.entry.to} not applied: the RH-app value changed ({edit.entry.from} → {edit.current}).
          </p>
        )}
      </td>
      <td className="py-1.5">{row.hasFinalOverride && <Chip tone="gold">final points set on Results — wins over this value</Chip>}</td>
    </tr>
  )
}

/** A flat CCA's members: each member's value can be changed (the CCA's own flat value is set in RH-app). */
export function FlatTable({ rows, locked, onSave }: FlatTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[760px] border-collapse text-body">
        <thead>
          <tr className="border-b border-rule text-left text-cap font-semibold text-muted">
            <th scope="col" className="py-2 pr-3">Member</th>
            <th scope="col" className="py-2 pr-3 text-right" title="The value in the RH-app bundle">RH-app value</th>
            <th scope="col" className="py-2 pr-3">Value</th>
            <th scope="col" className="py-2 pr-3">Reason</th>
            <th scope="col" className="py-2"><span className="sr-only">Notes</span></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <FlatLine key={row.member.matric} row={row} index={i} locked={locked} onSave={onSave} />
          ))}
        </tbody>
      </table>
    </div>
  )
}
