import { NumberField } from './fields'

interface ObjectFieldsProps<T extends Readonly<Record<keyof T, number>>> {
  readonly value: T
  readonly defaults: T
  readonly labels: Readonly<Record<keyof T & string, string>>
  readonly onChange: (next: T) => void
  readonly min?: number
  readonly max?: number
  readonly step?: number
  readonly integer?: boolean
  readonly slider?: { readonly min: number; readonly max: number; readonly step: number }
  /** One help line for the whole group, shown under the fields. */
  readonly help?: string
}

/** One number field per key of a settings object (e.g. placement bonus per level). */
export function ObjectFields<T extends Readonly<Record<keyof T, number>>>(props: ObjectFieldsProps<T>) {
  const { value, defaults, labels, onChange } = props
  const keys = Object.keys(labels) as (keyof T & string)[]
  return (
    <>
      {keys.map((key) => (
        <NumberField
          key={key}
          label={labels[key]}
          value={value[key] ?? 0}
          defaultValue={defaults[key] ?? 0}
          onChange={(next) => onChange({ ...value, [key]: next })}
          min={props.min}
          max={props.max}
          step={props.step}
          integer={props.integer}
          slider={props.slider}
        />
      ))}
      {props.help && <p className="pr-10 pb-1 text-cap text-muted">{props.help}</p>}
    </>
  )
}
