import { Check, Layers } from 'lucide-react'
import type { PerCcaReport, VettedStatus } from '../../import'
import type { GroupSection } from '../../import/groups'
import { Button, Chip, Eyebrow } from '../common/controls'
import { NotSetChips } from '../import/CcaTable'
import { vettableCcas } from '../state/store'
import { vettedLevelLine } from './reviewHelpers'

export interface CcaListItem {
  readonly cca: PerCcaReport
  /** The vetted mark's status; null when the CCA is not marked. */
  readonly vetted: VettedStatus | null
  readonly notSubmitting: boolean
  readonly edits: number
}

interface CcaListProps {
  /** The list in sections; with no groups this is one "Ungrouped" section and no headers are shown. */
  readonly sections: readonly GroupSection<CcaListItem>[]
  /** Whether any group exists: only then do sections get headers. */
  readonly grouped: boolean
  readonly selected: string | null
  readonly onSelect: (ccaID: string) => void
  readonly onOpenGroups: () => void
}

const isVetted = (item: CcaListItem): boolean => item.vetted === 'vetted'

/** "n of N vetted" over the CCAs that can be vetted: those with a leader file, and flat CCAs (D1). */
function vettedCount(items: readonly CcaListItem[]): { readonly vetted: number; readonly total: number } {
  const vettable = vettableCcas({ perCca: items.map((item) => item.cca) })
  const ids = new Set(vettable.map((cca) => cca.ccaID))
  return { vetted: items.filter((item) => ids.has(item.cca.ccaID) && isVetted(item)).length, total: vettable.length }
}

function ItemChips({ item }: { readonly item: CcaListItem }) {
  const { cca } = item
  const tweaked = cca.bonusOverride !== null || cca.multiplierOverride !== null
  const vetted = isVetted(item)
  return (
    <div className="mt-1 flex flex-wrap gap-1">
      {item.vetted === 'file_changed' && <Chip tone="warning">file changed</Chip>}
      {cca.status === 'out_of_range' && <Chip tone="warning">out of range</Chip>}
      {cca.status === 'flat' && !vetted && <Chip tone="gold">flat</Chip>}
      {item.notSubmitting && cca.fileName === null && <Chip tone="grey">not submitting</Chip>}
      <NotSetChips cca={cca} />
      {tweaked && !vetted && <Chip tone="outline">tweaked</Chip>}
      {item.edits > 0 && <Chip tone="outline">{item.edits} {item.edits === 1 ? 'edit' : 'edits'}</Chip>}
    </div>
  )
}

function Row({ item, active, onSelect }: { readonly item: CcaListItem; readonly active: boolean; readonly onSelect: () => void }) {
  const vetted = isVetted(item)
  const levelLine = vetted ? vettedLevelLine(item.cca) : null
  const tone = vetted ? `bg-ok-bg hover:brightness-95 ${active ? 'ring-2 ring-inset ring-ink/40' : ''}` : active ? 'bg-card' : 'hover:bg-ink/[0.04]'
  return (
    <button
      type="button"
      aria-current={active ? 'true' : undefined}
      onClick={onSelect}
      className={`motion relative block w-full border-b border-rule px-4 py-2.5 text-left ${tone}`}
    >
      {/* A solid ok bar for a vetted CCA; otherwise the brand bar marks the open one. */}
      <span className={vetted ? 'absolute inset-y-0 left-0 w-1 bg-ok' : `motion absolute inset-y-0 left-0 w-[3px] bg-raffles ${active ? 'opacity-100' : 'opacity-0'}`} />
      <span className="flex items-baseline justify-between gap-2">
        <span className="truncate text-ui font-medium">{item.cca.name}</span>
        <span className="font-mono text-cap text-muted">{item.cca.ccaID}</span>
      </span>
      {vetted && (
        <span className="mt-1 flex items-center gap-1 text-cap font-semibold text-ok">
          <Check aria-hidden size={14} strokeWidth={3} /> Vetted
        </span>
      )}
      {levelLine && (
        <span className="mt-0.5 block truncate text-cap font-medium text-ink" title={levelLine}>
          {levelLine}
        </span>
      )}
      <ItemChips item={item} />
    </button>
  )
}

function SectionHeader({ name, items }: { readonly name: string; readonly items: readonly CcaListItem[] }) {
  const { vetted, total } = vettedCount(items)
  return (
    <h3 className="sticky top-0 z-10 flex items-baseline justify-between gap-2 border-b border-rule bg-paper px-4 py-1.5">
      <span className="truncate text-cap font-semibold tracking-[0.08em] uppercase" title={name}>
        {name}
      </span>
      <span className="num shrink-0 text-cap text-muted">
        {vetted} of {total} vetted
      </span>
    </h3>
  )
}

/** The CCAs in review order, in the JCRC's groups. "n of N vetted" counts flat CCAs too (D1). */
export function CcaList({ sections, grouped, selected, onSelect, onOpenGroups }: CcaListProps) {
  const { vetted, total } = vettedCount(sections.flatMap((section) => section.ccas))
  return (
    <nav aria-label="CCAs" className="flex min-h-0 flex-col border-r border-rule bg-paper">
      <div className="border-b-2 border-ink px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-lead font-semibold">CCAs</h2>
          <Button small variant="ghost" onClick={onOpenGroups}>
            <Layers aria-hidden size={13} /> Groups
          </Button>
        </div>
        <div className="mt-1 flex items-center gap-2">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-rule/70">
            <div className="h-full rounded-full bg-ok" style={{ width: `${total === 0 ? 0 : (vetted / total) * 100}%` }} />
          </div>
          <Eyebrow>
            <span className="num">{vetted} of {total} vetted</span>
          </Eyebrow>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {sections.map((section) => {
          // With groups, an empty Ungrouped section is left out; an empty group stays and says so.
          if (grouped && section.groupId === null && section.ccas.length === 0) return null
          return (
            <section key={section.groupId ?? 'ungrouped'}>
              {grouped && <SectionHeader name={section.name} items={section.ccas} />}
              {section.ccas.length === 0 ? (
                <p className="border-b border-rule px-4 py-3 text-cap text-muted">No CCAs yet</p>
              ) : (
                <ul>
                  {section.ccas.map((item) => (
                    <li key={item.cca.ccaID}>
                      <Row item={item} active={item.cca.ccaID === selected} onSelect={() => onSelect(item.cca.ccaID)} />
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )
        })}
      </div>
    </nav>
  )
}
