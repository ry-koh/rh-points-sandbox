import type { ResidentResult, ScenarioConfig } from '../../engine'
import { POINTS_DECIMALS } from '../export/exportCsv'
import type { DrawerInputs } from './drawerData'

const pts = (n: number): string => n.toFixed(POINTS_DECIMALS)

function SumRow({ label, value, strong = false }: { readonly label: string; readonly value: string; readonly strong?: boolean }) {
  return (
    <tr className={strong ? 'border-t-2 border-ink font-semibold' : 'border-t border-rule'}>
      <td colSpan={4} className="py-1.5 pr-2">{label}</td>
      <td className="num py-1.5 text-right">{value}</td>
    </tr>
  )
}

interface BuildProps {
  readonly result: ResidentResult
  readonly inputs: DrawerInputs
  readonly config: ScenarioConfig
}

function auxNote(inputs: DrawerInputs, config: ScenarioConfig): string {
  const aux = inputs.resident?.aux
  if (aux === undefined) return 'AUX'
  return aux > config.auxCap ? `AUX: ${aux} (capped at ${config.auxCap})` : `AUX: ${aux}`
}

export function StayingBuild({ result, inputs, config }: BuildProps) {
  const { staying } = result
  const name = (id: string): string => inputs.ccas.get(id)?.ccaName ?? id
  return (
    <table className="w-full border-collapse text-body">
      <thead>
        <tr className="border-b border-ink text-left text-cap text-muted">
          <th scope="col" className="py-1.5 pr-2 font-semibold">#</th>
          <th scope="col" className="py-1.5 pr-2 font-semibold">Slot</th>
          <th scope="col" className="py-1.5 pr-2 text-right font-semibold">Value</th>
          <th scope="col" className="py-1.5 pr-2 text-right font-semibold">Weight</th>
          <th scope="col" className="py-1.5 text-right font-semibold">Contribution</th>
        </tr>
      </thead>
      <tbody>
        {staying.slots.map((slot, i) => (
          <tr key={slot.ccaIDs.join('+')} className="border-b border-rule/60">
            <td className="num py-1 pr-2 text-muted">{i + 1}</td>
            <td className="py-1 pr-2">{slot.ccaIDs.map(name).join(' + ')}</td>
            <td className="num py-1 pr-2 text-right">{pts(slot.value)}</td>
            <td className="num py-1 pr-2 text-right">{slot.weight}</td>
            <td className="num py-1 text-right">{pts(slot.contribution)}</td>
          </tr>
        ))}
        <SumRow label={staying.usedGreedyPairing ? 'Sum of slots (halves paired greedily)' : 'Sum of slots'} value={pts(staying.slotTotal)} />
        <SumRow label={auxNote(inputs, config)} value={pts(staying.auxPoints)} />
        <SumRow label="Flat IHG" value={pts(staying.flatIHG)} />
        <SumRow label="Staying points" value={pts(staying.points)} strong />
      </tbody>
    </table>
  )
}

export function BiddingBuild({ result, inputs, config }: BuildProps) {
  const { bidding } = result
  const netTotal = bidding.contributions.reduce((sum, c) => sum + c.bidNet, 0)
  return (
    <table className="w-full border-collapse text-body">
      <tbody>
        {bidding.contributions.map((c) => (
          <tr key={c.ccaID} className="border-b border-rule/60">
            <td colSpan={4} className="py-1 pr-2">{inputs.ccas.get(c.ccaID)?.ccaName ?? c.ccaID}</td>
            <td className="num py-1 text-right">{pts(c.bidNet)}</td>
          </tr>
        ))}
        <SumRow label="Sum of bidding nets (every CCA at 100%)" value={pts(netTotal)} />
        <SumRow label={auxNote(inputs, config)} value={pts(bidding.auxPoints)} />
        <SumRow label="Flat IHG" value={pts(bidding.flatIHG)} />
        <SumRow label="Bidding points" value={pts(bidding.points)} strong />
      </tbody>
    </table>
  )
}
