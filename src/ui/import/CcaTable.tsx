import { useState } from 'react'
import type { CcaStatus, PerCcaReport } from '../../import'
import { Button, Chip, ConfirmDialog, Eyebrow, type ChipTone } from '../common/controls'
import { RangeBar } from './RangeBar'

const STATUS: Readonly<Record<CcaStatus, { tone: ChipTone; label: string }>> = {
  ok: { tone: 'ok', label: 'ok' },
  out_of_range: { tone: 'error', label: 'out of range' },
  overridden: { tone: 'gold', label: 'overridden' },
  missing_file: { tone: 'grey', label: 'missing file' },
  flat: { tone: 'gold', label: 'flat' },
}

const fmt = (n: number | null): string => (n === null ? '—' : n.toFixed(2))

interface CcaTableProps {
  readonly rows: readonly PerCcaReport[]
  /** ccaIDs that have a waiver in JCRC's settings file (empty when none is loaded). */
  readonly waivers: ReadonlySet<string>
  readonly locked: boolean
  readonly onToggleOverride: (ccaID: string) => void
}

function Th({ children, right = false }: { readonly children: string; readonly right?: boolean }) {
  return (
    <th
      scope="col"
      className={`sticky top-0 bg-paper py-2 pr-4 text-cap font-semibold text-muted ${right ? 'text-right' : 'text-left'}`}
    >
      {children}
    </th>
  )
}

function Row({
  cca,
  waived,
  locked,
  onAsk,
}: {
  readonly cca: PerCcaReport
  readonly waived: boolean
  readonly locked: boolean
  readonly onAsk: (cca: PerCcaReport) => void
}) {
  const status = STATUS[cca.status]
  return (
    <tr className="border-b border-rule hover:bg-ink/[0.03]">
      <td className="py-2 pr-4">
        <div className="font-medium">{cca.name}</div>
        <div className="font-mono text-cap text-muted">{cca.ccaID}</div>
      </td>
      <td className="max-w-48 truncate py-2 pr-4 font-mono text-cap text-muted" title={cca.fileName ?? ''}>
        {cca.fileName ?? '—'}
      </td>
      <td className="num py-2 pr-4 text-right">{cca.n}</td>
      {cca.status === 'flat' ? (
        <td colSpan={6} className="py-2 pr-4 text-muted">
          Flat · <span className="num">{cca.flatPoints ?? 0}</span> pts <span className="text-cap">(no mean/SD check)</span>
        </td>
      ) : (
        <MeanSdCells cca={cca} waived={waived} />
      )}
      <td className="py-2 pr-4">
        <Chip tone={status.tone}>{status.label}</Chip>
      </td>
      <td className="py-2 text-right">
        {cca.status === 'out_of_range' && (
          <Button small disabled={locked} onClick={() => onAsk(cca)}>
            Override
          </Button>
        )}
        {cca.status === 'overridden' && (
          <Button small variant="ghost" disabled={locked} onClick={() => onAsk(cca)}>
            Undo override
          </Button>
        )}
      </td>
    </tr>
  )
}

function MeanSdCells({ cca, waived }: { readonly cca: PerCcaReport; readonly waived: boolean }) {
  const { range } = cca
  return (
    <>
      <td className="num py-2 pr-4 text-right">{fmt(cca.mean)}</td>
      <td className="num py-2 pr-4 text-cap text-muted">
        {range.meanMin}–{range.meanMax}
        {waived && (
          <span className="ml-1.5 font-sans">
            <Chip tone="outline">waiver</Chip>
          </span>
        )}
      </td>
      <td className="py-2 pr-4">
        <RangeBar label="Mean" value={cca.mean} min={range.meanMin} max={range.meanMax} />
      </td>
      <td className="num py-2 pr-4 text-right">{fmt(cca.sd)}</td>
      <td className="num py-2 pr-4 text-cap text-muted">
        {range.sdMin}–{range.sdMax}
      </td>
      <td className="py-2 pr-4">
        <RangeBar label="SD" value={cca.sd} min={range.sdMin} max={range.sdMax} />
      </td>
    </>
  )
}

export function CcaTable({ rows, waivers, locked, onToggleOverride }: CcaTableProps) {
  const [asking, setAsking] = useState<PerCcaReport | null>(null)
  if (rows.length === 0) return null
  const undo = asking?.status === 'overridden'
  const close = (): void => setAsking(null)
  return (
    <section aria-labelledby="cca-table-title" className="mt-10">
      <div className="flex items-baseline justify-between border-b-2 border-ink pb-2">
        <h2 id="cca-table-title" className="text-title font-semibold">
          Mean and SD check
        </h2>
        <Eyebrow>{rows.length} CCAs</Eyebrow>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[960px] border-collapse text-body">
          <thead>
            <tr className="border-b border-rule">
              <Th>CCA</Th>
              <Th>File</Th>
              <Th right>Members</Th>
              <Th right>Mean</Th>
              <Th>Allowed</Th>
              <Th>{' '}</Th>
              <Th right>SD</Th>
              <Th>Allowed</Th>
              <Th>{' '}</Th>
              <Th>Status</Th>
              <Th>{' '}</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((cca) => (
              <Row key={cca.ccaID} cca={cca} waived={waivers.has(cca.ccaID)} locked={locked} onAsk={setAsking} />
            ))}
          </tbody>
        </table>
      </div>
      <ConfirmDialog
        open={asking !== null}
        title={undo ? `Undo the override for ${asking?.name ?? ''}?` : `Override ${asking?.name ?? ''}?`}
        confirmLabel={undo ? 'Undo override' : 'Override mean/SD check'}
        onCancel={close}
        onConfirm={() => {
          if (asking) onToggleOverride(asking.ccaID)
          close()
        }}
      >
        {asking && (
          <>
            <p>
              Mean <span className="num">{fmt(asking.mean)}</span> (allowed{' '}
              <span className="num">
                {asking.range.meanMin}–{asking.range.meanMax}
              </span>
              ), SD <span className="num">{fmt(asking.sd)}</span> (allowed{' '}
              <span className="num">
                {asking.range.sdMin}–{asking.range.sdMax}
              </span>
              ).
            </p>
            <p className="mt-2 text-muted">
              {undo
                ? 'The CCA will block results again until its file is fixed.'
                : 'Results will use these scores as they are. The override is listed at the top of every export.'}
            </p>
          </>
        )}
      </ConfirmDialog>
    </section>
  )
}
