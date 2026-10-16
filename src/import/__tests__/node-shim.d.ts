// Minimal typings for the two node:fs calls used by samples.test.ts (no @types/node needed).
declare module 'node:fs' {
  export function readdirSync(path: string): string[]
  export function readFileSync(path: string, encoding: 'utf8'): string
}
