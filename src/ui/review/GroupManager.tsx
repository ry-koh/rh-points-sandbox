import { ArrowDown, ArrowUp, Trash2 } from 'lucide-react'
import { useEffect, useId, useState, type Dispatch, type KeyboardEvent } from 'react'
import { MAX_GROUP_NAME_LENGTH, type CcaGroup } from '../../import/groups'
import { Button } from '../common/controls'
import { Modal } from '../common/Modal'
import type { Action } from '../state/store'
import { groupAction, type GroupOp } from './reviewHelpers'

interface GroupManagerProps {
  readonly open: boolean
  readonly groups: readonly CcaGroup[]
  readonly dispatch: Dispatch<Action>
  readonly onClose: () => void
}

const INPUT_CLASS = 'motion h-9 min-w-0 flex-1 rounded-[3px] border bg-card px-2 text-ui hover:border-ink/50'

/** A group id that is new on this computer; ids are never shown. */
const newGroupId = (): string => `g${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`

/** Enter commits and does not submit the dialog's form. */
const onEnter = (commit: () => void) => (event: KeyboardEvent): void => {
  if (event.key !== 'Enter') return
  event.preventDefault()
  commit()
}

function GroupRow({ group, first, last, apply }: {
  readonly group: CcaGroup
  readonly first: boolean
  readonly last: boolean
  /** Dispatches the change; returns the problem in words, or null. */
  readonly apply: (op: GroupOp) => string | null
}) {
  const [draft, setDraft] = useState(group.name)
  const [problem, setProblem] = useState<string | null>(null)
  const inputId = useId()
  useEffect(() => {
    setDraft(group.name)
    setProblem(null)
  }, [group.name])
  const commit = (): void => {
    if (draft === group.name) return
    setProblem(apply({ type: 'rename', id: group.id, name: draft }))
  }
  return (
    <li className="border-b border-rule py-2">
      <div className="flex items-center gap-2">
        <label htmlFor={inputId} className="sr-only">
          Name of {group.name}
        </label>
        <input
          id={inputId}
          value={draft}
          maxLength={MAX_GROUP_NAME_LENGTH}
          aria-invalid={problem !== null}
          autoComplete="off"
          onChange={(event) => setDraft(event.target.value)}
          onBlur={commit}
          onKeyDown={onEnter(commit)}
          className={`${INPUT_CLASS} ${problem ? 'border-error' : 'border-ink/20'}`}
        />
        <span className="num w-16 shrink-0 text-right text-cap text-muted">
          {group.ccaIDs.length} {group.ccaIDs.length === 1 ? 'CCA' : 'CCAs'}
        </span>
        <Button small variant="ghost" aria-label={`Move ${group.name} up`} disabled={first} onClick={() => apply({ type: 'move', id: group.id, step: -1 })}>
          <ArrowUp aria-hidden size={14} />
        </Button>
        <Button small variant="ghost" aria-label={`Move ${group.name} down`} disabled={last} onClick={() => apply({ type: 'move', id: group.id, step: 1 })}>
          <ArrowDown aria-hidden size={14} />
        </Button>
        <Button small variant="danger" aria-label={`Delete ${group.name}`} onClick={() => apply({ type: 'remove', id: group.id })}>
          <Trash2 aria-hidden size={13} />
        </Button>
      </div>
      {problem && <p role="alert" className="mt-1 text-cap text-error">{problem}</p>}
    </li>
  )
}

/**
 * Create, rename, reorder and delete CCA groups. Buttons and fields only, so all of it works from the
 * keyboard. Grouping is not a points input, so it stays available while the lists are finalised.
 */
export function GroupManager({ open, groups, dispatch, onClose }: GroupManagerProps) {
  const [name, setName] = useState('')
  const [problem, setProblem] = useState<string | null>(null)
  const newId = useId()
  const apply = (op: GroupOp): string | null => {
    const { action, problem: found } = groupAction(groups, op)
    if (action) dispatch(action)
    return found
  }
  const add = (): void => {
    const found = apply({ type: 'add', name, id: newGroupId() })
    setProblem(found)
    if (found === null) setName('')
  }
  const close = (): void => {
    setName('')
    setProblem(null)
    onClose()
  }
  return (
    <Modal open={open} title="Groups" wide onClose={close} footer={<Button variant="primary" onClick={close}>Done</Button>}>
      <p className="text-body text-muted">
        Group CCAs the way you review them, for example by portfolio. A group lists its CCAs A–Z; CCAs in no group come last. Move a CCA to a group from its own page.
      </p>
      {groups.length === 0 ? (
        <p className="mt-3 rounded-[4px] border border-dashed border-ink/20 px-3 py-4 text-center text-body text-muted">No groups yet</p>
      ) : (
        <ul className="mt-3 max-h-[40vh] overflow-y-auto border-t border-rule">
          {groups.map((group, i) => (
            <GroupRow key={group.id} group={group} first={i === 0} last={i === groups.length - 1} apply={apply} />
          ))}
        </ul>
      )}
      <p className="mt-2 text-cap text-muted">Deleting a group does not delete its CCAs: they move to Ungrouped.</p>
      <div className="mt-4">
        <label htmlFor={newId} className="text-body font-medium">
          New group
        </label>
        <div className="mt-1 flex items-center gap-2">
          <input
            id={newId}
            value={name}
            maxLength={MAX_GROUP_NAME_LENGTH}
            aria-invalid={problem !== null}
            autoComplete="off"
            placeholder="e.g. Sports"
            onChange={(event) => setName(event.target.value)}
            onKeyDown={onEnter(add)}
            className={`${INPUT_CLASS} ${problem ? 'border-error' : 'border-ink/20'}`}
          />
          <Button onClick={add}>Add group</Button>
        </div>
        {problem && <p role="alert" className="mt-1 text-cap text-error">{problem}</p>}
      </div>
    </Modal>
  )
}
