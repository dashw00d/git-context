# Suggested Commands

## Build & Run
*   `npm run compile`: Compiles TS, downloads WASM, builds Webview.
*   `npm run watch`: Development mode (watch).
*   `npm run build:cockpit`: Builds the React webview.

## Testing & Linting
*   `npm run test`: Runs Vitest tests.
*   `npm run test:watch`: Runs Vitest in watch mode.
*   `npm run lint`: Runs ESLint.
*   `npm run lint:fix`: Fixes ESLint errors.
*   `npm run format`: Formats code with Prettier.
*   `npm run fix`: Runs format and lint:fix.

## Benchmarks
*   `npx ts-node benchmarks/pipeline_benchmark.ts`: Runs pipeline benchmarks.
*   `npm run test:pipeline`: Runs pipeline metric tests.

## CLI
*   `./out/cli/index.js analyze`: Analyze recent commits (via CLI).
