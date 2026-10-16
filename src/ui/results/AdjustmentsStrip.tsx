import { AlertTriangle, ChevronDown, Lock } from 'lucide-react'
import { useState } from 'react'
import type { Checked, Discretion, FinalOverride, PipelineInput } from '../../engine'
import { Button } from '../common/controls'
import { discretionSummary } from '../drawer/editorState'
import { plural } from '../shell/blockReason'

interface AdjustmentsStripProps {
  readonly overrides: readonly Checked<FinalOverride>[]
  readonly discretion: readonly Checked<Discretion>[]
  readonly input: PipelineInput | undefined
  readonly locked: boolean
  readonly onOpen: (matric: string) => void
  readonly onRemoveOverride: (matric: string, ccaID: string) => void
  readonly onRemoveDiscretion: (matric: string) => void
}

interface Item {
  readonly key: string
  readonly matric: string
  readonly cca: string
  readonly value: string
  readonly reason: string
  readonly stale: boolean
  readonly remove: () => void
}

/** Every final-points override and discretion entry, with Open and Remove; stale ones separately. */
export function AdjustmentsStrip(props: AdjustmentsStripProps) {
  const { overrides, discretion, input, locked, onOpen } = props
  const [open, setOpen] = useState(false)
  if (overrides.length === 0 && discretion.length === 0) return null
  const nameOf = (matric: string): string => input?.residents.find((r) => r.matric === matric)?.name ?? matric
  const ccaOf = (id: string): string => input?.ccas.find((c) => c.ccaID === id)?.ccaName ?? id
  const items: Item[] = [
    ...overrides.map(({ entry: o, status }): Item => ({
      key: `o-${o.matric}-${o.ccaID}`, matric: o.matric, cca: ccaOf(o.ccaID), value: `Final: ${o.finalPoints}`,
      reason: o.reason, stale: status === 'stale', remove: () => props.onRemoveOverride(o.matric, o.ccaID),
    })),
    ...discretion.map(({ entry: d, status }): Item => ({
      key: `d-${d.matric}`, matric: d.matric, cca: '—', value: discretionSummary(d).split(' — ')[0] ?? '',
      reason: d.reason, stale: status === 'stale', remove: () => props.onRemoveDiscretion(d.matric),
    })),
  ]
  const live = items.filter((i) => !i.stale)
  const stale = items.filter((i) => i.stale)
  const applied = (list: readonly Checked<unknown>[]): number => list.filter((c) => c.status === 'applied').length
  const summary = `${plural(applied(overrides), 'final-points override')} · ${applied(discretion)} discretion`
  const row = (item: Item) => (
    <tr key={item.key} className="border-b border-rule/60 last:border-b-0">
      <td className="py-1 pr-3">{item.stale && <AlertTriangle aria-label="Stale" size={13} className="text-warning" />}</td>
      <td className="py-1 pr-3 font-medium">{nameOf(item.matric)}</td>
      <td className="py-1 pr-3 text-muted">{item.cca}</td>
      <td className="num py-1 pr-3">{item.value}</td>
      <td className="max-w-80 truncate py-1 pr-3 text-muted" title={item.reason}>{item.reason}</td>
      <td className="py-1 text-right whitespace-nowrap">
        {!item.stale && <Button small variant="ghost" onClick={() => onOpen(item.matric)}>Open</Button>}
        <Button small variant="ghost" disabled={locked} onClick={item.remove}>Remove</Button>
      </td>
    </tr>
  )
  return (
    <div className="border-b border-rule bg-card">
      <button type="button" aria-expanded={open} onClick={() => setOpen(!open)} className="motion flex w-full items-center gap-2 px-6 py-2 text-left text-body hover:bg-ink/[0.03]">
        <span className="font-semibold">Adjustments</span>
        <span className="text-muted">{summary}</span>
        {stale.length > 0 && <span className="flex items-center gap-1 text-warning"><AlertTriangle aria-hidden size={13} /> {stale.length} no longer apply</span>}
        {locked && <Lock aria-label="Locked while finalised" size={13} className="text-muted" />}
        <ChevronDown aria-hidden size={14} className={`motion ml-auto ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="border-t border-rule/70 px-6 py-2">
          <table className="w-full border-collapse text-body"><tbody>{live.map(row)}</tbody></table>
          {stale.length > 0 && (
            <>
              <p className="mt-2 flex items-center gap-1.5 text-cap font-semibold text-warning">
                <AlertTriangle aria-hidden size={13} /> No longer match the imported files (not used)
              </p>
              <table className="w-full border-collapse text-body"><tbody>{stale.map(row)}</tbody></table>
            </>
          )}
        </div>
      )}
    </div>
  )
}
