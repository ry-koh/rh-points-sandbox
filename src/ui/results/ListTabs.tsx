import { useRef, type KeyboardEvent } from 'react'
import type { Lists } from '../../engine'
import { LIST_KEYS, LIST_TITLES, type ListKey } from '../export/exportCsv'

interface ListTabsProps {
  readonly lists: Lists
  readonly active: ListKey
  readonly onChange: (list: ListKey) => void
}

export const tabId = (list: ListKey): string => `tab-${list}`
export const panelId = 'list-panel'

/** WAI-ARIA tabs: arrow keys move between lists, Home/End jump to the ends. */
export function ListTabs({ lists, active, onChange }: ListTabsProps) {
  const refs = useRef<Partial<Record<ListKey, HTMLButtonElement | null>>>({})
  const onKey = (event: KeyboardEvent<HTMLDivElement>): void => {
    const index = LIST_KEYS.indexOf(active)
    const moves: Record<string, number> = { ArrowRight: index + 1, ArrowLeft: index - 1, Home: 0, End: LIST_KEYS.length - 1 }
    const target = moves[event.key]
    if (target === undefined) return
    event.preventDefault()
    const next = LIST_KEYS[(target + LIST_KEYS.length) % LIST_KEYS.length]
    if (next) {
      onChange(next)
      refs.current[next]?.focus()
    }
  }
  return (
    <div role="tablist" aria-label="Lists" onKeyDown={onKey} className="flex gap-6 border-b border-rule px-6">
      {LIST_KEYS.map((key) => {
        const selected = key === active
        return (
          <button
            key={key}
            ref={(el) => {
              refs.current[key] = el
            }}
            id={tabId(key)}
            type="button"
            role="tab"
            aria-selected={selected}
            aria-controls={panelId}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(key)}
            className={`motion relative flex h-11 items-center gap-2 text-ui font-medium ${selected ? 'text-ink' : 'text-muted hover:text-ink'}`}
          >
            {LIST_TITLES[key]}
            <span className={`num rounded-[3px] px-1.5 text-cap ${selected ? 'bg-ink text-paper' : 'bg-ink/[0.07]'}`}>
              {lists[key].length}
            </span>
            <span className={`motion absolute inset-x-0 -bottom-px h-[3px] bg-raffles ${selected ? 'opacity-100' : 'opacity-0'}`} />
          </button>
        )
      })}
    </div>
  )
}
