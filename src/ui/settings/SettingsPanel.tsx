import { Lock } from 'lucide-react'
import { useState, type ComponentType } from 'react'
import { DEFAULT_CONFIG, type ScenarioConfig } from '../../engine'
import { Button, ConfirmDialog } from '../common/controls'
import {
  DroppedRoleFields,
  HalfCcaFields,
  HeadcountsFields,
  IhgFields,
  JcrcFields,
  MeanSdFields,
  PlacementFields,
  Sem2Fields,
} from './basicSections'
import { differs } from './fields'
import { Section, type SectionProps } from './Section'
import { AuxFields, LeaderFields, WeightsFields } from './tableSections'

interface SectionDef {
  readonly id: string
  readonly title: string
  readonly keys: readonly (keyof ScenarioConfig)[]
  readonly Body: ComponentType<SectionProps>
}

/** Every key of the scenario config (spec §3) appears in exactly one section. */
export const SECTIONS: readonly SectionDef[] = [
  { id: 'headcounts', title: 'Headcounts', keys: ['headcounts'], Body: HeadcountsFields },
  { id: 'placement', title: 'Placement bonus', keys: ['placementBonus'], Body: PlacementFields },
  { id: 'leaders', title: 'Leader multipliers', keys: ['incomingMultiplier', 'outgoingMode', 'outgoingTiers', 'stackingMode'], Body: LeaderFields },
  { id: 'weights', title: 'Staying weights', keys: ['stayingWeights', 'stayingWeightTail'], Body: WeightsFields },
  { id: 'half', title: 'Half CCAs and semester-only', keys: ['halfCcaBaseFactor', 'halfCcaPlacementHalved', 'mergeHalfCcas', 'semesterOnlyFactor'], Body: HalfCcaFields },
  { id: 'dropped', title: 'Dropped role', keys: ['droppedRoleBase'], Body: DroppedRoleFields },
  { id: 'aux', title: 'AUX', keys: ['auxTable', 'auxCap'], Body: AuxFields },
  { id: 'ihg', title: 'IHG', keys: ['ihgPoints', 'ihgInSportNet'], Body: IhgFields },
  { id: 'sem2', title: 'Sem-2', keys: ['sem2Mode', 'sem2Factor'], Body: Sem2Fields },
  { id: 'jcrc', title: 'JCRC residents', keys: ['jcrcFullYearOffset', 'jcrcExchangeFactor'], Body: JcrcFields },
  { id: 'meanSd', title: 'Mean/SD defaults', keys: ['meanSdDefault'], Body: MeanSdFields },
]

const countChanged = (config: ScenarioConfig, keys: readonly (keyof ScenarioConfig)[]): number =>
  keys.filter((key) => differs(config[key], DEFAULT_CONFIG[key])).length

interface SettingsPanelProps {
  readonly config: ScenarioConfig
  readonly locked: boolean
  readonly onChange: (config: ScenarioConfig) => void
  readonly openSections: ReadonlySet<string>
  readonly onOpenSectionsChange: (open: ReadonlySet<string>) => void
}

export function SettingsPanel({ config, locked, onChange, openSections, onOpenSectionsChange }: SettingsPanelProps) {
  const [confirmReset, setConfirmReset] = useState(false)
  const update: SectionProps['update'] = (key, value) => onChange({ ...config, [key]: value })
  const totalChanged = countChanged(config, Object.keys(DEFAULT_CONFIG) as (keyof ScenarioConfig)[])
  const toggle = (id: string): void => {
    const next = new Set(openSections)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    onOpenSectionsChange(next)
  }
  return (
    <aside aria-label="Settings" className="flex h-full flex-col border-r border-rule bg-paper">
      <div className="flex items-center gap-2 border-b-2 border-ink px-4 py-3">
        <h2 className="flex flex-1 items-center gap-1.5 text-lead font-semibold">
          {locked && <Lock aria-label="Locked" size={14} />}
          Settings
        </h2>
        <Button small variant="ghost" disabled={locked || totalChanged === 0} onClick={() => setConfirmReset(true)}>
          Reset all
        </Button>
      </div>
      {locked && (
        <p className="flex items-center gap-1.5 border-b border-rule bg-gold-soft px-4 py-2 text-body font-medium">
          <Lock aria-hidden size={13} /> Finalised · settings locked
        </p>
      )}
      <div className="min-h-0 flex-1 overflow-y-auto">
        {SECTIONS.map(({ id, title, keys, Body }) => (
          <Section
            key={id}
            title={title}
            open={openSections.has(id)}
            changed={countChanged(config, keys)}
            onToggle={() => toggle(id)}
            prominent={id === 'headcounts'}
          >
            <fieldset disabled={locked} className={locked ? 'opacity-70' : ''}>
              <Body config={config} update={update} />
            </fieldset>
          </Section>
        ))}
      </div>
      <ConfirmDialog
        open={confirmReset}
        title="Reset all settings to defaults?"
        confirmLabel="Reset all"
        onCancel={() => setConfirmReset(false)}
        onConfirm={() => {
          onChange(DEFAULT_CONFIG)
          setConfirmReset(false)
        }}
      >
        {totalChanged} {totalChanged === 1 ? 'setting differs' : 'settings differ'} from the defaults,
        including headcounts. Imported files are kept.
      </ConfirmDialog>
    </aside>
  )
}
