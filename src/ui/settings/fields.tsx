import { RotateCcw } from 'lucide-react'
import { useEffect, useId, useState, type ReactNode } from 'react'

export const MULTIPLIER_SLIDER = { min: 0, max: 3, step: 0.05 } as const
export const FACTOR_SLIDER = { min: 0, max: 1, step: 0.05 } as const

export const differs = (a: unknown, b: unknown): boolean => JSON.stringify(a) !== JSON.stringify(b)

/** Gold dot plus a reset button, shown only when the value differs from the default. */
export function ChangedMark({ changed, label, onReset }: { readonly changed: boolean; readonly label: string; readonly onReset: () => void }) {
  if (!changed) return <span className="w-[34px] shrink-0" aria-hidden />
  return (
    <span className="flex w-[34px] shrink-0 items-center justify-end gap-1">
      <span className="h-1.5 w-1.5 rounded-full bg-gold" title="Changed from the default" />
      <button
        type="button"
        onClick={onReset}
        aria-label={`Reset ${label} to default`}
        title="Reset to default"
        className="motion rounded-[2px] p-0.5 text-muted hover:bg-ink/5 hover:text-ink"
      >
        <RotateCcw aria-hidden size={12} />
      </button>
    </span>
  )
}

interface NumberInputProps {
  readonly value: number
  readonly onChange: (value: number) => void
  readonly label: string
  readonly min?: number
  readonly max?: number
  readonly step?: number
  readonly integer?: boolean
  readonly id?: string
  readonly className?: string
}

/** Keeps a text draft so partial typing ("0.", "-") never fights the stored number. */
export function NumberInput({ value, onChange, label, min, max, step = 1, integer = false, id, className = 'w-20' }: NumberInputProps) {
  const [draft, setDraft] = useState(String(value))
  useEffect(() => {
    if (Number(draft) !== value) setDraft(String(value))
  }, [value])
  const commit = (text: string): void => {
    setDraft(text)
    const parsed = Number(text)
    if (text.trim() === '' || !Number.isFinite(parsed)) return
    if (integer && !Number.isInteger(parsed)) return
    if ((min !== undefined && parsed < min) || (max !== undefined && parsed > max)) return
    onChange(parsed)
  }
  const invalid = draft.trim() === '' || Number(draft) !== value
  return (
    <input
      id={id}
      type="number"
      inputMode="decimal"
      aria-label={label}
      aria-invalid={invalid}
      value={draft}
      min={min}
      max={max}
      step={step}
      onChange={(event) => commit(event.target.value)}
      onBlur={() => setDraft(String(value))}
      className={`motion h-8 rounded-[3px] border bg-card px-2 text-right text-body hover:border-ink/50 ${
        invalid ? 'border-error' : 'border-ink/20'
      } ${className}`}
    />
  )
}

interface NumberFieldProps {
  readonly label: string
  readonly value: number
  readonly defaultValue: number
  readonly onChange: (value: number) => void
  readonly min?: number
  readonly max?: number
  readonly step?: number
  readonly integer?: boolean
  readonly slider?: { readonly min: number; readonly max: number; readonly step: number }
  readonly hint?: ReactNode
}

export function NumberField(props: NumberFieldProps) {
  const { label, value, defaultValue, onChange, slider, hint } = props
  const id = useId()
  return (
    <div className="py-1.5">
      <div className="flex items-center gap-2">
        <label htmlFor={id} className="min-w-0 flex-1 text-body">
          {label}
        </label>
        <NumberInput id={id} label={label} value={value} onChange={onChange} min={props.min} max={props.max} step={props.step ?? slider?.step} integer={props.integer} />
        <ChangedMark changed={value !== defaultValue} label={label} onReset={() => onChange(defaultValue)} />
      </div>
      {slider && (
        <input
          type="range"
          aria-label={`${label} slider`}
          min={slider.min}
          max={slider.max}
          step={slider.step}
          value={Math.min(slider.max, Math.max(slider.min, value))}
          onChange={(event) => onChange(Number(event.target.value))}
          className="mt-1 w-[calc(100%-42px)]"
        />
      )}
      {hint && <p className="text-cap text-muted">{hint}</p>}
    </div>
  )
}

interface ToggleFieldProps {
  readonly label: string
  readonly value: boolean
  readonly defaultValue: boolean
  readonly onChange: (value: boolean) => void
  readonly hint?: string
}

export function ToggleField({ label, value, defaultValue, onChange, hint }: ToggleFieldProps) {
  return (
    <div className="py-1.5">
      <div className="flex items-center gap-2">
        <span className="min-w-0 flex-1 text-body">{label}</span>
        <button
          type="button"
          role="switch"
          aria-checked={value}
          aria-label={label}
          onClick={() => onChange(!value)}
          className={`motion relative h-5 w-9 rounded-full ${value ? 'bg-raffles' : 'bg-ink/20'} hover:opacity-90`}
        >
          <span className={`motion absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow ${value ? 'translate-x-4' : ''}`} />
        </button>
        <ChangedMark changed={value !== defaultValue} label={label} onReset={() => onChange(defaultValue)} />
      </div>
      {hint && <p className="mt-0.5 pr-10 text-cap text-muted">{hint}</p>}
    </div>
  )
}

interface SegmentedFieldProps<T extends string> {
  readonly label: string
  readonly value: T
  readonly defaultValue: T
  readonly options: readonly { readonly value: T; readonly label: string }[]
  readonly onChange: (value: T) => void
}

export function SegmentedField<T extends string>({ label, value, defaultValue, options, onChange }: SegmentedFieldProps<T>) {
  return (
    <div className="py-1.5">
      <div className="flex items-center gap-2">
        <span className="min-w-0 flex-1 text-body">{label}</span>
        <ChangedMark changed={value !== defaultValue} label={label} onReset={() => onChange(defaultValue)} />
      </div>
      <div role="radiogroup" aria-label={label} className="mt-1 mr-[42px] flex rounded-[3px] border border-ink/20 bg-card p-0.5">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={value === option.value}
            onClick={() => onChange(option.value)}
            className={`motion flex-1 rounded-[2px] px-1.5 py-1 text-cap font-medium ${
              value === option.value ? 'bg-ink text-paper' : 'text-muted hover:bg-ink/5 hover:text-ink'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  )
}
