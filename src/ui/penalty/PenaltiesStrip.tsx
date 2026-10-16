import { ChevronDown, Lock } from 'lucide-react'
import { useState } from 'react'
import type { Lists } from '../../engine'
import { Button, StatusChip } from '../common/controls'
import type { Finalised, PenaltyLogEntry } from '../state/store'

interface PenaltiesStripProps {
  readonly finalised: Finalised
  readonly lists: Lists
  readonly undoError: string | null
  readonly onUndo: (entry: PenaltyLogEntry) => void
}

function currentStatus(lists: Lists, matric: string, removed: readonly string[]): string | null {
  if (removed.includes(matric)) return 'removed'
  const row = [...lists.maleStaying, ...lists.femaleStaying, ...lists.sem2].find((r) => r.matric === matric)
  return row?.status ?? null
}

/** Finalised banner plus the collapsible list of applied penalties, each with Undo. */
export function PenaltiesStrip({ finalised, lists, undoError, onUndo }: PenaltiesStripProps) {
  const [open, setOpen] = useState(true)
  const { log, penalty } = finalised
  return (
    <div className="border-b border-rule bg-gold-soft/60">
      <div className="flex items-center gap-3 px-6 py-2 text-body">
        <Lock aria-hidden size={14} />
        <span className="font-semibold">Finalised · settings locked</span>
        <span className="text-muted">Green cut-offs are frozen.</span>
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen(!open)}
          className="motion ml-auto flex items-center gap-1 rounded-[2px] font-medium hover:underline"
        >
          Penalties · <span className="num">{log.length}</span>
          <ChevronDown aria-hidden size={14} className={`motion ${open ? 'rotate-180' : ''}`} />
        </button>
      </div>
      {open && (
        <div className="border-t border-rule/70 px-6 py-2">
          {undoError && <p role="alert" className="pb-1 text-body text-error">{undoError}</p>}
          {log.length === 0 ? (
            <p className="text-body text-muted">No penalties yet. Open a resident to drop an incoming role.</p>
          ) : (
            <table className="w-full border-collapse text-body">
              <tbody>
                {log.map((entry) => (
                  <tr key={`${entry.key.matric}|${entry.key.ccaID}`} className="border-b border-rule/60 last:border-b-0">
                    <td className="py-1 pr-3 font-medium">{entry.residentName}</td>
                    <td className="py-1 pr-3 text-muted">{entry.ccaName}</td>
                    <td className="py-1 pr-3">{entry.outcome}</td>
                    <td className="py-1 pr-3"><StatusChip status={currentStatus(lists, entry.key.matric, penalty.removed)} /></td>
                    <td className="py-1 text-right"><Button small variant="ghost" onClick={() => onUndo(entry)}>Undo</Button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  )
}
