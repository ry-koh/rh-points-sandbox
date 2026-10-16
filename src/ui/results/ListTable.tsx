import type { ListRow, ScenarioConfig, TieFlag } from '../../engine'
import { Chip, StatusChip } from '../common/controls'
import { POINTS_DECIMALS, type ListKey } from '../export/exportCsv'
import { bandRows } from './bands'

const INFORMATIONAL = 'informational'
const COLUMN_COUNT = 7

interface ListTableProps {
  readonly list: ListKey
  readonly rows: readonly ListRow[]
  readonly config: ScenarioConfig
  readonly search: string
  readonly onOpen: (matric: string) => void
  /** Staying lists only: open the wheel dialog for this row's tie group, or clear its result. */
  readonly onTie?: (matric: string) => void
  readonly onClearTie?: (matric: string) => void
}

interface TieHandlers {
  readonly onTie?: (matric: string) => void
  readonly onClearTie?: (matric: string) => void
}

/** Tie flags; on staying lists each is a button that records the wheel result. */
function TieCell({ row, onTie, onClearTie }: { readonly row: ListRow } & TieHandlers) {
  const stop = (fn: () => void) => (event: React.MouseEvent) => {
    event.stopPropagation()
    fn()
  }
  if (!onTie || row.tieFlags.length === 0) {
    return <>{row.tieFlags.map((flag: TieFlag) => <Chip key={flag.boundary} tone="gold">TIE {flag.boundary} · {flag.k} of {flag.n}</Chip>)}</>
  }
  if (row.tieFlags.every((f) => f.resolved === true)) {
    return (
      <>
        <Chip tone="ok">Wheel result saved</Chip>
        <button type="button" onClick={stop(() => onTie(row.matric))} className="motion rounded-[2px] px-1 text-cap font-medium underline-offset-2 hover:underline">Edit</button>
        {onClearTie && <button type="button" onClick={stop(() => onClearTie(row.matric))} className="motion rounded-[2px] px-1 text-cap font-medium text-raffles underline-offset-2 hover:underline">Clear</button>}
      </>
    )
  }
  return (
    <>
      {row.tieFlags.map((flag) => (
        <button
          key={flag.boundary}
          type="button"
          onClick={stop(() => onTie(row.matric))}
          onKeyDown={(event) => event.stopPropagation()}
          title="Record the wheel result for this tie"
          className="motion inline-flex h-5 items-center rounded-[3px] bg-gold-soft px-1.5 text-cap font-medium whitespace-nowrap ring-1 ring-gold/60 hover:bg-gold/30"
        >
          TIE {flag.boundary} · {flag.k} of {flag.n}
        </button>
      ))}
    </>
  )
}

const BAND_RULE: Readonly<Record<string, string>> = {
  green: 'border-ok text-ok',
  grey: 'border-grey text-grey',
  white: 'border-ink/40 text-ink',
  removed: 'border-raffles text-raffles',
}

function Row({ row, onOpen, onTie, onClearTie }: { readonly row: ListRow; readonly onOpen: (matric: string) => void } & TieHandlers) {
  return (
    <tr
      tabIndex={0}
      data-row-matric={row.matric}
      aria-label={`${row.name}, rank ${row.rank}. Press Enter for the breakdown.`}
      onClick={() => onOpen(row.matric)}
      onKeyDown={(event) => {
        if (event.key !== 'Enter') return
        // Stop the same keypress from also activating a button inside the drawer.
        event.preventDefault()
        onOpen(row.matric)
      }}
      className="motion cursor-pointer border-b border-rule/70 hover:bg-gold-soft/50 focus-visible:bg-gold-soft/50 focus-visible:outline-offset-[-2px]"
    >
      <td className="num py-1.5 pr-4 pl-4 text-right text-muted">{row.rank}</td>
      <td className="py-1.5 pr-4 font-medium">{row.name}</td>
      <td className="py-1.5 pr-4 font-mono text-cap text-muted">{row.matric}</td>
      <td className="num py-1.5 pr-6 text-right">{row.points.toFixed(POINTS_DECIMALS)}</td>
      <td className="py-1.5 pr-4">
        <StatusChip status={row.status} />
      </td>
      <td className="py-1.5 pr-4">
        <div className="flex flex-wrap items-center gap-1">
          <TieCell row={row} onTie={onTie} onClearTie={onClearTie} />
        </div>
      </td>
      <td className="py-1.5 pr-4">
        <div className="flex flex-wrap gap-1">
          {row.labels.map((label) => (
            <Chip key={label} tone={label.startsWith(INFORMATIONAL) ? 'warning' : 'outline'}>
              {label}
            </Chip>
          ))}
        </div>
      </td>
    </tr>
  )
}

function Divider({ label, status, shown, total }: { readonly label: string; readonly status: string; readonly shown: number; readonly total: number }) {
  return (
    <tr>
      <td colSpan={COLUMN_COUNT} className="pt-4 pb-1 pl-4">
        <div className={`flex items-baseline gap-3 border-b-2 pb-1 text-cap font-semibold tracking-[0.06em] uppercase ${BAND_RULE[status] ?? ''}`}>
          {label}
          <span className="num font-normal tracking-normal text-muted normal-case">
            {shown === total ? `${total} listed` : `${shown} of ${total} match`}
          </span>
        </div>
      </td>
    </tr>
  )
}

export function ListTable({ list, rows, config, search, onOpen, onTie, onClearTie }: ListTableProps) {
  const bands = bandRows(list, rows, config, search)
  const shown = bands.reduce((n, band) => n + band.rows.length, 0)
  return (
    <div className="min-h-0 flex-1 overflow-auto">
      <table className="w-full min-w-[700px] border-collapse text-body">
        <thead className="sticky top-0 z-10 bg-paper shadow-[0_1px_0_var(--color-ink)]">
          <tr className="text-left text-cap font-semibold text-muted">
            <th scope="col" className="py-2 pr-4 pl-4 text-right">Rank</th>
            <th scope="col" className="py-2 pr-4">Name</th>
            <th scope="col" className="py-2 pr-4">Matric</th>
            <th scope="col" className="py-2 pr-6 text-right">Points</th>
            <th scope="col" className="py-2 pr-4">Status</th>
            <th scope="col" className="py-2 pr-4">Tie flags</th>
            <th scope="col" className="py-2 pr-4">Labels</th>
          </tr>
        </thead>
        <tbody>
          {bands.map((band) => (
            <BandRows key={band.status || 'all'} label={band.label} status={band.status} rows={band.rows} total={rows.filter((r) => r.status === band.status).length} onOpen={onOpen} onTie={onTie} onClearTie={onClearTie} />
          ))}
          {shown === 0 && (
            <tr>
              <td colSpan={COLUMN_COUNT} className="py-8 text-center text-muted">
                {rows.length === 0 ? 'Nobody on this list.' : 'No name or matric matches the search.'}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

function BandRows({ label, status, rows, total, onOpen, onTie, onClearTie }: { readonly label: string; readonly status: string; readonly rows: readonly ListRow[]; readonly total: number; readonly onOpen: (matric: string) => void } & TieHandlers) {
  return (
    <>
      {label !== '' && <Divider label={label} status={status} shown={rows.length} total={total} />}
      {rows.map((row) => (
        <Row key={`${row.matric}-${row.labels.join()}`} row={row} onOpen={onOpen} onTie={onTie} onClearTie={onClearTie} />
      ))}
    </>
  )
}
