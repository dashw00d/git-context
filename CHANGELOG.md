# Changelog

## [2.0.0] - 2024-12-XX

### Major Changes

#### Modular Database Schema System
- **BREAKING**: Refactored monolithic SQL schema into 9 logical modules with per-module versioning
  - Modules: `core`, `commits`, `symbols`, `edges`, `conventions`, `structural`, `hotspots`, `moved`, `reports`
  - Each module has independent version tracking and migration history
  - Automatic migration on startup using `migrateDatabase()`
  - Safe column additions via `safeAddColumn()` helper

#### Critical Fix: `edge_type` Column
- **FIXED**: Added missing `edge_type` column to `edges` table (defaults to `'unknown'`)
- Migration automatically detects and flags legacy databases
- Updated `driftDetector.ts` to use `COALESCE(edge_type, 'unknown')` for backward compatibility
- Updated `commitIndexer.ts` to store `edge_type` during indexing
- Updated `contextExporter.ts` to ensure `edge_type` is always present

#### CLI Reindex Support
- Added `ct index --reindex` flag to force reindex all commits
- Added `ct index --modules <list>` flag to reindex specific modules
- Extension now warns users if legacy database is detected

#### Migration System Improvements
- Replaced brittle `ALTER TABLE` migrations with safe helpers
- Added `auditAllModules()` for schema gap detection
- Transaction support for atomic migrations
- Per-module migration logging in `migration_log` table

### Technical Details

- **Schema Location**: `src/storage/schema.ts`
- **Migration Runner**: `migrateDatabase(db: Database): string[]`
- **Audit Function**: `auditAllModules(db: Database): string[]`
- **Safe Column Helper**: `safeAddColumn(db: Database, table: string, column: string, definition: string): void`

### Migration Notes

If you have a pre-v2.0 database:
1. Run `ct index --reindex` to migrate edge data
2. The extension will automatically detect and warn about legacy databases
3. All migrations are backward-compatible and safe to run multiple times

### Testing

- Added modular schema tests to `benchmarks/pipeline_diagnostics.ts`
- Schema validation runs automatically during pipeline diagnostics

