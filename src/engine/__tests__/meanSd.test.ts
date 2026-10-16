import { describe, expect, it } from 'vitest'
import { DEFAULT_CONFIG, RANGE_TOLERANCE } from '../defaults'
import { checkMeanSd, mean, populationSd, resolveRange } from '../meanSd'
import { deepFreeze } from './helpers'

const E8_SCORES = [20, 20, 15, 12, 10, 8, 5]
const NO_OVERRIDE = { meanMin: null, meanMax: null, sdMin: null, sdMax: null }

describe('mean / populationSd', () => {
  it('E8: mean 12.857 and population SD 5.357', () => {
    expect(mean(E8_SCORES)).toBeCloseTo(12.857, 3)
    expect(populationSd(E8_SCORES)).toBeCloseTo(5.357, 3)
  })

  it('SD of identical scores is 0', () => {
    expect(populationSd([7, 7, 7])).toBe(0)
  })

  it('uses N, not N-1', () => {
    expect(populationSd([0, 2])).toBe(1)
  })
})

describe('checkMeanSd', () => {
  const range = DEFAULT_CONFIG.meanSdDefault

  it('E8: default ranges pass the mean but fail the SD', () => {
    const result = checkMeanSd(E8_SCORES, range, RANGE_TOLERANCE)
    expect(result.meanOk).toBe(true)
    expect(result.sdOk).toBe(false)
    expect(result.ok).toBe(false)
  })

  it('accepts scores inside both ranges', () => {
    expect(checkMeanSd([10, 12, 14, 16], range, RANGE_TOLERANCE).ok).toBe(true)
  })

  it('bounds are inclusive', () => {
    const exact = { meanMin: 1, meanMax: 1, sdMin: 1, sdMax: 1 }
    expect(checkMeanSd([0, 2], exact, RANGE_TOLERANCE).meanOk).toBe(true)
    expect(checkMeanSd([0, 2], exact, RANGE_TOLERANCE).sdOk).toBe(true)
  })

  it('tolerates rounding noise below the tolerance', () => {
    const tight = { meanMin: 1 + RANGE_TOLERANCE / 2, meanMax: 5, sdMin: 0, sdMax: 5 }
    expect(checkMeanSd([0, 2], tight, RANGE_TOLERANCE).meanOk).toBe(true)
  })

  it('rejects a mean beyond the tolerance', () => {
    const tight = { meanMin: 1 + RANGE_TOLERANCE * 10, meanMax: 5, sdMin: 0, sdMax: 5 }
    expect(checkMeanSd([0, 2], tight, RANGE_TOLERANCE).meanOk).toBe(false)
  })

  it('rejects a mean above the maximum', () => {
    expect(checkMeanSd([18, 20], range, RANGE_TOLERANCE).meanOk).toBe(false)
  })

  it('fails on an empty list', () => {
    const result = checkMeanSd([], range, RANGE_TOLERANCE)
    expect(result.ok).toBe(false)
    expect(Number.isNaN(result.mean)).toBe(true)
  })

  it('does not mutate its inputs', () => {
    const scores = deepFreeze([...E8_SCORES])
    expect(() => checkMeanSd(scores, deepFreeze({ ...range }), RANGE_TOLERANCE)).not.toThrow()
  })
})

describe('resolveRange', () => {
  const fallback = DEFAULT_CONFIG.meanSdDefault

  it('uses the default when every override is blank', () => {
    expect(resolveRange(NO_OVERRIDE, fallback)).toEqual(fallback)
  })

  it('falls back field by field', () => {
    const resolved = resolveRange({ ...NO_OVERRIDE, sdMax: 8 }, fallback)
    expect(resolved).toEqual({ ...fallback, sdMax: 8 })
  })

  it('keeps a zero override instead of falling back', () => {
    expect(resolveRange({ ...NO_OVERRIDE, sdMin: 0 }, fallback).sdMin).toBe(0)
  })
})
