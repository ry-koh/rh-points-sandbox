import type { PerCcaReport, VettedStatus } from '../../import'
import { Chip, Eyebrow } from '../common/controls'
import { NotSetChips } from '../import/CcaTable'

export interface CcaListItem {
  readonly cca: PerCcaReport
  /** The vetted mark's status; null when the CCA is not marked. */
  readonly vetted: VettedStatus | null
  readonly notSubmitting: boolean
  readonly edits: number
}

interface CcaListProps {
  readonly items: readonly CcaListItem[]
  readonly selected: string | null
  readonly onSelect: (ccaID: string) => void
}

function ItemChips({ item }: { readonly item: CcaListItem }) {
  const { cca } = item
  const tweaked = cca.bonusOverride !== null || cca.multiplierOverride !== null
  return (
    <div className="mt-1 flex flex-wrap gap-1">
      {item.vetted === 'vetted' && <Chip tone="ok">vetted</Chip>}
      {item.vetted === 'file_changed' && <Chip tone="warning">file changed</Chip>}
      {cca.status === 'out_of_range' && <Chip tone="warning">out of range</Chip>}
      {cca.status === 'flat' && <Chip tone="gold">flat</Chip>}
      {item.notSubmitting && cca.fileName === null && <Chip tone="grey">not submitting</Chip>}
      <NotSetChips cca={cca} />
      {tweaked && <Chip tone="outline">tweaked</Chip>}
      {item.edits > 0 && <Chip tone="outline">{item.edits} {item.edits === 1 ? 'edit' : 'edits'}</Chip>}
    </div>
  )
}

/** The CCAs in review order; "n of N vetted" counts only CCAs with a leader file (D25). */
export function CcaList({ items, selected, onSelect }: CcaListProps) {
  const vettable = items.filter((item) => item.cca.fileHash !== null)
  const vetted = vettable.filter((item) => item.vetted === 'vetted').length
  return (
    <nav aria-label="CCAs" className="flex min-h-0 flex-col border-r border-rule bg-paper">
      <div className="border-b-2 border-ink px-4 py-3">
        <h2 className="text-lead font-semibold">CCAs</h2>
        <div className="mt-1 flex items-center gap-2">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-rule/70">
            <div className="h-full rounded-full bg-ok" style={{ width: `${vettable.length === 0 ? 0 : (vetted / vettable.length) * 100}%` }} />
          </div>
          <Eyebrow>
            <span className="num">{vetted} of {vettable.length} vetted</span>
          </Eyebrow>
        </div>
      </div>
      <ul className="min-h-0 flex-1 overflow-y-auto">
        {items.map((item) => {
          const active = item.cca.ccaID === selected
          return (
            <li key={item.cca.ccaID}>
              <button
                type="button"
                aria-current={active ? 'true' : undefined}
                onClick={() => onSelect(item.cca.ccaID)}
                className={`motion relative block w-full border-b border-rule px-4 py-2.5 text-left ${active ? 'bg-card' : 'hover:bg-ink/[0.04]'}`}
              >
                <span className={`motion absolute inset-y-0 left-0 w-[3px] bg-raffles ${active ? 'opacity-100' : 'opacity-0'}`} />
                <span className="flex items-baseline justify-between gap-2">
                  <span className="truncate text-ui font-medium">{item.cca.name}</span>
                  <span className="font-mono text-cap text-muted">{item.cca.ccaID}</span>
                </span>
                <ItemChips item={item} />
              </button>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
