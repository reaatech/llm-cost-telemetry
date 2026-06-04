import path from 'path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: false,
    environment: 'node',
    coverage: {
      reporter: ['text', 'json-summary'],
    },
  },
  resolve: {
    alias: {
      '@reaatech/llm-cost-telemetry': path.resolve(__dirname, './src/index.ts'),
    },
  },
});
