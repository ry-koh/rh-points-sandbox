import { ArrowRight, Lock, ShieldCheck } from 'lucide-react'
import { Fragment } from 'react'

export type Screen = 'import' | 'results' | 'compare'

interface TopBarProps {
  readonly screen: Screen
  /** Why each step is locked, or null when it can be opened. */
  readonly locks: Readonly<Record<Screen, string | null>>
  readonly finalised: boolean
  readonly onNavigate: (screen: Screen) => void
}

const STEPS: readonly { readonly screen: Screen; readonly label: string }[] = [
  { screen: 'import', label: 'Import' },
  { screen: 'results', label: 'Results' },
  { screen: 'compare', label: 'Compare' },
]

function StepButton({ index, label, active, disabledReason, onClick }: {
  readonly index: number
  readonly label: string
  readonly active: boolean
  readonly disabledReason: string | null
  readonly onClick: () => void
}) {
  const disabled = disabledReason !== null
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-current={active ? 'step' : undefined}
      title={disabled ? `${label} is locked: ${disabledReason}` : undefined}
      className={`motion relative flex h-14 items-center gap-2 px-1 text-ui font-medium ${
        active ? 'text-ink' : disabled ? 'text-muted/60' : 'text-muted hover:text-ink'
      }`}
    >
      <span className={`num flex h-5 w-5 items-center justify-center rounded-full text-cap ${active ? 'bg-raffles text-white' : 'border border-current'}`}>
        {index}
      </span>
      {label}
      {disabled && <span className="sr-only">(locked: {disabledReason})</span>}
      <span className={`motion absolute inset-x-0 -bottom-px h-[3px] bg-raffles ${active ? 'opacity-100' : 'opacity-0'}`} />
    </button>
  )
}

export function TopBar({ screen, locks, finalised, onNavigate }: TopBarProps) {
  return (
    <header className="sticky top-0 z-30 border-b border-rule bg-paper/95 backdrop-blur-sm">
      <div className="h-1 bg-raffles" />
      <div className="mx-auto flex max-w-[1920px] items-center gap-8 px-6">
        <div className="flex items-baseline gap-3">
          <span className="text-title font-semibold tracking-tight">RH Points Sandbox</span>
          <span className="hidden text-cap text-muted xl:inline">Raffles Hall · AY26/27</span>
        </div>
        <nav aria-label="Steps" className="flex items-center gap-3">
          {STEPS.map((step, i) => (
            <Fragment key={step.screen}>
              {i > 0 && <ArrowRight aria-hidden size={14} className="text-muted" />}
              <StepButton
                index={i + 1}
                label={step.label}
                active={screen === step.screen}
                disabledReason={locks[step.screen]}
                onClick={() => onNavigate(step.screen)}
              />
            </Fragment>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          {finalised && (
            <span className="flex items-center gap-1.5 rounded-[3px] bg-gold-soft px-2 py-1 text-cap font-medium">
              <Lock aria-hidden size={13} /> Finalised
            </span>
          )}
          <div
            className="flex items-center gap-1.5 rounded-[3px] border border-ok/30 bg-ok-bg px-2 py-1 text-cap font-medium text-ok"
            title="Files are read in this browser tab only. Nothing is uploaded; reloading the page clears all resident data."
          >
            <ShieldCheck aria-hidden size={14} />
            Data stays on this computer
          </div>
        </div>
      </div>
    </header>
  )
}
