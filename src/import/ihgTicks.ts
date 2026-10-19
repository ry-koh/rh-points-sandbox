import type { IhgEntry } from '../engine'
import type { CheckedLeader } from './checks'
import { makeIssue } from './parseCommon'
import type { BundleCca, Issue } from './types'

export interface IhgFromTicks {
  readonly ihg: IhgEntry[]
  readonly issues: Issue[]
  /** Ticked rows in each checked leader file, by ccaID. */
  readonly tickedByCca: Readonly<Record<string, number>>
}

const members = (n: number): string => (n === 1 ? '1 ticked member gets' : `${n} ticked members get`)

function blankPart(cca: BundleCca): string {
  if (cca.ihgResult === null && cca.ihgCap === null) return 'no IHG result or cap'
  return cca.ihgResult === null ? 'no IHG result' : 'no IHG cap'
}

/** The issue (if any) for one sport's ticks; null means the ticks become IHG entries. */
function tickIssue(leader: CheckedLeader, cca: BundleCca, ticked: number): Issue | null {
  const who = `${cca.ccaName} (${cca.ccaID})`
  const at = { ccaID: cca.ccaID }
  if (!cca.isSport) {
    if (ticked === 0) return null
    const text = `${who} is not a sports CCA in the bundle, so its ${ticked} IHG ticks are ignored.`
    return makeIssue('IHG_TICK_IGNORED', leader.fileName, text, at)
  }
  if (cca.ihgResult === null || cca.ihgCap === null) {
    const text = `${who} is a sport with ${blankPart(cca)} set in RH-app, so its ${members(ticked)} no IHG points yet. Set it on /admin/points and download the bundle again.`
    return makeIssue('IHG_NOT_SET', leader.fileName, text, at)
  }
  if (ticked > cca.ihgCap) {
    const text =
      `${who} has ${ticked} members ticked for IHG but the cap is ${cca.ihgCap}. ` +
      'Raise the cap on /admin/points and download the bundle again, or reopen points entry and ask the head for a corrected file.'
    return makeIssue('IHG_OVER_CAP', leader.fileName, text, at)
  }
  if (ticked === 0) {
    const text = `${who} has IHG result ${cca.ihgResult} but no member is ticked for the points.`
    return makeIssue('IHG_NO_TICKS', leader.fileName, text, at)
  }
  return null
}

/**
 * Builds the IHG entries from the leader files' `ihg` ticks (spec 2c). "Sport" comes only from the
 * bundle's sport column; a sport needs both a result and a cap before its ticks count.
 */
export function buildIhgFromTicks(leaders: readonly CheckedLeader[], bundle: readonly BundleCca[]): IhgFromTicks {
  const ihg: IhgEntry[] = []
  const issues: Issue[] = []
  const tickedByCca: Record<string, number> = {}
  for (const leader of leaders) {
    const ticked = leader.rows.filter((r) => r.ihg)
    tickedByCca[leader.ccaID] = ticked.length
    const cca = bundle.find((c) => c.ccaID === leader.ccaID)
    // A flat CCA with a leader file is already FLAT_AND_LEADER_FILE; an unlisted one is UNKNOWN_CCA.
    if (!cca || cca.flatPoints !== null) continue
    const issue = tickIssue(leader, cca, ticked.length)
    if (issue) issues.push(issue)
    else if (cca.isSport && cca.ihgResult !== null) {
      const placement = cca.ihgResult
      ihg.push(...ticked.map((r): IhgEntry => ({ matric: r.matric, ccaID: cca.ccaID, placement })))
    }
  }
  return { ihg, issues, tickedByCca }
}
