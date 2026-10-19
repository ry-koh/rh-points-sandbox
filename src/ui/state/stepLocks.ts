import { checklistComplete, checklistRows } from '../../import'
import type { WorkflowStep } from '../../workspace'
import { blockReason } from '../shell/blockReason'
import type { AppState } from './store'

export const BUNDLE_FIRST = 'Load the RH-app bundle first'
export const CHECKLIST_FIRST = 'Complete the checklist first'
export const COMPARE_NEEDS_DATA = 'Load data that passes the checks first'
export const COMPARE_NEEDS_SCENARIO = 'Save a scenario first'

/**
 * Why each step is locked, or null when it can be opened (R15). Each step needs the one before:
 * the checklist needs a bundle, Review a complete checklist, Summary an import that computes.
 * Results stays reachable when the settings caused the block (`settingsCause`) so they can be
 * changed back, but only once Review is open.
 */
export function stepLocks(
  state: Pick<AppState, 'report' | 'review' | 'files'>,
  scenarioCount: number,
  settingsCause = false,
): Record<WorkflowStep, string | null> {
  const { report } = state
  const checklist = report.bundle === null ? BUNDLE_FIRST : null
  const complete = checklistComplete(checklistRows(report, state.review.notSubmitting))
  const review = checklist ?? (complete ? null : CHECKLIST_FIRST)
  const reason = blockReason(report, state.files.length)
  const summary = review ?? reason
  const results = settingsCause && review === null ? null : summary
  const compare = reason !== null ? COMPARE_NEEDS_DATA : scenarioCount === 0 ? COMPARE_NEEDS_SCENARIO : null
  return { import: null, checklist, review, summary, results, publish: results, compare }
}
