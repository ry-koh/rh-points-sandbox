import type { Role } from '../../engine'
import { Chip } from '../common/controls'
import { IHG_LABELS } from '../import/CcaTable'
import type { SummaryMembership, SummaryRow } from './summaryData'

const ROLE_LABELS: Readonly<Record<Role, string>> = { none: '—', head: 'Head', vice_head: 'Vice head' }

function MembershipLine({ m }: { readonly m: SummaryMembership }) {
  return (
    <tr className="border-b border-rule/70">
      <td className="py-1.5 pr-4 font-medium">{m.ccaName}</td>
      <td className="num py-1.5 pr-4 text-right">
        {m.flatPoints !== null ? <>flat {m.flatPoints}{m.flatEdited && <> (was {m.flatFile})</>}</> : m.basePoints}
        {m.edited && <span className="ml-1.5 align-middle"><Chip tone="warning">edited</Chip></span>}
      </td>
      <td className="py-1.5 pr-4">{m.semesterOnly ? 'yes' : '—'}</td>
      <td className="py-1.5 pr-4">{ROLE_LABELS[m.outgoingRole]}</td>
      <td className="py-1.5 pr-4">{ROLE_LABELS[m.incomingRole]}</td>
      <td className="py-1.5 pr-4">{m.ihg ? 'ticked' : '—'}</td>
      <td className="py-1.5">
        {m.levelName ?? <span className="text-muted">none</span>}
        {m.tweaked && <span className="ml-1.5 align-middle"><Chip tone="gold">tweaked</Chip></span>}
      </td>
    </tr>
  )
}

/** One resident's inputs: reviewed scores and roles per CCA, IHG ticks and the JCRC note. */
export function ResidentSummary({ row }: { readonly row: SummaryRow }) {
  return (
    <div className="px-2 py-3">
      {row.jcrcNote && (
        <p className="mb-2 text-body text-muted">
          JCRC {row.jcrc === 'FULL' ? 'full year' : 'exchange'} — {row.jcrcNote}.
        </p>
      )}
      {row.ihg.length > 0 && (
        <p className="mb-2 text-body">
          IHG: {row.ihg.map((e) => `${e.ccaID} (${IHG_LABELS[e.result]})`).join(', ')}
        </p>
      )}
      {row.memberships.length === 0 ? (
        <p className="text-body text-muted">No CCA memberships.</p>
      ) : (
        <table className="w-full max-w-4xl border-collapse text-body">
          <thead>
            <tr className="border-b border-rule text-left text-cap font-semibold text-muted">
              <th scope="col" className="py-1.5 pr-4">CCA</th>
              <th scope="col" className="py-1.5 pr-4 text-right">Reviewed score</th>
              <th scope="col" className="py-1.5 pr-4">Semester only</th>
              <th scope="col" className="py-1.5 pr-4">Outgoing</th>
              <th scope="col" className="py-1.5 pr-4">Incoming</th>
              <th scope="col" className="py-1.5 pr-4">IHG</th>
              <th scope="col" className="py-1.5">Level</th>
            </tr>
          </thead>
          <tbody>
            {row.memberships.map((m) => (
              <MembershipLine key={m.ccaID} m={m} />
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
