import type { CcaType, IhgPlacement } from '../../engine'
import type { CcaStatus, PerCcaReport } from '../../import'
import { Chip, Eyebrow, type ChipTone } from '../common/controls'
import { RangeBar } from './RangeBar'

const STATUS: Readonly<Record<CcaStatus, { tone: ChipTone; label: string }>> = {
  ok: { tone: 'ok', label: 'ok' },
  out_of_range: { tone: 'warning', label: 'out of range' },
  missing_file: { tone: 'grey', label: 'missing file' },
  flat: { tone: 'gold', label: 'flat' },
}

const fmt = (n: number | null): string => (n === null ? '—' : n.toFixed(2))

export const IHG_LABELS: Readonly<Record<IhgPlacement, string>> = {
  '1st': '1st',
  '2nd': '2nd',
  '3rd': '3rd',
  '3rd4th_no_match': '3rd–4th, no match',
}

interface NotSetFields {
  readonly type: CcaType | null
  readonly isSport: boolean
  readonly ihgResult: IhgPlacement | null
  readonly ihgCap: number | null
  readonly flatPoints: number | null
  readonly level: string | null
  readonly fileName: string | null
}

/**
 * What the RH app (type, a sport's IHG result and cap) or the sandbox (level) left unset for a CCA
 * (D9). Flat CCAs need none of them; a CCA without a leader file needs no level.
 */
export function notSet(cca: NotSetFields): { readonly type: boolean; readonly ihg: boolean; readonly level: boolean } {
  const flat = cca.flatPoints !== null
  return {
    type: !flat && cca.type === null,
    ihg: !flat && cca.isSport && (cca.ihgResult === null || cca.ihgCap === null),
    level: !flat && cca.fileName !== null && cca.level === null,
  }
}

/** The amber "not set" chips for a CCA; nothing when everything is set. */
export function NotSetChips({ cca }: { readonly cca: NotSetFields }) {
  const missing = notSet(cca)
  return (
    <>
      {missing.type && <Chip tone="warning">type not set</Chip>}
      {missing.ihg && <Chip tone="warning">IHG not set</Chip>}
      {missing.level && <Chip tone="warning">level needed</Chip>}
    </>
  )
}

interface CcaTableProps {
  readonly rows: readonly PerCcaReport[]
  /** ccaIDs that have a waiver in JCRC's settings file (empty when none is loaded). */
  readonly waivers: ReadonlySet<string>
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
}: {
  readonly cca: PerCcaReport
  readonly waived: boolean
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
        <div className="flex flex-wrap gap-1">
          <Chip tone={status.tone}>{status.label}</Chip>
          <NotSetChips cca={cca} />
        </div>
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

export function CcaTable({ rows, waivers }: CcaTableProps) {
  if (rows.length === 0) return null
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
            </tr>
          </thead>
          <tbody>
            {rows.map((cca) => (
              <Row key={cca.ccaID} cca={cca} waived={waivers.has(cca.ccaID)} />
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
