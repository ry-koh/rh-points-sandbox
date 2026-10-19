import { Plus, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { DEFAULT_CONFIG, type Level } from '../../engine'
import type { LevelChange } from '../state/store'
import { ChangedMark, MULTIPLIER_SLIDER, NumberField, NumberInput, SegmentedField, differs } from './fields'
import { INCOMING_LABELS, STACKING_OPTIONS, SETTINGS_TEXT as T } from './labels'
import { ObjectFields } from './ObjectFields'
import type { SectionProps } from './Section'

const D = DEFAULT_CONFIG
const DEFAULT_NEW_MULTIPLIER = 1
const DEFAULT_NEW_BONUS = 0
const BONUS_STEP = 0.5

const ordinal = (n: number): string => {
  const suffix = n % 10 === 1 && n !== 11 ? 'st' : n % 10 === 2 && n !== 12 ? 'nd' : n % 10 === 3 && n !== 13 ? 'rd' : 'th'
  return `${n}${suffix}`
}

interface IconButtonProps {
  readonly label: string
  readonly onClick: () => void
  readonly disabled?: boolean
  readonly children: React.ReactNode
}

function IconButton({ label, onClick, disabled = false, children }: IconButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className="motion rounded-[2px] p-1 text-muted hover:bg-error-bg hover:text-error disabled:pointer-events-none disabled:opacity-40"
    >
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

interface LevelsTableProps extends SectionProps {
  /** How many CCAs use each level, by name; Remove is disabled while a level is in use (R44). */
  readonly usage?: Readonly<Record<string, number>>
  /** The last level edit that cleared tweaks (D21). */
  readonly change?: LevelChange | null
}

/** "2 tweaks on Gold were cleared so those CCAs follow the new value" (D21). */
export function levelChangeText(change: LevelChange): string {
  const n = change.clearedTweaks
  const one = n === 1
  return `${n} ${one ? 'tweak' : 'tweaks'} on ${change.level} ${one ? 'was' : 'were'} cleared so ${one ? 'that CCA follows' : 'those CCAs follow'} the new value`
}

const usedBy = (n: number): string => `used by ${n} ${n === 1 ? 'CCA' : 'CCAs'}`

/**
 * Why a typed level name cannot be stored yet, or null when it can (D24): it must be non-blank
 * and differ from every other level's name. The store never holds a half-typed name.
 */
export function levelNameProblem(draft: string, index: number, levels: readonly Level[]): string | null {
  const name = draft.trim()
  if (name === '') return "Name can't be blank"
  if (levels.some((level, i) => i !== index && level.name === name)) return `Another level is already called ${name}`
  return null
}

interface LevelNameInputProps {
  readonly index: number
  readonly levels: readonly Level[]
  readonly onCommit: (name: string) => void
}

/** Keeps a local draft; commits on blur or Enter when the name is usable, reverts on Escape or a bad blur. */
function LevelNameInput({ index, levels, onCommit }: LevelNameInputProps) {
  const stored = levels[index]?.name ?? ''
  const [draft, setDraft] = useState(stored)
  useEffect(() => setDraft(stored), [stored])
  const problem = draft === stored ? null : levelNameProblem(draft, index, levels)
  const commit = (): boolean => {
    if (problem !== null) return false
    const name = draft.trim()
    if (name !== stored) onCommit(name)
    setDraft(name)
    return true
  }
  return (
    <div className="min-w-0 flex-1">
      <input
        aria-label={`Level ${index + 1} name`}
        aria-invalid={problem !== null}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => {
          if (!commit()) setDraft(stored)
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter') commit()
          if (event.key === 'Escape') setDraft(stored)
        }}
        className={`motion h-7 w-full rounded-[3px] border bg-transparent px-1.5 text-body ${
          problem === null ? 'border-transparent hover:border-ink/20' : 'border-error'
        }`}
      />
      {problem !== null && <p role="alert" className="px-1.5 text-cap text-error">{problem}</p>}
    </div>
  )
}

export function LevelsTable({ config, update, usage, change = null }: LevelsTableProps) {
  const levels = config.levels
  const set = (next: readonly Level[]): void => update('levels', next)
  const patch = (index: number, delta: Partial<Level>): void =>
    set(levels.map((level, i) => (i === index ? { ...level, ...delta } : level)))
  return (
    <div className="mr-[42px]">
      <TableHeader title={T.levels.label} changed={differs(levels, D.levels)} onReset={() => set(D.levels)} />
      <p className="text-cap text-muted">{T.levels.help}</p>
      {change && (
        <p role="status" className="mt-1.5 border-l-4 border-gold bg-gold-soft px-2 py-1 text-cap font-medium">
          {levelChangeText(change)}.
        </p>
      )}
      <div className="mt-1 flex items-center gap-1.5 text-cap text-muted" aria-hidden>
        <span className="flex-1 px-1.5">Name</span>
        <span className="w-[76px]">Bonus (+)</span>
        <span className="w-[76px]">Outgoing (×)</span>
        <span className="w-[21px]" />
      </div>
      <ul className="divide-y divide-rule border-y border-rule">
        {levels.map((level, i) => {
          const inUse = usage?.[level.name] ?? 0
          return (
            <li key={i} className="py-1">
              <div className="flex items-center gap-1.5">
                <LevelNameInput index={i} levels={levels} onCommit={(name) => patch(i, { name })} />
                <NumberInput label={`${level.name} bonus`} value={level.bonus} min={0} step={BONUS_STEP} onChange={(b) => patch(i, { bonus: b })} className="w-[76px]" />
                <NumberInput label={`${level.name} multiplier`} value={level.multiplier} min={0} step={MULTIPLIER_SLIDER.step} onChange={(m) => patch(i, { multiplier: m })} className="w-[76px]" />
                <IconButton
                  label={inUse > 0 ? `${level.name} is ${usedBy(inUse)}` : `Remove ${level.name}`}
                  disabled={inUse > 0}
                  onClick={() => set(levels.filter((_, j) => j !== i))}
                >
                  <X aria-hidden size={13} />
                </IconButton>
              </div>
              {usage && <p className="num px-1.5 text-cap text-muted">{usedBy(inUse)}</p>}
            </li>
          )
        })}
      </ul>
      <button
        type="button"
        onClick={() => set([...levels, { name: `New level ${levels.length + 1}`, bonus: DEFAULT_NEW_BONUS, multiplier: DEFAULT_NEW_MULTIPLIER }])}
        className="motion mt-1 flex items-center gap-1 rounded-[2px] px-1 py-0.5 text-cap font-medium text-raffles hover:bg-raffles/5"
      >
        <Plus aria-hidden size={12} /> Add level
      </button>
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
        labels={INCOMING_LABELS}
        help={T.incomingMultiplier.help}
      />
      <SegmentedField
        label={T.stackingMode.label}
        hint={T.stackingMode.help}
        value={config.stackingMode}
        defaultValue={D.stackingMode}
        onChange={(v) => update('stackingMode', v)}
        options={STACKING_OPTIONS}
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
      <TableHeader title={T.stayingWeights.label} changed={differs(weights, D.stayingWeights)} onReset={() => set(D.stayingWeights)} />
      <p className="pr-10 text-cap text-muted">{T.stayingWeights.help}</p>
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
        label={T.stayingWeightTail.label}
        hint={T.stayingWeightTail.help}
        value={config.stayingWeightTail}
        defaultValue={D.stayingWeightTail}
        onChange={(v) => update('stayingWeightTail', v)}
        options={[{ value: 'halve', label: 'Keep halving' }]}
      />
    </div>
  )
}

export function AuxFields({ config, update }: SectionProps) {
  const table = config.auxTable
  return (
    <>
      <TableHeader title={T.auxTable.label} changed={differs(table, D.auxTable)} onReset={() => update('auxTable', D.auxTable)} />
      <p className="pr-10 text-cap text-muted">{T.auxTable.help}</p>
      <div className="mt-1 mr-[42px] grid grid-cols-4 gap-x-2 gap-y-1">
        {table.map((points, i) => (
          <label key={i} className="flex flex-col text-cap text-muted">
            <span className="num">{i} AUX</span>
            <NumberInput label={`Points for ${i} AUX`} value={points} step={0.5} onChange={(p) => update('auxTable', table.map((x, j) => (j === i ? p : x)))} className="w-full" />
          </label>
        ))}
      </div>
      <NumberField
        label={T.auxCap.label}
        value={config.auxCap}
        defaultValue={D.auxCap}
        onChange={(v) => update('auxCap', v)}
        min={0}
        max={table.length - 1}
        integer
        hint={T.auxCap.help}
      />
    </>
  )
}
