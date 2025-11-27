import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['benchmarks/**/*.test.ts'],
    exclude: ['benchmarks/mocks/**/*.test.ts'], // Exclude mock test files that aren't actual test suites
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'out/',
        'benchmarks/',
        '**/*.d.ts'
      ]
    }
  }
});

