import { Lock, ShieldCheck, TriangleAlert } from 'lucide-react'
import { useMemo, useState, type Dispatch } from 'react'
import {
  ccaLevelFor,
  parseCsv,
  parseLeader,
  reviewKey,
  reviewOrder,
  validateCcaLevelEntry,
  validateReviewEdit,
  vettedStatus,
  type CcaLevelEntry,
  type FlatMemberRow,
  type LeaderRow,
  type ReviewEditCode,
  type SourceFile,
} from '../../import'
import { groupedOrder, type GroupSection } from '../../import/groups'
import { Button, Chip } from '../common/controls'
import { SettingsPanel } from '../settings/SettingsPanel'
import { vettedLocked, type Action, type AppState } from '../state/store'
import { CcaHeader } from './CcaHeader'
import { CcaList, type CcaListItem } from './CcaList'
import { EditLog } from './EditLog'
import { FlatTable, type FlatLineData } from './FlatTable'
import { GroupManager } from './GroupManager'
import { MeanSdMeter } from './MeanSdMeter'
import { ScoreTable, type ScoreRow } from './ScoreTable'
import { flatAction, groupAction, tickAction } from './reviewHelpers'

interface ReviewScreenProps {
  readonly state: AppState
  readonly dispatch: Dispatch<Action>
  readonly openSections: ReadonlySet<string>
  readonly onOpenSectionsChange: (open: ReadonlySet<string>) => void
  readonly levelUsage: Readonly<Record<string, number>>
}

const EDIT_PROBLEMS: Readonly<Record<Exclude<ReviewEditCode, 'REVIEW_NO_CHANGE'>, string>> = {
  BAD_REVIEW_POINTS: 'Use a whole number from 0 to 20.',
  MISSING_REASON: 'The reason is too long.',
  REVIEW_FLAT_CCA: "Change a flat member's value in the flat table.",
  REVIEW_UNKNOWN_MEMBERSHIP: 'This member is not in the leader file any more.',
}

export const LEVELS_SECTION_ID = 'levels'

/** Each leader file's rows by ccaID, read straight from the files (scores as the leader sent them). */
function leaderRowsByCca(files: readonly SourceFile[], fileNames: ReadonlyMap<string, string>): Map<string, readonly LeaderRow[]> {
  const byName = new Map(files.map((f) => [f.name, f]))
  const out = new Map<string, readonly LeaderRow[]>()
  for (const [ccaID, fileName] of fileNames) {
    const file = byName.get(fileName)
    if (file) out.set(ccaID, parseLeader(fileName, parseCsv(file.text)).rows.filter((r) => r.ccaID === ccaID))
  }
  return out
}

function StalePanel({ state, dispatch, locked, ccaName }: {
  readonly state: AppState
  readonly dispatch: Dispatch<Action>
  readonly locked: boolean
  readonly ccaName: (ccaID: string) => string
}) {
  const { edits: scoreEdits, tickEdits, flatEdits } = state.report.review
  const edits = scoreEdits.filter((e) => e.status !== 'applied')
  const ticks = tickEdits.filter((e) => e.status !== 'applied')
  const flats = flatEdits.filter((e) => e.status !== 'applied')
  const bundleIds = new Set(state.report.bundle?.ccas.map((c) => c.ccaID) ?? [])
  const levels = state.ccaLevels.filter((e) => !bundleIds.has(e.ccaID))
  if (edits.length === 0 && ticks.length === 0 && flats.length === 0 && levels.length === 0) return null
  const now = (): string => new Date().toISOString()
  return (
    <section role="alert" className="mt-6 border-l-4 border-warning bg-warning-bg px-4 py-3">
      <h2 className="flex items-center gap-2 text-ui font-semibold text-warning">
        <TriangleAlert aria-hidden size={15} /> Not applied: review these and remove them
      </h2>
      <ul className="mt-2 divide-y divide-warning/20 text-body">
        {edits.map(({ entry, status, fileValue }) => (
          <li key={reviewKey(entry)} className="flex flex-wrap items-center gap-3 py-1.5">
            <span className="min-w-0 flex-1">
              {ccaName(entry.ccaID)} · <span className="font-mono text-cap">{entry.matric}</span> · edit {entry.from} → {entry.to}:{' '}
              {status === 'changed'
                ? `the leader file now says ${fileValue}, so the edit is not applied.`
                : 'this member is no longer in the leader file.'}
            </span>
            <Button small variant="ghost" disabled={locked} onClick={() => dispatch({ type: 'removeReviewEdit', matric: entry.matric, ccaID: entry.ccaID, at: now() })}>
              Remove
            </Button>
          </li>
        ))}
        {ticks.map(({ entry, status }) => (
          <li key={`tick-${reviewKey(entry)}`} className="flex flex-wrap items-center gap-3 py-1.5">
            <span className="min-w-0 flex-1">
              {ccaName(entry.ccaID)} · <span className="font-mono text-cap">{entry.matric}</span> · IHG tick {entry.to ? 'ticked' : 'not ticked'}:{' '}
              {status === 'changed'
                ? 'the leader file now has a different tick, so the edit is not applied.'
                : 'this member is no longer in the leader file.'}
            </span>
            <Button small variant="ghost" disabled={locked} onClick={() => dispatch({ type: 'removeTickEdit', matric: entry.matric, ccaID: entry.ccaID, at: now() })}>
              Remove
            </Button>
          </li>
        ))}
        {flats.map(({ entry, status, current }) => (
          <li key={`flat-${reviewKey(entry)}`} className="flex flex-wrap items-center gap-3 py-1.5">
            <span className="min-w-0 flex-1">
              {ccaName(entry.ccaID)} · <span className="font-mono text-cap">{entry.matric}</span> · flat value {entry.from} → {entry.to}:{' '}
              {status === 'changed'
                ? `the RH-app bundle now says ${current}, so the edit is not applied.`
                : 'this member is no longer in the bundle.'}
            </span>
            <Button small variant="ghost" disabled={locked} onClick={() => dispatch({ type: 'removeFlatEdit', matric: entry.matric, ccaID: entry.ccaID, at: now() })}>
              Remove
            </Button>
          </li>
        ))}
        {levels.map((entry) => (
          <li key={entry.ccaID} className="flex flex-wrap items-center gap-3 py-1.5">
            <span className="min-w-0 flex-1">
              <span className="font-mono text-cap">{entry.ccaID}</span> has a level ({entry.level ?? 'tweaks only'}) but is not in the bundle; it is ignored.
            </span>
            <Button
              small
              variant="ghost"
              disabled={locked}
              onClick={() => dispatch({ type: 'setCcaLevel', entry: { ccaID: entry.ccaID, level: null, bonusOverride: null, multiplierOverride: null } })}
            >
              Remove
            </Button>
          </li>
        ))}
      </ul>
    </section>
  )
}

function VetBar({ item, locked, onVet, onClear }: {
  readonly item: CcaListItem
  readonly locked: boolean
  readonly onVet: () => void
  readonly onClear: () => void
}) {
  return (
    <div className="mt-6 flex flex-wrap items-center gap-3 border-y border-rule py-3">
      {item.vetted === 'vetted' ? (
        <>
          <span className="flex items-center gap-1.5 text-ui font-medium text-ok">
            <ShieldCheck aria-hidden size={16} /> Vetted
          </span>
          <span className="text-cap text-muted">Re-dropping a changed leader file un-vets it.</span>
          <Button small variant="ghost" disabled={locked} onClick={onClear} className="ml-auto">
            Clear
          </Button>
        </>
      ) : (
        <>
          {item.vetted === 'file_changed' && <Chip tone="warning">file changed since vetting</Chip>}
          <span className="text-body text-muted">Checked every score in this file?</span>
          <Button variant="primary" disabled={locked} onClick={onVet} className="ml-auto">
            <ShieldCheck aria-hidden size={15} /> Mark vetted
          </Button>
          {item.vetted === 'file_changed' && (
            <Button small variant="ghost" disabled={locked} onClick={onClear}>
              Clear
            </Button>
          )}
        </>
      )}
    </div>
  )
}

export function ReviewScreen({ state, dispatch, openSections, onOpenSectionsChange, levelUsage }: ReviewScreenProps) {
  const { report, review, config } = state
  const locked = state.finalised !== null
  const [showSettings, setShowSettings] = useState(false)
  const [showGroups, setShowGroups] = useState(false)
  const items = useMemo((): CcaListItem[] =>
    reviewOrder(report.perCca).map((cca) => {
      const mark = review.vetted.find((m) => m.ccaID === cca.ccaID)
      return {
        cca,
        vetted: mark ? vettedStatus(mark, report.perCca) : null,
        notSubmitting: review.notSubmitting.some((m) => m.ccaID === cca.ccaID),
        edits: review.edits.filter((e) => e.ccaID === cca.ccaID).length,
      }
    }), [report.perCca, review])
  const sections = useMemo((): GroupSection<CcaListItem>[] => {
    const byId = new Map(items.map((i) => [i.cca.ccaID, i]))
    return groupedOrder(report.perCca, state.groups).map((section) => ({
      ...section,
      ccas: section.ccas.flatMap((cca) => byId.get(cca.ccaID) ?? []),
    }))
  }, [items, report.perCca, state.groups])
  const [picked, setPicked] = useState<string | null>(null)
  const shown = useMemo(() => sections.flatMap((section) => section.ccas), [sections])
  const item = shown.find((i) => i.cca.ccaID === picked) ?? shown[0] ?? null
  const fileNames = useMemo(
    () => new Map(report.perCca.flatMap((c) => (c.fileName !== null && c.status !== 'flat' ? [[c.ccaID, c.fileName] as const] : []))),
    [report.perCca],
  )
  const leaders = useMemo(() => leaderRowsByCca(state.files, fileNames), [state.files, fileNames])
  const names = useMemo(() => new Map([...leaders.values()].flat().map((r) => [r.matric, r.name])), [leaders])
  const ccaName = (ccaID: string): string => report.perCca.find((c) => c.ccaID === ccaID)?.name ?? ccaID
  const ccaIds = useMemo(() => new Set(report.bundle?.ccas.map((c) => c.ccaID) ?? []), [report.bundle])

  const editLevels = (): void => {
    onOpenSectionsChange(new Set([...openSections, LEVELS_SECTION_ID]))
    setShowSettings(true)
    window.requestAnimationFrame(() => document.getElementById(`settings-section-${LEVELS_SECTION_ID}`)?.scrollIntoView({ block: 'start' }))
  }

  const checked = useMemo(() => [...leaders].map(([ccaID, rows]) => ({ fileName: fileNames.get(ccaID) ?? '', ccaID, rows })), [leaders, fileNames])
  const saveScore = (member: LeaderRow, score: string, reason: string): string | null => {
    const existing = review.edits.find((e) => reviewKey(e) === reviewKey(member))
    const entry = { matric: member.matric, ccaID: member.ccaID, from: member.basePoints, to: score.trim() === '' ? Number.NaN : Number(score), reason: reason.trim(), at: new Date().toISOString() }
    const verdict = validateReviewEdit(checked, report.review.flatIds, entry)
    if (!verdict.ok) {
      const { code } = verdict
      if (code !== 'REVIEW_NO_CHANGE') return EDIT_PROBLEMS[code]
      // Back to the file's value: the edit is removed (and logged).
      if (existing) dispatch({ type: 'removeReviewEdit', matric: entry.matric, ccaID: entry.ccaID, at: entry.at })
      return null
    }
    dispatch({ type: 'setReviewEdit', entry })
    return null
  }
  const saveTick = (member: LeaderRow, ticked: boolean, reason: string): void => {
    const hasEdit = report.review.tickEdits.some((e) => e.status !== 'stale' && reviewKey(e.entry) === reviewKey(member))
    const action = tickAction({ matric: member.matric, ccaID: member.ccaID, fileTick: member.ihg, to: ticked, reason: reason.trim(), hasEdit, at: new Date().toISOString() })
    if (action) dispatch(action)
  }
  const saveFlat = (ccaID: string, member: FlatMemberRow, value: string, reason: string): string | null => {
    const hasEdit = report.review.flatEdits.some((e) => e.status !== 'stale' && reviewKey(e.entry) === reviewKey({ matric: member.matric, ccaID }))
    const { action, problem } = flatAction({ matric: member.matric, ccaID, fileValue: member.fileValue, to: value, reason: reason.trim(), hasEdit, at: new Date().toISOString() })
    if (action) dispatch(action)
    return problem
  }
  const checkEntry = (entry: CcaLevelEntry): string | null =>
    validateCcaLevelEntry(entry, config, ccaIds).find((issue) => issue.code === 'BAD_LEVEL_TWEAK' || issue.code === 'UNKNOWN_LEVEL')?.message ?? null

  const cca = item?.cca ?? null
  const rows: ScoreRow[] = cca
    ? (leaders.get(cca.ccaID) ?? []).map((member) => ({
        member,
        edit: report.review.edits.find((e) => reviewKey(e.entry) === reviewKey(member) && e.status !== 'stale') ?? null,
        tickEdit: report.review.tickEdits.find((e) => reviewKey(e.entry) === reviewKey(member) && e.status !== 'stale') ?? null,
        hasFinalOverride: state.finalOverrides.some((o) => o.matric === member.matric && o.ccaID === member.ccaID),
      }))
    : []
  const flatRows: FlatLineData[] = cca
    ? (report.review.flats.find((f) => f.ccaID === cca.ccaID)?.rows ?? []).map((member) => ({
        member,
        edit: report.review.flatEdits.find((e) => reviewKey(e.entry) === reviewKey({ matric: member.matric, ccaID: cca.ccaID }) && e.status !== 'stale') ?? null,
        hasFinalOverride: state.finalOverrides.some((o) => o.matric === member.matric && o.ccaID === cca.ccaID),
      }))
    : []
  const vetLocked = cca ? vettedLocked(state, cca.ccaID) : false
  const storedLevel = cca ? (ccaLevelFor(state.ccaLevels, cca.ccaID)?.level ?? null) : null
  const levelGone = storedLevel !== null && !config.levels.some((l) => l.name === storedLevel)
  const levelNotSet = cca ? (report.issues.find((i) => i.code === 'LEVEL_NOT_SET' && i.ccaID === cca.ccaID)?.message ?? null) : null

  return (
    <div className={`grid min-h-0 flex-1 grid-rows-[minmax(0,1fr)] ${showSettings ? 'grid-cols-[260px_minmax(0,1fr)_320px] xl:grid-cols-[300px_minmax(0,1fr)_340px]' : 'grid-cols-[260px_minmax(0,1fr)] xl:grid-cols-[300px_minmax(0,1fr)]'}`}>
      <CcaList sections={sections} grouped={state.groups.length > 0} selected={cca?.ccaID ?? null} onSelect={setPicked} onOpenGroups={() => setShowGroups(true)} />
      <GroupManager open={showGroups} groups={state.groups} dispatch={dispatch} onClose={() => setShowGroups(false)} />
      <main className="min-h-0 min-w-0 overflow-y-auto px-8 pt-6 pb-16">
        {locked && (
          <p role="status" className="mb-5 flex items-center gap-2 border-l-4 border-gold bg-gold-soft px-4 py-3 text-body font-medium">
            <Lock aria-hidden size={15} /> Finalised · review locked. Unlock the lists on the Results screen to change scores, levels or vetting.
          </p>
        )}
        {vetLocked && (
          <p role="status" className="mb-5 flex items-center gap-2 border-l-4 border-ok bg-ok-bg px-4 py-3 text-body font-medium">
            <ShieldCheck aria-hidden size={15} /> Vetted · locked. Clear vetted to change the level, tweaks, scores or IHG ticks.
            {levelGone && ' The level is no longer in Settings: clear vetted to pick another level.'}
          </p>
        )}
        {cca && item ? (
          <>
            <CcaHeader
              cca={cca}
              entry={ccaLevelFor(state.ccaLevels, cca.ccaID)}
              levels={config.levels}
              locked={locked || vetLocked}
              levelNotSet={levelNotSet}
              levelChange={state.lastLevelChange}
              groups={state.groups}
              checkEntry={checkEntry}
              onSetEntry={(entry) => dispatch({ type: 'setCcaLevel', entry })}
              onEditLevels={editLevels}
              onAssignGroup={(groupId) => {
                const { action } = groupAction(state.groups, { type: 'assign', ccaID: cca.ccaID, groupId })
                if (action) dispatch(action)
              }}
            />
            <StalePanel state={state} dispatch={dispatch} locked={locked} ccaName={ccaName} />
            {cca.status === 'flat' ? (
              <>
                <VetBar
                  item={item}
                  locked={locked || cca.vetHash === null}
                  onVet={() => dispatch({ type: 'setVetted', ccaID: cca.ccaID, at: new Date().toISOString() })}
                  onClear={() => dispatch({ type: 'clearVetted', ccaID: cca.ccaID })}
                />
                <section aria-labelledby="flat-title" className="mt-6">
                  <div className="flex flex-wrap items-baseline justify-between gap-2 border-b-2 border-ink pb-2">
                    <h2 id="flat-title" className="text-title font-semibold">
                      Flat values
                    </h2>
                    <span className="text-cap text-muted">
                      {cca.n} members get {cca.flatPoints ?? 0} pts each (set in RH-app) · change one member's value here · Enter saves · Esc cancels
                    </span>
                  </div>
                  <FlatTable rows={flatRows} locked={locked || vetLocked} onSave={(member, value, reason) => saveFlat(cca.ccaID, member, value, reason)} />
                </section>
              </>
            ) : cca.fileName === null ? (
              <p className="mt-6 rounded-[4px] border border-dashed border-ink/20 px-4 py-6 text-center text-body text-muted">
                No leader file: marked not submitting on the checklist. Nothing to review.
              </p>
            ) : (
              <>
                <div className="mt-6">
                  <MeanSdMeter cca={cca} />
                </div>
                <VetBar
                  item={item}
                  locked={locked}
                  onVet={() => dispatch({ type: 'setVetted', ccaID: cca.ccaID, at: new Date().toISOString() })}
                  onClear={() => dispatch({ type: 'clearVetted', ccaID: cca.ccaID })}
                />
                <section aria-labelledby="scores-title" className="mt-6">
                  <div className="flex flex-wrap items-baseline justify-between gap-2 border-b-2 border-ink pb-2">
                    <h2 id="scores-title" className="text-title font-semibold">
                      Scores
                    </h2>
                    <span className="text-cap text-muted">
                      Whole numbers 0–20 · Enter saves and moves down · Esc cancels · roles and semester-only come from the leader file
                    </span>
                  </div>
                  <ScoreTable rows={rows} isSport={cca.isSport} locked={locked || vetLocked} onSave={saveScore} onTick={saveTick} />
                </section>
              </>
            )}
            <EditLog log={review.log} tickLog={review.tickLog} flatLog={review.flatLog} selected={cca.ccaID} ccaName={ccaName} memberName={(m) => names.get(m) ?? m} />
          </>
        ) : (
          <p className="text-body text-muted">No CCAs in the bundle.</p>
        )}
      </main>
      {showSettings && (
        <div className="flex min-h-0 flex-col border-l border-rule">
          <SettingsPanel
            config={config}
            locked={locked}
            settings={report.settings}
            onChange={(next) => dispatch({ type: 'setConfig', config: next })}
            openSections={openSections}
            onOpenSectionsChange={onOpenSectionsChange}
            levelUsage={levelUsage}
            levelChange={state.lastLevelChange}
            onClose={() => setShowSettings(false)}
          />
        </div>
      )}
    </div>
  )
}
