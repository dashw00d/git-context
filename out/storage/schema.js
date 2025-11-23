"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CURRENT_VERSION = exports.MIGRATIONS = exports.DATABASE_SCHEMA = void 0;
exports.DATABASE_SCHEMA = `
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
`;
exports.MIGRATIONS = [
    // Version 1: Initial schema
    exports.DATABASE_SCHEMA
];
exports.CURRENT_VERSION = 1;
//# sourceMappingURL=schema.js.map