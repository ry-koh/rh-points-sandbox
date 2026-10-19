import { FlaskConical, Upload } from 'lucide-react'
import { useRef, useState, type DragEvent } from 'react'
import type { SourceFile } from '../../import'
import { Button } from '../common/controls'
import { DEMO_AVAILABLE } from './demoData'

interface DropZoneProps {
  readonly onFiles: (files: readonly SourceFile[]) => void
  /** Loads the synthetic demo (dev only). */
  readonly onDemo: () => void
}

const isCsv = (file: File): boolean => file.name.toLowerCase().endsWith('.csv')

async function readAll(list: FileList | null): Promise<{ files: SourceFile[]; skipped: string[] }> {
  const all = Array.from(list ?? [])
  const files = await Promise.all(
    all.filter(isCsv).map(async (file) => ({ name: file.name, text: await file.text() })),
  )
  return { files, skipped: all.filter((f) => !isCsv(f)).map((f) => f.name) }
}

export function DropZone({ onFiles, onDemo }: DropZoneProps) {
  const input = useRef<HTMLInputElement>(null)
  const [over, setOver] = useState(false)
  const [skipped, setSkipped] = useState<readonly string[]>([])

  const accept = async (list: FileList | null): Promise<void> => {
    const read = await readAll(list)
    setSkipped(read.skipped)
    if (read.files.length > 0) onFiles(read.files)
  }
  const onDrop = (event: DragEvent<HTMLDivElement>): void => {
    event.preventDefault()
    setOver(false)
    void accept(event.dataTransfer.files)
  }

  return (
    <div>
      <div
        onDragOver={(event) => {
          event.preventDefault()
          setOver(true)
        }}
        onDragLeave={() => setOver(false)}
        onDrop={onDrop}
        className={`motion flex items-center gap-5 rounded-[4px] border-2 border-dashed px-5 py-5 ${
          over ? 'border-raffles bg-raffles/5' : 'border-ink/20 bg-card'
        }`}
      >
        <Upload aria-hidden size={28} strokeWidth={1.5} className={over ? 'text-raffles' : 'text-muted'} />
        <div className="min-w-0 flex-1">
          <div className="text-lead font-medium">Drop CSV files here</div>
          <div className="text-body text-muted">
            Leader exports, the RH-app bundle and residents.csv. A file with the same name replaces
            the earlier one.
          </div>
        </div>
        <div className="flex shrink-0 flex-col gap-2">
          <Button variant="primary" onClick={() => input.current?.click()}>
            Choose files
          </Button>
          {DEMO_AVAILABLE && (
            <Button small variant="ghost" onClick={onDemo}>
              <FlaskConical aria-hidden size={14} /> Load demo data
            </Button>
          )}
        </div>
        <input
          ref={input}
          type="file"
          accept=".csv,text/csv"
          multiple
          hidden
          onChange={(event) => {
            void accept(event.target.files)
            event.target.value = ''
          }}
        />
      </div>
      {skipped.length > 0 && (
        <p role="status" className="mt-2 text-body text-warning">
          Skipped (not .csv): {skipped.join(', ')}
        </p>
      )}
    </div>
  )
}
