import path from 'node:path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      // Next's 'server-only' guard throws outside the Next bundler;
      // tests import server modules directly, so stub it out.
      'server-only': path.resolve(__dirname, 'test/stubs/empty.ts'),
      '@': __dirname
    }
  },
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts']
  }
})
