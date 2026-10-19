import { ChevronRight } from 'lucide-react'
import { useId, type ReactNode } from 'react'
import type { ScenarioConfig } from '../../engine'

export type Update = <K extends keyof ScenarioConfig>(key: K, value: ScenarioConfig[K]) => void

export interface SectionProps {
  readonly config: ScenarioConfig
  readonly update: Update
}

interface SectionShellProps {
  /** Lets another screen scroll to this section. */
  readonly id?: string
  readonly title: string
  readonly open: boolean
  readonly changed: number
  readonly onToggle: () => void
  readonly prominent?: boolean
  readonly children: ReactNode
}

/** Collapsible settings group; the header shows how many values differ from the defaults. */
export function Section({ id, title, open, changed, onToggle, prominent = false, children }: SectionShellProps) {
  const bodyId = useId()
  return (
    <section id={id} className={`scroll-mt-2 border-b border-rule ${prominent ? 'bg-gold-soft/40' : ''}`}>
      <h3>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={bodyId}
          onClick={onToggle}
          className="motion flex w-full items-center gap-2 px-4 py-2.5 text-left hover:bg-ink/[0.04]"
        >
          <ChevronRight aria-hidden size={14} className={`motion text-muted ${open ? 'rotate-90' : ''}`} />
          <span className={`flex-1 font-semibold ${prominent ? 'text-lead' : 'text-ui'}`}>{title}</span>
          {changed > 0 && (
            <span className="flex items-center gap-1 text-cap text-muted">
              <span className="h-1.5 w-1.5 rounded-full bg-gold" aria-hidden />
              {changed} changed
            </span>
          )}
        </button>
      </h3>
      {open && (
        <div id={bodyId} className="px-4 pb-3">
          {children}
        </div>
      )}
    </section>
  )
}
