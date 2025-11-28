import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['benchmarks/**/*.test.ts'],
    exclude: ['benchmarks/mocks/**/*.test.ts'], // Exclude mock test files that aren't actual test suites
    outputFile: path.resolve(__dirname, 'benchmarks/output/test-results.json'),
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      reportsDirectory: path.resolve(__dirname, 'benchmarks/output/coverage'),
      exclude: [
        'node_modules/',
        'out/',
        'benchmarks/',
        '**/*.d.ts'
      ]
    }
  }
});

