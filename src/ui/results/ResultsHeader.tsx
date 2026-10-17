import { Bookmark, Lock, LockOpen } from 'lucide-react'
import { useState, type Dispatch } from 'react'
import { computeAll, createPenaltyState, type Lists } from '../../engine'
import { Button, ConfirmDialog } from '../common/controls'
import { ScenariosDialog } from '../scenarios/ScenariosDialog'
import { entryOptions, finaliseBlock, type Action, type AppState } from '../state/store'
import type { ScenarioStore } from '../state/useScenarios'

interface ResultsHeaderProps {
  readonly state: AppState
  readonly lists: Lists | null
  readonly dispatch: Dispatch<Action>
  readonly scenarios: ScenarioStore
}

type Ask = 'finalise' | 'unlock' | null

/** Scenarios, Finalise and Unlock, each behind its own dialog. */
export function ResultsHeader({ state, lists, dispatch, scenarios }: ResultsHeaderProps) {
  const [ask, setAsk] = useState<Ask>(null)
  const [scenariosOpen, setScenariosOpen] = useState(false)
  const penalties = state.finalised?.log.length ?? 0
  const finalised = state.finalised !== null
  const block = finaliseBlock(state)
  return (
    <div className="flex items-center gap-2 border-b border-rule px-6 py-2">
      <Button small onClick={() => setScenariosOpen(true)}>
        <Bookmark aria-hidden size={13} /> Scenarios · <span className="num">{scenarios.scenarios.length}</span>
      </Button>
      {!finalised && !state.report.settings && (
        <p className="text-cap text-muted" role="note">
          Using the sandbox’s own ranges. Load JCRC’s points settings file before finalising.
        </p>
      )}
      <div className="ml-auto">
        {finalised ? (
          <Button small onClick={() => setAsk('unlock')}>
            <LockOpen aria-hidden size={13} /> Unlock
          </Button>
        ) : (
          <Button small variant="primary" disabled={!lists || block !== null} title={block ?? undefined} onClick={() => setAsk('finalise')}>
            <Lock aria-hidden size={13} /> Finalise lists
          </Button>
        )}
      </div>
      <ConfirmDialog
        open={ask === 'finalise'}
        title="Finalise the lists?"
        confirmLabel="Finalise lists"
        onCancel={() => setAsk(null)}
        onConfirm={() => {
          // Freeze cut-offs from lists computed now, never from results still waiting on the debounce.
          const input = state.report.input
          if (input) dispatch({ type: 'finalise', penalty: createPenaltyState(computeAll(input, state.config, entryOptions(state)).lists) })
          setAsk(null)
        }}
      >
        <p>The settings, imported files, final-points overrides and discretion lock, and each gender’s green cut-off freezes at today’s lowest green score.</p>
        <p className="mt-2 text-muted">Wheel results stay editable. After finalising you can drop incoming roles (penalties) from a resident’s breakdown, and publish. Unlocking clears every penalty.</p>
      </ConfirmDialog>
      <ConfirmDialog
        open={ask === 'unlock'}
        title="Unlock the lists?"
        confirmLabel={penalties > 0 ? `Clear ${penalties} and unlock` : 'Unlock'}
        onCancel={() => setAsk(null)}
        onConfirm={() => {
          dispatch({ type: 'unlock' })
          setAsk(null)
        }}
      >
        This clears {penalties} {penalties === 1 ? 'penalty' : 'penalties'} and unfreezes the cut-offs. Settings, files and adjustments can be changed again.
        Wheel results are kept; any that no longer match a tie are flagged.
      </ConfirmDialog>
      <ScenariosDialog
        open={scenariosOpen}
        store={scenarios}
        config={state.config}
        locked={finalised}
        onLoad={(config) => dispatch({ type: 'setConfig', config })}
        onClose={() => setScenariosOpen(false)}
      />
    </div>
  )
}
