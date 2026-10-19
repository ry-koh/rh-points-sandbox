import { ArrowRight, Lock } from 'lucide-react'
import { useMemo, useState, type Dispatch } from 'react'
import { MAX_REASON_LENGTH } from '../../engine'
import { checklistRows, type ChecklistRow, type ChecklistStatus } from '../../import'
import { Button, Chip, Eyebrow, type ChipTone } from '../common/controls'
import { Modal, TextField } from '../common/Modal'
import { IHG_LABELS, notSet } from '../import/CcaTable'
import { plural } from '../shell/blockReason'
import type { Action, AppState } from '../state/store'

interface ChecklistScreenProps {
  readonly state: AppState
  readonly dispatch: Dispatch<Action>
  /** Why Review is locked, or null when it can be opened. */
  readonly reviewLock: string | null
  readonly onContinue: () => void
}

const STATUS: Readonly<Record<ChecklistStatus, { tone: ChipTone; label: string }>> = {
  present: { tone: 'ok', label: 'present' },
  flat: { tone: 'gold', label: 'flat' },
  not_submitting: { tone: 'grey', label: 'not submitting' },
  missing: { tone: 'error', label: 'missing' },
  superseded: { tone: 'outline', label: 'superseded' },
}

/** An ISO time from a file, in this computer's local time; the raw text when it does not parse. */
export function localTime(iso: string): string {
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? iso : date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}

const NotSetChip = () => <Chip tone="warning">not set</Chip>

function IhgCell({ row }: { readonly row: ChecklistRow }) {
  if (!row.isSport) return <span className="text-muted">—</span>
  if (notSet(row).ihg || row.ihgResult === null) return <NotSetChip />
  return (
    <span className="num">
      {IHG_LABELS[row.ihgResult]} · cap {row.ihgCap}
    </span>
  )
}

interface RowProps {
  readonly row: ChecklistRow
  readonly members: number | null
  readonly locked: boolean
  readonly onMark: () => void
  readonly onClear: () => void
}

function Row({ row, members, locked, onMark, onClear }: RowProps) {
  const status = STATUS[row.status]
  const marked = row.status === 'not_submitting' || row.status === 'superseded'
  return (
    <tr className={`border-b border-rule hover:bg-ink/[0.03] ${row.status === 'missing' ? 'bg-error-bg/40' : ''}`}>
      <td className="py-2 pr-4">
        <div className="font-medium">{row.name}</div>
        <div className="font-mono text-cap text-muted">{row.ccaID}</div>
      </td>
      {row.flatPoints !== null ? (
        <td colSpan={2} className="py-2 pr-4 text-muted">
          flat · <span className="num">{row.flatPoints}</span> pts
        </td>
      ) : (
        <>
          <td className="py-2 pr-4">{row.type === null ? <NotSetChip /> : <span className="num">{row.type}</span>}</td>
          <td className="py-2 pr-4">
            <IhgCell row={row} />
          </td>
        </>
      )}
      <td className="max-w-48 truncate py-2 pr-4 font-mono text-cap text-muted" title={row.fileName ?? ''}>
        {row.fileName ?? '—'}
      </td>
      <td className="num py-2 pr-4 text-right">{members ?? '—'}</td>
      <td className="py-2 pr-4">
        <Chip tone={status.tone}>{status.label}</Chip>
        {row.status === 'superseded' && <div className="mt-0.5 text-cap text-muted">The file arrived; it wins.</div>}
      </td>
      <td className="max-w-56 py-2 pr-4 text-body text-muted">{row.note || (marked ? <span className="italic">no note</span> : '')}</td>
      <td className="py-2 text-right">
        {row.status === 'missing' && (
          <Button small disabled={locked} onClick={onMark}>
            Mark not submitting
          </Button>
        )}
        {marked && (
          <Button small variant="ghost" disabled={locked} onClick={onClear}>
            Clear
          </Button>
        )}
      </td>
    </tr>
  )
}

function summaryLine(rows: readonly ChecklistRow[]): string {
  const count = (statuses: readonly ChecklistStatus[]): number => rows.filter((r) => statuses.includes(r.status)).length
  const unset = rows.filter((r) => {
    const missing = notSet(r)
    return missing.type || missing.ihg
  }).length
  return [
    `${count(['present', 'superseded'])} of ${rows.length} present`,
    `${count(['flat'])} flat`,
    `${count(['not_submitting'])} not submitting`,
    `${count(['missing'])} missing`,
    `${unset} not set in RH-app`,
  ].join(' · ')
}

function NotSubmittingDialog({ row, onClose, onSave }: {
  readonly row: ChecklistRow | null
  readonly onClose: () => void
  readonly onSave: (note: string) => void
}) {
  const [note, setNote] = useState('')
  const close = (): void => {
    setNote('')
    onClose()
  }
  return (
    <Modal
      open={row !== null}
      title={`Mark ${row?.name ?? ''} as not submitting?`}
      onClose={close}
      onSubmit={() => {
        onSave(note.trim())
        setNote('')
      }}
      footer={
        <>
          <Button onClick={close}>Cancel</Button>
          <Button type="submit" variant="primary">
            Mark not submitting
          </Button>
        </>
      }
    >
      <p>Its members get no points from it. If its file arrives later, the file wins.</p>
      <TextField label="Note (optional)" value={note} onChange={setNote} autoFocus maxLength={MAX_REASON_LENGTH} />
    </Modal>
  )
}

export function ChecklistScreen({ state, dispatch, reviewLock, onContinue }: ChecklistScreenProps) {
  const { report, review } = state
  const locked = state.finalised !== null
  const rows = useMemo(() => checklistRows(report, review.notSubmitting), [report, review.notSubmitting])
  const [marking, setMarking] = useState<ChecklistRow | null>(null)
  const members = (ccaID: string): number | null => {
    const cca = report.perCca.find((c) => c.ccaID === ccaID)
    return cca && (cca.fileName !== null || cca.status === 'flat') ? cca.n : null
  }
  const bundle = report.bundle
  const sports = rows.filter((r) => r.isSport).length
  return (
    <main className="mx-auto w-full max-w-[1600px] min-h-0 flex-1 overflow-y-auto px-6 pt-8 pb-16">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-rule pb-5">
        <div>
          <h1 className="text-display font-semibold tracking-tight">Checklist</h1>
          <p className="mt-1 text-ui">
            {bundle ? `Bundle exported ${localTime(bundle.exportedAt)}` : 'No bundle'} · {plural(rows.length, 'CCA')} · {plural(sports, 'sport')}
          </p>
          <p className="mt-1 max-w-2xl text-body text-muted">
            Type, IHG result and cap come from the RH app. To change one, edit it on /admin/points and
            download the bundle again.
          </p>
        </div>
        <Button variant="primary" disabled={reviewLock !== null} onClick={onContinue} className="h-11 px-5 text-lead">
          {reviewLock === null ? (
            <>
              Continue to Review <ArrowRight aria-hidden size={18} />
            </>
          ) : (
            <>
              <Lock aria-hidden size={16} /> {reviewLock}
            </>
          )}
        </Button>
      </div>
      {locked && (
        <p role="status" className="mt-6 flex items-center gap-2 border-l-4 border-gold bg-gold-soft px-4 py-3 text-body font-medium">
          <Lock aria-hidden size={15} /> Finalised · checklist locked. Unlock the lists on the Results screen to change it.
        </p>
      )}
      <section aria-labelledby="checklist-title" className="mt-8">
        <div className="flex flex-wrap items-baseline justify-between gap-2 border-b-2 border-ink pb-2">
          <h2 id="checklist-title" className="text-title font-semibold">
            Every CCA in the bundle
          </h2>
          <Eyebrow>{summaryLine(rows)}</Eyebrow>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[960px] border-collapse text-body">
            <thead>
              <tr className="border-b border-rule text-left text-cap font-semibold text-muted">
                <th scope="col" className="py-2 pr-4">CCA</th>
                <th scope="col" className="py-2 pr-4">Type</th>
                <th scope="col" className="py-2 pr-4">IHG</th>
                <th scope="col" className="py-2 pr-4">File</th>
                <th scope="col" className="py-2 pr-4 text-right">Members</th>
                <th scope="col" className="py-2 pr-4">Status</th>
                <th scope="col" className="py-2 pr-4">Note</th>
                <th scope="col" className="py-2"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <Row
                  key={row.ccaID}
                  row={row}
                  members={members(row.ccaID)}
                  locked={locked}
                  onMark={() => setMarking(row)}
                  onClear={() => dispatch({ type: 'clearNotSubmitting', ccaID: row.ccaID })}
                />
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <NotSubmittingDialog
        row={marking}
        onClose={() => setMarking(null)}
        onSave={(note) => {
          if (marking) dispatch({ type: 'setNotSubmitting', mark: { ccaID: marking.ccaID, note, at: new Date().toISOString() } })
          setMarking(null)
        }}
      />
    </main>
  )
}
