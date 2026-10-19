import { SlidersHorizontal } from 'lucide-react'
import { useEffect, useId, useState } from 'react'
import type { Level } from '../../engine'
import type { CcaLevelEntry, PerCcaReport } from '../../import'
import { Button, Chip } from '../common/controls'
import { IHG_LABELS, notSet } from '../import/CcaTable'
import { levelChangeText } from '../settings/tableSections'
import type { LevelChange } from '../state/store'

/** ×2.0, ×1.31: at least one decimal, more only when the value has them. */
export const fmtMultiplier = (m: number): string => `×${Number.isInteger(m * 10) ? m.toFixed(1) : String(m)}`
const fmtBonus = (b: number): string => `+${b}`

interface CcaHeaderProps {
  readonly cca: PerCcaReport
  /** The stored entry as entered, which may name a level that no longer exists (R44). */
  readonly entry: CcaLevelEntry | null
  readonly levels: readonly Level[]
  readonly locked: boolean
  /** The LEVEL_NOT_SET sentence for this CCA, when it applies. */
  readonly levelNotSet: string | null
  readonly levelChange: LevelChange | null
  /** Checks an entry before it is stored; returns the problem in words, or null. */
  readonly checkEntry: (entry: CcaLevelEntry) => string | null
  readonly onSetEntry: (entry: CcaLevelEntry) => void
  readonly onEditLevels: () => void
}

function FromApp() {
  return <span className="text-cap text-muted">From RH-app</span>
}

function Facts({ cca }: { readonly cca: PerCcaReport }) {
  const missing = notSet(cca)
  return (
    <dl className="mt-3 flex flex-wrap gap-x-8 gap-y-2 text-body">
      <div className="flex items-baseline gap-2">
        <dt className="text-muted">Type</dt>
        <dd className="flex items-baseline gap-2">
          {missing.type ? <Chip tone="warning">type not set in RH-app: 1x assumed</Chip> : <span className="num font-medium">{cca.type}</span>}
          {!missing.type && <FromApp />}
        </dd>
      </div>
      {cca.isSport && (
        <div className="flex items-baseline gap-2">
          <dt className="text-muted">IHG</dt>
          <dd className="flex items-baseline gap-2">
            {missing.ihg || cca.ihgResult === null ? (
              <Chip tone="warning">IHG result / cap not set in RH-app: no IHG points yet</Chip>
            ) : (
              <>
                <span className="num font-medium">
                  {cca.ihgTicked} of {cca.ihgCap} ticked · {IHG_LABELS[cca.ihgResult]}
                </span>
                <FromApp />
              </>
            )}
          </dd>
        </div>
      )}
      <div className="flex items-baseline gap-2">
        <dt className="text-muted">Outgoing leaders</dt>
        <dd className="num font-medium">{cca.outgoingLeaders}</dd>
      </div>
    </dl>
  )
}

interface TweakBoxProps {
  readonly label: string
  readonly value: number | null
  readonly levelValue: number | null
  readonly format: (n: number) => string
  readonly step: number
  readonly disabled: boolean
  /** Stores the value (null = blank); returns the problem in words, or null. */
  readonly onCommit: (value: number | null) => string | null
}

/** Blank follows the level; a value is this CCA's own number (D15, R45). Commits on Enter or blur. */
function TweakBox({ label, value, levelValue, format, step, disabled, onCommit }: TweakBoxProps) {
  const id = useId()
  const stored = value === null ? '' : String(value)
  const [draft, setDraft] = useState(stored)
  const [problem, setProblem] = useState<string | null>(null)
  useEffect(() => {
    setDraft(stored)
    setProblem(null)
  }, [stored])
  const commit = (): void => {
    if (draft.trim() === stored) return
    const next = draft.trim() === '' ? null : Number(draft)
    setProblem(onCommit(next))
  }
  const same = value !== null && levelValue !== null && value === levelValue
  return (
    <div>
      <label htmlFor={id} className="text-cap font-medium text-muted">
        {label}
      </label>
      <div className="mt-0.5 flex items-center gap-2">
        <input
          id={id}
          type="number"
          step={step}
          min={0}
          value={draft}
          disabled={disabled}
          placeholder={levelValue === null ? '—' : String(levelValue)}
          aria-invalid={problem !== null}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === 'Enter') commit()
            if (event.key === 'Escape') {
              setDraft(stored)
              setProblem(null)
            }
          }}
          className={`motion h-8 w-20 rounded-[3px] border bg-card px-2 text-ui disabled:opacity-60 ${problem ? 'border-error' : 'border-ink/20 hover:border-ink/50'}`}
        />
        {value !== null && levelValue !== null && <span className="num text-cap text-muted">(level: {format(levelValue)})</span>}
        {same && (
          <span className="flex items-center gap-1 text-cap text-muted">
            same as the level
            <Button small variant="ghost" disabled={disabled} onClick={() => setProblem(onCommit(null))}>
              Clear
            </Button>
          </span>
        )}
      </div>
      {problem && <p role="alert" className="mt-0.5 text-cap text-error">{problem}</p>}
    </div>
  )
}

const NOT_SET = ''

function LevelControls({ cca, entry, levels, locked, levelNotSet, levelChange, checkEntry, onSetEntry, onEditLevels }: CcaHeaderProps) {
  const selectId = useId()
  const [problem, setProblem] = useState<string | null>(null)
  const base: CcaLevelEntry = entry ?? { ccaID: cca.ccaID, level: null, bonusOverride: null, multiplierOverride: null }
  const stored = base.level
  const level = levels.find((l) => l.name === stored) ?? null
  const stale = stored !== null && level === null
  const submit = (next: CcaLevelEntry): string | null => {
    const found = checkEntry(next)
    if (found === null) onSetEntry(next)
    return found
  }
  const tweaked = base.bonusOverride !== null || base.multiplierOverride !== null
  return (
    <div className="mt-4 rounded-[4px] border border-rule bg-card px-4 py-3">
      <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
        <div>
          <label htmlFor={selectId} className="text-cap font-medium text-muted">
            Level
          </label>
          <div className="mt-0.5 flex items-center gap-3">
            <select
              id={selectId}
              value={stored ?? NOT_SET}
              disabled={locked}
              onChange={(event) => setProblem(submit({ ...base, level: event.target.value === NOT_SET ? null : event.target.value }))}
              className={`motion h-8 min-w-44 rounded-[3px] border bg-card px-2 text-ui font-medium disabled:opacity-60 ${stale || stored === null ? 'border-warning' : 'border-ink/20 hover:border-ink/50'}`}
            >
              <option value={NOT_SET}>— not set —</option>
              {levels.map((l) => (
                <option key={l.name} value={l.name}>
                  {l.name}
                </option>
              ))}
              {stale && (
                <option value={stored} disabled>
                  {stored} (no longer a level)
                </option>
              )}
            </select>
            {level && (
              <span className="num text-body">
                {fmtBonus(level.bonus)} to members · {fmtMultiplier(level.multiplier)} for outgoing leaders
              </span>
            )}
            {tweaked && <Chip tone="outline">tweaked</Chip>}
          </div>
        </div>
        <TweakBox
          label="Tweak bonus"
          value={base.bonusOverride}
          levelValue={level?.bonus ?? null}
          format={(n) => String(n)}
          step={0.5}
          disabled={locked}
          onCommit={(bonusOverride) => submit({ ...base, bonusOverride })}
        />
        <TweakBox
          label="Tweak multiplier"
          value={base.multiplierOverride}
          levelValue={level?.multiplier ?? null}
          format={fmtMultiplier}
          step={0.01}
          disabled={locked}
          onCommit={(multiplierOverride) => submit({ ...base, multiplierOverride })}
        />
        <Button small variant="ghost" onClick={onEditLevels} className="ml-auto text-raffles">
          <SlidersHorizontal aria-hidden size={13} /> Edit levels
        </Button>
      </div>
      {problem && <p role="alert" className="mt-1 text-cap text-error">{problem}</p>}
      <p className="mt-2 text-cap text-muted">
        The bonus is added to every member; the multiplier applies to outgoing leaders, bidding only. Blank tweaks follow the level.
      </p>
      {stale && (
        <p className="mt-1 text-cap font-medium text-error">
          "{stored}" is not one of the levels in Settings. Pick another level or add it back in Settings.
        </p>
      )}
      {levelNotSet && <p className="mt-1 text-cap font-medium text-warning">{levelNotSet}</p>}
      {levelChange && stored === levelChange.level && (
        <p role="status" className="mt-2 border-l-4 border-gold bg-gold-soft px-3 py-1.5 text-cap font-medium">
          {levelChangeText(levelChange)}.
        </p>
      )}
    </div>
  )
}

/** Name, the read-only facts from the RH app, and (for a CCA with scores) its level and tweaks. */
export function CcaHeader(props: CcaHeaderProps) {
  const { cca } = props
  return (
    <header>
      <div className="flex flex-wrap items-baseline gap-3">
        <h1 className="text-display font-semibold tracking-tight">{cca.name}</h1>
        <span className="font-mono text-ui text-muted">{cca.ccaID}</span>
      </div>
      {cca.status === 'flat' ? (
        <p className="mt-2 text-body text-muted">
          Flat · <span className="num font-medium text-ink">{cca.flatPoints ?? 0}</span> pts to every member, set in the RH app. No scores, level or vetting here.
        </p>
      ) : (
        <>
          <Facts cca={cca} />
          {/* A CCA without a leader file needs no level, but a stored entry stays fixable (R44). */}
          {(cca.fileName !== null || props.entry !== null) && <LevelControls {...props} />}
        </>
      )}
    </header>
  )
}
