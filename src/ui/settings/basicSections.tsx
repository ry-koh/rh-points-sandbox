import { BASE_POINTS_MAX, DEFAULT_CONFIG } from '../../engine'
import { FACTOR_SLIDER, MULTIPLIER_SLIDER, NumberField, SegmentedField, ToggleField } from './fields'
import { HEADCOUNT_LABELS, MEAN_SD_LABELS, SEM2_MODE_OPTIONS, SETTINGS_TEXT as T } from './labels'
import { ObjectFields } from './ObjectFields'
import type { SectionProps } from './Section'

const D = DEFAULT_CONFIG
const PERCENT = 100

export function HeadcountsFields({ config, update }: SectionProps) {
  return (
    <ObjectFields
      value={config.headcounts}
      defaults={D.headcounts}
      onChange={(next) => update('headcounts', next)}
      min={0}
      integer
      labels={HEADCOUNT_LABELS}
      help={T.headcounts.help}
    />
  )
}

export function HalfCcaFields({ config, update }: SectionProps) {
  return (
    <>
      <NumberField
        label={T.halfCcaBaseFactor.label}
        hint={T.halfCcaBaseFactor.help}
        value={config.halfCcaBaseFactor}
        defaultValue={D.halfCcaBaseFactor}
        onChange={(v) => update('halfCcaBaseFactor', v)}
        min={0}
        slider={FACTOR_SLIDER}
      />
      <ToggleField
        label={T.halfCcaPlacementHalved.label}
        hint={T.halfCcaPlacementHalved.help}
        value={config.halfCcaPlacementHalved}
        defaultValue={D.halfCcaPlacementHalved}
        onChange={(v) => update('halfCcaPlacementHalved', v)}
      />
      <ToggleField
        label={T.mergeHalfCcas.label}
        hint={T.mergeHalfCcas.help}
        value={config.mergeHalfCcas}
        defaultValue={D.mergeHalfCcas}
        onChange={(v) => update('mergeHalfCcas', v)}
      />
      <NumberField
        label={T.semesterOnlyFactor.label}
        hint={T.semesterOnlyFactor.help}
        value={config.semesterOnlyFactor}
        defaultValue={D.semesterOnlyFactor}
        onChange={(v) => update('semesterOnlyFactor', v)}
        min={0}
        slider={FACTOR_SLIDER}
      />
    </>
  )
}

export function DroppedRoleFields({ config, update }: SectionProps) {
  return (
    <NumberField
      label={T.droppedRoleBase.label}
      hint={T.droppedRoleBase.help}
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
        help={T.ihgPoints.help}
      />
      <ToggleField
        label={T.ihgInSportNet.label}
        hint={T.ihgInSportNet.help}
        value={config.ihgInSportNet}
        defaultValue={D.ihgInSportNet}
        onChange={(v) => update('ihgInSportNet', v)}
      />
    </>
  )
}

export function Sem2Fields({ config, update }: SectionProps) {
  const mixed = config.sem2Mode === 'merged'
  return (
    <>
      <SegmentedField
        label={T.sem2Mode.label}
        hint={T.sem2Mode.help}
        value={config.sem2Mode}
        defaultValue={D.sem2Mode}
        onChange={(v) => update('sem2Mode', v)}
        options={SEM2_MODE_OPTIONS}
      />
      <NumberField
        label={T.sem2Factor.label}
        hint={T.sem2Factor.help}
        value={config.sem2Factor}
        defaultValue={D.sem2Factor}
        onChange={(v) => update('sem2Factor', v)}
        min={0}
        slider={MULTIPLIER_SLIDER}
        disabled={!mixed}
      />
    </>
  )
}

/** The exchange factor is stored as a fraction (0.75) and shown as a percentage (75%). */
export function JcrcFields({ config, update }: SectionProps) {
  return (
    <>
      <NumberField
        label={T.jcrcFullYearOffset.label}
        value={config.jcrcFullYearOffset}
        defaultValue={D.jcrcFullYearOffset}
        onChange={(v) => update('jcrcFullYearOffset', v)}
        step={0.5}
      />
      <NumberField
        label={T.jcrcExchangeFactor.label}
        hint={T.jcrcExchangeFactor.help}
        value={Math.round(config.jcrcExchangeFactor * PERCENT * 1000) / 1000}
        defaultValue={D.jcrcExchangeFactor * PERCENT}
        onChange={(v) => update('jcrcExchangeFactor', v / PERCENT)}
        min={0}
        suffix="%"
        slider={{ min: 0, max: 200, step: 5 }}
      />
    </>
  )
}

export function MeanSdFields({ config, update }: SectionProps) {
  return (
    <ObjectFields
      value={config.meanSdDefault}
      defaults={D.meanSdDefault}
      onChange={(next) => update('meanSdDefault', next)}
      min={0}
      step={0.1}
      labels={MEAN_SD_LABELS}
      help={T.meanSdDefault.help}
    />
  )
}
