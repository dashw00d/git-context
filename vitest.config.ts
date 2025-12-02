import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['benchmarks/**/*.test.ts', 'tests/**/*.test.ts', 'tests/**/*.test.tsx'],
    exclude: ['benchmarks/mocks/**/*.test.ts', 'tests/mocks/**', 'tests/integration/qdrant.test.ts'],
    outputFile: path.resolve(__dirname, 'benchmarks/output/test-results.json'),
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      reportsDirectory: path.resolve(__dirname, 'benchmarks/output/coverage'),
      exclude: [
        'node_modules/',
        'out/',
        'benchmarks/',
        'tests/mocks/',
        '**/*.d.ts'
      ]
    },
    // Environment configuration
    environmentMatchGlobs: [
      ['tests/unit/ui/**', 'jsdom'],
      ['tests/unit/pipeline/**', 'node'],
      ['tests/integration/**', 'node']
    ],
    setupFiles: ['./tests/setup.ts']
  }
});

