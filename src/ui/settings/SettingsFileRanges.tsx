import { Lock } from 'lucide-react'
import type { LoadedSettings } from '../../import'
import { MEAN_SD_LABELS } from './labels'

/** `2027-04-01T09:30:00.000Z` -> `2027-04-01`; anything else is shown as written. */
export const exportedDate = (exportedAt: string): string => /^\d{4}-\d{2}-\d{2}/.exec(exportedAt)?.[0] ?? exportedAt

/**
 * The default allowed average and spread while JCRC's points settings file is loaded: the
 * file's values, read-only. Waivers are listed in the CCA table on the Import screen.
 */
export function SettingsFileRanges({ settings }: { readonly settings: LoadedSettings }) {
  const range = settings.defaultRange
  return (
    <div className="px-1 pb-2">
      <p className="flex items-center gap-1.5 py-2 text-body font-medium">
        <Lock aria-hidden size={13} /> From JCRC settings file (exported {exportedDate(settings.exportedAt)})
      </p>
      <dl className="grid grid-cols-[1fr_auto] gap-y-1 text-body">
        {(Object.keys(MEAN_SD_LABELS) as (keyof typeof MEAN_SD_LABELS)[]).map((key) => (
          <div key={key} className="contents">
            <dt className="text-muted">{MEAN_SD_LABELS[key]}</dt>
            <dd className="num text-right">{range[key]}</dd>
          </div>
        ))}
      </dl>
      <p className="pt-2 text-cap text-muted">
        These can only change by loading a new settings file. {Object.keys(settings.waivers).length} waiver
        {Object.keys(settings.waivers).length === 1 ? '' : 's'} apply on top.
      </p>
    </div>
  )
}
