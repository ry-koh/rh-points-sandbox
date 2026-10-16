import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

const COVERAGE_THRESHOLD = 80

export default defineConfig({
  plugins: [react()],
  test: {
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/engine/**', 'src/import/**'],
      exclude: ['src/**/__tests__/**'],
      thresholds: {
        lines: COVERAGE_THRESHOLD,
        branches: COVERAGE_THRESHOLD,
        functions: COVERAGE_THRESHOLD,
        statements: COVERAGE_THRESHOLD,
      },
    },
  },
})
