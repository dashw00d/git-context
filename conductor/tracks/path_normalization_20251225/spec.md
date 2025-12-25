# Specification: Centralized Path Normalization (PathManager)

## Overview
The project currently suffers from inconsistent path normalization across its Analysis, Storage, Intelligence, and UI layers. This "whack-a-mole" issue stems from manual path manipulation (e.g., string replacements, mixed use of absolute/relative paths) being scattered throughout the codebase. This track aims to implement a centralized `PathService` (or `PathManager`) to act as the single source of truth for all path-related operations, ensuring everything stored and processed is strictly project-relative and platform-agnostic.

## Functional Requirements
- **Centralized Path Service:** Create a dedicated service in `src/services/` (e.g., `PathService`) to handle all path conversions.
- **Normalization Logic:** 
    - Convert absolute paths to project-relative paths.
    - Standardize path separators (POSIX-style `/`) regardless of the host OS.
    - Handle edge cases: root directory, deeply nested files, and special characters/spaces.
- **Global Migration:** Replace all instances of manual string manipulation for paths (e.g., `path.replace(root, '')`) with calls to the new service.
- **Database Consistency:** Ensure all path-related entries in SQLite use the normalized relative format.

## Non-Functional Requirements
- **Type Safety:** Ensure the service API is clear about whether it expects/returns absolute or relative paths.
- **Performance:** Path normalization should be efficient as it will be called frequently during indexing and analysis.

## Acceptance Criteria
- [ ] A new `PathService` is implemented and integrated into the project's dependency injection/provider system.
- [ ] All manual path normalization logic in `src/analysis/`, `src/storage/`, and `src/services/` has been replaced.
- [ ] Existing tests pass, and new unit tests for `PathService` cover various OS and nesting scenarios.
- [ ] A search for common manual normalization patterns (e.g., `.replace(root`) returns zero results in implementation code.

## Out of Scope
- Changing how `git` or `tree-sitter` internally handle paths (only our processing of their output is in scope).
- Refactoring the entire database schema beyond path normalization consistency.
