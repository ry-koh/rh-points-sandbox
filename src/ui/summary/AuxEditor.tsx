import { useState, type Dispatch, type KeyboardEvent } from 'react'
import { MAX_REASON_LENGTH } from '../../engine'
import { Button } from '../common/controls'
import type { Action } from '../state/store'
import { auxAction } from './auxAction'

interface AuxEditorProps {
  readonly matric: string
  /** The count in use now. */
  readonly aux: number
  /** residents.csv's count. */
  readonly auxFile: number
  readonly hasEdit: boolean
  readonly dispatch: Dispatch<Action>
  readonly onDone: () => void
}

const inputClass = 'motion h-8 rounded-[3px] border border-ink/20 bg-card px-2 text-body text-ink hover:border-ink/50'

/** Inline editor for one resident's AUX count: a whole number of 0 or more and an optional reason. */
export function AuxEditor({ matric, aux, auxFile, hasEdit, dispatch, onDone }: AuxEditorProps) {
  const [count, setCount] = useState(String(aux))
  const [reason, setReason] = useState('')
  const [problem, setProblem] = useState<string | null>(null)
  const save = (): void => {
    const result = auxAction({ matric, fileValue: auxFile, to: count, reason, hasEdit, at: new Date().toISOString() })
    if (result.problem) return setProblem(result.problem)
    if (result.action) dispatch(result.action)
    onDone()
  }
  const backToFile = (): void => {
    dispatch({ type: 'removeAuxEdit', matric, at: new Date().toISOString() })
    onDone()
  }
  const onKeyDown = (event: KeyboardEvent): void => {
    if (event.key === 'Enter') {
      event.preventDefault()
      save()
    } else if (event.key === 'Escape') {
      event.preventDefault()
      onDone()
    }
  }
  return (
    <div className="mt-1.5 rounded-[3px] border border-rule bg-paper p-2 text-left" onKeyDown={onKeyDown}>
      <div className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col text-cap text-muted">
          AUX count
          <input
            autoFocus
            type="number"
            inputMode="numeric"
            min={0}
            step={1}
            value={count}
            onChange={(e) => setCount(e.target.value)}
            className={`${inputClass} w-20 text-right`}
          />
        </label>
        <label className="flex min-w-40 flex-1 flex-col text-cap text-muted">
          Reason (optional)
          <input value={reason} maxLength={MAX_REASON_LENGTH} onChange={(e) => setReason(e.target.value)} className={inputClass} />
        </label>
      </div>
      <p className="mt-1 text-cap text-muted">residents.csv says {auxFile}.</p>
      {problem && <p role="alert" className="mt-1 text-cap text-error">{problem}</p>}
      <div className="mt-2 flex gap-2">
        <Button small variant="primary" onClick={save}>Save</Button>
        {hasEdit && <Button small variant="danger" onClick={backToFile}>Back to file value</Button>}
        <Button small variant="ghost" onClick={onDone}>Cancel</Button>
      </div>
    </div>
  )
}
