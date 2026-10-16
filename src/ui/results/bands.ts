import type { ListRow, ScenarioConfig } from '../../engine'
import type { ListKey } from '../export/exportCsv'

export interface Band {
  readonly status: string
  readonly label: string
  readonly rows: readonly ListRow[]
}

interface BandDef {
  readonly status: string
  readonly label: string
}

const seats = (n: number): string => `${n} ${n === 1 ? 'seat' : 'seats'}`

function bandDefs(list: ListKey, config: ScenarioConfig): readonly BandDef[] | null {
  const h = config.headcounts
  if (list === 'maleStaying' || list === 'femaleStaying') {
    const male = list === 'maleStaying'
    return [
      { status: 'green', label: `Green · ${seats(male ? h.maleGreen : h.femaleGreen)}` },
      { status: 'grey', label: `Grey · ${seats(male ? h.maleGrey : h.femaleGrey)}` },
      { status: 'white', label: 'White' },
      { status: 'removed', label: 'Removed' },
    ]
  }
  if (list === 'sem2') {
    return [
      { status: 'green', label: `Green · ${seats(h.sem2Green)}` },
      { status: 'grey', label: `Grey · ${seats(h.sem2Grey)}` },
      { status: 'white', label: 'White' },
    ]
  }
  return null
}

const matches = (row: ListRow, query: string): boolean =>
  query === '' || row.name.toLowerCase().includes(query) || row.matric.toLowerCase().includes(query)

/**
 * Splits a list into its bands (staying and sem-2 lists) so dividers survive filtering.
 * Bidding lists come back as one unlabelled band.
 */
export function bandRows(list: ListKey, rows: readonly ListRow[], config: ScenarioConfig, search: string): Band[] {
  const query = search.trim().toLowerCase()
  const defs = bandDefs(list, config)
  if (!defs) return [{ status: '', label: '', rows: rows.filter((r) => matches(r, query)) }]
  return defs
    .filter((def) => rows.some((r) => r.status === def.status))
    .map((def) => ({
      ...def,
      rows: rows.filter((r) => r.status === def.status && matches(r, query)),
    }))
}
