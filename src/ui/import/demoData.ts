import type { CcaLevelEntry, SourceFile } from '../../import'

/** True only in `npm run dev`; the production build drops the demo loader and its files. */
export const DEMO_AVAILABLE: boolean = import.meta.env.DEV

/** Synthetic sample files from samples/valid (dev only). */
export async function loadDemoFiles(): Promise<SourceFile[]> {
  if (import.meta.env.DEV) {
    const modules = import.meta.glob<string>('../../../samples/valid/*.csv', {
      query: '?raw',
      import: 'default',
    })
    const entries = await Promise.all(
      Object.entries(modules).map(async ([path, load]) => ({
        name: path.split('/').pop() ?? path,
        text: await load(),
      })),
    )
    return entries.sort((a, b) => a.name.localeCompare(b.name))
  }
  return []
}

/** The demo's level for each CCA, from samples/valid/demo-levels.json (dev only). */
export async function loadDemoLevels(): Promise<CcaLevelEntry[]> {
  if (import.meta.env.DEV) {
    const modules = import.meta.glob<string>('../../../samples/valid/demo-levels.json', {
      query: '?raw',
      import: 'default',
    })
    const [load] = Object.values(modules)
    return load ? (JSON.parse(await load()) as CcaLevelEntry[]) : []
  }
  return []
}
