import { Lock } from 'lucide-react'
import { useState } from 'react'
import { MAX_REASON_LENGTH, type Discretion, type FinalOverride, type PipelineInput } from '../../engine'
import { Button } from '../common/controls'
import { discretionFromDraft, discretionSummary, overrideFromDraft } from './editorState'

/** The JCRC adjustments the drawer can make, and whether they are locked (finalised). */
export interface DrawerEditing {
  readonly locked: boolean
  readonly input: PipelineInput
  readonly overrides: readonly FinalOverride[]
  readonly discretion: readonly Discretion[]
  readonly setOverride: (entry: FinalOverride) => void
  readonly removeOverride: (matric: string, ccaID: string) => void
  readonly setDiscretion: (entry: Discretion) => void
  readonly removeDiscretion: (matric: string) => void
}

const inputClass = 'motion h-8 rounded-[3px] border border-ink/20 bg-card px-2 text-body hover:border-ink/50'

function ReasonInput({ value, onChange }: { readonly value: string; readonly onChange: (v: string) => void }) {
  return (
    <label className="flex min-w-0 flex-1 flex-col text-cap text-muted">
      Reason (required)
      <input value={value} maxLength={MAX_REASON_LENGTH} onChange={(e) => onChange(e.target.value)} className={`${inputClass} text-ink`} />
    </label>
  )
}

/** Inline editor for one membership's final points (spec 6.2). */
export function FinalPointsEditor({ matric, ccaID, editing, onDone }: {
  readonly matric: string
  readonly ccaID: string
  readonly editing: DrawerEditing
  readonly onDone: () => void
}) {
  const current = editing.overrides.find((o) => o.matric === matric && o.ccaID === ccaID)
  const [points, setPoints] = useState(current ? String(current.finalPoints) : '')
  const [reason, setReason] = useState(current?.reason ?? '')
  const [error, setError] = useState<string | null>(null)
  const save = (): void => {
    const result = overrideFromDraft(editing.input, { matric, ccaID }, points, reason)
    if (!result.ok) return setError(result.message)
    editing.setOverride(result.entry)
    onDone()
  }
  return (
    <div className="mt-1.5 rounded-[3px] border border-rule bg-paper p-2">
      <div className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col text-cap text-muted">
          Final points
          <input type="number" inputMode="decimal" value={points} onChange={(e) => setPoints(e.target.value)} className={`${inputClass} w-24 text-right text-ink`} />
        </label>
        <ReasonInput value={reason} onChange={setReason} />
      </div>
      {error && <p role="alert" className="mt-1 text-cap text-error">{error}</p>}
      <div className="mt-2 flex gap-2">
        <Button small variant="primary" onClick={save}>Save</Button>
        {current && <Button small variant="danger" onClick={() => { editing.removeOverride(matric, ccaID); onDone() }}>Remove</Button>}
        <Button small variant="ghost" onClick={onDone}>Cancel</Button>
      </div>
    </div>
  )
}

/** Per-resident ± adjustment applied last (spec 6.3). "Same for both" is on by default. */
export function DiscretionEditor({ matric, editing }: { readonly matric: string; readonly editing: DrawerEditing }) {
  const current = editing.discretion.find((d) => d.matric === matric)
  const [staying, setStaying] = useState(current ? String(current.stayingDelta) : '')
  const [bidding, setBidding] = useState(current ? String(current.biddingDelta) : '')
  const [same, setSame] = useState(current ? current.stayingDelta === current.biddingDelta : true)
  const [reason, setReason] = useState(current?.reason ?? '')
  const [error, setError] = useState<string | null>(null)
  if (editing.locked) {
    return (
      <p className="flex items-center gap-1.5 text-body text-muted">
        <Lock aria-hidden size={13} /> {current ? discretionSummary(current) : 'None.'} Locked while finalised.
      </p>
    )
  }
  const save = (): void => {
    const result = discretionFromDraft(editing.input, matric, { staying, bidding, same, reason })
    if (!result.ok) return setError(result.message)
    setError(null)
    editing.setDiscretion(result.entry)
  }
  return (
    <div>
      {current && <p className="mb-2 text-body font-medium">{discretionSummary(current)}</p>}
      <div className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col text-cap text-muted">
          Staying change
          <input type="number" inputMode="decimal" value={staying} onChange={(e) => setStaying(e.target.value)} placeholder="e.g. 2" className={`${inputClass} w-24 text-right text-ink`} />
        </label>
        <label className="flex flex-col text-cap text-muted">
          Bidding change
          <input type="number" inputMode="decimal" disabled={same} value={same ? staying : bidding} onChange={(e) => setBidding(e.target.value)} placeholder="e.g. -1" className={`${inputClass} w-24 text-right text-ink disabled:opacity-50`} />
        </label>
        <label className="flex h-8 items-center gap-1.5 text-body">
          <input type="checkbox" checked={same} onChange={(e) => setSame(e.target.checked)} className="accent-raffles" /> Same for both
        </label>
      </div>
      <div className="mt-2 flex"><ReasonInput value={reason} onChange={setReason} /></div>
      {error && <p role="alert" className="mt-1 text-cap text-error">{error}</p>}
      <div className="mt-2 flex gap-2">
        <Button small variant="primary" onClick={save}>{current ? 'Update' : 'Save'}</Button>
        {current && <Button small variant="danger" onClick={() => editing.removeDiscretion(matric)}>Remove</Button>}
      </div>
    </div>
  )
}
