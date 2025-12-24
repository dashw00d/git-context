# Style Guide & Conventions

## Code Style
*   **Language:** TypeScript.
*   **Formatting:** Prettier is used for formatting.
*   **Linting:** ESLint is used.
*   **Imports:** `organize-imports-cli` is used.

## Naming Conventions
*   **Classes/Interfaces:** PascalCase.
*   **Functions/Variables:** camelCase.
*   **Files:** camelCase (e.g. `gitCacheService.ts`).

## Architecture Patterns
*   **Dependency Injection:** Used in `extension.ts` and service constructors.
*   **Singleton:** Used for `GitCacheService`.
*   **Database:** Access via `statement-wrapper` and `database.ts`.
*   **Logging:** Use `logInfo`, `logDebug`, `logError` from `src/utils/logger`.

## Git Operations
*   **Caching:** Use `GitCacheService` for expensive operations (`check-ignore`, `ls-tree`, `cat-file`).
*   **Timeouts:** Use `withTimeout` for all git process calls.
