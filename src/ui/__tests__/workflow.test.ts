import { describe, expect, it } from 'vitest'
import { DEFAULT_CONFIG, computeAll, createPenaltyState, type Lists } from '../../engine'
import { leaderRows, matricOf, scenario } from '../../import/__tests__/fixtures'
import { restoreWorkspace } from '../../workspace'
import { discretionFromDraft, discretionSummary, overrideFromDraft } from '../drawer/editorState'
import { publishReadiness } from '../publish/publishData'
import { groupOf, moveItem, seatsText, tieGroups, upperColour } from '../results/wheel'
import { entryOptions, initialState, reducer, type Action, type AppState } from '../state/store'
import { fromRestored, passwordProblem, savedLabel, toWorkspace } from '../state/workspaceState'

const config = { ...DEFAULT_CONFIG, headcounts: { ...DEFAULT_CONFIG.headcounts, maleGreen: 2, maleGrey: 1, femaleGreen: 2 } }
const loaded = (): AppState => reducer(reducer(initialState(), { type: 'setConfig', config }), { type: 'addFiles', files: scenario() })
const run = (state: AppState, ...actions: Action[]): AppState => actions.reduce(reducer, state)
const override = { matric: matricOf(1), ccaID: 'C1', finalPoints: 5, reason: 'withdrew' }
const discretion = { matric: matricOf(2), stayingDelta: 2, biddingDelta: -1, reason: 'service' }
const resolution = { list: 'maleStaying' as const, order: [matricOf(3), matricOf(1)] }
const AT = '2027-04-02T10:00:00.000Z'
const reviewEdit = { matric: matricOf(1), ccaID: 'C1', from: 8, to: 9, reason: '', at: AT }
const level = { ccaID: 'C1', level: 'High Gold', bonusOverride: null, multiplierOverride: null }
const notSubmitting = { ccaID: 'C2', note: 'disbanded', at: AT }
const tickEdit = { matric: matricOf(1), ccaID: 'C1', from: false, to: true, reason: '', at: AT }
const flatEdit = { matric: matricOf(1), ccaID: 'C3', from: 12, to: 10, reason: '', at: AT }
const auxEdit = { matric: matricOf(1), from: 5, to: 7, reason: '', at: AT }
const membershipEdit = { matric: matricOf(1), ccaID: 'C1', field: 'incomingRole' as const, from: 'none' as const, to: 'vice_head' as const, reason: '', at: AT }
const removeMembership = { type: 'removeMembershipEdit' as const, matric: membershipEdit.matric, ccaID: membershipEdit.ccaID, field: membershipEdit.field, at: AT }

/** Fills in what Finalise needs: a level on every CCA with a file and a vetted mark on each. */
function prepared(state: AppState): AppState {
  const withLevels = state.report.perCca
    .filter((c) => c.fileHash !== null && c.level === null)
    .reduce((s, c) => reducer(s, { type: 'setCcaLevel', entry: { ccaID: c.ccaID, level: 'High Gold', bonusOverride: null, multiplierOverride: null } }), state)
  return withLevels.report.perCca
    .filter((c) => c.fileHash !== null && !withLevels.review.vetted.some((m) => m.ccaID === c.ccaID))
    .reduce((s, c) => reducer(s, { type: 'setVetted', ccaID: c.ccaID, at: AT }), withLevels)
}

function finalised(start = loaded()): AppState {
  const state = prepared(start)
  const input = state.report.input
  if (!input) throw new Error('expected input')
  return reducer(state, { type: 'finalise', penalty: createPenaltyState(computeAll(input, state.config, entryOptions(state)).lists) })
}

describe('lock rules while finalised', () => {
  it('refuses files, settings, final-points overrides, discretion, review marks and levels', () => {
    const state = finalised(
      run(
        loaded(),
        { type: 'setFinalOverride', entry: override },
        { type: 'setDiscretion', entry: discretion },
        { type: 'setReviewEdit', entry: reviewEdit },
        { type: 'setCcaLevel', entry: { ...level, ccaID: 'C2' } },
        { type: 'setVetted', ccaID: 'C2', at: AT },
        { type: 'setNotSubmitting', mark: notSubmitting },
        { type: 'setCcaLevel', entry: level },
        { type: 'setAuxEdit', entry: auxEdit },
        { type: 'setMembershipEdit', entry: membershipEdit },
      ),
    )
    for (const action of [
      { type: 'setReviewEdit', entry: { ...reviewEdit, to: 10 } },
      { type: 'removeReviewEdit', matric: reviewEdit.matric, ccaID: reviewEdit.ccaID, at: AT },
      { type: 'setVetted', ccaID: 'C1', at: AT },
      { type: 'clearVetted', ccaID: 'C2' },
      { type: 'setNotSubmitting', mark: { ...notSubmitting, ccaID: 'C1' } },
      { type: 'clearNotSubmitting', ccaID: 'C2' },
      { type: 'setCcaLevel', entry: { ...level, level: 'Pass' } },
      { type: 'setCcaLevelsAll', list: [] },
      { type: 'setTickEdit', entry: tickEdit },
      { type: 'removeTickEdit', matric: tickEdit.matric, ccaID: tickEdit.ccaID, at: AT },
      { type: 'setFlatEdit', entry: flatEdit },
      { type: 'removeFlatEdit', matric: flatEdit.matric, ccaID: flatEdit.ccaID, at: AT },
      { type: 'setAuxEdit', entry: { ...auxEdit, to: 9 } },
      { type: 'removeAuxEdit', matric: auxEdit.matric, at: AT },
      { type: 'setMembershipEdit', entry: { ...membershipEdit, to: 'head' } },
      removeMembership,
      { type: 'setConfig', config: DEFAULT_CONFIG },
      { type: 'addFiles', files: scenario() },
      { type: 'setFinalOverride', entry: { ...override, finalPoints: 9 } },
      { type: 'removeFinalOverride', matric: override.matric, ccaID: override.ccaID },
      { type: 'setDiscretion', entry: { ...discretion, stayingDelta: 9 } },
      { type: 'removeDiscretion', matric: discretion.matric },
    ] satisfies Action[]) {
      expect(reducer(state, action)).toBe(state)
    }
  })

  it('keeps wheel results editable, and unlock keeps them', () => {
    const state = run(finalised(), { type: 'setResolution', resolution })
    expect(state.resolutions).toEqual([resolution])
    const unlocked = reducer(state, { type: 'unlock' })
    expect(unlocked.finalised).toBeNull()
    expect(unlocked.resolutions).toEqual([resolution])
    expect(reducer(unlocked, { type: 'clearResolution', list: 'maleStaying', matrics: [matricOf(1), matricOf(3)] }).resolutions).toEqual([])
  })

  it('replaces a wheel result for the same group instead of adding a second', () => {
    const twice = run(loaded(), { type: 'setResolution', resolution }, { type: 'setResolution', resolution: { ...resolution, order: [...resolution.order].reverse() } })
    expect(twice.resolutions).toHaveLength(1)
    expect(twice.resolutions[0]?.order).toEqual([matricOf(1), matricOf(3)])
  })
})

describe('unsaved-changes flag', () => {
  it('starts clean', () => {
    expect(initialState().dirty).toBe(false)
  })

  it.each<[string, (s: AppState) => AppState]>([
    ['files', (s) => reducer(s, { type: 'removeFile', name: 'residents.csv' })],
    ['settings', (s) => reducer(s, { type: 'setConfig', config: DEFAULT_CONFIG })],
    ['final-points overrides', (s) => reducer(s, { type: 'setFinalOverride', entry: override })],
    ['discretion', (s) => reducer(s, { type: 'setDiscretion', entry: discretion })],
    ['wheel results', (s) => reducer(s, { type: 'setResolution', resolution })],
    ['finalise', (s) => finalised(s)],
    ['review edits', (s) => reducer(s, { type: 'setReviewEdit', entry: reviewEdit })],
    ['removing a review edit', (s) => reducer(run(s, { type: 'setReviewEdit', entry: reviewEdit }, { type: 'markSaved', at: AT }), { type: 'removeReviewEdit', matric: reviewEdit.matric, ccaID: reviewEdit.ccaID, at: AT })],
    ['vetted marks', (s) => reducer(s, { type: 'setVetted', ccaID: 'C1', at: AT })],
    ['clearing a vetted mark', (s) => reducer(run(s, { type: 'setVetted', ccaID: 'C1', at: AT }, { type: 'markSaved', at: AT }), { type: 'clearVetted', ccaID: 'C1' })],
    ['not-submitting marks', (s) => reducer(s, { type: 'setNotSubmitting', mark: notSubmitting })],
    ['clearing a not-submitting mark', (s) => reducer(run(s, { type: 'setNotSubmitting', mark: notSubmitting }, { type: 'markSaved', at: AT }), { type: 'clearNotSubmitting', ccaID: 'C2' })],
    ['a CCA level', (s) => reducer(s, { type: 'setCcaLevel', entry: level })],
    ['the whole level table', (s) => reducer(s, { type: 'setCcaLevelsAll', list: [level] })],
    ['tick edits', (s) => reducer(s, { type: 'setTickEdit', entry: tickEdit })],
    ['removing a tick edit', (s) => reducer(run(s, { type: 'setTickEdit', entry: tickEdit }, { type: 'markSaved', at: AT }), { type: 'removeTickEdit', matric: tickEdit.matric, ccaID: tickEdit.ccaID, at: AT })],
    ['flat edits', (s) => reducer(s, { type: 'setFlatEdit', entry: flatEdit })],
    ['removing a flat edit', (s) => reducer(run(s, { type: 'setFlatEdit', entry: flatEdit }, { type: 'markSaved', at: AT }), { type: 'removeFlatEdit', matric: flatEdit.matric, ccaID: flatEdit.ccaID, at: AT })],
    ['AUX edits', (s) => reducer(s, { type: 'setAuxEdit', entry: auxEdit })],
    ['removing an AUX edit', (s) => reducer(run(s, { type: 'setAuxEdit', entry: auxEdit }, { type: 'markSaved', at: AT }), { type: 'removeAuxEdit', matric: auxEdit.matric, at: AT })],
    ['role and semester edits', (s) => reducer(s, { type: 'setMembershipEdit', entry: membershipEdit })],
    ['removing a role or semester edit', (s) => reducer(run(s, { type: 'setMembershipEdit', entry: membershipEdit }, { type: 'markSaved', at: AT }), removeMembership)],
    ['unlock', (s) => reducer(finalised(s), { type: 'unlock' })],
  ])('is set by a change to %s', (_, change) => {
    const clean = reducer(loaded(), { type: 'markSaved', at: '2027-04-01T06:32:00.000Z' })
    expect(clean.dirty).toBe(false)
    expect(change(clean).dirty).toBe(true)
  })

  it('is set by a penalty and by undoing it', () => {
    const state = reducer(finalised(), { type: 'markSaved', at: '2027-04-01T06:32:00.000Z' })
    const penalty = { ...(state.finalised?.penalty ?? createPenaltyState({} as Lists)), applied: [{ matric: matricOf(1), ccaID: 'C1' }] }
    const entry = { key: { matric: matricOf(1), ccaID: 'C1' }, residentName: 'R', ccaName: 'C', outcome: 'x' }
    expect(reducer(state, { type: 'applyPenalty', penalty, entry }).dirty).toBe(true)
  })

  it('is never set by moving between steps', () => {
    const clean = reducer(loaded(), { type: 'markSaved', at: AT })
    const moved = run(clean, { type: 'setStep', step: 'results' }, { type: 'setStep', step: 'review' })
    expect(moved.step).toBe('review')
    expect(moved.dirty).toBe(false)
    expect(reducer(moved, { type: 'setStep', step: 'review' })).toBe(moved)
    expect(reducer(finalised(), { type: 'setStep', step: 'publish' }).step).toBe('publish')
  })

  it('is not set by a refused change or by new results', () => {
    const state = reducer(finalised(), { type: 'markSaved', at: '2027-04-01T06:32:00.000Z' })
    expect(reducer(state, { type: 'setConfig', config: DEFAULT_CONFIG }).dirty).toBe(false)
    expect(reducer(state, { type: 'setResults', results: null, error: null }).dirty).toBe(false)
  })

  it('is cleared by saving, and records the time', () => {
    const saved = reducer(run(loaded(), { type: 'setDiscretion', entry: discretion }), { type: 'markSaved', at: '2027-04-01T06:32:00.000Z' })
    expect(saved.dirty).toBe(false)
    expect(saved.savedAt).toBe('2027-04-01T06:32:00.000Z')
    expect(savedLabel('2027-04-01T06:32:00.000Z')).toMatch(/^Saved \d{2}:\d{2}$/)
  })

  it('is cleared by opening a workspace, which restores everything', () => {
    const before = run(
      loaded(),
      { type: 'setFinalOverride', entry: override },
      { type: 'setDiscretion', entry: discretion },
      { type: 'setReviewEdit', entry: reviewEdit },
      { type: 'setMembershipEdit', entry: membershipEdit },
      { type: 'setCcaLevel', entry: level },
      { type: 'setVetted', ccaID: 'C1', at: AT },
      { type: 'setNotSubmitting', mark: notSubmitting },
      { type: 'setStep', step: 'results' },
    )
    const done = finalised(before)
    const workspace = toWorkspace(done, new Date(2027, 3, 1))
    expect(workspace.version).toBe(4)
    expect(workspace.review.membershipEdits).toEqual([membershipEdit])
    expect(workspace.review.membershipLog).toEqual([{ ...membershipEdit, kind: 'edit' }])
    expect('meanSdOverrides' in workspace).toBe(false)
    const opened = reducer(run(initialState(), { type: 'setConfig', config: DEFAULT_CONFIG }), { type: 'loadWorkspace', workspace: fromRestored(restoreWorkspace(workspace)) })
    expect(opened.dirty).toBe(false)
    expect(opened.files).toEqual(before.files)
    expect(opened.finalOverrides).toEqual([override])
    expect(opened.discretion).toEqual([discretion])
    expect(opened.config).toEqual(config)
    expect(opened.review).toEqual(done.review)
    expect(opened.review.edits).toEqual([reviewEdit])
    expect(opened.review.membershipEdits).toEqual([membershipEdit])
    expect(opened.ccaLevels).toEqual(done.ccaLevels)
    expect(opened.ccaLevels).toContainEqual(level)
    expect(opened.step).toBe('results')
    expect(opened.finalised?.penalty).toEqual(workspace.finalised)
    expect(opened.report.canCompute).toBe(true)
  })
})

describe('wheel helpers', () => {
  it('moves an item up or down and stops at the ends', () => {
    expect(moveItem(['a', 'b', 'c'], 2, -1)).toEqual(['a', 'c', 'b'])
    expect(moveItem(['a', 'b', 'c'], 0, 1)).toEqual(['b', 'a', 'c'])
    expect(moveItem(['a', 'b', 'c'], 0, -1)).toEqual(['a', 'b', 'c'])
    expect(moveItem(['a', 'b', 'c'], 2, 1)).toEqual(['a', 'b', 'c'])
  })

  it('does not change the list it was given', () => {
    const items = Object.freeze(['a', 'b'])
    expect(moveItem(items, 0, 1)).toEqual(['b', 'a'])
    expect(items).toEqual(['a', 'b'])
  })

  it('says how many go to the upper colour', () => {
    expect(upperColour('grey/white')).toBe('grey')
    expect(seatsText({ boundary: 'green/grey', k: 1, n: 2, text: '' })).toBe('1 of 2 go to green')
  })

  it('finds boundary tie groups on the staying lists only', () => {
    const files = scenario({ leaders: { C1: leaderRows('C1', [12, 12, 12, 14, 16, 8]), C2: leaderRows('C2') } })
    const state = run(initialState(), { type: 'setConfig', config: { ...config, headcounts: { ...config.headcounts, maleGreen: 1, maleGrey: 0 } } }, { type: 'addFiles', files })
    const input = state.report.input
    if (!input) throw new Error('expected input')
    const lists = computeAll(input, state.config).lists
    const groups = tieGroups(lists)
    expect(groups.every((g) => ['maleStaying', 'femaleStaying', 'sem2'].includes(g.list))).toBe(true)
    const first = groups[0]
    if (first) expect(groupOf(lists, first.list, first.rows[0]?.matric ?? '')?.rows).toEqual(first.rows)
    expect(groupOf(lists, 'maleBidding', 'x')).toBeNull()
  })
})

describe('drawer editors validation', () => {
  const input = loaded().report.input
  if (!input) throw new Error('expected input')

  it('turns the final-points editor fields into a valid override, or a plain message', () => {
    expect(overrideFromDraft(input, { matric: matricOf(1), ccaID: 'C1' }, ' 5 ', ' withdrew ')).toEqual({ ok: true, entry: override })
    expect(overrideFromDraft(input, { matric: matricOf(1), ccaID: 'C1' }, '', 'r')).toEqual({ ok: false, message: 'Enter the final points as a number.' })
    expect(overrideFromDraft(input, { matric: matricOf(1), ccaID: 'C1' }, '5', '  ').ok).toBe(false)
    expect(overrideFromDraft(input, { matric: matricOf(1), ccaID: 'NOPE' }, '5', 'r')).toMatchObject({ ok: false, message: expect.stringMatching(/no longer a member/) })
  })

  it('copies the staying change to bidding when "Same for both" is on', () => {
    const same = discretionFromDraft(input, matricOf(2), { staying: '2', bidding: '9', same: true, reason: 'r' })
    expect(same).toMatchObject({ ok: true, entry: { stayingDelta: 2, biddingDelta: 2 } })
    const split = discretionFromDraft(input, matricOf(2), { staying: '2', bidding: '-1', same: false, reason: 'service' })
    expect(split).toEqual({ ok: true, entry: discretion })
    expect(discretionFromDraft(input, matricOf(2), { staying: 'x', bidding: '', same: true, reason: 'r' }).ok).toBe(false)
    expect(discretionFromDraft(input, 'A9999999Z', { staying: '1', bidding: '', same: true, reason: 'r' })).toMatchObject({ ok: false })
    expect(discretionSummary(discretion)).toBe('+2 staying / −1 bidding — service')
  })
})

describe('publish readiness and workspace passwords', () => {
  it('needs finalising before it is ready', () => {
    const state = loaded()
    const input = state.report.input
    if (!input) throw new Error('expected input')
    const lists = computeAll(input, state.config).lists
    expect(publishReadiness(lists, false, [])).toMatchObject({ ok: false, finalised: false })
    expect(publishReadiness(null, true, []).ok).toBe(false)
  })

  it('asks for 8+ characters and a matching confirmation', () => {
    expect(passwordProblem('short', 'short')).toMatch(/8/)
    expect(passwordProblem('long enough', 'long enougH')).toMatch(/match/)
    expect(passwordProblem('long enough', 'long enough')).toBeNull()
  })
})
