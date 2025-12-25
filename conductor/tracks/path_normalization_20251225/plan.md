# Plan: Centralized Path Normalization (PathManager)

This plan implements a centralized `PathService` to resolve the path normalization inconsistencies ("whack-a-mole") across the codebase.

## Phase 1: Foundation & Core Service
- [~] Task: Create `src/services/pathService.ts` with methods for `toRelative(path: string)`, `toAbsolute(path: string)`, and `normalize(path: string)`.
- [ ] Task: Implement POSIX-style separator enforcement within `PathService`.
- [ ] Task: Write comprehensive unit tests in `tests/unit/services/pathService.test.ts` covering Windows/POSIX paths, root files, and nested directories.
- [ ] Task: Conductor - User Manual Verification 'Phase 1: Foundation & Core Service' (Protocol in workflow.md)

## Phase 2: Analysis Layer Migration
- [ ] Task: Integrate `PathService` into `AnalysisCoordinator` and `CommitIndexer`.
- [ ] Task: Replace manual path normalization in `src/analysis/git.ts` and `src/analysis/unifiedSymbolExtraction.ts`.
- [ ] Task: Update `CstExtractor` and `CstDiff` to use `PathService` for symbol location reporting.
- [ ] Task: Conductor - User Manual Verification 'Phase 2: Analysis Layer Migration' (Protocol in workflow.md)

## Phase 3: Storage & Service Layer Migration
- [ ] Task: Audit `src/storage/database.ts` to ensure `PathService` is used before any path is written to SQLite.
- [ ] Task: Update `SymbolService` and `CommitService` to normalize query inputs via `PathService`.
- [ ] Task: Replace manual normalization in `src/services/contextExporter.ts`.
- [ ] Task: Conductor - User Manual Verification 'Phase 3: Storage & Service Layer Migration' (Protocol in workflow.md)

## Phase 4: Verification & Cleanup
- [ ] Task: Perform a codebase-wide search for `.replace(root` or `path.relative(projectRoot` and replace with `PathService` calls.
- [ ] Task: Run full integration test suite to ensure symbol lookups and diffing remain functional.
- [ ] Task: Conductor - User Manual Verification 'Phase 4: Verification & Cleanup' (Protocol in workflow.md)
