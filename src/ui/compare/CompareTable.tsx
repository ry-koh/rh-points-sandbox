import { ArrowRight } from 'lucide-react'
import type { CompareRow } from '../../engine'
import { StatusChip } from '../common/controls'
import { POINTS_DECIMALS } from '../export/exportCsv'

const COLUMN_COUNT = 5

const sortKey = (row: CompareRow): number => (row.rankDelta === null ? Number.POSITIVE_INFINITY : Math.abs(row.rankDelta))

/** Biggest rank moves first; residents on only one side lead. */
export function sortRows(rows: readonly CompareRow[]): CompareRow[] {
  return [...rows].sort((x, y) => sortKey(y) - sortKey(x) || (x.rankA ?? x.rankB ?? 0) - (y.rankA ?? y.rankB ?? 0))
}

function Delta({ value, digits, invert = false }: { readonly value: number | null; readonly digits: number; readonly invert?: boolean }) {
  if (value === null || Number(value.toFixed(digits)) === 0) return <span className="num w-16 text-right text-muted">—</span>
  const better = invert ? value < 0 : value > 0
  return (
    <span className={`num w-16 text-right ${better ? 'text-ok' : 'text-error'}`}>
      {value > 0 ? '+' : ''}
      {value.toFixed(digits)}
    </span>
  )
}

const val = (n: number | null, digits: number): string => (n === null ? '—' : n.toFixed(digits))

function Row({ row }: { readonly row: CompareRow }) {
  return (
    <tr className="border-b border-rule/70 hover:bg-gold-soft/50">
      <td className="py-1.5 pr-4 pl-4 whitespace-nowrap">
        <div className="font-medium">{row.name}</div>
        <div className="font-mono text-cap text-muted">{row.matric}</div>
      </td>
      <td className="py-1.5 pr-4">
        <span className="flex items-center gap-1.5">
          <StatusChip status={row.statusA} />
          <ArrowRight aria-label="to" size={12} className="text-muted" />
          <StatusChip status={row.statusB} />
        </span>
      </td>
      <td className="py-1.5 pr-4">
        <span className="flex items-center justify-end gap-2">
          <span className="num">{val(row.rankA, 0)}</span>
          <ArrowRight aria-label="to" size={12} className="text-muted" />
          <span className="num">{val(row.rankB, 0)}</span>
          <Delta value={row.rankDelta} digits={0} invert />
        </span>
      </td>
      <td className="py-1.5 pr-4">
        <span className="flex items-center justify-end gap-2">
          <span className="num">{val(row.pointsA, POINTS_DECIMALS)}</span>
          <ArrowRight aria-label="to" size={12} className="text-muted" />
          <span className="num">{val(row.pointsB, POINTS_DECIMALS)}</span>
          <Delta value={row.pointsDelta} digits={POINTS_DECIMALS} />
        </span>
      </td>
      <td />
    </tr>
  )
}

export function CompareTable({ rows }: { readonly rows: readonly CompareRow[] }) {
  return (
    <div className="min-h-0 flex-1 overflow-auto">
      <table className="w-full min-w-[760px] border-collapse text-body">
        <thead className="sticky top-0 z-10 bg-paper shadow-[0_1px_0_var(--color-ink)]">
          <tr className="text-left text-cap font-semibold text-muted">
            <th scope="col" className="py-2 pr-4 pl-4">Resident</th>
            <th scope="col" className="py-2 pr-4">Status A → B</th>
            <th scope="col" className="py-2 pr-4 text-right">Rank A → B (Δ)</th>
            <th scope="col" className="py-2 pr-4 text-right">Points A → B (Δ)</th>
            <th scope="col" />
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => <Row key={row.matric} row={row} />)}
          {rows.length === 0 && (
            <tr><td colSpan={COLUMN_COUNT} className="py-8 text-center text-muted">Nobody to show. Turn off “Changed only” to see everyone.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
