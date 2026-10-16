import { AlertTriangle, Lock } from 'lucide-react'
import { useState, type Dispatch } from 'react'
import { encryptWorkspace, serializeWorkspace, workspaceFilename } from '../../workspace'
import { Button } from '../common/controls'
import { Modal, TextField } from '../common/Modal'
import { downloadText } from '../export/exportCsv'
import type { Action, AppState } from '../state/store'
import { passwordProblem, toWorkspace } from '../state/workspaceState'

interface SaveWorkspaceDialogProps {
  readonly open: boolean
  readonly state: AppState
  readonly dispatch: Dispatch<Action>
  readonly onClose: () => void
}

/** Saves everything to a .rhps file the user downloads; password protection is on by default. */
export function SaveWorkspaceDialog({ open, state, dispatch, onClose }: SaveWorkspaceDialogProps) {
  const [protect, setProtect] = useState(true)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const close = (): void => {
    setPassword('')
    setConfirm('')
    setError(null)
    onClose()
  }
  const save = async (): Promise<void> => {
    const problem = protect ? passwordProblem(password, confirm) : null
    if (problem) {
      setError(problem)
      return
    }
    setBusy(true)
    try {
      const now = new Date()
      const json = serializeWorkspace(toWorkspace(state, now))
      const text = protect ? await encryptWorkspace(json, password) : json
      downloadText(workspaceFilename(now), text, 'application/octet-stream')
      dispatch({ type: 'markSaved', at: now.toISOString() })
      close()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The workspace could not be saved.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open={open}
      title="Save workspace"
      onClose={close}
      onSubmit={() => void save()}
      footer={
        <>
          <Button onClick={close}>Cancel</Button>
          <Button type="submit" variant="primary" disabled={busy}>
            {protect && <Lock aria-hidden size={13} />} {busy ? 'Saving…' : 'Save workspace'}
          </Button>
        </>
      }
    >
      <p>
        Saves the imported files, settings, overrides, discretion, wheel results and penalties into one
        file on this computer, so you can carry on later with Open workspace.
      </p>
      <label className="mt-3 flex items-center gap-2 text-body font-medium">
        <input type="checkbox" checked={protect} onChange={(event) => setProtect(event.target.checked)} className="accent-raffles" />
        Protect with a password (recommended)
      </label>
      {protect ? (
        <>
          <TextField label="Password (at least 8 characters)" type="password" value={password} onChange={setPassword} autoFocus />
          <TextField label="Type it again" type="password" value={confirm} onChange={setConfirm} />
          <p className="mt-2 text-cap text-muted">
            Keep the password safe. Nobody, not even the tool, can open this file without it.
          </p>
        </>
      ) : (
        <p role="alert" className="mt-3 flex items-start gap-2 border-l-4 border-warning bg-warning-bg px-3 py-2 text-body text-warning">
          <AlertTriangle aria-hidden size={15} className="mt-0.5 shrink-0" />
          Anyone with this file can read every resident's points.
        </p>
      )}
      {error && <p role="alert" className="mt-2 text-body text-error">{error}</p>}
    </Modal>
  )
}
