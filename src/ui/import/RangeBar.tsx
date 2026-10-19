const HEADROOM = 1.25

interface RangeBarProps {
  readonly value: number | null
  readonly min: number
  readonly max: number
  readonly label: string
  /** Width override, e.g. for the larger Review meter. */
  readonly className?: string
}

/** A tiny track: the allowed range shaded, the value as a tick (red when outside). */
export function RangeBar({ value, min, max, label, className = 'w-20' }: RangeBarProps) {
  const scale = Math.max(max, value ?? 0, 1) * HEADROOM
  const pct = (n: number): string => `${Math.min(100, Math.max(0, (n / scale) * 100))}%`
  const inside = value !== null && value >= min && value <= max
  return (
    <div
      role="img"
      aria-label={
        value === null ? `${label}: no value` : `${label} ${value.toFixed(2)}, allowed ${min} to ${max}`
      }
      className={`relative h-2 rounded-full bg-rule/70 ${className}`}
    >
      <div
        className="absolute inset-y-0 rounded-full bg-ok/25"
        style={{ left: pct(min), width: `calc(${pct(max)} - ${pct(min)})` }}
      />
      {value !== null && (
        <div
          className={`absolute -top-0.5 h-3 w-[3px] -translate-x-1/2 rounded-full ${inside ? 'bg-ink' : 'bg-error'}`}
          style={{ left: pct(value) }}
        />
      )}
    </div>
  )
}
