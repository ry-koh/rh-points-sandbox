import { ArrowRight } from 'lucide-react'
import { useMemo } from 'react'
import {
  applyPenalty,
  computeAll,
  type Lists,
  type PenaltyKey,
  type PenaltyState,
  type PipelineInput,
  type ScenarioConfig,
} from '../../engine'
import { ConfirmDialog } from '../common/controls'
import { POINTS_DECIMALS } from '../export/exportCsv'
import type { PenaltyLogEntry } from '../state/store'
import { describeOutcome } from './outcome'

interface PenaltyDialogProps {
  readonly target: PenaltyKey | null
  readonly input: PipelineInput
  readonly config: ScenarioConfig
  readonly penalty: PenaltyState
  readonly lists: Lists
  readonly onCancel: () => void
  readonly onConfirm: (penalty: PenaltyState, entry: PenaltyLogEntry) => void
}

type Preview =
  | { readonly ok: false; readonly error: string }
  | { readonly ok: true; readonly penalty: PenaltyState; readonly entry: PenaltyLogEntry; readonly stay: [number, number]; readonly bid: [number, number]; readonly cutoff: number | null }

/** Runs the penalty on a copy of the state so the user sees the effect before committing. */
function preview(props: PenaltyDialogProps, target: PenaltyKey): Preview {
  const { input, config, penalty, lists } = props
  const applied = applyPenalty(input, config, penalty, target)
  if (!applied.ok) return { ok: false, error: applied.error }
  const resident = input.residents.find((r) => r.matric === target.matric)
  const before = computeAll(input, config, penalty)
  const after = computeAll(input, config, applied.state)
  const was = before.results.find((r) => r.matric === target.matric)
  const now = after.results.find((r) => r.matric === target.matric)
  if (!resident || !was || !now) return { ok: false, error: 'This resident is not in the imported data.' }
  const newlyRemoved = applied.state.removed.includes(target.matric) && !penalty.removed.includes(target.matric)
  const outcome = describeOutcome(resident, lists, after.lists, newlyRemoved)
  const ccaName = input.ccas.find((c) => c.ccaID === target.ccaID)?.ccaName ?? target.ccaID
  return {
    ok: true,
    penalty: applied.state,
    entry: { key: target, residentName: resident.name, ccaName, outcome },
    stay: [was.staying.points, now.staying.points],
    bid: [was.bidding.points, now.bidding.points],
    cutoff: resident.sem2 ? null : penalty.cutoffs[resident.gender],
  }
}

const pts = (n: number): string => n.toFixed(POINTS_DECIMALS)

function Change({ label, values, note }: { readonly label: string; readonly values: [number, number]; readonly note?: string }) {
  return (
    <tr className="border-b border-rule">
      <th scope="row" className="py-1.5 pr-3 text-left font-normal text-muted">{label}</th>
      <td className="num py-1.5 text-right">{pts(values[0])}</td>
      <td className="px-2 text-muted"><ArrowRight aria-hidden size={13} /></td>
      <td className="num py-1.5 text-right font-medium">{pts(values[1])}</td>
      <td className="py-1.5 pl-3 text-cap text-muted">{note}</td>
    </tr>
  )
}

export function PenaltyDialog(props: PenaltyDialogProps) {
  const { target, input, config, penalty, lists, onCancel, onConfirm } = props
  const result = useMemo(
    () => (target ? preview({ target, input, config, penalty, lists, onCancel, onConfirm }, target) : null),
    // The preview depends only on the target and the data; callbacks are not inputs.
    [target, input, config, penalty, lists],
  )
  return (
    <ConfirmDialog
      open={target !== null}
      title={result?.ok ? `Drop ${result.entry.residentName}'s incoming role in ${result.entry.ccaName}?` : 'Drop incoming role'}
      confirmLabel="Apply penalty"
      onCancel={onCancel}
      onConfirm={() => {
        if (result?.ok) onConfirm(result.penalty, result.entry)
        else onCancel()
      }}
    >
      {result && !result.ok && <p role="alert" className="text-error">{result.error}</p>}
      {result?.ok && (
        <>
          <table className="w-full border-collapse text-body">
            <tbody>
              <Change label="Staying" values={result.stay} note={result.cutoff === null ? 'no frozen cut-off' : `frozen green cut-off ${pts(result.cutoff)}`} />
              <Change label="Bidding" values={result.bid} note="informational — rooms may already be picked" />
            </tbody>
          </table>
          <p className="mt-3 border-l-4 border-gold bg-gold-soft px-3 py-2 font-medium text-ink">{result.entry.outcome}</p>
        </>
      )}
    </ConfirmDialog>
  )
}
