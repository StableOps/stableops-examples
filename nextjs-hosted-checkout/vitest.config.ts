import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      '@': path.dirname(fileURLToPath(import.meta.url)),
      'server-only': path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'tests/server-only.ts'),
    },
  },
  test: { environment: 'node', include: ['tests/**/*.spec.ts'] },
})
