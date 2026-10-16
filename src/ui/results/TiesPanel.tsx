import { AlertTriangle, Dices } from 'lucide-react'
import type { PipelineInput, WheelResolution } from '../../engine'
import { Button } from '../common/controls'
import { LIST_TITLES } from '../export/exportCsv'
import { plural } from '../shell/blockReason'
import type { TieGroup } from './wheel'

interface TiesPanelProps {
  readonly unresolved: readonly TieGroup[]
  readonly stale: readonly WheelResolution[]
  readonly input: PipelineInput | undefined
  readonly onResolve: (group: TieGroup) => void
  readonly onRemoveStale: (resolution: WheelResolution) => void
}

/** Every boundary tie still waiting for the wheel, and every saved wheel result that went stale. */
export function TiesPanel({ unresolved, stale, input, onResolve, onRemoveStale }: TiesPanelProps) {
  if (unresolved.length === 0 && stale.length === 0) return null
  const nameOf = (matric: string): string => input?.residents.find((r) => r.matric === matric)?.name ?? matric
  return (
    <div className="border-b border-gold/40 bg-gold-soft/50 px-6 py-2 text-body">
      <p className="flex items-center gap-2 font-semibold">
        <Dices aria-hidden size={15} /> Ties to resolve · {plural(unresolved.length, 'group')}
        <span className="font-normal text-muted">Needed before publishing.</span>
      </p>
      <ul className="mt-1">
        {unresolved.map((group) => (
          <li key={`${group.list}-${group.rows[0]?.rank}`} className="flex flex-wrap items-center gap-2 py-0.5">
            <span className="w-28 text-muted">{LIST_TITLES[group.list]}</span>
            <span className="font-medium">TIE {group.flags.map((f) => f.boundary).join(' + ')}</span>
            <span className="min-w-0 flex-1 truncate">{group.rows.map((r) => r.name).join(', ')}</span>
            <Button small onClick={() => onResolve(group)}>Resolve</Button>
          </li>
        ))}
        {stale.map((resolution) => (
          <li key={`stale-${resolution.list}-${resolution.order.join()}`} className="flex flex-wrap items-center gap-2 py-0.5 text-warning">
            <AlertTriangle aria-label="Stale" size={13} />
            <span className="w-28">{LIST_TITLES[resolution.list]}</span>
            <span className="min-w-0 flex-1 truncate">
              Saved wheel result no longer matches a tie: {resolution.order.map(nameOf).join(', ')}
            </span>
            <Button small variant="ghost" onClick={() => onRemoveStale(resolution)}>Remove</Button>
          </li>
        ))}
      </ul>
    </div>
  )
}
