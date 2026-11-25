import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: false,
    include: ['app/src/**/*.test.ts', 'api/**/*.test.ts'],
    coverage: { reporter: ['text-summary'] },
  },
  resolve: {
    alias: {
      '@boxlens/core': resolve(__dirname, 'packages/core/src/index.ts'),
    },
  },
});
