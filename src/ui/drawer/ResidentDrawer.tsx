import { ChevronDown, ChevronUp, X } from 'lucide-react'
import { useEffect, useRef, type KeyboardEvent, type ReactNode } from 'react'
import type { Lists, PenaltyKey, PenaltyState, PipelineInput, ScenarioConfig } from '../../engine'
import { Chip, Eyebrow, StatusChip } from '../common/controls'
import { LIST_TITLES, POINTS_DECIMALS } from '../export/exportCsv'
import { BiddingBuild, StayingBuild } from './BuildTables'
import { drawerInputs, findResult, placements } from './drawerData'
import { MembershipTable } from './MembershipTable'

interface ResidentDrawerProps {
  readonly matric: string | null
  /** Matrics of the current list, in display order, for ↑/↓. */
  readonly order: readonly string[]
  readonly lists: Lists
  readonly input: PipelineInput | undefined
  readonly config: ScenarioConfig
  readonly penalty: PenaltyState | undefined
  readonly onNavigate: (matric: string) => void
  readonly onClose: () => void
  readonly onDropRole: ((key: PenaltyKey) => void) | null
}

function Block({ title, children }: { readonly title: string; readonly children: ReactNode }) {
  return (
    <section className="mt-6">
      <h3 className="mb-1.5 border-b-2 border-ink pb-1 text-ui font-semibold">{title}</h3>
      {children}
    </section>
  )
}

function Total({ label, value }: { readonly label: string; readonly value: number }) {
  return (
    <div>
      <Eyebrow>{label}</Eyebrow>
      <div className="num text-display font-medium">{value.toFixed(POINTS_DECIMALS)}</div>
    </div>
  )
}

/** Right-side modal drawer: focus is trapped, Esc closes, ↑/↓ steps through the list. */
export function ResidentDrawer(props: ResidentDrawerProps) {
  const { matric, order, lists, input, config, penalty, onNavigate, onClose, onDropRole } = props
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (matric !== null && !dialog.open) dialog.showModal()
    if (matric === null && dialog.open) dialog.close()
  }, [matric])

  const step = (delta: number): void => {
    const index = matric === null ? -1 : order.indexOf(matric)
    const next = order[index + delta]
    if (index >= 0 && next !== undefined) onNavigate(next)
  }
  const onKey = (event: KeyboardEvent<HTMLDialogElement>): void => {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return
    event.preventDefault()
    step(event.key === 'ArrowDown' ? 1 : -1)
  }

  const result = matric === null ? undefined : findResult(lists, matric)
  const inputs = drawerInputs(input, matric ?? '')
  const resident = inputs.resident
  return (
    <dialog
      ref={ref}
      aria-label={resident ? `Breakdown for ${resident.name}` : 'Resident breakdown'}
      onKeyDown={onKey}
      onCancel={(event) => {
        event.preventDefault()
        onClose()
      }}
      className="fixed inset-y-0 right-0 left-auto m-0 h-full max-h-full w-[min(520px,100vw)] max-w-full border-l border-rule bg-paper p-0 text-ink shadow-2xl"
    >
      {result && matric !== null && (
        <div className="flex h-full flex-col">
          <header className="border-b border-rule px-5 pt-1 pb-4">
            <div className="h-1 bg-raffles" />
            <div className="mt-3 flex items-start gap-2">
              <div className="min-w-0 flex-1">
                <h2 className="text-title font-semibold">{resident?.name ?? matric}</h2>
                <div className="mt-0.5 flex items-center gap-2 text-body text-muted">
                  <span className="font-mono">{matric}</span>
                  <span>· {resident?.gender === 'F' ? 'Female' : resident?.gender === 'M' ? 'Male' : '—'}</span>
                  {resident?.sem2 && <Chip tone="gold">sem-2</Chip>}
                </div>
              </div>
              <button type="button" aria-label="Previous resident (↑)" title="Previous resident (↑)" onClick={() => step(-1)} className="motion rounded-[3px] p-1.5 text-muted hover:bg-ink/5 hover:text-ink"><ChevronUp aria-hidden size={16} /></button>
              <button type="button" aria-label="Next resident (↓)" title="Next resident (↓)" onClick={() => step(1)} className="motion rounded-[3px] p-1.5 text-muted hover:bg-ink/5 hover:text-ink"><ChevronDown aria-hidden size={16} /></button>
              <button type="button" autoFocus aria-label="Close (Esc)" onClick={onClose} className="motion rounded-[3px] p-1.5 text-muted hover:bg-ink/5 hover:text-ink"><X aria-hidden size={16} /></button>
            </div>
            <div className="mt-3 flex gap-10">
              <Total label="Staying" value={result.staying.points} />
              <Total label="Bidding" value={result.bidding.points} />
            </div>
            {(result.jcrc || result.discretion) && (
              <div className="mt-3 space-y-0.5 text-body text-muted">
                {result.jcrc && <p>{result.jcrc.note}</p>}
                {result.discretion && <p>{result.discretion.text}</p>}
              </div>
            )}
            <ul className="mt-3 space-y-1">
              {placements(lists, matric).map(({ list, row }) => (
                <li key={list} className="flex flex-wrap items-center gap-2 text-body">
                  <span className="w-28 text-muted">{LIST_TITLES[list]}</span>
                  <span className="num w-10 text-right">#{row.rank}</span>
                  <StatusChip status={row.status} />
                  {row.tieFlags.map((f) => <Chip key={f.boundary} tone="gold">TIE {f.boundary} · {f.k} of {f.n}</Chip>)}
                  {row.labels.map((label) => <Chip key={label} tone="outline">{label}</Chip>)}
                </li>
              ))}
            </ul>
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-8">
            <Block title="CCAs">
              <MembershipTable result={result} inputs={inputs} penalty={penalty} onDropRole={onDropRole} />
            </Block>
            <Block title="How staying was built">
              <StayingBuild result={result} inputs={inputs} config={config} />
            </Block>
            <Block title="How bidding was built">
              <BiddingBuild result={result} inputs={inputs} config={config} />
            </Block>
            <Block title="Warnings">
              {result.warnings.length === 0 ? (
                <p className="text-body text-muted">None.</p>
              ) : (
                <ul className="list-disc pl-5 text-body">{result.warnings.map((w, i) => <li key={`${w.code}-${i}`}>{w.message}</li>)}</ul>
              )}
            </Block>
          </div>
        </div>
      )}
    </dialog>
  )
}
