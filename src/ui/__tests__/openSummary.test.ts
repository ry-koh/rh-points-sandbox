import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { DEFAULT_CONFIG } from '../../engine'
import { restoreWorkspace, type RestoredWorkspace } from '../../workspace'
import { initialState } from '../state/store'
import { toWorkspace } from '../state/workspaceState'
import { OpenSummaryDialog } from '../workspace/OpenSummaryDialog'

const base = restoreWorkspace(toWorkspace(initialState(DEFAULT_CONFIG, []), new Date(2027, 0, 1)))
const edit = { reason: '', at: 'T' }
const render = (restored: RestoredWorkspace, groupsReplaced = false): string =>
  renderToStaticMarkup(createElement(OpenSummaryDialog, { restored, groupsReplaced, onClose: () => undefined }))

describe('Open workspace summary: tick, flat and AUX edits', () => {
  it('lists each changed or stale tick, flat and AUX edit like a score edit', () => {
    const restored: RestoredWorkspace = {
      ...base,
      unchecked: { review: false, computed: false, aux: false },
      stale: {
        ...base.stale,
        tickEdits: [{ entry: { matric: 'A0000001Z', ccaID: 'C5', from: false, to: true, ...edit }, status: 'changed', fileValue: 1 }] as never,
        flatEdits: [{ entry: { matric: 'A0000002Z', ccaID: 'C7', from: 9, to: 7, ...edit }, status: 'stale', fileValue: null }] as never,
        auxEdits: [{ entry: { matric: 'A0000003Z', from: 6, to: 7, ...edit }, status: 'changed', fileValue: 5 }] as never,
      },
    }
    const html = render(restored)
    expect(html).toContain('IHG tick edit for A0000001Z in C5 no longer matches the file')
    expect(html).toContain('Flat value edit for A0000002Z in C7 no longer matches the file')
    expect(html).toContain('AUX edit for A0000003Z no longer matches the residents list')
  })

  it('says AUX edits are unchecked while no residents list is loaded', () => {
    const html = render({ ...base, unchecked: { review: false, computed: false, aux: true } })
    expect(html).toContain('AUX edits are unchecked')
    expect(render({ ...base, unchecked: { review: false, computed: false, aux: false } })).not.toContain('AUX edits are unchecked')
  })

  it('shows the groups note only when the file’s groups replaced this computer’s', () => {
    expect(render(base, true)).toContain('Groups from the file replaced this computer’s groups.')
    expect(render(base, false)).not.toContain('Groups from the file replaced')
  })
})
