import { useState } from 'react'
import { Button } from '../common/controls'
import type { Scenario } from '../state/scenarios'

interface ScenarioRowProps {
  readonly scenario: Scenario
  readonly isCurrent: boolean
  readonly loadBlockedReason: string | null
  readonly needsLoadConfirm: boolean
  readonly onLoad: () => void
  readonly onRename: (name: string) => void
  readonly onDuplicate: () => void
  readonly onExport: () => void
  readonly onDelete: () => void
}

type Mode = 'idle' | 'rename' | 'confirmLoad' | 'confirmDelete'

const savedOn = (iso: string): string => (iso ? new Date(iso).toLocaleString() : '')

export function ScenarioRow(props: ScenarioRowProps) {
  const { scenario, isCurrent, loadBlockedReason, needsLoadConfirm } = props
  const [mode, setMode] = useState<Mode>('idle')
  const [draft, setDraft] = useState(scenario.name)
  const load = (): void => (needsLoadConfirm ? setMode('confirmLoad') : props.onLoad())
  return (
    <li className="border-b border-rule py-2.5">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          {mode === 'rename' ? (
            <form
              className="flex gap-2"
              onSubmit={(event) => {
                event.preventDefault()
                if (draft.trim()) props.onRename(draft.trim())
                setMode('idle')
              }}
            >
              <input autoFocus aria-label="Scenario name" value={draft} onChange={(e) => setDraft(e.target.value)} className="h-7 min-w-0 flex-1 rounded-[3px] border border-ink/20 bg-card px-2 text-body" />
              <Button small type="submit" variant="primary">Save</Button>
              <Button small onClick={() => setMode('idle')}>Cancel</Button>
            </form>
          ) : (
            <div className="flex items-center gap-2">
              <span className="font-medium">{scenario.name}</span>
              {isCurrent && <span className="text-cap text-ok">· matches current settings</span>}
            </div>
          )}
          {scenario.note && <p className="text-body text-muted">{scenario.note}</p>}
          <p className="text-cap text-muted">Saved {savedOn(scenario.savedAt)}</p>
        </div>
        {mode === 'idle' && (
          <div className="flex shrink-0 flex-wrap justify-end gap-1">
            <Button small variant="primary" disabled={loadBlockedReason !== null} title={loadBlockedReason ?? undefined} onClick={load}>Load</Button>
            <Button small variant="ghost" onClick={() => setMode('rename')}>Rename</Button>
            <Button small variant="ghost" onClick={props.onDuplicate}>Duplicate</Button>
            <Button small variant="ghost" onClick={props.onExport}>Export</Button>
            <Button small variant="ghost" onClick={() => setMode('confirmDelete')}>Delete</Button>
          </div>
        )}
      </div>
      {mode === 'confirmLoad' && (
        <div role="alert" className="mt-2 flex items-center gap-2 border-l-4 border-gold bg-gold-soft px-3 py-2 text-body">
          <span className="flex-1">The current settings are not saved as a scenario. Load “{scenario.name}” anyway?</span>
          <Button small variant="primary" onClick={() => { props.onLoad(); setMode('idle') }}>Load anyway</Button>
          <Button small onClick={() => setMode('idle')}>Cancel</Button>
        </div>
      )}
      {mode === 'confirmDelete' && (
        <div role="alert" className="mt-2 flex items-center gap-2 border-l-4 border-error bg-error-bg px-3 py-2 text-body">
          <span className="flex-1">Delete “{scenario.name}”? This cannot be undone.</span>
          <Button small variant="danger" onClick={props.onDelete}>Delete</Button>
          <Button small onClick={() => setMode('idle')}>Cancel</Button>
        </div>
      )}
    </li>
  )
}
