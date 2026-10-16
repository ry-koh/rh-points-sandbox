import { useEffect, useRef, type ButtonHTMLAttributes, type ReactNode } from 'react'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'

const VARIANTS: Readonly<Record<Variant, string>> = {
  primary:
    'bg-raffles text-white hover:bg-raffles-dark active:translate-y-px disabled:bg-rule disabled:text-muted',
  secondary:
    'border border-ink/25 bg-card text-ink hover:border-ink hover:bg-paper active:translate-y-px disabled:text-muted disabled:border-rule',
  ghost: 'text-ink hover:bg-ink/5 active:bg-ink/10 disabled:text-muted',
  danger: 'border border-error/40 text-error hover:bg-error-bg active:translate-y-px',
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  readonly variant?: Variant
  readonly small?: boolean
}

export function Button({ variant = 'secondary', small = false, className = '', ...rest }: ButtonProps) {
  const size = small ? 'h-7 px-2.5 text-cap' : 'h-9 px-3.5 text-ui'
  return (
    <button
      type="button"
      className={`motion inline-flex items-center gap-1.5 rounded-[3px] font-medium whitespace-nowrap ${size} ${VARIANTS[variant]} ${className}`}
      {...rest}
    />
  )
}

export type ChipTone = 'ok' | 'grey' | 'outline' | 'removed' | 'error' | 'warning' | 'gold'

const TONES: Readonly<Record<ChipTone, string>> = {
  ok: 'bg-ok-bg text-ok',
  grey: 'bg-grey-bg text-grey',
  outline: 'border border-ink/30 text-ink',
  removed: 'text-raffles line-through',
  error: 'bg-error-bg text-error',
  warning: 'bg-warning-bg text-warning',
  gold: 'bg-gold-soft text-ink',
}

export function Chip({ tone, children }: { readonly tone: ChipTone; readonly children: ReactNode }) {
  return (
    <span
      className={`inline-flex h-5 items-center rounded-[3px] px-1.5 text-cap font-medium whitespace-nowrap ${TONES[tone]}`}
    >
      {children}
    </span>
  )
}

const STATUS_TONES: Readonly<Record<string, ChipTone>> = {
  green: 'ok',
  grey: 'grey',
  white: 'outline',
  removed: 'removed',
  spot: 'ok',
  'no spot': 'outline',
}

export function StatusChip({ status }: { readonly status: string | null }) {
  if (status === null) return <span className="text-cap text-muted">—</span>
  return <Chip tone={STATUS_TONES[status] ?? 'outline'}>{status}</Chip>
}

interface ConfirmProps {
  readonly open: boolean
  readonly title: string
  readonly confirmLabel: string
  readonly children: ReactNode
  readonly onConfirm: () => void
  readonly onCancel: () => void
}

/** Native modal dialog: focus is trapped and Escape cancels. */
export function ConfirmDialog({ open, title, confirmLabel, children, onConfirm, onCancel }: ConfirmProps) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])
  return (
    <dialog
      ref={ref}
      onCancel={(event) => {
        event.preventDefault()
        onCancel()
      }}
      className="m-auto w-[min(480px,calc(100vw-32px))] rounded-[4px] border border-rule bg-card p-0 text-ink shadow-xl"
    >
      <div className="border-t-4 border-raffles px-5 pt-4 pb-5">
        <h2 className="text-lead font-semibold">{title}</h2>
        <div className="mt-2 text-ui text-ink/80">{children}</div>
        <div className="mt-5 flex justify-end gap-2">
          <Button onClick={onCancel}>Cancel</Button>
          <Button variant="primary" onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </dialog>
  )
}

/** Small uppercase label used above sections. */
export function Eyebrow({ children }: { readonly children: ReactNode }) {
  return <div className="text-cap font-semibold tracking-[0.08em] text-muted uppercase">{children}</div>
}
