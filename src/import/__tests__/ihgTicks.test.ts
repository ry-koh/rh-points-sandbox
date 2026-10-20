import { describe, expect, it } from 'vitest'
import type { CheckedLeader } from '../checks'
import { buildIhgFromTicks } from '../ihgTicks'
import type { BundleCca, LeaderRow } from '../types'

const FILE = 'points_9201_20270401.csv'

const row = (n: number, ihg: boolean, patch: Partial<LeaderRow> = {}): LeaderRow => ({
  line: n + 1,
  ccaID: '9201',
  ccaName: 'Soccer (M)',
  matric: `A99201${String(n).padStart(2, '0')}X`,
  name: `Test Player ${n}`,
  basePoints: 12,
  semesterOnly: false,
  outgoingRole: 'none',
  incomingRole: 'none',
  ihg,
  ...patch,
})

const leader = (ticks: readonly boolean[], ccaID = '9201', fileName = FILE): CheckedLeader => ({
  fileName,
  ccaID,
  rows: ticks.map((t, i) => row(i + 1, t, { ccaID })),
})

const sport = (patch: Partial<BundleCca> = {}): BundleCca => ({
  ccaID: '9201',
  ccaName: 'Soccer (M)',
  flatPoints: null,
  type: '1x',
  isSport: true,
  ihgResult: '1st',
  ihgCap: 12,
  ...patch,
})

describe('buildIhgFromTicks', () => {
  it('gives one IHG entry per ticked member of a sport with a result and a cap', () => {
    const out = buildIhgFromTicks([leader([true, true, false])], [sport()])
    expect(out.issues).toEqual([])
    expect(out.ihg).toEqual([
      { matric: 'A9920101X', ccaID: '9201', placement: '1st' },
      { matric: 'A9920102X', ccaID: '9201', placement: '1st' },
    ])
    expect(out.tickedByCca).toEqual({ '9201': 2 })
  })

  it('exactly at the cap is fine', () => {
    const out = buildIhgFromTicks([leader([true, true])], [sport({ ihgCap: 2 })])
    expect(out.issues).toEqual([])
    expect(out.ihg).toHaveLength(2)
  })

  it('IHG_OVER_CAP is a warning naming both numbers; every ticked member still gets an entry', () => {
    const out = buildIhgFromTicks([leader([true, true, true])], [sport({ ihgCap: 2 })])
    expect(out.ihg).toHaveLength(3)
    expect(out.ihg.every((e) => e.placement === '1st')).toBe(true)
    expect(out.issues).toHaveLength(1)
    expect(out.issues[0]).toMatchObject({ severity: 'warning', code: 'IHG_OVER_CAP', fileName: FILE, ccaID: '9201' })
    expect(out.issues[0]?.message).toBe(
      `${FILE}: Soccer (M) (9201) has 3 members ticked for IHG; the cap is 2. ` +
        'All 3 get the points (allowed). Untick on the Review step if this is a mistake.',
    )
    expect(out.tickedByCca).toEqual({ '9201': 3 })
  })

  it.each([
    ['result', { ihgResult: null }, 'no IHG result'],
    ['cap', { ihgCap: null }, 'no IHG cap'],
    ['result and cap', { ihgResult: null, ihgCap: null }, 'no IHG result or cap'],
  ] as const)('IHG_NOT_SET (warning) when the %s is blank, naming the ticked count; no entries', (_, patch, blank) => {
    const out = buildIhgFromTicks([leader([true, false])], [sport(patch)])
    expect(out.ihg).toEqual([])
    expect(out.issues).toHaveLength(1)
    expect(out.issues[0]).toMatchObject({ severity: 'warning', code: 'IHG_NOT_SET', fileName: FILE, ccaID: '9201' })
    expect(out.issues[0]?.message).toBe(
      `${FILE}: Soccer (M) (9201) is a sport with ${blank} set in RH-app, so its 1 ticked member gets no IHG points yet. ` +
        'Set it on /admin/points and download the bundle again.',
    )
  })

  it('IHG_NOT_SET is raised even with no ticks', () => {
    const out = buildIhgFromTicks([leader([false])], [sport({ ihgResult: null })])
    expect(out.issues.map((i) => i.code)).toEqual(['IHG_NOT_SET'])
    expect(out.issues[0]?.message).toContain('its 0 ticked members get no IHG points yet')
  })

  it('IHG_TICK_IGNORED (warning) for ticks on a CCA the bundle says is not a sport', () => {
    const out = buildIhgFromTicks([leader([true, true])], [sport({ isSport: false, ihgResult: null, ihgCap: null })])
    expect(out.ihg).toEqual([])
    expect(out.issues).toHaveLength(1)
    expect(out.issues[0]).toMatchObject({ severity: 'warning', code: 'IHG_TICK_IGNORED', fileName: FILE, ccaID: '9201' })
    expect(out.issues[0]?.message).toBe(`${FILE}: Soccer (M) (9201) is not a sports CCA in the bundle, so its 2 IHG ticks are ignored.`)
  })

  it('a non-sport with no ticks raises nothing', () => {
    const out = buildIhgFromTicks([leader([false, false])], [sport({ isSport: false, ihgResult: null, ihgCap: null })])
    expect(out).toEqual({ ihg: [], issues: [], tickedByCca: { '9201': 0 } })
  })

  it('IHG_NO_TICKS (warning) for a sport with a result and nobody ticked', () => {
    const out = buildIhgFromTicks([leader([false, false])], [sport()])
    expect(out.ihg).toEqual([])
    expect(out.issues).toHaveLength(1)
    expect(out.issues[0]).toMatchObject({ severity: 'warning', code: 'IHG_NO_TICKS', fileName: FILE, ccaID: '9201' })
    expect(out.issues[0]?.message).toBe(`${FILE}: Soccer (M) (9201) has IHG result 1st but no member is ticked for the points.`)
  })

  it('decides "sport" only from the bundle row, whatever the file name or result', () => {
    const notSport = sport({ isSport: false })
    expect(buildIhgFromTicks([leader([true])], [notSport]).issues.map((i) => i.code)).toEqual(['IHG_TICK_IGNORED'])
  })

  it('skips a leader with no bundle row and a flat CCA', () => {
    const flat = sport({ flatPoints: 9 })
    expect(buildIhgFromTicks([leader([true])], [flat])).toEqual({ ihg: [], issues: [], tickedByCca: { '9201': 1 } })
    expect(buildIhgFromTicks([leader([true], '9999')], [sport()])).toEqual({ ihg: [], issues: [], tickedByCca: { '9999': 1 } })
  })

  it('one player ticked in two sports gives two entries', () => {
    const second = sport({ ccaID: '9203', ccaName: 'Floorball (M)', ihgResult: '3rd' })
    const out = buildIhgFromTicks(
      [leader([true]), leader([true], '9203', 'points_9203_20270401.csv')],
      [sport(), second],
    )
    expect(out.issues).toEqual([])
    expect(out.ihg).toEqual([
      { matric: 'A9920101X', ccaID: '9201', placement: '1st' },
      { matric: 'A9920101X', ccaID: '9203', placement: '3rd' },
    ])
  })

  it('a semester-only member is ticked like anyone else', () => {
    const rows = [row(1, true, { semesterOnly: true })]
    const out = buildIhgFromTicks([{ fileName: FILE, ccaID: '9201', rows }], [sport()])
    expect(out.ihg).toEqual([{ matric: 'A9920101X', ccaID: '9201', placement: '1st' }])
  })
})
