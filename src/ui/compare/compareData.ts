import { computeAll, type Comparison, type EntryOptions, type PipelineResult, type ScenarioConfig } from '../../engine'
import { validateImport, type SourceFile } from '../../import'
import { LIST_KEYS, POINTS_DECIMALS, headerLines, toCsvLine } from '../export/exportCsv'
import { CONFIG_KEYS } from '../state/configShape'
import { blockReason } from '../shell/blockReason'

export const CURRENT = 'current'

export type SideRun = { readonly ok: true; readonly run: PipelineResult } | { readonly ok: false; readonly error: string }

/**
 * Runs one side of a comparison on the imported files without touching the live results.
 * Both sides use the same final-points overrides, discretion and wheel results (`entries`).
 */
export function runSide(
  files: readonly SourceFile[],
  config: ScenarioConfig,
  entries: EntryOptions,
): SideRun {
  const report = validateImport(files, config)
  if (!report.canCompute || !report.input) {
    return { ok: false, error: `the files do not pass with these settings (${blockReason(report, files.length) ?? 'blocked'})` }
  }
  try {
    return { ok: true, run: computeAll(report.input, config, entries) }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'the calculation failed' }
  }
}

export interface ConfigDifference {
  readonly key: string
  readonly a: string
  readonly b: string
}

const show = (value: unknown): string => JSON.stringify(value)

export function configDifferences(a: ScenarioConfig, b: ScenarioConfig): ConfigDifference[] {
  return CONFIG_KEYS.filter((key) => show(a[key]) !== show(b[key])).map((key) => ({ key, a: show(a[key]), b: show(b[key]) }))
}

const signed = (n: number | null, digits: number): string =>
  n === null ? '' : `${n > 0 ? '+' : ''}${n.toFixed(digits)}`
const fixed = (n: number | null): string => (n === null ? '' : n.toFixed(POINTS_DECIMALS))

export const COMPARE_COLUMNS = ['list', 'matric', 'name', 'statusA', 'statusB', 'rankA', 'rankB', 'rankDelta', 'pointsA', 'pointsB', 'pointsDelta']

/** Every row of every list, A against B, after the usual export header lines. */
export function buildComparisonCsv(
  comparison: Comparison,
  outOfRange: readonly { readonly name: string }[],
  labels: { readonly a: string; readonly b: string },
): string {
  const rows = LIST_KEYS.flatMap((list) =>
    comparison[list].rows.map((r) =>
      toCsvLine([list, r.matric, r.name, r.statusA, r.statusB, String(r.rankA ?? ''), String(r.rankB ?? ''), signed(r.rankDelta, 0), fixed(r.pointsA), fixed(r.pointsB), signed(r.pointsDelta, POINTS_DECIMALS)]),
    ),
  )
  const lines = [...headerLines(outOfRange, null), `# A: ${labels.a} · B: ${labels.b}`, COMPARE_COLUMNS.join(','), ...rows]
  return `${lines.join('\n')}\n`
}
