export const DATABASE_SCHEMA = `
-- Main commits table
CREATE TABLE IF NOT EXISTS commits (
  sha TEXT PRIMARY KEY,
  author TEXT NOT NULL,
  date TEXT NOT NULL,
  message TEXT NOT NULL,
  summary_md TEXT,
  raw_llm_json TEXT,
  files_changed INTEGER DEFAULT 0,
  symbols_added INTEGER DEFAULT 0,
  symbols_removed INTEGER DEFAULT 0,
  symbols_modified INTEGER DEFAULT 0,
  edges_added INTEGER DEFAULT 0,
  edges_removed INTEGER DEFAULT 0,
  risks TEXT DEFAULT '[]', -- JSON array of risk flags
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Files changed in each commit
CREATE TABLE IF NOT EXISTS files (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sha TEXT NOT NULL,
  path TEXT NOT NULL,
  status TEXT NOT NULL, -- A, M, D, R, C, U
  lang TEXT, -- Detected language
  FOREIGN KEY (sha) REFERENCES commits(sha) ON DELETE CASCADE,
  UNIQUE(sha, path)
);

-- Symbols extracted from files
CREATE TABLE IF NOT EXISTS symbols (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sha TEXT NOT NULL,
  path TEXT NOT NULL,
  symbol_id TEXT NOT NULL, -- Unique identifier for the symbol
  name TEXT NOT NULL,
  kind TEXT NOT NULL, -- function, class, method, const, interface, type, variable
  signature_pre TEXT, -- Signature before change (for modified symbols)
  signature_post TEXT, -- Signature after change
  loc_pre TEXT, -- JSON location before change
  loc_post TEXT, -- JSON location after change
  change_type TEXT, -- added, removed, modified, signature_changed, body_changed, renamed, moved
  mod_reason TEXT, -- body_changed, signature_changed, doc_changed, visibility_changed, annotation_changed
  diff_snippet_pre TEXT, -- Before diff snippet (truncated)
  diff_snippet_post TEXT, -- After diff snippet (truncated)
  confidence REAL DEFAULT 1.0, -- Confidence in change detection (0.0-1.0)
  naming_convention TEXT, -- camelCase, PascalCase, snake_case, etc.
  convention_confidence REAL, -- Confidence in convention detection (0.0-1.0)
  FOREIGN KEY (sha) REFERENCES commits(sha) ON DELETE CASCADE,
  UNIQUE(sha, symbol_id)
);

-- Dependency edges between symbols
CREATE TABLE IF NOT EXISTS edges (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sha TEXT NOT NULL,
  from_symbol_id TEXT NOT NULL,
  to_symbol_id TEXT NOT NULL,
  edge_type TEXT NOT NULL, -- imports, calls, extends, implements, uses
  change_type TEXT, -- added, removed, modified (NULL for current state)
  confidence REAL DEFAULT 1.0, -- Confidence in edge detection (0.0-1.0)
  is_resolved INTEGER DEFAULT 1, -- Whether target symbol was resolved
  FOREIGN KEY (sha) REFERENCES commits(sha) ON DELETE CASCADE
);

-- Full-text search removed due to sql.js limitations
-- We will use standard LIKE queries on the symbols table instead

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_files_sha ON files(sha);
CREATE INDEX IF NOT EXISTS idx_symbols_sha ON symbols(sha);
CREATE INDEX IF NOT EXISTS idx_symbols_path ON symbols(path);
CREATE INDEX IF NOT EXISTS idx_symbols_name ON symbols(name);
CREATE INDEX IF NOT EXISTS idx_edges_sha ON edges(sha);
CREATE INDEX IF NOT EXISTS idx_edges_from ON edges(from_symbol_id);
CREATE INDEX IF NOT EXISTS idx_edges_to ON edges(to_symbol_id);

-- Renames table for tracking symbol evolution
CREATE TABLE IF NOT EXISTS renames (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sha TEXT NOT NULL,
  path TEXT NOT NULL,
  old_symbol_id TEXT NOT NULL,
  new_symbol_id TEXT NOT NULL,
  old_name TEXT NOT NULL,
  new_name TEXT NOT NULL,
  confidence REAL DEFAULT 1.0,
  FOREIGN KEY (sha) REFERENCES commits(sha) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_renames_sha ON renames(sha);
CREATE INDEX IF NOT EXISTS idx_renames_path ON renames(path);

-- File-level naming convention tracking
CREATE TABLE IF NOT EXISTS file_conventions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sha TEXT NOT NULL,
  path TEXT NOT NULL,
  dominant_convention TEXT,
  convention_counts TEXT, -- JSON object with counts per convention
  drift_percent REAL,
  symbol_count INTEGER,
  FOREIGN KEY (sha) REFERENCES commits(sha) ON DELETE CASCADE,
  UNIQUE(sha, path)
);

CREATE INDEX IF NOT EXISTS idx_symbols_convention ON symbols(naming_convention);
CREATE INDEX IF NOT EXISTS idx_file_conventions_sha ON file_conventions(sha);
CREATE INDEX IF NOT EXISTS idx_file_conventions_path ON file_conventions(path);

-- Import path convention tracking
CREATE TABLE IF NOT EXISTS import_conventions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sha TEXT NOT NULL,
  path TEXT NOT NULL,
  import_path TEXT NOT NULL,
  import_style TEXT NOT NULL,
  line_number INTEGER,
  FOREIGN KEY (sha) REFERENCES commits(sha) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_import_conventions_sha ON import_conventions(sha);
CREATE INDEX IF NOT EXISTS idx_import_conventions_path ON import_conventions(path);
CREATE INDEX IF NOT EXISTS idx_import_conventions_style ON import_conventions(import_style);
`;

export const MIGRATION_V2 = `
-- Add naming convention columns to symbols table
ALTER TABLE symbols ADD COLUMN naming_convention TEXT;
ALTER TABLE symbols ADD COLUMN convention_confidence REAL;

-- Create file_conventions table
CREATE TABLE IF NOT EXISTS file_conventions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sha TEXT NOT NULL,
  path TEXT NOT NULL,
  dominant_convention TEXT,
  convention_counts TEXT,
  drift_percent REAL,
  symbol_count INTEGER,
  FOREIGN KEY (sha) REFERENCES commits(sha) ON DELETE CASCADE,
  UNIQUE(sha, path)
);

-- Add indexes for convention queries
CREATE INDEX IF NOT EXISTS idx_symbols_convention ON symbols(naming_convention);
CREATE INDEX IF NOT EXISTS idx_file_conventions_sha ON file_conventions(sha);
CREATE INDEX IF NOT EXISTS idx_file_conventions_path ON file_conventions(path);
`;

export const MIGRATION_V3 = `
-- Create import_conventions table
CREATE TABLE IF NOT EXISTS import_conventions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sha TEXT NOT NULL,
  path TEXT NOT NULL,
  import_path TEXT NOT NULL,
  import_style TEXT NOT NULL,
  line_number INTEGER,
  FOREIGN KEY (sha) REFERENCES commits(sha) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_import_conventions_sha ON import_conventions(sha);
CREATE INDEX IF NOT EXISTS idx_import_conventions_path ON import_conventions(path);
CREATE INDEX IF NOT EXISTS idx_import_conventions_style ON import_conventions(import_style);
`;

export const MIGRATION_V4 = `
-- Create reports table for saved analysis reports
CREATE TABLE IF NOT EXISTS reports (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  commit_shas TEXT,              -- JSON array of SHAs
  selected_files TEXT,           -- JSON array of selected file paths
  workspace_scope TEXT,          -- 'full'|'staged'|'unstaged'|'partial'
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  workspace_hash TEXT,           -- Hash for staleness detection
  facts_json TEXT,               -- Cached RefactorBundleFacts
  analysis_json TEXT,            -- Cached LLM analysis
  summary TEXT,                  -- "6 Critical Issues"
  critical_count INTEGER DEFAULT 0,
  warning_count INTEGER DEFAULT 0,
  is_pinned INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_reports_created_at ON reports(created_at);
CREATE INDEX IF NOT EXISTS idx_reports_is_pinned ON reports(is_pinned);
`;

export const MIGRATION_V5 = `
-- Split commits table into commits_metadata and commits_analysis

-- Create lightweight metadata table
CREATE TABLE IF NOT EXISTS commits_metadata (
  sha TEXT PRIMARY KEY,
  author TEXT NOT NULL,
  date TEXT NOT NULL,
  message TEXT NOT NULL,
  parent TEXT,
  files_changed INTEGER DEFAULT 0,
  loaded_at TEXT NOT NULL  -- ISO timestamp when loaded
);

-- Create heavyweight analysis results table
CREATE TABLE IF NOT EXISTS commits_analysis (
  sha TEXT PRIMARY KEY,
  summary_md TEXT,
  raw_llm_json TEXT,
  symbols_added INTEGER DEFAULT 0,
  symbols_removed INTEGER DEFAULT 0,
  symbols_modified INTEGER DEFAULT 0,
  edges_added INTEGER DEFAULT 0,
  edges_removed INTEGER DEFAULT 0,
  risks TEXT DEFAULT '[]',  -- JSON array
  blast_radius INTEGER DEFAULT 0,
  difftastic_highlights TEXT,  -- JSON array of difftastic highlight strings
  analyzed_at TEXT NOT NULL,  -- ISO timestamp when analyzed
  FOREIGN KEY (sha) REFERENCES commits_metadata(sha) ON DELETE CASCADE
);

-- Migrate existing data from commits table
INSERT OR IGNORE INTO commits_metadata (sha, author, date, message, parent, files_changed, loaded_at)
SELECT sha, author, date, message, NULL, files_changed, datetime('now')
FROM commits;

INSERT OR IGNORE INTO commits_analysis (sha, summary_md, raw_llm_json, symbols_added, symbols_removed,
  symbols_modified, edges_added, edges_removed, risks, blast_radius, analyzed_at)
SELECT sha, summary_md, raw_llm_json, symbols_added, symbols_removed, symbols_modified,
  edges_added, edges_removed, risks, 0, datetime('now')
FROM commits
WHERE summary_md IS NOT NULL OR raw_llm_json IS NOT NULL;

-- Create indexes for new tables
CREATE INDEX IF NOT EXISTS idx_commits_metadata_date ON commits_metadata(date DESC);
CREATE INDEX IF NOT EXISTS idx_commits_analysis_analyzed_at ON commits_analysis(analyzed_at DESC);

-- Drop the old commits table (AGGRESSIVE: since nobody is using the plugin)
DROP TABLE IF EXISTS commits;

-- Note: Foreign key constraints may not be enforced in sql.js, but the relationships are defined
-- for future compatibility with SQLite databases that support FKs
`;

export const MIGRATION_V6 = `
-- Add difftastic_highlights column to commits_analysis table
ALTER TABLE commits_analysis ADD COLUMN difftastic_highlights TEXT;
`;

export const MIGRATIONS = [
  // Version 1: Initial schema
  DATABASE_SCHEMA,
  // Version 2: Naming convention tracking
  MIGRATION_V2,
  // Version 3: Import path convention tracking
  MIGRATION_V3,
  // Version 4: Reports table
  MIGRATION_V4,
  // Version 5: Split commits table
  MIGRATION_V5,
  // Version 6: Add difftastic highlights storage
  MIGRATION_V6
];

export const CURRENT_VERSION = 6;
