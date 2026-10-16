import { BASE_POINTS_MAX, DEFAULT_CONFIG } from '../../engine'
import { FACTOR_SLIDER, MULTIPLIER_SLIDER, NumberField, SegmentedField, ToggleField } from './fields'
import { ObjectFields } from './ObjectFields'
import type { SectionProps } from './Section'

const D = DEFAULT_CONFIG

export function HeadcountsFields({ config, update }: SectionProps) {
  return (
    <>
      <p className="pb-1 text-cap text-muted">Seats per band. Lists are final only once these are set.</p>
      <ObjectFields
        value={config.headcounts}
        defaults={D.headcounts}
        onChange={(next) => update('headcounts', next)}
        min={0}
        integer
        labels={{
          maleGreen: 'Male green',
          maleGrey: 'Male grey',
          femaleGreen: 'Female green',
          femaleGrey: 'Female grey',
          sem2Spots: 'Sem-2 spots',
        }}
      />
    </>
  )
}

export function PlacementFields({ config, update }: SectionProps) {
  return (
    <ObjectFields
      value={config.placementBonus}
      defaults={D.placementBonus}
      onChange={(next) => update('placementBonus', next)}
      min={0}
      step={0.5}
      labels={{ pass: 'Pass', bronze: 'Bronze', silver: 'Silver', gold: 'Gold' }}
    />
  )
}

export function HalfCcaFields({ config, update }: SectionProps) {
  return (
    <>
      <NumberField
        label="0.5x CCA base factor"
        value={config.halfCcaBaseFactor}
        defaultValue={D.halfCcaBaseFactor}
        onChange={(v) => update('halfCcaBaseFactor', v)}
        min={0}
        slider={FACTOR_SLIDER}
      />
      <ToggleField
        label="Halve placement for 0.5x CCAs"
        value={config.halfCcaPlacementHalved}
        defaultValue={D.halfCcaPlacementHalved}
        onChange={(v) => update('halfCcaPlacementHalved', v)}
      />
      <ToggleField
        label="Merge two 0.5x CCAs into one slot"
        hint="Pairs are chosen to give each resident the most staying points."
        value={config.mergeHalfCcas}
        defaultValue={D.mergeHalfCcas}
        onChange={(v) => update('mergeHalfCcas', v)}
      />
      <NumberField
        label="Semester-only factor"
        value={config.semesterOnlyFactor}
        defaultValue={D.semesterOnlyFactor}
        onChange={(v) => update('semesterOnlyFactor', v)}
        min={0}
        slider={FACTOR_SLIDER}
        hint="Applied to 1x CCAs only, after the mean/SD check."
      />
    </>
  )
}

export function DroppedRoleFields({ config, update }: SectionProps) {
  return (
    <NumberField
      label="Base ceiling after a dropped role"
      value={config.droppedRoleBase}
      defaultValue={D.droppedRoleBase}
      onChange={(v) => update('droppedRoleBase', v)}
      min={0}
      max={BASE_POINTS_MAX}
      slider={{ min: 0, max: BASE_POINTS_MAX, step: 1 }}
    />
  )
}

export function IhgFields({ config, update }: SectionProps) {
  return (
    <>
      <ObjectFields
        value={config.ihgPoints}
        defaults={D.ihgPoints}
        onChange={(next) => update('ihgPoints', next)}
        min={0}
        step={0.5}
        labels={{ '1st': '1st', '2nd': '2nd', '3rd': '3rd', '3rd4th_no_match': '3rd/4th, no placement match' }}
      />
      <ToggleField
        label="Add IHG into the sport's net"
        hint="Off: IHG points are added flat, never multiplied."
        value={config.ihgInSportNet}
        defaultValue={D.ihgInSportNet}
        onChange={(v) => update('ihgInSportNet', v)}
      />
    </>
  )
}

export function Sem2Fields({ config, update }: SectionProps) {
  return (
    <>
      <SegmentedField
        label="Room-pick mode"
        value={config.sem2Mode}
        defaultValue={D.sem2Mode}
        onChange={(v) => update('sem2Mode', v)}
        options={[
          { value: 'separate', label: 'Separate list' },
          { value: 'merged', label: 'Merged × factor' },
        ]}
      />
      <NumberField
        label="Merged-mode factor"
        value={config.sem2Factor}
        defaultValue={D.sem2Factor}
        onChange={(v) => update('sem2Factor', v)}
        min={0}
        slider={MULTIPLIER_SLIDER}
      />
    </>
  )
}

export function MeanSdFields({ config, update }: SectionProps) {
  return (
    <>
      <p className="pb-1 text-cap text-muted">Used for every CCA without its own range in ccas.csv.</p>
      <ObjectFields
        value={config.meanSdDefault}
        defaults={D.meanSdDefault}
        onChange={(next) => update('meanSdDefault', next)}
        min={0}
        step={0.1}
        labels={{ meanMin: 'Mean, lowest', meanMax: 'Mean, highest', sdMin: 'SD, lowest', sdMax: 'SD, highest' }}
      />
    </>
  )
}
