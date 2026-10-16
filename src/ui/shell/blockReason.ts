import type { ImportReport } from '../../import'

const plural = (n: number, word: string): string => `${n} ${word}${n === 1 ? '' : 's'}`

/** Why results cannot be shown yet, in plain words, or null when they can. */
export function blockReason(report: ImportReport, fileCount: number): string | null {
  if (report.canCompute) return null
  if (fileCount === 0) return 'Add files to start'
  const blocking = report.issues.filter((i) => i.severity === 'error' && i.overridden !== true)
  if (blocking.length > 0) return `${plural(blocking.length, 'error')} to fix`
  return 'Import is not complete'
}

export function countIssues(report: ImportReport): { errors: number; warnings: number } {
  const errors = report.issues.filter((i) => i.severity === 'error' && i.overridden !== true).length
  const warnings = report.issues.filter((i) => i.severity === 'warning').length
  return { errors, warnings }
}

export { plural }
