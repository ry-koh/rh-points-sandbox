import { AlertTriangle, CheckCircle2 } from 'lucide-react'
import type { RestoredWorkspace } from '../../workspace'
import { Button } from '../common/controls'
import { Modal } from '../common/Modal'
import { cap } from '../drawer/drawerData'
import { MEMBERSHIP_FIELD_WORDS } from '../review/reviewHelpers'
import { countIssues, plural } from '../shell/blockReason'

interface OpenSummaryDialogProps {
  readonly restored: RestoredWorkspace | null
  /** The file's groups replaced the ones saved on this computer (D3). */
  readonly groupsReplaced?: boolean
  readonly onClose: () => void
}

function Line({ ok, children }: { readonly ok: boolean; readonly children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2 py-0.5">
      {ok ? <CheckCircle2 aria-hidden size={15} className="mt-0.5 shrink-0 text-ok" /> : <AlertTriangle aria-hidden size={15} className="mt-0.5 shrink-0 text-warning" />}
      <span>{children}</span>
    </li>
  )
}

const WAITING_FOR_BUNDLE =
  'Score edits, IHG tick edits, flat value edits, role and semester edits, vetted marks, CCA levels, discretion points, final-points overrides and wheel results will be checked once the RH-app bundle is loaded.'
const WAITING_FOR_IMPORT = 'Discretion points, final-points overrides and wheel results will be checked once the import has no errors.'

const WAITING_FOR_RESIDENTS =
  'AUX edits are unchecked: load the residents list and the RH-app bundle and they will be checked then.'

const waitingNote = (unchecked: RestoredWorkspace['unchecked']): string =>
  unchecked.review ? WAITING_FOR_BUNDLE : WAITING_FOR_IMPORT

/** What was just loaded, and anything in the file that no longer applies. */
export function OpenSummaryDialog({ restored, groupsReplaced = false, onClose }: OpenSummaryDialogProps) {
  if (!restored) return <Modal open={false} title="Workspace opened" onClose={onClose} footer={null}>{null}</Modal>
  const { workspace, report, stale, notes, unchecked } = restored
  const ccaName = (ccaID: string): string => report.bundle?.ccas.find((c) => c.ccaID === ccaID)?.ccaName ?? ccaID
  const reviewStale = stale.edits.length + stale.vetted.length + stale.ccaLevels.length + stale.tickEdits.length + stale.flatEdits.length + stale.auxEdits.length + stale.membershipEdits.length
  const { errors, warnings } = countIssues(report)
  const staleCount = stale.overrides.length + stale.discretion.length + stale.resolutions.length
  return (
    <Modal
      open
      wide
      title="Workspace opened"
      onClose={onClose}
      onSubmit={onClose}
      footer={<Button type="submit" variant="primary">Continue</Button>}
    >
      <ul className="text-body">
        {notes.map((note) => <Line key={note} ok={false}>{note}</Line>)}
        {report.bundle === null && <Line ok={false}>Load the RH-app bundle: it is not in this workspace.</Line>}
        <Line ok>{plural(workspace.files.length, 'file')} loaded and checked again.</Line>
        <Line ok={errors === 0}>
          {errors === 0 ? 'The files pass every check' : `${plural(errors, 'import error')} to fix`}
          {warnings > 0 ? ` · ${plural(warnings, 'warning')}` : ''}.
        </Line>
        <Line ok>Your settings were replaced by the ones saved in the file.</Line>
        {groupsReplaced && <Line ok>Groups from the file replaced this computer’s groups.</Line>}
        {unchecked.aux && <Line ok>{WAITING_FOR_RESIDENTS}</Line>}
        {unchecked.review || unchecked.computed ? (
          <Line ok>{waitingNote(unchecked)}</Line>
        ) : (
          <Line ok={staleCount === 0}>
            {staleCount === 0
              ? 'Every final-points override, discretion entry and wheel result still applies.'
              : `${plural(staleCount, 'saved item')} no longer match the files and are not used:`}
          </Line>
        )}
      </ul>
      {staleCount > 0 && (
        <ul className="mt-1 ml-6 list-disc text-body text-muted">
          {stale.overrides.map((o) => <li key={`o-${o.matric}-${o.ccaID}`}>Final points {o.finalPoints} for {o.matric} in {o.ccaID}</li>)}
          {stale.discretion.map((d) => <li key={`d-${d.matric}`}>Discretion for {d.matric}</li>)}
          {stale.resolutions.map((r) => <li key={`r-${r.list}-${r.order.join()}`}>Wheel result on {r.list} for {plural(r.order.length, 'resident')}</li>)}
        </ul>
      )}
      {reviewStale > 0 && (
        <ul className="mt-1 ml-6 list-disc text-body text-muted">
          {stale.edits.map((e) => <li key={`e-${e.entry.matric}-${e.entry.ccaID}-${e.entry.at}`}>Score edit for {e.entry.matric} in {e.entry.ccaID} no longer matches the file</li>)}
          {stale.vetted.map((v) => <li key={`v-${v.ccaID}`}>{ccaName(v.ccaID)} was vetted on an older file</li>)}
          {stale.tickEdits.map((t) => <li key={`t-${t.entry.matric}-${t.entry.ccaID}-${t.entry.at}`}>IHG tick edit for {t.entry.matric} in {t.entry.ccaID} no longer matches the file</li>)}
          {stale.flatEdits.map((f) => <li key={`f-${f.entry.matric}-${f.entry.ccaID}-${f.entry.at}`}>Flat value edit for {f.entry.matric} in {f.entry.ccaID} no longer matches the file</li>)}
          {stale.auxEdits.map((a) => <li key={`a-${a.entry.matric}-${a.entry.at}`}>AUX edit for {a.entry.matric} no longer matches the residents list</li>)}
          {stale.membershipEdits.map((m) => <li key={`m-${m.entry.matric}-${m.entry.ccaID}-${m.entry.field}-${m.entry.at}`}>{cap(MEMBERSHIP_FIELD_WORDS[m.entry.field])} for {m.entry.matric} in {m.entry.ccaID} no longer matches the file</li>)}
          {stale.ccaLevels.map((l) => <li key={`l-${l.ccaID}`}>{l.ccaID} has a level set but is not in the bundle</li>)}
        </ul>
      )}
      {staleCount > 0 && <p className="mt-2 text-cap text-muted">They are listed under Adjustments and Ties to resolve, where you can remove them.</p>}
    </Modal>
  )
}
