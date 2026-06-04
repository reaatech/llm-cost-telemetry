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
      '@reaatech/llm-cost-telemetry': path.resolve(__dirname, '../core/src/index.ts'),
      '@reaatech/llm-cost-telemetry-observability': path.resolve(
        __dirname,
        '../observability/src/index.ts',
      ),
      '@reaatech/llm-cost-telemetry-exporters': path.resolve(__dirname, './src/index.ts'),
    },
  },
});
