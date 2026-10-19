import { useRef, useState, type Dispatch } from 'react'
import { parseWorkspaceFile, restoreWorkspace, type RestoredWorkspace } from '../../workspace'
import { Button, ConfirmDialog } from '../common/controls'
import { Modal, TextField } from '../common/Modal'
import type { Action } from '../state/store'
import { OPEN_ERRORS, fromRestored } from '../state/workspaceState'
import { OpenSummaryDialog } from './OpenSummaryDialog'

interface OpenWorkspaceProps {
  readonly dirty: boolean
  readonly dispatch: Dispatch<Action>
  /** Renders the trigger; call `start` to begin opening. */
  readonly children: (start: () => void) => React.ReactNode
}

type Stage =
  | { readonly kind: 'idle' }
  | { readonly kind: 'confirmReplace' }
  | { readonly kind: 'password'; readonly text: string; readonly error: string | null }
  | { readonly kind: 'error'; readonly message: string }
  | { readonly kind: 'summary'; readonly restored: RestoredWorkspace }

/** Open workspace: confirm unsaved changes, pick a .rhps file, ask for its password, load, summarise. */
export function OpenWorkspace({ dirty, dispatch, children }: OpenWorkspaceProps) {
  const input = useRef<HTMLInputElement>(null)
  const [stage, setStage] = useState<Stage>({ kind: 'idle' })
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)

  const pick = (): void => {
    setStage({ kind: 'idle' })
    input.current?.click()
  }
  const start = (): void => (dirty ? setStage({ kind: 'confirmReplace' }) : pick())

  const attempt = async (text: string, pw?: string): Promise<void> => {
    setBusy(true)
    const result = await parseWorkspaceFile(text, pw)
    setBusy(false)
    if (result.ok) {
      const restored = restoreWorkspace(result.workspace, result.notes)
      dispatch({ type: 'loadWorkspace', workspace: fromRestored(restored) })
      setPassword('')
      setStage({ kind: 'summary', restored })
    } else if (result.code === 'PASSWORD_REQUIRED' || result.code === 'WRONG_PASSWORD') {
      setStage({ kind: 'password', text, error: pw === undefined ? null : OPEN_ERRORS[result.code] })
    } else {
      setStage({ kind: 'error', message: OPEN_ERRORS[result.code] })
    }
  }
  const onFile = async (file: File | undefined): Promise<void> => {
    if (input.current) input.current.value = ''
    if (file) await attempt(await file.text())
  }
  const close = (): void => {
    setPassword('')
    setStage({ kind: 'idle' })
  }

  return (
    <>
      {children(start)}
      <input ref={input} type="file" accept=".rhps,application/json" hidden onChange={(event) => void onFile(event.target.files?.[0])} />
      <ConfirmDialog open={stage.kind === 'confirmReplace'} title="Replace what is open now?" confirmLabel="Open another workspace" onCancel={close} onConfirm={pick}>
        You have unsaved changes. Opening a workspace replaces the files, settings and adjustments that are open now. Save first if you want to keep them.
      </ConfirmDialog>
      <Modal
        open={stage.kind === 'password'}
        title="This workspace is protected"
        onClose={close}
        onSubmit={() => stage.kind === 'password' && void attempt(stage.text, password)}
        footer={
          <>
            <Button onClick={close}>Cancel</Button>
            <Button type="submit" variant="primary" disabled={busy || password === ''}>{busy ? 'Opening…' : 'Open workspace'}</Button>
          </>
        }
      >
        <p>Enter the password that was set when this workspace was saved.</p>
        <TextField label="Password" type="password" value={password} onChange={setPassword} autoFocus />
        {stage.kind === 'password' && stage.error && <p role="alert" className="mt-2 text-body text-error">{stage.error}</p>}
      </Modal>
      <ConfirmDialog open={stage.kind === 'error'} title="This workspace cannot be opened" confirmLabel="Choose another file" onCancel={close} onConfirm={pick}>
        {stage.kind === 'error' ? stage.message : ''}
      </ConfirmDialog>
      <OpenSummaryDialog restored={stage.kind === 'summary' ? stage.restored : null} onClose={close} />
    </>
  )
}
