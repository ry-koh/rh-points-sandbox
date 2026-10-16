import { Plus, X } from 'lucide-react'
import { DEFAULT_CONFIG, type OutgoingTier } from '../../engine'
import { ChangedMark, MULTIPLIER_SLIDER, NumberField, NumberInput, SegmentedField, differs } from './fields'
import { ObjectFields } from './ObjectFields'
import type { SectionProps } from './Section'

const D = DEFAULT_CONFIG
const DEFAULT_NEW_MULTIPLIER = 1

const ordinal = (n: number): string => {
  const suffix = n % 10 === 1 && n !== 11 ? 'st' : n % 10 === 2 && n !== 12 ? 'nd' : n % 10 === 3 && n !== 13 ? 'rd' : 'th'
  return `${n}${suffix}`
}

function IconButton({ label, onClick, children }: { readonly label: string; readonly onClick: () => void; readonly children: React.ReactNode }) {
  return (
    <button type="button" aria-label={label} title={label} onClick={onClick} className="motion rounded-[2px] p-1 text-muted hover:bg-error-bg hover:text-error">
      {children}
    </button>
  )
}

function TableHeader({ title, changed, onReset }: { readonly title: string; readonly changed: boolean; readonly onReset: () => void }) {
  return (
    <div className="mt-2 flex items-center gap-2">
      <span className="flex-1 text-body font-medium">{title}</span>
      <ChangedMark changed={changed} label={title} onReset={onReset} />
    </div>
  )
}

function TiersTable({ config, update }: SectionProps) {
  const tiers = config.outgoingTiers
  const set = (next: readonly OutgoingTier[]): void => update('outgoingTiers', next)
  const patch = (index: number, change: Partial<OutgoingTier>): void =>
    set(tiers.map((tier, i) => (i === index ? { ...tier, ...change } : tier)))
  return (
    <div className="mr-[42px]">
      <TableHeader title="Outgoing tiers" changed={differs(tiers, D.outgoingTiers)} onReset={() => set(D.outgoingTiers)} />
      <ul className="mt-1 divide-y divide-rule border-y border-rule">
        {tiers.map((tier, i) => (
          <li key={i} className="flex items-center gap-1.5 py-1">
            <input
              aria-label={`Tier ${i + 1} name`}
              value={tier.name}
              onChange={(event) => patch(i, { name: event.target.value })}
              className="motion h-7 min-w-0 flex-1 rounded-[3px] border border-transparent bg-transparent px-1.5 text-body hover:border-ink/20"
            />
            <NumberInput label={`${tier.name} multiplier`} value={tier.multiplier} min={0} step={MULTIPLIER_SLIDER.step} onChange={(m) => patch(i, { multiplier: m })} className="w-[76px]" />
            <IconButton label={`Remove ${tier.name}`} onClick={() => set(tiers.filter((_, j) => j !== i))}>
              <X aria-hidden size={13} />
            </IconButton>
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={() => set([...tiers, { name: `New tier ${tiers.length + 1}`, multiplier: DEFAULT_NEW_MULTIPLIER }])}
        className="motion mt-1 flex items-center gap-1 rounded-[2px] px-1 py-0.5 text-cap font-medium text-raffles hover:bg-raffles/5"
      >
        <Plus aria-hidden size={12} /> Add tier
      </button>
      <p className="text-cap text-muted">Tier names must match the outgoingTier column in ccas.csv.</p>
    </div>
  )
}

export function LeaderFields({ config, update }: SectionProps) {
  return (
    <>
      <ObjectFields
        value={config.incomingMultiplier}
        defaults={D.incomingMultiplier}
        onChange={(next) => update('incomingMultiplier', next)}
        min={0}
        slider={MULTIPLIER_SLIDER}
        labels={{ head: 'Incoming Head', vice_head: 'Incoming Vice Head' }}
      />
      <SegmentedField
        label="Outgoing multiplier comes from"
        value={config.outgoingMode}
        defaultValue={D.outgoingMode}
        onChange={(v) => update('outgoingMode', v)}
        options={[
          { value: 'tier', label: 'Tier table' },
          { value: 'manual', label: 'Manual per CCA' },
        ]}
      />
      <div className={config.outgoingMode === 'tier' ? '' : 'opacity-60'}>
        <TiersTable config={config} update={update} />
      </div>
      <SegmentedField
        label="Outgoing + incoming in one CCA"
        value={config.stackingMode}
        defaultValue={D.stackingMode}
        onChange={(v) => update('stackingMode', v)}
        options={[
          { value: 'max', label: 'Max' },
          { value: 'additive', label: 'Additive' },
          { value: 'multiplicative', label: 'Multiply' },
        ]}
      />
    </>
  )
}

export function WeightsFields({ config, update }: SectionProps) {
  const weights = config.stayingWeights
  const set = (next: readonly number[]): void => update('stayingWeights', next)
  const last = weights[weights.length - 1] ?? DEFAULT_NEW_MULTIPLIER
  return (
    <div>
      <TableHeader title="Weight per slot (best first)" changed={differs(weights, D.stayingWeights)} onReset={() => set(D.stayingWeights)} />
      <ol className="mt-1 mr-[42px] grid grid-cols-1">
        {weights.map((weight, i) => (
          <li key={i} className="flex items-center gap-1.5 border-b border-rule py-1">
            <span className="num w-8 text-cap text-muted">{ordinal(i + 1)}</span>
            <NumberInput label={`${ordinal(i + 1)} slot weight`} value={weight} min={0} step={0.05} onChange={(w) => set(weights.map((x, j) => (j === i ? w : x)))} className="w-[76px]" />
            {weights.length > 1 && (
              <IconButton label={`Remove ${ordinal(i + 1)} weight`} onClick={() => set(weights.filter((_, j) => j !== i))}>
                <X aria-hidden size={12} />
              </IconButton>
            )}
          </li>
        ))}
      </ol>
      <button type="button" onClick={() => set([...weights, last])} className="motion mt-1 flex items-center gap-1 rounded-[2px] px-1 py-0.5 text-cap font-medium text-raffles hover:bg-raffles/5">
        <Plus aria-hidden size={12} /> Add slot weight
      </button>
      <SegmentedField
        label="After the last weight"
        value={config.stayingWeightTail}
        defaultValue={D.stayingWeightTail}
        onChange={(v) => update('stayingWeightTail', v)}
        options={[{ value: 'halve', label: 'Halve each further slot' }]}
      />
    </div>
  )
}

export function AuxFields({ config, update }: SectionProps) {
  const table = config.auxTable
  return (
    <>
      <TableHeader title="Hall points per AUX count" changed={differs(table, D.auxTable)} onReset={() => update('auxTable', D.auxTable)} />
      <div className="mt-1 mr-[42px] grid grid-cols-4 gap-x-2 gap-y-1">
        {table.map((points, i) => (
          <label key={i} className="flex flex-col text-cap text-muted">
            <span className="num">{i} AUX</span>
            <NumberInput label={`Points for ${i} AUX`} value={points} step={0.5} onChange={(p) => update('auxTable', table.map((x, j) => (j === i ? p : x)))} className="w-full" />
          </label>
        ))}
      </div>
      <NumberField
        label="AUX cap"
        value={config.auxCap}
        defaultValue={D.auxCap}
        onChange={(v) => update('auxCap', v)}
        min={0}
        max={table.length - 1}
        integer
        hint="AUX above the cap count as the cap."
      />
    </>
  )
}
