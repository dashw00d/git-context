# Plan: Centralized Path Normalization (PathManager)

This plan implements a centralized `PathService` to resolve the path normalization inconsistencies ("whack-a-mole") across the codebase.

## Phase 1: Foundation & Core Service [checkpoint: 6bac291]
- [x] Task: Create `src/services/pathService.ts` with methods for `toRelative(path: string)`, `toAbsolute(path: string)`, and `normalize(path: string)`. 6bac291
- [x] Task: Implement POSIX-style separator enforcement within `PathService`. 6bac291
- [x] Task: Write comprehensive unit tests in `tests/unit/services/pathService.test.ts` covering Windows/POSIX paths, root files, and nested directories. 6bac291
- [x] Task: Conductor - User Manual Verification 'Phase 1: Foundation & Core Service' (Protocol in workflow.md) 6bac291

## Phase 2: Analysis Layer Migration [checkpoint: a3ffe8f]
- [x] Task: Integrate `PathService` into `AnalysisCoordinator` and `CommitIndexer`. a3ffe8f
- [x] Task: Replace manual path normalization in `src/analysis/git.ts` and `src/analysis/unifiedSymbolExtraction.ts`. a3ffe8f
- [x] Task: Update `CstExtractor` and `CstDiff` to use `PathService` for symbol location reporting. a3ffe8f
- [x] Task: Conductor - User Manual Verification 'Phase 2: Analysis Layer Migration' (Protocol in workflow.md) a3ffe8f

## Phase 3: Storage & Service Layer Migration [checkpoint: f6462d8]
- [x] Task: Audit `src/storage/database.ts` to ensure `PathService` is used before any path is written to SQLite. f6462d8
- [x] Task: Update `SymbolService` and `CommitService` to normalize query inputs via `PathService`. f6462d8
- [x] Task: Replace manual normalization in `src/services/contextExporter.ts`. f6462d8
- [x] Task: Conductor - User Manual Verification 'Phase 3: Storage & Service Layer Migration' (Protocol in workflow.md) f6462d8

## Phase 4: Verification & Cleanup
- [~] Task: Perform a codebase-wide search for `.replace(root` or `path.relative(projectRoot` and replace with `PathService` calls.
- [ ] Task: Run full integration test suite to ensure symbol lookups and diffing remain functional.
- [ ] Task: Conductor - User Manual Verification 'Phase 4: Verification & Cleanup' (Protocol in workflow.md)
