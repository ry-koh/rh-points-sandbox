import { ArrowDown, ArrowUp } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { ListRow, WheelResolution } from '../../engine'
import { Button } from '../common/controls'
import { Modal } from '../common/Modal'
import { LIST_TITLES } from '../export/exportCsv'
import { groupMatrics, moveItem, seatsText, type TieGroup } from './wheel'

interface WheelDialogProps {
  readonly group: TieGroup | null
  readonly onSave: (resolution: WheelResolution) => void
  readonly onClose: () => void
}

/** Record the wheel's order for one boundary tie group. Reordering uses ↑/↓ buttons only. */
export function WheelDialog({ group, onSave, onClose }: WheelDialogProps) {
  const [rows, setRows] = useState<readonly ListRow[]>([])
  useEffect(() => setRows(group?.rows ?? []), [group])
  if (!group) return <Modal open={false} title="Record wheel result" onClose={onClose} footer={null}>{null}</Modal>
  const move = (index: number, delta: number): void => setRows(moveItem(rows, index, delta))
  return (
    <Modal
      open
      wide
      title="Record wheel result"
      onClose={onClose}
      onSubmit={() => onSave({ list: group.list, order: rows.map((r) => r.matric) })}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary">Save wheel result</Button>
        </>
      }
    >
      <p>
        {LIST_TITLES[group.list]}: these residents are tied on exactly the same points. Spin the wheel, then put
        them in the order it gave, first place at the top.
      </p>
      <ul className="mt-2 text-body font-medium">
        {group.flags.map((flag) => <li key={flag.boundary}>{seatsText(flag)}.</li>)}
      </ul>
      <ol className="mt-3 divide-y divide-rule border-y border-rule" aria-label="Wheel order">
        {rows.map((row, i) => (
          <li key={row.matric} className="flex items-center gap-3 py-1.5">
            <span className="num w-6 text-right text-muted">{i + 1}</span>
            <span className="min-w-0 flex-1 font-medium">{row.name}</span>
            <span className="font-mono text-cap text-muted">{row.matric}</span>
            <span className="num w-20 text-right">{row.points.toFixed(3)}</span>
            <Button small variant="ghost" aria-label={`Move ${row.name} up`} disabled={i === 0} onClick={() => move(i, -1)}>
              <ArrowUp aria-hidden size={13} />
            </Button>
            <Button small variant="ghost" aria-label={`Move ${row.name} down`} disabled={i === rows.length - 1} onClick={() => move(i, 1)}>
              <ArrowDown aria-hidden size={13} />
            </Button>
          </li>
        ))}
      </ol>
      <p className="mt-2 text-cap text-muted">
        {groupMatrics(group).length} tied residents. Wheel results can still be changed after finalising.
      </p>
    </Modal>
  )
}
