// Dependency-free on purpose: this file is copied into the RH app unchanged.

export interface RangeFields {
  readonly meanMin: number
  readonly meanMax: number
  readonly sdMin: number
  readonly sdMax: number
}

export interface RangeOverride {
  readonly meanMin: number | null
  readonly meanMax: number | null
  readonly sdMin: number | null
  readonly sdMax: number | null
}

export interface MeanSdCheck {
  readonly mean: number
  readonly sd: number
  readonly meanOk: boolean
  readonly sdOk: boolean
  readonly ok: boolean
}

export function mean(values: readonly number[]): number {
  if (values.length === 0) return Number.NaN
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

/** Population standard deviation (divides by N). */
export function populationSd(values: readonly number[]): number {
  if (values.length === 0) return Number.NaN
  const center = mean(values)
  const squares = values.reduce((sum, value) => sum + (value - center) ** 2, 0)
  return Math.sqrt(squares / values.length)
}

/** Each blank (null) override field falls back to the default independently. */
export function resolveRange(override: RangeOverride, fallback: RangeFields): RangeFields {
  return {
    meanMin: override.meanMin ?? fallback.meanMin,
    meanMax: override.meanMax ?? fallback.meanMax,
    sdMin: override.sdMin ?? fallback.sdMin,
    sdMax: override.sdMax ?? fallback.sdMax,
  }
}

function withinInclusive(value: number, min: number, max: number, tolerance: number): boolean {
  return value >= min - tolerance && value <= max + tolerance
}

export function checkMeanSd(
  scores: readonly number[],
  range: RangeFields,
  tolerance: number,
): MeanSdCheck {
  const average = mean(scores)
  const sd = populationSd(scores)
  const meanOk = withinInclusive(average, range.meanMin, range.meanMax, tolerance)
  const sdOk = withinInclusive(sd, range.sdMin, range.sdMax, tolerance)
  return { mean: average, sd, meanOk, sdOk, ok: meanOk && sdOk }
}
