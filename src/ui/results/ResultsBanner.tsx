import { AlertTriangle, ChevronDown } from 'lucide-react'
import { useState } from 'react'
import type { ImportReport } from '../../import'
import { plural } from '../shell/blockReason'

interface ResultsBannerProps {
  readonly report: ImportReport
  readonly onBackToImport: () => void
}

/** Shown whenever results rest on out-of-range CCAs or there are warnings. */
export function ResultsBanner({ report, onBackToImport }: ResultsBannerProps) {
  const [open, setOpen] = useState(false)
  const warnings = report.issues.filter((i) => i.severity === 'warning')
  const outOfRange = report.outOfRange
  if (warnings.length === 0 && outOfRange.length === 0) return null
  const parts = [
    ...(outOfRange.length > 0 ? [`${plural(outOfRange.length, 'CCA')} out of range (accepted)`] : []),
    ...(warnings.length > 0 ? [plural(warnings.length, 'warning')] : []),
  ]
  return (
    <div className="border-b border-warning/30 bg-warning-bg">
      <div className="flex items-center gap-3 px-6 py-2">
        <AlertTriangle aria-hidden size={16} className="text-warning" />
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen(!open)}
          className="motion flex items-center gap-1 rounded-[2px] text-body font-medium text-warning hover:underline"
        >
          {parts.join(' · ')}
          <ChevronDown aria-hidden size={14} className={`motion ${open ? 'rotate-180' : ''}`} />
        </button>
        <button type="button" onClick={onBackToImport} className="motion ml-auto rounded-[2px] text-body font-medium text-ink underline-offset-2 hover:underline">
          Review in Import
        </button>
      </div>
      {open && (
        <ul className="max-h-48 overflow-y-auto border-t border-warning/20 px-6 py-2 text-body">
          {outOfRange.map((o) => (
            <li key={o.ccaID} className="py-0.5">
              <span className="font-medium">Out of range:</span> {o.name} — mean{' '}
              <span className="num">{o.mean?.toFixed(2) ?? '—'}</span>, SD <span className="num">{o.sd?.toFixed(2) ?? '—'}</span>
            </li>
          ))}
          {warnings.map((w, i) => (
            <li key={`${w.code}-${i}`} className="py-0.5 text-ink/80">
              {w.message}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
