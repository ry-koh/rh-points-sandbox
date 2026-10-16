import type { PenaltyKey, PenaltyState, ResidentResult } from '../../engine'
import { Fragment } from 'react'
import { Button, Chip } from '../common/controls'
import { POINTS_DECIMALS } from '../export/exportCsv'
import { isDropped, roleLabel, type DrawerInputs } from './drawerData'

const MULT_DECIMALS = 2
const pts = (n: number): string => n.toFixed(POINTS_DECIMALS)
const mult = (n: number): string => `×${n.toFixed(MULT_DECIMALS)}`

interface MembershipTableProps {
  readonly result: ResidentResult
  readonly inputs: DrawerInputs
  readonly penalty: PenaltyState | undefined
  readonly onDropRole: ((key: PenaltyKey) => void) | null
}

const HEADERS: readonly [string, string][] = [
  ['Type', ''], ['Base', 'Base points as exported'], ['Sem', 'Semester-only'],
  ['Eff.', 'Effective base'], ['Out / In', 'Outgoing / incoming role'], ['×Stay', 'Staying multiplier'],
  ['×Bid', 'Bidding multiplier'], ['Place', 'Placement bonus'], ['IHG', 'IHG in this net'],
  ['Stay net', ''], ['Bid net', ''],
]

/** One row per membership; every number comes from the engine's membership result. */
export function MembershipTable({ result, inputs, penalty, onDropRole }: MembershipTableProps) {
  if (result.memberships.length === 0) {
    const why = result.jcrc ? 'A JCRC resident’s value does not come from CCAs.' : 'No CCA files list this resident.'
    return <p className="text-body text-muted">{why}</p>
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-cap">
        <thead>
          <tr className="border-b border-ink text-left text-muted">
            {HEADERS.map(([label, title]) => (
              <th key={label} scope="col" title={title || undefined} className="py-1.5 pr-2 font-semibold whitespace-nowrap">
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {result.memberships.map((m) => {
            const own = inputs.memberships.find((x) => x.ccaID === m.ccaID)
            const cca = inputs.ccas.get(m.ccaID)
            const dropped = isDropped(penalty, result.matric, m.ccaID)
            const canDrop = onDropRole !== null && own !== undefined && own.incomingRole !== 'none' && !dropped
            return (
              <Fragment key={m.ccaID}>
              <tr className="border-t border-rule">
                <td colSpan={HEADERS.length} className="pt-2 pr-2">
                  <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-body">{cca?.ccaName ?? m.ccaID}</span>
                  {dropped && <Chip tone="removed">role dropped</Chip>}
                  {m.final && <span className="text-cap text-muted">{m.final.text}</span>}
                  {canDrop && (
                    <Button small variant="danger" onClick={() => onDropRole({ matric: result.matric, ccaID: m.ccaID })}>
                      Drop incoming role
                    </Button>
                  )}
                </div>
                </td>
              </tr>
              <tr className="align-top">
                <td className="py-1.5 pr-2">{m.isHalf ? '0.5x' : '1x'}</td>
                <td className="num py-1.5 pr-2 text-right">{own?.basePoints ?? '—'}</td>
                <td className="py-1.5 pr-2">{own === undefined ? '—' : own.semesterOnly ? 'Y' : '—'}</td>
                <td className="num py-1.5 pr-2 text-right">{m.effBase.toFixed(MULT_DECIMALS)}</td>
                <td className="py-1.5 pr-2 whitespace-nowrap">
                  {roleLabel(own?.outgoingRole ?? 'none')} / <span className={dropped ? 'line-through text-raffles' : ''}>{roleLabel(own?.incomingRole ?? 'none')}</span>
                </td>
                <td className="num py-1.5 pr-2">{mult(m.stayMult)}</td>
                <td className="num py-1.5 pr-2">{mult(m.bidMult)}</td>
                <td className="num py-1.5 pr-2 text-right">{m.placement}</td>
                <td className="num py-1.5 pr-2 text-right">{m.ihgNet}</td>
                <td className="num py-1.5 pr-2 text-right font-medium">{pts(m.stayNet)}</td>
                <td className="num py-1.5 text-right font-medium">{pts(m.bidNet)}</td>
              </tr>
              </Fragment>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
