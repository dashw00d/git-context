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
  analysis_version TEXT DEFAULT '0.0',
  status TEXT DEFAULT 'pending', -- pending, complete, failed
  FOREIGN KEY (sha) REFERENCES commits_metadata(sha) ON DELETE CASCADE
);

-- Files changed in each commit
CREATE TABLE IF NOT EXISTS files (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sha TEXT NOT NULL,
  path TEXT NOT NULL,
  status TEXT NOT NULL,
  lang TEXT,
  FOREIGN KEY (sha) REFERENCES commits_metadata(sha) ON DELETE CASCADE,
  UNIQUE(sha, path)
);

-- Symbols extracted from files
CREATE TABLE IF NOT EXISTS symbols (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sha TEXT NOT NULL,
  path TEXT NOT NULL,
  symbol_id TEXT NOT NULL,
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
  FOREIGN KEY (sha) REFERENCES commits_metadata(sha) ON DELETE CASCADE,
  UNIQUE(sha, symbol_id)
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
  UNIQUE(sha, path, symbol_id)
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
CREATE UNIQUE INDEX IF NOT EXISTS idx_symbols_sha_symbol_id ON symbols(sha, symbol_id);

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
CREATE INDEX IF NOT EXISTS idx_symbol_versions_lookup ON symbol_versions(sha, path, symbol_id);

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
`;

export const MIGRATIONS = [
  DATABASE_SCHEMA
];

// === NEW LAYERED PIPELINE SCHEMA ===

export const SCHEMA_V2 = `
-- Layer 1: Structural Index
CREATE TABLE IF NOT EXISTS file_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  blob_sha TEXT NOT NULL,
  file_path TEXT NOT NULL,
  language TEXT,
  symbols_json TEXT NOT NULL,
  edges_json TEXT NOT NULL,
  scope_path TEXT,
  shape_hash TEXT,
  body_hash TEXT,  -- NEW: for body-level change detection
  created_at TEXT NOT NULL,
  UNIQUE(blob_sha, file_path)
);
CREATE INDEX IF NOT EXISTS idx_snapshots_blob ON file_snapshots(blob_sha);
CREATE INDEX IF NOT EXISTS idx_snapshots_path ON file_snapshots(file_path);

CREATE TABLE IF NOT EXISTS structural_diffs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  parent_blob_sha TEXT NOT NULL,
  current_blob_sha TEXT NOT NULL,
  file_path TEXT NOT NULL,
  structural_change_score REAL DEFAULT 0,
  control_flow_changed INTEGER DEFAULT 0,
  interface_changed INTEGER DEFAULT 0,
  moved_blocks INTEGER DEFAULT 0,
  lines_added INTEGER DEFAULT 0,
  lines_removed INTEGER DEFAULT 0,
  data_json TEXT,
  created_at TEXT NOT NULL,
  UNIQUE(parent_blob_sha, current_blob_sha, file_path)
);
CREATE INDEX IF NOT EXISTS idx_structural_diffs_pair ON structural_diffs(parent_blob_sha, current_blob_sha);

-- Layer 2: Enhanced Commit Analysis
-- Check if table exists, then alter if needed
CREATE TABLE IF NOT EXISTS commits_analysis (
  sha TEXT PRIMARY KEY,
  summary_md TEXT,
  raw_llm_json TEXT,
  symbols_added INTEGER DEFAULT 0,
  symbols_modified INTEGER DEFAULT 0,
  symbols_removed INTEGER DEFAULT 0,
  edges_added INTEGER DEFAULT 0,
  edges_removed INTEGER DEFAULT 0,
  risks TEXT,
  blast_radius REAL DEFAULT 0,
  difftastic_highlights TEXT,
  analyzed_at TEXT,
  pipeline_version TEXT,
  prompt_version TEXT,
  model TEXT,
  -- V2 additions:
  status TEXT DEFAULT 'pending',
  analysis_version TEXT DEFAULT '1.0',
  files_changed INTEGER DEFAULT 0,
  structural_change_score REAL DEFAULT 0,
  hotspots_json TEXT  -- NEW: JSON array of hotspot symbols
);

-- Workspace Analysis
CREATE TABLE IF NOT EXISTS workspace_analysis (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  head_sha TEXT NOT NULL,
  workspace_hash TEXT NOT NULL,
  symbols_added INTEGER DEFAULT 0,
  symbols_modified INTEGER DEFAULT 0,
  symbols_removed INTEGER DEFAULT 0,
  edges_added INTEGER DEFAULT 0,
  edges_removed INTEGER DEFAULT 0,
  risks TEXT,
  files_changed INTEGER DEFAULT 0,
  structural_change_score REAL DEFAULT 0,
  blast_radius REAL DEFAULT 0,
  analyzed_at TEXT NOT NULL,
  UNIQUE(head_sha, workspace_hash)
);
CREATE INDEX IF NOT EXISTS idx_workspace_head ON workspace_analysis(head_sha);

-- Symbol History (for detailed tracking)
CREATE TABLE IF NOT EXISTS symbol_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  symbol_dna_id TEXT NOT NULL,  -- Stable DNA hash
  sha TEXT NOT NULL,
  file_path TEXT NOT NULL,
  name TEXT NOT NULL,
  kind TEXT NOT NULL,
  signature TEXT,
  body_hash TEXT,
  change_type TEXT,  -- added, modified, removed, renamed
  impact_score REAL DEFAULT 0,  -- From blast radius
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_symbol_history_dna ON symbol_history(symbol_dna_id);
CREATE INDEX IF NOT EXISTS idx_symbol_history_sha ON symbol_history(sha);
CREATE INDEX IF NOT EXISTS idx_symbol_history_dna_sha ON symbol_history(symbol_dna_id, sha);

-- Layer 5: Hotspot Detection
CREATE TABLE IF NOT EXISTS file_hotspots (
  file_path TEXT PRIMARY KEY,
  total_commits INTEGER DEFAULT 0,
  total_changes INTEGER DEFAULT 0,
  unique_authors INTEGER DEFAULT 0,
  last_changed_sha TEXT,
  last_changed_date TEXT,
  hotspot_score REAL DEFAULT 0.0,
  first_seen_sha TEXT,
  risk_level TEXT,
  FOREIGN KEY (last_changed_sha) REFERENCES commits_metadata(sha)
);

CREATE INDEX IF NOT EXISTS idx_file_hotspots_score ON file_hotspots(hotspot_score DESC);
CREATE INDEX IF NOT EXISTS idx_file_hotspots_risk ON file_hotspots(risk_level);

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
  risk_level TEXT,
  FOREIGN KEY (last_changed_sha) REFERENCES commits_metadata(sha)
);

CREATE INDEX IF NOT EXISTS idx_symbol_hotspots_score ON symbol_hotspots(hotspot_score DESC);
CREATE INDEX IF NOT EXISTS idx_symbol_hotspots_file ON symbol_hotspots(file_path);
CREATE INDEX IF NOT EXISTS idx_symbol_hotspots_type ON symbol_hotspots(symbol_type);

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

-- Layer 6: Moved Block Detection
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

CREATE INDEX IF NOT EXISTS idx_moved_blocks_commit ON moved_blocks(commit_sha);
CREATE INDEX IF NOT EXISTS idx_moved_blocks_source ON moved_blocks(source_file, source_symbol_id);
CREATE INDEX IF NOT EXISTS idx_moved_blocks_dest ON moved_blocks(dest_file, dest_symbol_id);
CREATE INDEX IF NOT EXISTS idx_moved_blocks_hash ON moved_blocks(source_content_hash);

CREATE TABLE IF NOT EXISTS symbol_lineage (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  symbol_id TEXT NOT NULL,
  previous_symbol_id TEXT NOT NULL,
  commit_sha TEXT NOT NULL,
  move_type TEXT NOT NULL,
  FOREIGN KEY (commit_sha) REFERENCES commits_metadata(sha)
);

CREATE INDEX IF NOT EXISTS idx_symbol_lineage_current ON symbol_lineage(symbol_id);
CREATE INDEX IF NOT EXISTS idx_symbol_lineage_previous ON symbol_lineage(previous_symbol_id);
`;

export const MIGRATION_V1_TO_V2 = `
// Add new columns to commits_analysis if they don't exist
// SQLite doesn't have IF NOT EXISTS for ALTER COLUMN, so we use a workaround

-- Add status column
ALTER TABLE commits_analysis ADD COLUMN status TEXT DEFAULT 'pending';
ALTER TABLE commits_analysis ADD COLUMN analysis_version TEXT DEFAULT '1.0';
ALTER TABLE commits_analysis ADD COLUMN files_changed INTEGER DEFAULT 0;
ALTER TABLE commits_analysis ADD COLUMN structural_change_score REAL DEFAULT 0;
ALTER TABLE commits_analysis ADD COLUMN hotspots_json TEXT;

-- Mark all existing rows as 'complete' with v1.0
UPDATE commits_analysis
SET status = 'complete',
    analysis_version = '1.0'
WHERE status IS NULL OR analysis_version IS NULL;

// Verify essential columns exist (will error if they don't - catch this)
// symbols_added, symbols_modified, symbols_removed should already exist
// edges_added, edges_removed should already exist
// If not, you'll need to add them too

-- Create hotspot tables for v2.0
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
  total_changes INTEGER NOT NULL
);

-- Create moved block tables for v2.0
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
  line_count INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS symbol_lineage (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  symbol_id TEXT NOT NULL,
  previous_symbol_id TEXT NOT NULL,
  commit_sha TEXT NOT NULL,
  move_type TEXT NOT NULL
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_file_hotspots_score ON file_hotspots(hotspot_score DESC);
CREATE INDEX IF NOT EXISTS idx_file_hotspots_risk ON file_hotspots(risk_level);
CREATE INDEX IF NOT EXISTS idx_symbol_hotspots_score ON symbol_hotspots(hotspot_score DESC);
CREATE INDEX IF NOT EXISTS idx_symbol_hotspots_file ON symbol_hotspots(file_path);
CREATE INDEX IF NOT EXISTS idx_symbol_hotspots_type ON symbol_hotspots(symbol_type);
CREATE INDEX IF NOT EXISTS idx_hotspot_snapshots_entity ON hotspot_snapshots(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_hotspot_snapshots_date ON hotspot_snapshots(snapshot_date);
CREATE INDEX IF NOT EXISTS idx_moved_blocks_commit ON moved_blocks(commit_sha);
CREATE INDEX IF NOT EXISTS idx_moved_blocks_source ON moved_blocks(source_file, source_symbol_id);
CREATE INDEX IF NOT EXISTS idx_moved_blocks_dest ON moved_blocks(dest_file, dest_symbol_id);
CREATE INDEX IF NOT EXISTS idx_moved_blocks_hash ON moved_blocks(source_content_hash);
CREATE INDEX IF NOT EXISTS idx_symbol_lineage_current ON symbol_lineage(symbol_id);
CREATE INDEX IF NOT EXISTS idx_symbol_lineage_previous ON symbol_lineage(previous_symbol_id);
`;

export function migrateDatabase(db: Database): void {
  console.log('[Schema] Running migration to v2.0...');

  // Check current schema version
  const versionRow = db.exec('PRAGMA user_version');
  const currentVersion = Number(versionRow[0]?.values[0]?.[0] || 0);

  if (currentVersion >= 2) {
    console.log('[Schema] Already at v2.0');
    return;
  }

  db.exec('BEGIN TRANSACTION');

  try {
    // Create new tables
    db.exec(SCHEMA_V2);

    // Migrate existing data
    try {
      db.exec(MIGRATION_V1_TO_V2);
    } catch (error) {
      console.warn('[Schema] Migration warnings (some columns may already exist):', error);
      // Continue - some columns might exist already
    }

    // Update schema version
    db.exec('PRAGMA user_version = 2');

    db.exec('COMMIT');
    console.log('[Schema] Migration to v2.0 complete');
  } catch (error) {
    db.exec('ROLLBACK');
    console.error('[Schema] Migration failed:', error);
    throw error;
  }
}

export const CURRENT_VERSION = 10;

// === MIGRATION FUNCTIONS ===

import { Database } from 'sql.js';

/**
 * Safely add a column if it doesn't exist
 */
function addColumnIfNotExists(db: Database, table: string, column: string, definition: string): void {
  try {
    // Check if column exists by querying table info
    const stmt = db.prepare(`PRAGMA table_info(${table})`);
    const columns: any[] = [];
    while (stmt.step()) {
      columns.push(stmt.getAsObject());
    }
    stmt.free();

    const columnExists = columns.some((col: any) => col.name === column);

    if (!columnExists) {
      db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
    }
  } catch (error) {
    // Column may already exist, safe to ignore
    console.warn(`Could not add column ${table}.${column}:`, error);
  }
}

/**
 * Migrate to v2.0 layered pipeline schema
 */
export function migrateToV2(db: Database): void {
  // Enable foreign keys
  db.exec('PRAGMA foreign_keys = ON');

  db.exec(`
    -- New tables for layered pipeline
    CREATE TABLE IF NOT EXISTS file_snapshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      blob_sha TEXT NOT NULL,
      file_path TEXT NOT NULL,
      language TEXT,
      symbols_json TEXT NOT NULL,
      edges_json TEXT NOT NULL,
      scope_path TEXT,
      shape_hash TEXT,
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
      risks TEXT,
      files_changed INTEGER,
      analyzed_at TEXT NOT NULL,
      UNIQUE(head_sha, workspace_hash)
    );

    -- Create indexes for new tables
    CREATE INDEX IF NOT EXISTS idx_snapshots_blob ON file_snapshots(blob_sha);
    CREATE INDEX IF NOT EXISTS idx_structural_diffs_pair ON structural_diffs(parent_blob_sha, current_blob_sha);
  `);

  // Add new columns to existing commits_analysis table (safe for existing databases)
  addColumnIfNotExists(db, 'commits_analysis', 'status', 'TEXT DEFAULT \'pending\'');
  addColumnIfNotExists(db, 'commits_analysis', 'analysis_version', 'TEXT DEFAULT \'1.0\'');
  addColumnIfNotExists(db, 'commits_analysis', 'files_changed', 'INTEGER DEFAULT 0');
  addColumnIfNotExists(db, 'commits_analysis', 'structural_change_score', 'REAL DEFAULT 0');
  addColumnIfNotExists(db, 'commits_analysis', 'hotspots_json', 'TEXT');

  // Mark existing commits as complete
  db.exec(`
    UPDATE commits_analysis
    SET status = 'complete', analysis_version = '1.0'
    WHERE status IS NULL OR status = 'pending';
  `);
}

// New pipeline version
export const ANALYSIS_VERSION = '2.0';
