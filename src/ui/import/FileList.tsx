import { X } from 'lucide-react'
import { useMemo } from 'react'
import type { SourceFile } from '../../import'
import { Chip, Eyebrow } from '../common/controls'
import { KIND_LABELS, describeFile } from '../state/fileInfo'

interface FileListProps {
  readonly files: readonly SourceFile[]
  readonly locked: boolean
  readonly onRemove: (name: string) => void
}

export function FileList({ files, locked, onRemove }: FileListProps) {
  const infos = useMemo(() => files.map(describeFile), [files])
  if (infos.length === 0) {
    return <p className="mt-4 text-body text-muted">No files yet.</p>
  }
  return (
    <div className="mt-6">
      <Eyebrow>Files · {infos.length}</Eyebrow>
      <table className="mt-2 w-full border-collapse text-body">
        <thead className="sr-only">
          <tr>
            <th>File</th>
            <th>Kind</th>
            <th>Rows</th>
            <th>Remove</th>
          </tr>
        </thead>
        <tbody>
          {infos.map((info) => (
            <tr key={info.name} className="border-b border-rule last:border-b-0 hover:bg-ink/[0.03]">
              <td className="max-w-0 truncate py-1.5 pr-3 font-mono text-cap" title={info.name}>
                {info.name}
              </td>
              <td className="w-28 py-1.5 pr-3">
                {info.kind ? (
                  <Chip tone={info.kind === 'leader' ? 'outline' : 'gold'}>{KIND_LABELS[info.kind]}</Chip>
                ) : (
                  <Chip tone="error">Unrecognised</Chip>
                )}
              </td>
              <td className="num w-20 py-1.5 pr-3 text-right text-muted">
                {info.rows} {info.rows === 1 ? 'row' : 'rows'}
              </td>
              <td className="w-8 py-1.5 text-right">
                <button
                  type="button"
                  disabled={locked}
                  onClick={() => onRemove(info.name)}
                  aria-label={`Remove ${info.name}`}
                  className="motion rounded-[3px] p-1 text-muted hover:bg-error-bg hover:text-error disabled:opacity-30 disabled:hover:bg-transparent"
                >
                  <X aria-hidden size={14} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
