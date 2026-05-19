import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    setupFiles: ['./tests/setup.js'],
    globals: true,
    environment: 'node',
    testTimeout: 30000,
    pool: 'forks',
  },
})
