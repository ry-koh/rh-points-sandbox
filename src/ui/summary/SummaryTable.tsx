import { ChevronDown, ChevronRight } from 'lucide-react'
import { Fragment } from 'react'
import { Button, Chip } from '../common/controls'
import { DiscretionEditor, type DrawerEditing } from '../drawer/Editors'
import { discretionSummary } from '../drawer/editorState'
import { ResidentSummary } from './ResidentSummary'
import type { SummaryRow } from './summaryData'

interface SummaryTableProps {
  readonly rows: readonly SummaryRow[]
  readonly editing: DrawerEditing
  readonly expanded: ReadonlySet<string>
  readonly discretionOpen: ReadonlySet<string>
  readonly onToggleExpanded: (matric: string) => void
  readonly onToggleDiscretion: (matric: string) => void
}

const COLUMNS = 8

export function SummaryTable({ rows, editing, expanded, discretionOpen, onToggleExpanded, onToggleDiscretion }: SummaryTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[900px] border-collapse text-body">
        <thead>
          <tr className="border-b border-rule text-left text-cap font-semibold text-muted">
            <th scope="col" className="w-8 py-2"><span className="sr-only">Details</span></th>
            <th scope="col" className="py-2 pr-4">Name</th>
            <th scope="col" className="py-2 pr-4">Matric</th>
            <th scope="col" className="py-2 pr-4">Gender</th>
            <th scope="col" className="py-2 pr-4">Sem-2</th>
            <th scope="col" className="py-2 pr-4 text-right">AUX</th>
            <th scope="col" className="py-2 pr-4">JCRC</th>
            <th scope="col" className="py-2">Discretion</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const isOpen = expanded.has(row.matric)
            const editorOpen = discretionOpen.has(row.matric)
            return (
              <Fragment key={row.matric}>
                <tr className="border-b border-rule hover:bg-ink/[0.03]">
                  <td className="py-1.5">
                    <button
                      type="button"
                      aria-expanded={isOpen}
                      aria-label={`${isOpen ? 'Hide' : 'Show'} details for ${row.name}`}
                      onClick={() => onToggleExpanded(row.matric)}
                      className="motion rounded-[3px] p-1 hover:bg-ink/5"
                    >
                      {isOpen ? <ChevronDown aria-hidden size={15} /> : <ChevronRight aria-hidden size={15} />}
                    </button>
                  </td>
                  <td className="py-1.5 pr-4 font-medium">{row.name}</td>
                  <td className="py-1.5 pr-4 font-mono text-cap text-muted">{row.matric}</td>
                  <td className="py-1.5 pr-4">{row.gender}</td>
                  <td className="py-1.5 pr-4">{row.sem2 ? <Chip tone="gold">sem-2</Chip> : '—'}</td>
                  <td className="num py-1.5 pr-4 text-right">{row.aux}</td>
                  <td className="py-1.5 pr-4">
                    {row.jcrc === 'N' ? '—' : <span title={row.jcrcNote ?? ''}><Chip tone="outline">{row.jcrc}</Chip></span>}
                  </td>
                  <td className="py-1.5">
                    <div className="flex items-center gap-2">
                      {row.discretion && <span className="max-w-72 truncate text-cap" title={discretionSummary(row.discretion)}>{discretionSummary(row.discretion)}</span>}
                      <Button small variant="ghost" aria-expanded={editorOpen} onClick={() => onToggleDiscretion(row.matric)}>
                        {editorOpen ? 'Close' : row.discretion ? 'Edit' : 'Add'}
                      </Button>
                    </div>
                  </td>
                </tr>
                {editorOpen && (
                  <tr className="border-b border-rule bg-paper">
                    <td />
                    <td colSpan={COLUMNS - 1} className="px-2 py-3">
                      <DiscretionEditor matric={row.matric} editing={editing} />
                    </td>
                  </tr>
                )}
                {isOpen && (
                  <tr className="border-b border-rule bg-paper">
                    <td />
                    <td colSpan={COLUMNS - 1}>
                      <ResidentSummary row={row} />
                    </td>
                  </tr>
                )}
              </Fragment>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
