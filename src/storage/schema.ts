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
`;

export const MIGRATIONS = [
  DATABASE_SCHEMA
];

export const CURRENT_VERSION = 10;
