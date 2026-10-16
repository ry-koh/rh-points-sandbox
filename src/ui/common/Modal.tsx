import { useEffect, useRef, type FormEvent, type ReactNode } from 'react'

interface ModalProps {
  readonly open: boolean
  readonly title: string
  readonly children: ReactNode
  /** The buttons; a submit button submits the form (Enter works in any field). */
  readonly footer: ReactNode
  readonly onClose: () => void
  readonly onSubmit?: () => void
  readonly wide?: boolean
}

/** Native modal dialog with a form body: focus is trapped and Escape closes. */
export function Modal({ open, title, children, footer, onClose, onSubmit, wide = false }: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])
  const submit = (event: FormEvent): void => {
    event.preventDefault()
    onSubmit?.()
  }
  return (
    <dialog
      ref={ref}
      aria-label={title}
      onCancel={(event) => {
        event.preventDefault()
        onClose()
      }}
      className={`m-auto ${wide ? 'w-[min(640px,calc(100vw-32px))]' : 'w-[min(480px,calc(100vw-32px))]'} rounded-[4px] border border-rule bg-card p-0 text-ink shadow-xl`}
    >
      {open && (
        <form onSubmit={submit} className="border-t-4 border-raffles px-5 pt-4 pb-5">
          <h2 className="text-lead font-semibold">{title}</h2>
          <div className="mt-2 text-ui text-ink/80">{children}</div>
          <div className="mt-5 flex justify-end gap-2">{footer}</div>
        </form>
      )}
    </dialog>
  )
}

/** A labelled text/password input in the house style. */
export function TextField({ label, type = 'text', value, onChange, autoFocus = false, maxLength }: {
  readonly label: string
  readonly type?: 'text' | 'password'
  readonly value: string
  readonly onChange: (value: string) => void
  readonly autoFocus?: boolean
  readonly maxLength?: number
}) {
  return (
    <label className="mt-3 block text-body">
      <span className="font-medium">{label}</span>
      <input
        type={type}
        value={value}
        autoFocus={autoFocus}
        maxLength={maxLength}
        autoComplete={type === 'password' ? 'new-password' : 'off'}
        onChange={(event) => onChange(event.target.value)}
        className="motion mt-1 block h-9 w-full rounded-[3px] border border-ink/20 bg-card px-2 text-ui hover:border-ink/50"
      />
    </label>
  )
}
