import { FileUp, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { ScenarioConfig } from '../../engine'
import { Button, Eyebrow } from '../common/controls'
import { downloadText } from '../export/exportCsv'
import { differs } from '../settings/fields'
import { parseScenarioFile, serialiseScenario, type Scenario } from '../state/scenarios'
import type { ScenarioStore } from '../state/useScenarios'
import { ScenarioRow } from './ScenarioRow'

interface ScenariosDialogProps {
  readonly open: boolean
  readonly store: ScenarioStore
  readonly config: ScenarioConfig
  readonly locked: boolean
  readonly onLoad: (config: ScenarioConfig) => void
  readonly onClose: () => void
}

const slug = (name: string): string => name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'scenario'

function exportScenario(scenario: Scenario): void {
  downloadText(`rhps_scenario_${slug(scenario.name)}.json`, serialiseScenario(scenario), 'application/json')
}

/** Save, load, rename, duplicate, delete, export and import scenarios (settings only). */
export function ScenariosDialog({ open, store, config, locked, onLoad, onClose }: ScenariosDialogProps) {
  const ref = useRef<HTMLDialogElement>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  const [name, setName] = useState('')
  const [note, setNote] = useState('')
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null)
  useEffect(() => {
    const dialog = ref.current
    if (open && dialog && !dialog.open) dialog.showModal()
    if (!open && dialog?.open) dialog.close()
  }, [open])

  const saved = store.scenarios.some((s) => !differs(s.config, config))
  const importFile = async (file: File | undefined): Promise<void> => {
    if (!file) return
    const parsed = parseScenarioFile(await file.text(), file.name.replace(/\.json$/i, ''))
    if (!parsed.ok) return setMessage({ tone: 'error', text: `${file.name}: ${parsed.error}` })
    store.add(parsed.file.name, parsed.file.note, parsed.file.config)
    setMessage({ tone: 'ok', text: `Imported “${parsed.file.name}”.` })
  }

  return (
    <dialog
      ref={ref}
      aria-labelledby="scenarios-title"
      onCancel={(event) => { event.preventDefault(); onClose() }}
      className="m-auto w-[min(720px,calc(100vw-32px))] rounded-[4px] border border-rule bg-card p-0 text-ink shadow-xl"
    >
      <div className="border-t-4 border-raffles px-5 pt-4 pb-5">
        <div className="flex items-center">
          <h2 id="scenarios-title" className="flex-1 text-title font-semibold">Scenarios</h2>
          <button type="button" aria-label="Close" onClick={onClose} className="motion rounded-[3px] p-1.5 text-muted hover:bg-ink/5 hover:text-ink"><X aria-hidden size={16} /></button>
        </div>
        <p className="text-body text-muted">A scenario stores settings only, never resident data.</p>
        <form
          className="mt-4 grid grid-cols-[1fr_1.4fr_auto] items-end gap-2"
          onSubmit={(event) => {
            event.preventDefault()
            if (!name.trim()) return setMessage({ tone: 'error', text: 'Give the scenario a name first.' })
            store.add(name.trim(), note.trim(), config)
            setMessage({ tone: 'ok', text: `Saved “${name.trim()}”.` })
            setName('')
            setNote('')
          }}
        >
          <label className="text-cap text-muted">Name
            <input value={name} onChange={(e) => setName(e.target.value)} className="mt-0.5 h-9 w-full rounded-[3px] border border-ink/20 bg-card px-2 text-body text-ink" />
          </label>
          <label className="text-cap text-muted">Note (optional)
            <input value={note} onChange={(e) => setNote(e.target.value)} className="mt-0.5 h-9 w-full rounded-[3px] border border-ink/20 bg-card px-2 text-body text-ink" />
          </label>
          <Button type="submit" variant="primary">Save current settings</Button>
        </form>
        {message && <p role="status" className={`mt-2 text-body ${message.tone === 'error' ? 'text-error' : 'text-ok'}`}>{message.text}</p>}
        <div className="mt-5 flex items-center justify-between border-b-2 border-ink pb-1">
          <Eyebrow>Saved · {store.scenarios.length}</Eyebrow>
          <Button small variant="ghost" onClick={() => fileInput.current?.click()}><FileUp aria-hidden size={13} /> Import scenario</Button>
          <input ref={fileInput} type="file" accept=".json,application/json" hidden onChange={(e) => { void importFile(e.target.files?.[0]); e.target.value = '' }} />
        </div>
        {store.scenarios.length === 0 ? (
          <p className="py-4 text-body text-muted">No scenarios yet.</p>
        ) : (
          <ul className="max-h-[50vh] overflow-y-auto">
            {store.scenarios.map((s) => (
              <ScenarioRow
                key={s.id}
                scenario={s}
                isCurrent={!differs(s.config, config)}
                loadBlockedReason={locked ? 'Unlock the finalised lists to load a scenario' : null}
                needsLoadConfirm={!saved}
                onLoad={() => { onLoad(s.config); setMessage({ tone: 'ok', text: `Loaded “${s.name}”.` }) }}
                onRename={(next) => store.rename(s.id, next)}
                onDuplicate={() => store.duplicate(s.id)}
                onExport={() => exportScenario(s)}
                onDelete={() => store.remove(s.id)}
              />
            ))}
          </ul>
        )}
      </div>
    </dialog>
  )
}
