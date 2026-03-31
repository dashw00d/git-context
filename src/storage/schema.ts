/* eslint-disable no-restricted-syntax */

import { logError, logWarn } from '../utils/logger';

// REFERENCE_ONLY: Original monolithic schema kept for reference
// This is replaced by MODULE_SCHEMAS below
/*
export const DATABASE_SCHEMA = `
-- Schema v11: Clean rewrite with workspace + branch tracking
-- Improvements: versioning, proper renames tracking, branch-aware metadata, comprehensive indexes

-- === CORE TABLES ===

-- Lightweight commit metadata
CREATE TABLE IF NOT EXISTS commits_metadata (
  sha TEXT PRIMARY KEY,
  author TEXT NOT NULL,
  date TEXT NOT NULL,
  message TEXT NOT NULL,
  parent TEXT,
  files_changed INTEGER DEFAULT 0,
  loaded_at TEXT NOT NULL
);

-- Heavyweight analysis results with versioning
CREATE TABLE IF NOT EXISTS commits_analysis (
  sha TEXT PRIMARY KEY,
  summary_md TEXT,
  raw_llm_json TEXT,
  symbols_added INTEGER DEFAULT 0,
  symbols_removed INTEGER DEFAULT 0,
  symbols_modified INTEGER DEFAULT 0,
  edges_added INTEGER DEFAULT 0,
  edges_removed INTEGER DEFAULT 0,
  risks TEXT DEFAULT '[]',
  blast_radius INTEGER DEFAULT 0,
  difftastic_highlights TEXT,
  analyzed_at TEXT NOT NULL,
  pipeline_version TEXT DEFAULT '1.0',
  prompt_version TEXT DEFAULT '1.0',
  model TEXT,
  -- New layered pipeline fields
  analysis_version TEXT DEFAULT '2.0',
  status TEXT DEFAULT 'pending', -- pending, complete, failed
  structural_change_score REAL DEFAULT 0.0,
  files_changed INTEGER DEFAULT 0,
  hotspots_json TEXT DEFAULT '[]',
  FOREIGN KEY (sha) REFERENCES commits_metadata(sha) ON DELETE CASCADE
);

-- Files changed in each commit
CREATE TABLE IF NOT EXISTS files (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sha TEXT NOT NULL,
  path TEXT NOT NULL,
  status TEXT NOT NULL,
  lang TEXT,
  completeness_flags TEXT DEFAULT '{}',
  FOREIGN KEY (sha) REFERENCES commits_metadata(sha) ON DELETE CASCADE,
  UNIQUE(sha, path)
);

-- Symbols extracted from files
CREATE TABLE IF NOT EXISTS symbols (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sha TEXT NOT NULL,
  path TEXT NOT NULL,
  symbol_id TEXT NOT NULL,
  dna_id TEXT NOT NULL,
  name TEXT NOT NULL,
  kind TEXT NOT NULL,
  signature TEXT,
  change_type TEXT,
  mod_reason TEXT,
  diff_snippet_pre TEXT,
  diff_snippet_post TEXT,
  confidence REAL DEFAULT 1.0,
  naming_convention TEXT,
  convention_confidence REAL,
  completeness_flags TEXT DEFAULT '{}',
  FOREIGN KEY (sha) REFERENCES commits_metadata(sha) ON DELETE CASCADE,
  FOREIGN KEY (dna_id) REFERENCES symbol_dna(dna_id) ON DELETE CASCADE,
  UNIQUE(sha, path, dna_id)
);

-- Dependency edges between symbols
CREATE TABLE IF NOT EXISTS edges (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sha TEXT NOT NULL,
  from_symbol_id TEXT NOT NULL,
  to_symbol_id TEXT NOT NULL,
  change_type TEXT,
  confidence REAL DEFAULT 1.0,
  is_resolved INTEGER DEFAULT 1,
  FOREIGN KEY (sha) REFERENCES commits_metadata(sha) ON DELETE CASCADE
);

-- Symbol renames/moves tracking with explicit paths
CREATE TABLE IF NOT EXISTS renames (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sha TEXT NOT NULL,
  old_symbol_id TEXT NOT NULL,
  new_symbol_id TEXT NOT NULL,
  old_name TEXT NOT NULL,
  new_name TEXT NOT NULL,
  old_path TEXT,
  new_path TEXT,
  confidence REAL DEFAULT 1.0,
  FOREIGN KEY (sha) REFERENCES commits_metadata(sha) ON DELETE CASCADE
);

-- File-level naming convention tracking
CREATE TABLE IF NOT EXISTS file_conventions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sha TEXT NOT NULL,
  path TEXT NOT NULL,
  dominant_convention TEXT,
  convention_counts TEXT,
  drift_percent REAL,
  symbol_count INTEGER,
  FOREIGN KEY (sha) REFERENCES commits_metadata(sha) ON DELETE CASCADE,
  UNIQUE(sha, path)
);

-- Import path convention tracking
CREATE TABLE IF NOT EXISTS import_conventions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sha TEXT NOT NULL,
  path TEXT NOT NULL,
  import_path TEXT NOT NULL,
  import_style TEXT NOT NULL,
  line_number INTEGER,
  FOREIGN KEY (sha) REFERENCES commits_metadata(sha) ON DELETE CASCADE
);

-- Branch awareness
CREATE TABLE IF NOT EXISTS commit_branches (
  sha TEXT NOT NULL,
  branch TEXT NOT NULL,
  first_seen_at TEXT NOT NULL,
  is_head INTEGER DEFAULT 0,
  PRIMARY KEY (sha, branch),
  FOREIGN KEY (sha) REFERENCES commits_metadata(sha) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS branches (
  name TEXT PRIMARY KEY,
  head_sha TEXT,
  parent_branch TEXT,
  created_at TEXT NOT NULL,
  last_analyzed_at TEXT
);

CREATE TABLE IF NOT EXISTS squash_mappings (
  squash_sha TEXT NOT NULL,
  source_branch TEXT NOT NULL,
  source_shas TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (squash_sha, source_branch)
);

CREATE INDEX IF NOT EXISTS idx_commit_branches_branch ON commit_branches(branch);
CREATE INDEX IF NOT EXISTS idx_commit_branches_sha ON commit_branches(sha);
CREATE INDEX IF NOT EXISTS idx_branches_parent ON branches(parent_branch);
CREATE INDEX IF NOT EXISTS idx_squash_mappings_squash ON squash_mappings(squash_sha);

-- === NEW LAYERED PIPELINE TABLES ===

-- Layer 1: Structural Index (content-addressed caching)
CREATE TABLE IF NOT EXISTS file_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  blob_sha TEXT NOT NULL,
  file_path TEXT NOT NULL,
  language TEXT,
  symbols_json TEXT NOT NULL,  -- SymbolInfo[]
  edges_json TEXT NOT NULL,     -- EdgeInfo[]
  scope_path TEXT,
  shape_hash TEXT,
  body_hash TEXT,  -- For body-level change detection
  created_at TEXT NOT NULL,
  UNIQUE(blob_sha, file_path)
);
CREATE INDEX IF NOT EXISTS idx_snapshots_blob ON file_snapshots(blob_sha);

CREATE TABLE IF NOT EXISTS structural_diffs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  parent_blob_sha TEXT NOT NULL,
  current_blob_sha TEXT NOT NULL,
  file_path TEXT NOT NULL,
  structural_change_score REAL,
  control_flow_changed INTEGER,
  interface_changed INTEGER,
  moved_blocks INTEGER,
  lines_added INTEGER,
  lines_removed INTEGER,
  data_json TEXT,  -- Full difftastic output
  created_at TEXT NOT NULL,
  UNIQUE(parent_blob_sha, current_blob_sha, file_path)
);
CREATE INDEX IF NOT EXISTS idx_structural_diffs_pair ON structural_diffs(parent_blob_sha, current_blob_sha);

-- Layer 2: Workspace overlay analysis
CREATE TABLE IF NOT EXISTS workspace_analysis (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  head_sha TEXT NOT NULL,
  workspace_hash TEXT NOT NULL,
  symbols_added INTEGER,
  symbols_modified INTEGER,
  symbols_removed INTEGER,
  risks TEXT,
  files_changed INTEGER,
  analyzed_at TEXT NOT NULL,
  UNIQUE(head_sha, workspace_hash)
);

-- Saved analysis reports with fingerprint caching
CREATE TABLE IF NOT EXISTS reports (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  commit_shas TEXT NOT NULL,
  selected_files TEXT,
  workspace_scope TEXT NOT NULL,
  created_at TEXT NOT NULL,
  workspace_hash TEXT NOT NULL,
  facts_json TEXT,
  analysis_json TEXT,
  summary TEXT,
  critical_count INTEGER DEFAULT 0,
  warning_count INTEGER DEFAULT 0,
  is_pinned INTEGER DEFAULT 0,
  fingerprint TEXT,
  pipeline_version TEXT DEFAULT '2.0',
  prompt_version TEXT DEFAULT '1.0',
  mode TEXT DEFAULT 'selection'
);

-- Symbol DNA: Stable identity tracking
CREATE TABLE IF NOT EXISTS symbol_dna (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  dna_id TEXT UNIQUE NOT NULL,
  first_seen_sha TEXT NOT NULL,
  first_seen_path TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Symbol version history (links DNA to commits)
CREATE TABLE IF NOT EXISTS symbol_versions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  dna_id TEXT NOT NULL,
  sha TEXT NOT NULL,
  path TEXT NOT NULL,
  symbol_id TEXT NOT NULL,
  name TEXT NOT NULL,
  kind TEXT NOT NULL,
  signature_hash TEXT,
  body_hash TEXT,
  FOREIGN KEY (dna_id) REFERENCES symbol_dna(dna_id) ON DELETE CASCADE,
  UNIQUE(sha, path, dna_id)
);

-- DNA matching decision log for debugging
CREATE TABLE IF NOT EXISTS dna_decision_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sha TEXT NOT NULL,
  symbol_id TEXT NOT NULL,
  dna_id TEXT NOT NULL,
  decision_type TEXT NOT NULL,
  confidence REAL NOT NULL,
  reasoning TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- === INDEXES FOR PERFORMANCE ===

-- Commit queries
CREATE INDEX IF NOT EXISTS idx_commits_metadata_date ON commits_metadata(date DESC);
CREATE INDEX IF NOT EXISTS idx_commits_analysis_analyzed_at ON commits_analysis(analyzed_at DESC);
CREATE INDEX IF NOT EXISTS idx_commits_analysis_version ON commits_analysis(pipeline_version, prompt_version);

-- File queries
CREATE INDEX IF NOT EXISTS idx_files_sha ON files(sha);
CREATE INDEX IF NOT EXISTS idx_files_path ON files(path);

-- Symbol queries
CREATE INDEX IF NOT EXISTS idx_symbols_sha ON symbols(sha);
CREATE INDEX IF NOT EXISTS idx_symbols_path ON symbols(path);
CREATE INDEX IF NOT EXISTS idx_symbols_name ON symbols(name);
CREATE INDEX IF NOT EXISTS idx_symbols_symbol_id ON symbols(symbol_id);
CREATE INDEX IF NOT EXISTS idx_symbols_convention ON symbols(naming_convention);
CREATE UNIQUE INDEX IF NOT EXISTS idx_symbols_sha_path_dna_id ON symbols(sha, path, dna_id);

-- Edge queries
CREATE INDEX IF NOT EXISTS idx_edges_sha ON edges(sha);
CREATE INDEX IF NOT EXISTS idx_edges_from ON edges(from_symbol_id);
CREATE INDEX IF NOT EXISTS idx_edges_to ON edges(to_symbol_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_edges_unique ON edges(sha, from_symbol_id, to_symbol_id, change_type);

-- Renames queries
CREATE INDEX IF NOT EXISTS idx_renames_sha ON renames(sha);
CREATE INDEX IF NOT EXISTS idx_renames_old_path ON renames(old_path);
CREATE INDEX IF NOT EXISTS idx_renames_new_path ON renames(new_path);

-- Convention queries
CREATE INDEX IF NOT EXISTS idx_file_conventions_sha ON file_conventions(sha);
CREATE INDEX IF NOT EXISTS idx_file_conventions_path ON file_conventions(path);
CREATE INDEX IF NOT EXISTS idx_import_conventions_sha ON import_conventions(sha);
CREATE INDEX IF NOT EXISTS idx_import_conventions_path ON import_conventions(path);
CREATE INDEX IF NOT EXISTS idx_import_conventions_style ON import_conventions(import_style);

-- Report queries
CREATE INDEX IF NOT EXISTS idx_reports_created_at ON reports(created_at);
CREATE INDEX IF NOT EXISTS idx_reports_is_pinned ON reports(is_pinned);
CREATE INDEX IF NOT EXISTS idx_reports_mode ON reports(mode);
CREATE UNIQUE INDEX IF NOT EXISTS idx_reports_fingerprint ON reports(fingerprint);

-- DNA queries
CREATE INDEX IF NOT EXISTS idx_symbol_dna_dna_id ON symbol_dna(dna_id);
CREATE INDEX IF NOT EXISTS idx_symbol_versions_dna ON symbol_versions(dna_id);
CREATE INDEX IF NOT EXISTS idx_symbol_versions_sha ON symbol_versions(sha);
CREATE UNIQUE INDEX IF NOT EXISTS idx_symbol_versions_sha_path_dna_id ON symbol_versions(sha, path, dna_id);

-- === SYMBOL HISTORY TABLE ===

CREATE TABLE IF NOT EXISTS symbol_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  symbol_dna_id TEXT NOT NULL,
  sha TEXT NOT NULL,
  file_path TEXT NOT NULL,
  name TEXT NOT NULL,
  kind TEXT NOT NULL,
  signature TEXT,
  body_hash TEXT,
  change_type TEXT,
  impact_score REAL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_symbol_history_dna ON symbol_history(symbol_dna_id);
CREATE INDEX IF NOT EXISTS idx_symbol_history_sha ON symbol_history(sha);
CREATE INDEX IF NOT EXISTS idx_symbol_history_dna_sha ON symbol_history(symbol_dna_id, sha);

-- === HOT SPOT DETECTION TABLES ===

CREATE TABLE IF NOT EXISTS file_hotspots (
  file_path TEXT PRIMARY KEY,
  total_commits INTEGER DEFAULT 0,
  total_changes INTEGER DEFAULT 0,
  unique_authors INTEGER DEFAULT 0,
  last_changed_sha TEXT,
  last_changed_date TEXT,
  hotspot_score REAL DEFAULT 0.0,
  first_seen_sha TEXT,
  risk_level TEXT
);

CREATE TABLE IF NOT EXISTS symbol_hotspots (
  symbol_id TEXT PRIMARY KEY,
  file_path TEXT NOT NULL,
  symbol_type TEXT NOT NULL,
  symbol_name TEXT NOT NULL,
  total_modifications INTEGER DEFAULT 0,
  total_commits INTEGER DEFAULT 0,
  last_change_type TEXT,
  last_changed_sha TEXT,
  last_changed_date TEXT,
  hotspot_score REAL DEFAULT 0.0,
  risk_level TEXT
);

CREATE TABLE IF NOT EXISTS hotspot_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  snapshot_sha TEXT NOT NULL,
  snapshot_date TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  hotspot_score REAL NOT NULL,
  total_changes INTEGER NOT NULL,
  FOREIGN KEY (snapshot_sha) REFERENCES commits_metadata(sha)
);

CREATE INDEX IF NOT EXISTS idx_hotspot_snapshots_entity ON hotspot_snapshots(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_hotspot_snapshots_date ON hotspot_snapshots(snapshot_date);
CREATE INDEX IF NOT EXISTS idx_file_hotspots_score ON file_hotspots(hotspot_score DESC);
CREATE INDEX IF NOT EXISTS idx_symbol_hotspots_score ON symbol_hotspots(hotspot_score DESC);

-- === MOVED BLOCK DETECTION TABLES ===

CREATE TABLE IF NOT EXISTS moved_blocks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  commit_sha TEXT NOT NULL,
  source_file TEXT NOT NULL,
  source_symbol_id TEXT,
  source_start_line INTEGER NOT NULL,
  source_end_line INTEGER NOT NULL,
  source_content_hash TEXT NOT NULL,
  dest_file TEXT NOT NULL,
  dest_symbol_id TEXT,
  dest_start_line INTEGER NOT NULL,
  dest_end_line INTEGER NOT NULL,
  dest_content_hash TEXT NOT NULL,
  similarity_score REAL NOT NULL,
  block_type TEXT NOT NULL,
  move_reason TEXT,
  line_count INTEGER NOT NULL,
  FOREIGN KEY (commit_sha) REFERENCES commits_metadata(sha)
);

CREATE TABLE IF NOT EXISTS symbol_lineage (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  symbol_id TEXT NOT NULL,
  previous_symbol_id TEXT NOT NULL,
  commit_sha TEXT NOT NULL,
  move_type TEXT NOT NULL,
  FOREIGN KEY (commit_sha) REFERENCES commits_metadata(sha)
);

CREATE INDEX IF NOT EXISTS idx_moved_blocks_commit ON moved_blocks(commit_sha);
CREATE INDEX IF NOT EXISTS idx_moved_blocks_source ON moved_blocks(source_file, source_symbol_id);
CREATE INDEX IF NOT EXISTS idx_moved_blocks_dest ON moved_blocks(dest_file, dest_symbol_id);
CREATE INDEX IF NOT EXISTS idx_moved_blocks_hash ON moved_blocks(source_content_hash);
CREATE INDEX IF NOT EXISTS idx_symbol_lineage_current ON symbol_lineage(symbol_id);
CREATE INDEX IF NOT EXISTS idx_symbol_lineage_previous ON symbol_lineage(previous_symbol_id);

-- Migration tracking table
CREATE TABLE IF NOT EXISTS migration_log (
  version INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  applied_at TEXT NOT NULL,
  success INTEGER DEFAULT 1
);
CREATE INDEX IF NOT EXISTS idx_migration_log_version ON migration_log(version);
`;
*/

// === MODULAR SCHEMA SYSTEM ===

// Database type is now 'any' to work with the wrapper API

/* eslint-disable no-restricted-syntax, no-restricted-properties */

// Type definitions for modular schema system
export type ModuleName =
  | 'core'
  | 'commits'
  | 'symbols'
  | 'edges'
  | 'conventions'
  | 'structural'
  | 'hotspots'
  | 'moved'
  | 'reports'
  | 'bundles';

export interface Migration {
  name: string;
  sql: string;
  safe: boolean;
  requiresReindex?: boolean;
}

export interface ModuleSchema {
  schema: string;
  migrations: Migration[];
  currentVersion: number;
}

// === SAFE COLUMN HELPER ===

/**
 * Safely add a column if it doesn't exist
 * Queries PRAGMA table_info, checks existence, ALTER if missing, logs/warns on error
 */
export function safeAddColumn(db: any, table: string, column: string, definition: string): void {
  try {
    // Check if column exists by querying table info
    const columns = db.prepare(`PRAGMA table_info(${table})`).all() as any[];

    const columnExists = columns.some((col: any) => col.name === column);

    if (!columnExists) {
      db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
    }
  } catch (error) {
    // Column may already exist, safe to ignore
    logError(`Could not add column ${table}.${column}`, error);
  }
}

// === MODULE SCHEMAS ===

export const MODULE_SCHEMAS: Record<ModuleName, ModuleSchema> = {
  // Core Module: migration_log only
  core: {
    schema: `CREATE TABLE IF NOT EXISTS migration_log (
  module TEXT NOT NULL,
  version INTEGER NOT NULL,
  name TEXT NOT NULL,
  applied_at TEXT NOT NULL,
  success INTEGER DEFAULT 1,
  PRIMARY KEY (module, version)
);
CREATE INDEX IF NOT EXISTS idx_migration_log_module ON migration_log(module);`,
    migrations: [],
    currentVersion: 1,
  },

  // Commits Module: commits_metadata, commits_analysis, files, commit_branches, branches, squash_mappings
  commits: {
    schema: `CREATE TABLE IF NOT EXISTS commits_metadata (
  sha TEXT PRIMARY KEY,
  author TEXT NOT NULL,
  date TEXT NOT NULL,
  message TEXT NOT NULL,
  parent TEXT,
  files_changed INTEGER DEFAULT 0,
  loaded_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS commits_analysis (
  sha TEXT PRIMARY KEY,
  summary_md TEXT,
  raw_llm_json TEXT,
  symbols_added INTEGER DEFAULT 0,
  symbols_removed INTEGER DEFAULT 0,
  symbols_modified INTEGER DEFAULT 0,
  edges_added INTEGER DEFAULT 0,
  edges_removed INTEGER DEFAULT 0,
  risks TEXT DEFAULT '[]',
  blast_radius INTEGER DEFAULT 0,
  difftastic_highlights TEXT,
  analyzed_at TEXT NOT NULL,
  pipeline_version TEXT DEFAULT '1.0',
  prompt_version TEXT DEFAULT '1.0',
  model TEXT,
  analysis_version TEXT DEFAULT '2.0',
  status TEXT DEFAULT 'pending',
  structural_change_score REAL DEFAULT 0.0,
  files_changed INTEGER DEFAULT 0,
  hotspots_json TEXT DEFAULT '[]',
  FOREIGN KEY (sha) REFERENCES commits_metadata(sha) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS files (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sha TEXT NOT NULL,
  path TEXT NOT NULL,
  status TEXT NOT NULL,
  lang TEXT,
  completeness_flags TEXT DEFAULT '{}',
  FOREIGN KEY (sha) REFERENCES commits_metadata(sha) ON DELETE CASCADE,
  UNIQUE(sha, path)
);
CREATE TABLE IF NOT EXISTS commit_branches (
  sha TEXT NOT NULL,
  branch TEXT NOT NULL,
  first_seen_at TEXT NOT NULL,
  is_head INTEGER DEFAULT 0,
  PRIMARY KEY (sha, branch),
  FOREIGN KEY (sha) REFERENCES commits_metadata(sha) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS branches (
  name TEXT PRIMARY KEY,
  head_sha TEXT,
  parent_branch TEXT,
  created_at TEXT NOT NULL,
  last_analyzed_at TEXT
);
CREATE TABLE IF NOT EXISTS squash_mappings (
  squash_sha TEXT NOT NULL,
  source_branch TEXT NOT NULL,
  source_shas TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (squash_sha, source_branch)
);
CREATE INDEX IF NOT EXISTS idx_commits_metadata_date ON commits_metadata(date DESC);
CREATE INDEX IF NOT EXISTS idx_commits_analysis_analyzed_at ON commits_analysis(analyzed_at DESC);
CREATE INDEX IF NOT EXISTS idx_commits_analysis_version ON commits_analysis(pipeline_version, prompt_version);
CREATE INDEX IF NOT EXISTS idx_files_sha ON files(sha);
CREATE INDEX IF NOT EXISTS idx_files_path ON files(path);
CREATE INDEX IF NOT EXISTS idx_commit_branches_branch ON commit_branches(branch);
CREATE INDEX IF NOT EXISTS idx_commit_branches_sha ON commit_branches(sha);
CREATE INDEX IF NOT EXISTS idx_branches_parent ON branches(parent_branch);
CREATE INDEX IF NOT EXISTS idx_squash_mappings_squash ON squash_mappings(squash_sha);`,
    migrations: [],
    currentVersion: 1,
  },

  // Symbols Module: symbols, symbol_dna, symbol_versions, symbol_history, dna_decision_log
  symbols: {
    schema: `CREATE TABLE IF NOT EXISTS symbols (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sha TEXT NOT NULL,
  path TEXT NOT NULL,
  symbol_id TEXT NOT NULL,
  dna_id TEXT NOT NULL,
  name TEXT NOT NULL,
  kind TEXT NOT NULL,
  signature TEXT,
  change_type TEXT,
  mod_reason TEXT,
  diff_snippet_pre TEXT,
  diff_snippet_post TEXT,
  confidence REAL DEFAULT 1.0,
  naming_convention TEXT,
  convention_confidence REAL,
  completeness_flags TEXT DEFAULT '{}',
  FOREIGN KEY (sha) REFERENCES commits_metadata(sha) ON DELETE CASCADE,
  FOREIGN KEY (dna_id) REFERENCES symbol_dna(dna_id) ON DELETE CASCADE,
  UNIQUE(sha, path, dna_id)
);
CREATE TABLE IF NOT EXISTS symbol_dna (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  dna_id TEXT UNIQUE NOT NULL,
  first_seen_sha TEXT NOT NULL,
  first_seen_path TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS symbol_versions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  dna_id TEXT NOT NULL,
  sha TEXT NOT NULL,
  path TEXT NOT NULL,
  symbol_id TEXT NOT NULL,
  name TEXT NOT NULL,
  kind TEXT NOT NULL,
  signature_hash TEXT,
  body_hash TEXT,
  FOREIGN KEY (dna_id) REFERENCES symbol_dna(dna_id) ON DELETE CASCADE,
  UNIQUE(sha, path, dna_id)
);
CREATE TABLE IF NOT EXISTS symbol_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  symbol_dna_id TEXT NOT NULL,
  sha TEXT NOT NULL,
  file_path TEXT NOT NULL,
  name TEXT NOT NULL,
  kind TEXT NOT NULL,
  signature TEXT,
  body_hash TEXT,
  change_type TEXT,
  impact_score REAL DEFAULT 0,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS dna_decision_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sha TEXT NOT NULL,
  symbol_id TEXT NOT NULL,
  dna_id TEXT NOT NULL,
  decision_type TEXT NOT NULL,
  confidence REAL NOT NULL,
  reasoning TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (sha) REFERENCES commits_metadata(sha) ON DELETE CASCADE,
  FOREIGN KEY (dna_id) REFERENCES symbol_dna(dna_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_symbols_sha ON symbols(sha);
CREATE INDEX IF NOT EXISTS idx_symbols_path ON symbols(path);
CREATE INDEX IF NOT EXISTS idx_symbols_name ON symbols(name);
CREATE INDEX IF NOT EXISTS idx_symbols_symbol_id ON symbols(symbol_id);
CREATE INDEX IF NOT EXISTS idx_symbols_convention ON symbols(naming_convention);
CREATE UNIQUE INDEX IF NOT EXISTS idx_symbols_sha_path_dna_id ON symbols(sha, path, dna_id);
CREATE INDEX IF NOT EXISTS idx_symbol_dna_dna_id ON symbol_dna(dna_id);
CREATE INDEX IF NOT EXISTS idx_symbol_versions_dna ON symbol_versions(dna_id);
CREATE INDEX IF NOT EXISTS idx_symbol_versions_sha ON symbol_versions(sha);
CREATE UNIQUE INDEX IF NOT EXISTS idx_symbol_versions_sha_path_dna_id ON symbol_versions(sha, path, dna_id);
CREATE INDEX IF NOT EXISTS idx_symbol_history_dna ON symbol_history(symbol_dna_id);
CREATE INDEX IF NOT EXISTS idx_symbol_history_sha ON symbol_history(sha);
CREATE INDEX IF NOT EXISTS idx_symbol_history_dna_sha ON symbol_history(symbol_dna_id, sha);
CREATE INDEX IF NOT EXISTS idx_dna_decision_log_sha ON dna_decision_log(sha);`,
    migrations: [
      {
        name: 'add_path_to_symbol_constraints',
        sql: `
          -- Drop old tables and indexes - schema will recreate with correct constraints
          -- This is safe for test databases which only contain test data
          DROP TABLE IF EXISTS symbols;
          DROP TABLE IF EXISTS symbol_versions;
          DROP INDEX IF EXISTS idx_symbols_sha_dna_id;
          DROP INDEX IF EXISTS idx_symbol_versions_lookup;
        `,
        safe: false,
        requiresReindex: true,
      },
    ],
    currentVersion: 2,
  },

  // Edges Module: edges, renames, import_conventions
  edges: {
    schema: `CREATE TABLE IF NOT EXISTS edges (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sha TEXT NOT NULL,
  from_symbol_id TEXT NOT NULL,
  to_symbol_id TEXT NOT NULL,
  change_type TEXT,
  edge_type TEXT DEFAULT 'unknown',
  confidence REAL DEFAULT 1.0,
  is_resolved INTEGER DEFAULT 1,
  FOREIGN KEY (sha) REFERENCES commits_metadata(sha) ON DELETE CASCADE,
  UNIQUE(sha, from_symbol_id, to_symbol_id, change_type, edge_type)
);
CREATE TABLE IF NOT EXISTS renames (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sha TEXT NOT NULL,
  old_symbol_id TEXT NOT NULL,
  new_symbol_id TEXT NOT NULL,
  old_name TEXT NOT NULL,
  new_name TEXT NOT NULL,
  old_path TEXT,
  new_path TEXT,
  confidence REAL DEFAULT 1.0,
  FOREIGN KEY (sha) REFERENCES commits_metadata(sha) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS import_conventions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sha TEXT NOT NULL,
  path TEXT NOT NULL,
  import_path TEXT NOT NULL,
  import_style TEXT NOT NULL,
  line_number INTEGER,
  FOREIGN KEY (sha) REFERENCES commits_metadata(sha) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_edges_sha ON edges(sha);
CREATE INDEX IF NOT EXISTS idx_edges_from ON edges(from_symbol_id);
CREATE INDEX IF NOT EXISTS idx_edges_to ON edges(to_symbol_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_edges_unique ON edges(sha, from_symbol_id, to_symbol_id, change_type);
CREATE INDEX IF NOT EXISTS idx_renames_sha ON renames(sha);
CREATE INDEX IF NOT EXISTS idx_renames_old_path ON renames(old_path);
CREATE INDEX IF NOT EXISTS idx_renames_new_path ON renames(new_path);
CREATE INDEX IF NOT EXISTS idx_import_conventions_sha ON import_conventions(sha);
CREATE INDEX IF NOT EXISTS idx_import_conventions_path ON import_conventions(path);
CREATE INDEX IF NOT EXISTS idx_import_conventions_style ON import_conventions(import_style);`,
    migrations: [],
    currentVersion: 1,
  },

  // Conventions Module: file_conventions
  conventions: {
    schema: `CREATE TABLE IF NOT EXISTS file_conventions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sha TEXT NOT NULL,
  path TEXT NOT NULL,
  dominant_convention TEXT,
  convention_counts TEXT,
  drift_percent REAL,
  symbol_count INTEGER,
  FOREIGN KEY (sha) REFERENCES commits_metadata(sha) ON DELETE CASCADE,
  UNIQUE(sha, path)
);
CREATE INDEX IF NOT EXISTS idx_file_conventions_sha ON file_conventions(sha);
CREATE INDEX IF NOT EXISTS idx_file_conventions_path ON file_conventions(path);`,
    migrations: [],
    currentVersion: 1,
  },

  // Structural Module: file_snapshots, structural_diffs, workspace_analysis, blob_content
  structural: {
    schema: `CREATE TABLE IF NOT EXISTS file_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  blob_sha TEXT NOT NULL,
  file_path TEXT NOT NULL,
  language TEXT,
  symbols_json TEXT NOT NULL,
  edges_json TEXT NOT NULL,
  scope_path TEXT,
  shape_hash TEXT,
  body_hash TEXT,
  created_at TEXT NOT NULL,
  UNIQUE(blob_sha, file_path)
);
CREATE TABLE IF NOT EXISTS structural_diffs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  parent_blob_sha TEXT NOT NULL,
  current_blob_sha TEXT NOT NULL,
  file_path TEXT NOT NULL,
  structural_change_score REAL,
  control_flow_changed INTEGER,
  interface_changed INTEGER,
  moved_blocks INTEGER,
  lines_added INTEGER,
  lines_removed INTEGER,
  data_json TEXT,
  created_at TEXT NOT NULL,
  UNIQUE(parent_blob_sha, current_blob_sha, file_path)
);
CREATE TABLE IF NOT EXISTS workspace_analysis (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  head_sha TEXT NOT NULL,
  workspace_hash TEXT NOT NULL,
  symbols_added INTEGER,
  symbols_modified INTEGER,
  symbols_removed INTEGER,
  edges_added INTEGER DEFAULT 0,
  edges_removed INTEGER DEFAULT 0,
  risks TEXT,
  files_changed INTEGER DEFAULT 0,
  structural_change_score REAL DEFAULT 0,
  blast_radius REAL DEFAULT 0,
  analyzed_at TEXT NOT NULL,
  UNIQUE(head_sha, workspace_hash)
);
CREATE TABLE IF NOT EXISTS hybrid_facts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  file_path TEXT NOT NULL,
  version TEXT NOT NULL,
  fact_id TEXT NOT NULL,
  dna_id TEXT NOT NULL,
  serialized_fact TEXT NOT NULL,
  timeline_json TEXT NOT NULL,
  hash TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(file_path, version, fact_id)
);
CREATE TABLE IF NOT EXISTS blob_content (
  blob_sha TEXT PRIMARY KEY,
  content TEXT NOT NULL,
  size INTEGER NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS commit_file_blobs (
  commit_sha TEXT NOT NULL,
  file_path TEXT NOT NULL,
  blob_sha TEXT NOT NULL,
  PRIMARY KEY (commit_sha, file_path),
  FOREIGN KEY (blob_sha) REFERENCES blob_content(blob_sha)
);
CREATE INDEX IF NOT EXISTS idx_snapshots_blob ON file_snapshots(blob_sha);
CREATE INDEX IF NOT EXISTS idx_structural_diffs_pair ON structural_diffs(parent_blob_sha, current_blob_sha);
CREATE INDEX IF NOT EXISTS idx_workspace_head ON workspace_analysis(head_sha);
CREATE INDEX IF NOT EXISTS idx_hybrid_facts_file_version ON hybrid_facts(file_path, version);
CREATE INDEX IF NOT EXISTS idx_hybrid_facts_dna ON hybrid_facts(dna_id);
CREATE INDEX IF NOT EXISTS idx_hybrid_facts_hash ON hybrid_facts(file_path, hash);
CREATE INDEX IF NOT EXISTS idx_cfb_blob ON commit_file_blobs(blob_sha);`,
    migrations: [],
    currentVersion: 1,
  },

  // Bundles Module: bundles, bundle_files
  bundles: {
    schema: `CREATE TABLE IF NOT EXISTS bundles (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  config_json TEXT
);
CREATE TABLE IF NOT EXISTS bundle_files (
  bundle_id TEXT NOT NULL,
  file_path TEXT NOT NULL,
  PRIMARY KEY (bundle_id, file_path),
  FOREIGN KEY (bundle_id) REFERENCES bundles(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_bundles_updated ON bundles(updated_at DESC);`,
    migrations: [],
    currentVersion: 1,
  },

  // Hotspots Module: file_hotspots, symbol_hotspots, hotspot_snapshots
  hotspots: {
    schema: `CREATE TABLE IF NOT EXISTS file_hotspots (
  file_path TEXT PRIMARY KEY,
  total_commits INTEGER DEFAULT 0,
  total_changes INTEGER DEFAULT 0,
  unique_authors INTEGER DEFAULT 0,
  last_changed_sha TEXT,
  last_changed_date TEXT,
  hotspot_score REAL DEFAULT 0.0,
  first_seen_sha TEXT,
  risk_level TEXT
);
CREATE TABLE IF NOT EXISTS symbol_hotspots (
  symbol_id TEXT PRIMARY KEY,
  file_path TEXT NOT NULL,
  symbol_type TEXT NOT NULL,
  symbol_name TEXT NOT NULL,
  total_modifications INTEGER DEFAULT 0,
  total_commits INTEGER DEFAULT 0,
  last_change_type TEXT,
  last_changed_sha TEXT,
  last_changed_date TEXT,
  hotspot_score REAL DEFAULT 0.0,
  risk_level TEXT
);
CREATE TABLE IF NOT EXISTS hotspot_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  snapshot_sha TEXT NOT NULL,
  snapshot_date TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  hotspot_score REAL NOT NULL,
  total_changes INTEGER NOT NULL,
  FOREIGN KEY (snapshot_sha) REFERENCES commits_metadata(sha)
);
CREATE TABLE IF NOT EXISTS hotspot_cache (
  cache_key TEXT PRIMARY KEY,
  cache_hash TEXT NOT NULL,
  cached_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_file_hotspots_score ON file_hotspots(hotspot_score DESC);
CREATE INDEX IF NOT EXISTS idx_symbol_hotspots_score ON symbol_hotspots(hotspot_score DESC);
CREATE INDEX IF NOT EXISTS idx_hotspot_snapshots_entity ON hotspot_snapshots(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_hotspot_snapshots_date ON hotspot_snapshots(snapshot_date);
CREATE INDEX IF NOT EXISTS idx_hotspot_cache_expires ON hotspot_cache(expires_at);`,
    migrations: [],
    currentVersion: 1,
  },

  // Moved Module: moved_blocks, symbol_lineage
  moved: {
    schema: `CREATE TABLE IF NOT EXISTS moved_blocks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  commit_sha TEXT NOT NULL,
  source_file TEXT NOT NULL,
  source_symbol_id TEXT,
  source_start_line INTEGER NOT NULL,
  source_end_line INTEGER NOT NULL,
  source_content_hash TEXT NOT NULL,
  dest_file TEXT NOT NULL,
  dest_symbol_id TEXT,
  dest_start_line INTEGER NOT NULL,
  dest_end_line INTEGER NOT NULL,
  dest_content_hash TEXT NOT NULL,
  similarity_score REAL NOT NULL,
  block_type TEXT NOT NULL,
  move_reason TEXT,
  line_count INTEGER NOT NULL,
  FOREIGN KEY (commit_sha) REFERENCES commits_metadata(sha)
);
CREATE TABLE IF NOT EXISTS symbol_lineage (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  symbol_id TEXT NOT NULL,
  previous_symbol_id TEXT NOT NULL,
  commit_sha TEXT NOT NULL,
  move_type TEXT NOT NULL,
  FOREIGN KEY (commit_sha) REFERENCES commits_metadata(sha)
);
CREATE INDEX IF NOT EXISTS idx_moved_blocks_commit ON moved_blocks(commit_sha);
CREATE INDEX IF NOT EXISTS idx_moved_blocks_source ON moved_blocks(source_file, source_symbol_id);
CREATE INDEX IF NOT EXISTS idx_moved_blocks_dest ON moved_blocks(dest_file, dest_symbol_id);
CREATE INDEX IF NOT EXISTS idx_moved_blocks_hash ON moved_blocks(source_content_hash);
CREATE INDEX IF NOT EXISTS idx_symbol_lineage_current ON symbol_lineage(symbol_id);
CREATE INDEX IF NOT EXISTS idx_symbol_lineage_previous ON symbol_lineage(previous_symbol_id);`,
    migrations: [],
    currentVersion: 1,
  },

  // Reports Module: reports
  reports: {
    schema: `CREATE TABLE IF NOT EXISTS reports (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  commit_shas TEXT NOT NULL,
  selected_files TEXT,
  workspace_scope TEXT NOT NULL,
  created_at TEXT NOT NULL,
  workspace_hash TEXT NOT NULL,
  facts_json TEXT,
  analysis_json TEXT,
  summary TEXT,
  critical_count INTEGER DEFAULT 0,
  warning_count INTEGER DEFAULT 0,
  is_pinned INTEGER DEFAULT 0,
  fingerprint TEXT,
  pipeline_version TEXT DEFAULT '2.0',
  prompt_version TEXT DEFAULT '1.0',
  mode TEXT DEFAULT 'selection'
);
CREATE INDEX IF NOT EXISTS idx_reports_created_at ON reports(created_at);
CREATE INDEX IF NOT EXISTS idx_reports_is_pinned ON reports(is_pinned);
CREATE INDEX IF NOT EXISTS idx_reports_mode ON reports(mode);
CREATE UNIQUE INDEX IF NOT EXISTS idx_reports_fingerprint ON reports(fingerprint);`,
    migrations: [],
    currentVersion: 1,
  },
};

// Legacy constant for backward compatibility
export const ANALYSIS_VERSION = '2.0';

// === MIGRATION RUNNER ===

/**
 * Truncate error message to prevent log spam
 */
function truncateError(msg: string | undefined, maxLen = 200): string {
  if (!msg) return 'unknown error';
  return msg.length > maxLen ? msg.substring(0, maxLen) + '...' : msg;
}

/**
 * Migrate database to modular schema system
 * Returns array of gap/error messages
 */
export function migrateDatabase(db: any): string[] {
  const gaps: string[] = [];

  // Exec core module schema first (creates migration_log with module column)
  try {
    db.exec(MODULE_SCHEMAS.core.schema);
  } catch (error: any) {
    gaps.push(`core schema failed: ${truncateError(error.message)}`);
    return gaps; // Can't proceed without migration_log
  }

  // Migrate legacy migration_log to add module column if missing
  try {
    safeAddColumn(db, 'migration_log', 'module', 'TEXT DEFAULT "core"');
    // Update existing rows to have module = "core"
    try {
      db.exec('UPDATE migration_log SET module = "core" WHERE module IS NULL;');
    } catch {
      // Ignore if column doesn't exist yet or no rows
    }
  } catch (error: any) {
    // Ignore if already migrated
    if (!error.message?.includes('already exists')) {
      logError('[MIGRATION] Legacy migration_log migration warning', error);
    }
  }

  // Module execution order (dependencies matter)
  const moduleOrder: ModuleName[] = [
    'core',
    'commits',
    'symbols',
    'edges',
    'conventions',
    'structural',
    'hotspots',
    'moved',
    'reports',
    'bundles',
  ];

  for (const modName of moduleOrder) {
    const mod = MODULE_SCHEMAS[modName];

    try {
      // Get current version for this module
      const maxVerResult = db
        .prepare('SELECT MAX(version) as maxVer FROM migration_log WHERE module = ?')
        .get(modName) as any;
      let currentVer = 0;
      if (maxVerResult) {
        currentVer = Number(maxVerResult.maxVer || 0);
      }

      // If current version < target, apply schema and migrations
      if (currentVer < mod.currentVersion) {
        // Apply missing migrations first (they may drop tables)
        for (let v = currentVer + 1; v <= mod.currentVersion; v++) {
          const migIndex = v - 1;
          if (migIndex >= mod.migrations.length) {
            // No migration for this version, just mark as applied
            db.prepare(
              'INSERT INTO migration_log (module, version, name, applied_at, success) VALUES (?, ?, ?, datetime("now"), 1)'
            ).run([modName, v, `schema_v${v}`]);
            continue;
          }

          const mig = mod.migrations[migIndex];
          try {
            if (mig.safe) {
              // Parse ALTER TABLE ADD COLUMN statements and use safeAddColumn
              const alterRegex = /ALTER TABLE (\w+) ADD COLUMN (\w+) ([^;]+);/g;
              let match;
              let nonAlterSql = mig.sql;

              while ((match = alterRegex.exec(mig.sql)) !== null) {
                const [, table, column, definition] = match;
                safeAddColumn(db, table, column, definition.trim());
                // Remove this ALTER from nonAlterSql
                nonAlterSql = nonAlterSql.replace(match[0], '').trim();
              }

              // Exec any remaining non-ALTER SQL (e.g., UPDATE statements)
              if (nonAlterSql.trim()) {
                db.exec(nonAlterSql);
              }
            } else {
              // Unsafe migration - exec directly
              db.exec(mig.sql);
            }

            // Log migration success
            db.prepare(
              'INSERT INTO migration_log (module, version, name, applied_at, success) VALUES (?, ?, ?, datetime("now"), 1)'
            ).run([modName, v, mig.name]);

            // If requires reindex, mark commits and warn
            if (mig.requiresReindex) {
              try {
                db.exec(
                  `UPDATE commits_analysis SET analysis_version = REPLACE(analysis_version, '1.0', '2.0-legacy') WHERE analysis_version LIKE '1.%';`
                );
                logWarn(`[MIGRATION] ${modName} v${v} requires reindex: run 'ct index --reindex'`);
              } catch (e) {
                // Ignore if commits_analysis doesn't exist yet
              }
            }
          } catch (e: any) {
            // Log migration failure
            try {
              db.prepare(
                'INSERT INTO migration_log (module, version, name, applied_at, success) VALUES (?, ?, ?, datetime("now"), 0)'
              ).run([modName, v, mig.name]);
            } catch {
              // Silently ignore logging failures
            }

            // If error is about duplicate/already exists, that's okay
            if (e.message?.includes('already exists') || e.message?.includes('duplicate')) {
              logError(`[MIGRATION] Skipped ${modName} v${v}`, e);
            } else {
              throw e; // Re-throw unexpected errors
            }
          }
        }

        // Exec module schema after migrations (recreates any dropped tables)
        db.exec(mod.schema);
      } else {
        // Already at target version, just ensure schema is up to date
        db.exec(mod.schema);
      }
    } catch (e: any) {
      gaps.push(`${modName} failed: ${truncateError(e.message)}`);
    }
  }

  return gaps;
}

/**
 * Audit all modules for missing columns/tables
 * Returns array of gap messages
 */
export function auditAllModules(db: any): string[] {
  const gaps: string[] = [];

  // Expected columns per module/table
  const expected: Record<string, Record<string, string[]>> = {
    core: {
      migration_log: ['module'],
    },
    commits: {
      commits_analysis: ['status', 'structural_change_score', 'files_changed', 'hotspots_json'],
    },
    edges: {
      edges: ['edge_type'],
    },
    structural: {
      file_snapshots: ['body_hash'],
      workspace_analysis: ['edges_added', 'edges_removed'],
    },
  };

  // Check expected columns
  for (const [mod, tables] of Object.entries(expected)) {
    for (const [table, cols] of Object.entries(tables)) {
      try {
        const rows = db.prepare(`PRAGMA table_info(${table})`).all() as any[];
        const existingCols = rows.map((row: any) => row.name as string);

        const missing = cols.filter(c => !existingCols.includes(c));
        if (missing.length > 0) {
          gaps.push(`${mod}.${table} missing: ${missing.join(', ')}`);
        }
      } catch (e: any) {
        gaps.push(`${mod}.${table}: ${truncateError(e.message)}`);
      }
    }
  }

  // Check for legacy edges (no edge_type)
  try {
    const legacyResult = db
      .prepare('SELECT COUNT(*) as cnt FROM edges WHERE edge_type IS NULL OR edge_type = ""')
      .get() as any;
    const legacyCount = Number(legacyResult?.cnt || 0);

    if (legacyCount > 0) {
      gaps.push(`Legacy edges: ${legacyCount} rows need reindex`);
    }
  } catch (e: any) {
    // Ignore if edges table doesn't exist
    if (!e.message?.includes('no such table')) {
      gaps.push(`Legacy edges check failed: ${truncateError(e.message)}`);
    }
  }

  return gaps;
}
