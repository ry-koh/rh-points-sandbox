import type { PerCcaReport } from '../../import'
import { RangeBar } from '../import/RangeBar'

const DECIMALS = 2
const fmt = (n: number): string => n.toFixed(DECIMALS)

/** Where a value sits against its allowed range, in plain words. */
function judge(what: string, value: number | null, min: number, max: number): { readonly text: string; readonly inside: boolean } {
  if (value === null) return { text: `${what}: no scores yet`, inside: true }
  if (value < min) return { text: `${what} ${fmt(value)} is ${fmt(min - value)} below the allowed ${min}–${max}`, inside: false }
  if (value > max) return { text: `${what} ${fmt(value)} is ${fmt(value - max)} above the allowed ${min}–${max}`, inside: false }
  return { text: `${what} ${fmt(value)} is inside ${min}–${max}`, inside: true }
}

function Gauge({ what, value, min, max, n }: {
  readonly what: string
  readonly value: number | null
  readonly min: number
  readonly max: number
  readonly n: number
}) {
  const verdict = judge(what, value, min, max)
  return (
    <div className="min-w-0 flex-1">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-cap font-semibold tracking-[0.08em] text-muted uppercase">{what}</span>
        <span className={`num text-title font-semibold ${verdict.inside ? '' : 'text-warning'}`}>{value === null ? '—' : fmt(value)}</span>
      </div>
      <RangeBar label={`${what} (n = ${n})`} value={value} min={min} max={max} className="mt-1.5 w-full" />
      <p className={`mt-1 text-cap ${verdict.inside ? 'text-muted' : 'text-warning'}`}>{verdict.text}</p>
    </div>
  )
}

/** The CCA's live mean and SD over the reviewed scores, against its allowed range. Never blocks. */
export function MeanSdMeter({ cca }: { readonly cca: PerCcaReport }) {
  const { range } = cca
  const outside = cca.status === 'out_of_range'
  return (
    <section aria-label="Mean and SD" className="rounded-[4px] border border-rule bg-card px-4 py-3">
      <div className="flex flex-wrap gap-6">
        <Gauge what="Mean" value={cca.mean} min={range.meanMin} max={range.meanMax} n={cca.n} />
        <Gauge what="SD" value={cca.sd} min={range.sdMin} max={range.sdMax} n={cca.n} />
      </div>
      <p className="num mt-2 border-t border-rule pt-2 text-cap text-muted">
        n = {cca.n} · reviewed scores, semester-only members unhalved ·{' '}
        <span className={outside ? 'font-medium text-warning' : ''}>out of range is allowed</span>
        {outside && ', and is listed on every export'}
      </p>
    </section>
  )
}
