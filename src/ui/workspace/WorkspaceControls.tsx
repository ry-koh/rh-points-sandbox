import { FolderOpen, Save } from 'lucide-react'
import { useState, type Dispatch } from 'react'
import { Button } from '../common/controls'
import type { Action, AppState } from '../state/store'
import { savedLabel } from '../state/workspaceState'
import { OpenWorkspace } from './OpenWorkspace'
import { SaveWorkspaceDialog } from './SaveWorkspaceDialog'

interface WorkspaceControlsProps {
  readonly state: AppState
  readonly dispatch: Dispatch<Action>
}

/** Top-bar Save / Open workspace, with the unsaved-changes dot and the last-saved time. */
export function WorkspaceControls({ state, dispatch }: WorkspaceControlsProps) {
  const [saving, setSaving] = useState(false)
  const status = state.dirty ? 'Unsaved changes' : state.savedAt ? savedLabel(state.savedAt) : null
  return (
    <div className="flex items-center gap-2">
      {status && <span className="hidden text-cap text-muted lg:inline" role="status">{status}</span>}
      <OpenWorkspace dirty={state.dirty} groupsReplaced={state.groupsReplaced} dispatch={dispatch}>
        {(start) => (
          <Button small onClick={start}>
            <FolderOpen aria-hidden size={13} /> Open workspace
          </Button>
        )}
      </OpenWorkspace>
      <Button small onClick={() => setSaving(true)} aria-label={state.dirty ? 'Save workspace (unsaved changes)' : 'Save workspace'}>
        <Save aria-hidden size={13} /> Save workspace
        {state.dirty && <span className="h-1.5 w-1.5 rounded-full bg-gold" title="Unsaved changes" aria-hidden />}
      </Button>
      <SaveWorkspaceDialog open={saving} state={state} dispatch={dispatch} onClose={() => setSaving(false)} />
    </div>
  )
}
