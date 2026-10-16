// Extra node:fs typing for the confidentiality scan (no @types/node needed).
declare module 'node:fs' {
  export function readdirSync(path: string, options: { recursive: true }): string[]
}
