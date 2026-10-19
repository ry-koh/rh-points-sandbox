import { ArrowRight, Lock, SlidersHorizontal } from 'lucide-react'
import type { Dispatch } from 'react'
import { DEFAULT_CONFIG } from '../../engine'
import { Button } from '../common/controls'
import type { Action, AppState } from '../state/store'
import { CcaTable } from './CcaTable'
import { DropZone } from './DropZone'
import { FileList } from './FileList'
import { IssuesPanel } from './IssuesPanel'

interface ImportScreenProps {
  readonly state: AppState
  readonly dispatch: Dispatch<Action>
  readonly blockedReason: string | null
  readonly settingsCause: boolean
  readonly onViewResults: () => void
}

export function ImportScreen({ state, dispatch, blockedReason, settingsCause, onViewResults }: ImportScreenProps) {
  const { report, files } = state
  const locked = state.finalised !== null
  return (
    <main className="mx-auto max-w-[1600px] px-6 pt-8 pb-16">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-rule pb-5">
        <div>
          <h1 className="text-display font-semibold tracking-tight">Import</h1>
          <p className="mt-1 max-w-2xl text-ui text-muted">
            Drop the vetted CCA files and JCRC lists. Every file is checked here, in this browser;
            nothing is uploaded.
          </p>
        </div>
        <Button
          variant="primary"
          disabled={blockedReason !== null}
          onClick={onViewResults}
          className="h-11 px-5 text-lead"
        >
          {blockedReason === null ? (
            <>
              View results <ArrowRight aria-hidden size={18} />
            </>
          ) : (
            <>
              <Lock aria-hidden size={16} /> {blockedReason}
            </>
          )}
        </Button>
      </div>
      {locked && (
        <p role="status" className="mt-6 flex items-center gap-2 border-l-4 border-gold bg-gold-soft px-4 py-3 text-body font-medium">
          <Lock aria-hidden size={15} /> Finalised · settings locked. Files cannot change until the lists are unlocked on the Results screen.
        </p>
      )}
      {settingsCause && (
        <div role="alert" className="mt-6 flex flex-wrap items-center gap-3 border-l-4 border-gold bg-gold-soft px-4 py-3">
          <SlidersHorizontal aria-hidden size={16} />
          <p className="min-w-0 flex-1 text-body">
            These files pass with the default settings. The current settings (for example tier names
            or the mean/SD defaults) cause the errors below.
          </p>
          <Button small onClick={onViewResults}>
            Open settings
          </Button>
          <Button small variant="ghost" onClick={() => dispatch({ type: 'setConfig', config: DEFAULT_CONFIG })}>
            Reset settings to defaults
          </Button>
        </div>
      )}
      <div className="mt-8 grid gap-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,4fr)]">
        <div className="min-w-0">
          {!locked && <DropZone onFiles={(added) => dispatch({ type: 'addFiles', files: added })} />}
          <FileList files={files} locked={locked} onRemove={(name) => dispatch({ type: 'removeFile', name })} />
        </div>
        {files.length > 0 && <IssuesPanel issues={report.issues} />}
      </div>
      <CcaTable
        rows={report.perCca}
        waivers={new Set(Object.keys(report.settings?.waivers ?? {}))}
      />
    </main>
  )
}
