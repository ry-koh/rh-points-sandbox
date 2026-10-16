import type { MembershipResult, PenaltyKey, PenaltyState, ResidentResult } from '../../engine'
import { Lock } from 'lucide-react'
import { Fragment, useState } from 'react'
import { Button, Chip } from '../common/controls'
import { POINTS_DECIMALS } from '../export/exportCsv'
import { isDropped, roleLabel, type DrawerInputs } from './drawerData'
import { FinalPointsEditor, type DrawerEditing } from './Editors'

const MULT_DECIMALS = 2
const pts = (n: number): string => n.toFixed(POINTS_DECIMALS)
const mult = (n: number): string => `×${n.toFixed(MULT_DECIMALS)}`

interface MembershipTableProps {
  readonly result: ResidentResult
  readonly inputs: DrawerInputs
  readonly penalty: PenaltyState | undefined
  readonly onDropRole: ((key: PenaltyKey) => void) | null
  readonly editing: DrawerEditing | null
}

const HEADERS: readonly [string, string][] = [
  ['Type', ''], ['Base', 'Base points as exported'], ['Sem', 'Semester-only'],
  ['Eff.', 'Effective base'], ['Out / In', 'Outgoing / incoming role'], ['×Stay', 'Staying multiplier'],
  ['×Bid', 'Bidding multiplier'], ['Place', 'Placement bonus'], ['IHG', 'IHG in this net'],
  ['Stay net', ''], ['Bid net', ''],
]

interface HeaderProps {
  readonly matric: string
  readonly m: MembershipResult
  readonly inputs: DrawerInputs
  readonly penalty: PenaltyState | undefined
  readonly onDropRole: ((key: PenaltyKey) => void) | null
  readonly editing: DrawerEditing | null
}

/** CCA name, Flat / Final chips, the final-points editor and the drop-role action. */
function CcaHeader({ matric, m, inputs, penalty, onDropRole, editing }: HeaderProps) {
  const [open, setOpen] = useState(false)
  const own = inputs.memberships.find((x) => x.ccaID === m.ccaID)
  const dropped = isDropped(penalty, matric, m.ccaID)
  const canDrop = onDropRole !== null && own !== undefined && own.incomingRole !== 'none' && !dropped && m.final === null
  const override = editing?.overrides.find((o) => o.matric === matric && o.ccaID === m.ccaID)
  return (
    <td colSpan={HEADERS.length} className="pt-2 pr-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-body font-medium">{inputs.ccas.get(m.ccaID)?.ccaName ?? m.ccaID}</span>
        {own?.flatPoints !== undefined && <Chip tone="gold">Flat (JCRC)</Chip>}
        {m.final?.kind === 'override' && <Chip tone="gold">Final: {m.final.value}</Chip>}
        {dropped && <Chip tone="removed">role dropped</Chip>}
        {editing && !open && (
          editing.locked ? (
            override && <span className="flex items-center gap-1 text-cap text-muted"><Lock aria-hidden size={11} /> locked</span>
          ) : (
            <Button small variant="ghost" onClick={() => setOpen(true)}>{override ? 'Edit final points' : 'Set final points'}</Button>
          )
        )}
        {canDrop && (
          <Button small variant="danger" onClick={() => onDropRole({ matric, ccaID: m.ccaID })}>
            Drop incoming role
          </Button>
        )}
      </div>
      {m.final && <p className="mt-0.5 text-cap text-muted">{m.final.text}</p>}
      {open && editing && !editing.locked && (
        <FinalPointsEditor matric={matric} ccaID={m.ccaID} editing={editing} onDone={() => setOpen(false)} />
      )}
    </td>
  )
}

/** One row per membership; every number comes from the engine's membership result. */
export function MembershipTable({ result, inputs, penalty, onDropRole, editing }: MembershipTableProps) {
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
            const dropped = isDropped(penalty, result.matric, m.ccaID)
            return (
              <Fragment key={m.ccaID}>
                <tr className="border-t border-rule">
                  <CcaHeader matric={result.matric} m={m} inputs={inputs} penalty={penalty} onDropRole={onDropRole} editing={editing} />
                </tr>
                <tr className="align-top">
                  <td className="py-1.5 pr-2">{m.isHalf ? '0.5x' : '1x'}</td>
                  <td className="num py-1.5 pr-2 text-right">{own?.flatPoints !== undefined ? '—' : (own?.basePoints ?? '—')}</td>
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
