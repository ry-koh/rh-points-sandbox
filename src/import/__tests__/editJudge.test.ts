import { describe, expect, it } from 'vitest'
import { deepFreeze } from '../../engine/__tests__/helpers'
import { judgeEdits, reasonFits } from '../editJudge'
import { MAX_REASON_LENGTH } from '../../engine'

interface Edit {
  readonly key: string
  readonly from: number
  readonly to: number
}

const current: Readonly<Record<string, number>> = { a: 1, b: 2 }
const judge = (edits: readonly Edit[]) =>
  judgeEdits(
    edits,
    (e) => e.key,
    (e) => current[e.key] ?? null,
  )

describe('judgeEdits', () => {
  it('applied while the current value equals from', () => {
    expect(judge([{ key: 'a', from: 1, to: 5 }])).toEqual([{ entry: { key: 'a', from: 1, to: 5 }, status: 'applied', current: 1 }])
  })

  it('changed when the current value moved since the edit', () => {
    expect(judge([{ key: 'b', from: 3, to: 5 }])[0]).toMatchObject({ status: 'changed', current: 2 })
  })

  it('stale when there is no current value', () => {
    expect(judge([{ key: 'z', from: 1, to: 5 }])[0]).toMatchObject({ status: 'stale', current: null })
  })

  it('only the last edit per key counts; earlier ones are stale but keep their current value', () => {
    const out = judge([
      { key: 'a', from: 1, to: 5 },
      { key: 'b', from: 2, to: 3 },
      { key: 'a', from: 1, to: 6 },
    ])
    expect(out.map((e) => e.status)).toEqual(['stale', 'applied', 'applied'])
    expect(out[0]?.current).toBe(1)
  })

  it('compares booleans too', () => {
    const out = judgeEdits(
      [{ k: 'x', from: true, to: false }],
      (e) => e.k,
      () => false,
    )
    expect(out[0]).toMatchObject({ status: 'changed', current: false })
  })

  it('never mutates its input', () => {
    const edits = deepFreeze([{ key: 'a', from: 1, to: 5 }])
    expect(() => judge(edits)).not.toThrow()
  })
})

describe('reasonFits', () => {
  it('accepts empty and up to the limit (trimmed); rejects longer or non-strings', () => {
    expect(reasonFits('')).toBe(true)
    expect(reasonFits(`  ${'x'.repeat(MAX_REASON_LENGTH)}  `)).toBe(true)
    expect(reasonFits('x'.repeat(MAX_REASON_LENGTH + 1))).toBe(false)
    expect(reasonFits(undefined)).toBe(false)
  })
})
