# Storage Module (`storage/`)

## Purpose

The `storage/` module manages all persistent data operations for Git Context. It implements a modular SQLite database schema with automatic migrations, provides a statement wrapper for safe database access, and handles embedding storage with Qdrant integration.

## Key Components

### Database Management (`database.ts`)

Core database initialization, connection management, and file system operations.

```typescript
class DatabaseManager {
  private db: Database | null = null;
  private dbPath: string;

  constructor() {
    this.dbPath = this.getDatabasePath();
  }

  async initialize(): Promise<void> {
    try {
      // Load SQL.js WASM
      const SQL = await initSqlJs();

      // Load or create database file
      let filebuffer: Uint8Array | null = null;
      if (fs.existsSync(this.dbPath)) {
        filebuffer = fs.readFileSync(this.dbPath);
      }

      // Create database instance
      this.db = new SQL.Database(filebuffer);

      // Run migrations
      await migrateDatabase(this.db);

      // Audit schema
      const gaps = auditAllModules(this.db);
      if (gaps.length > 0) {
        logWarn('Schema gaps detected:', gaps);
      }
    } catch (error) {
      logError('Database initialization failed', error);
      throw error;
    }
  }

  getDatabase(): Database {
    if (!this.db) {
      throw new Error('Database not initialized');
    }
    return this.db;
  }

  save(): void {
    if (this.db && this.dbPath) {
      const data = this.db.export();
      const buffer = Buffer.from(data);
      fs.writeFileSync(this.dbPath, buffer);
    }
  }

  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }
}

let dbManager: DatabaseManager | null = null;

export function getDatabaseManager(): DatabaseManager {
  if (!dbManager) {
    dbManager = new DatabaseManager();
  }
  return dbManager;
}

export async function ensureDatabaseInitialized(): Promise<void> {
  const manager = getDatabaseManager();
  await manager.initialize();
}

export function getDatabase(): Database | null {
  return getDatabaseManager().getDatabase();
}

export function closeDatabase(): void {
  getDatabaseManager().close();
}
```

**Key Features:**

- **Lazy Initialization**: Database loaded only when first accessed
- **File Persistence**: Automatic saving to `.git/commit-tracker/commit_tracker.sqlite`
- **Migration System**: Automatic schema updates on startup
- **Connection Management**: Singleton pattern for database access

### Statement Wrapper (`statement-wrapper.ts`)

Mandatory wrapper for all database operations providing safety and consistency.

```typescript
/**
 * Prepare a SQL statement using the database connection.
 * This is the recommended way to create prepared statements instead of db.prepare().
 * It prevents memory leaks from uninitialized statements.
 */
export function prepare(sql: string): DatabaseStatement {
  const db = getDatabase();
  if (!db) {
    throw new Error('Database not initialized');
  }

  const stmt = db.prepare(sql);

  return {
    run(...params: any[]): { changes: number; lastInsertRowid: number } {
      stmt.bind(params);
      stmt.step();
      stmt.reset(); // CRITICAL: Reset for reuse
      getDatabaseManager().save(); // Auto-save on mutations
      return { changes: 0, lastInsertRowid: 0 };
    },

    get(...params: any[]): any {
      stmt.bind(params);
      const result = stmt.step() ? stmt.getAsObject() : undefined;
      stmt.reset();
      return result;
    },

    all(...params: any[]): any[] {
      const results: any[] = [];
      stmt.bind(params);
      while (stmt.step()) {
        results.push(stmt.getAsObject());
      }
      stmt.reset();
      return results;
    },

    finalize(): void {
      stmt.free();
    },
  };
}
```

**Critical Invariants:**

- **Always use `prepare()`**: Never access `db.prepare()` directly
- **Statement Lifecycle**: Always call `finalize()` when done
- **Parameter Binding**: Proper parameter normalization
- **Memory Management**: Automatic statement reset and cleanup

### Modular Schema System (`schema.ts`)

Versioned, modular database schema with automatic migrations.

```typescript
export const MODULE_SCHEMAS = {
  core: {
    version: 1,
    tables: {
      migration_log: `
        CREATE TABLE IF NOT EXISTS migration_log (
          module TEXT NOT NULL,
          version INTEGER NOT NULL,
          migrated_at TEXT NOT NULL,
          PRIMARY KEY (module, version)
        )
      `,
    },
  },

  commits: {
    version: 2,
    tables: {
      commits_metadata: `
        CREATE TABLE IF NOT EXISTS commits_metadata (
          sha TEXT PRIMARY KEY,
          author TEXT NOT NULL,
          date TEXT NOT NULL,
          message TEXT NOT NULL,
          parent_sha TEXT,
          files_changed INTEGER DEFAULT 0,
          loaded_at TEXT NOT NULL
        )
      `,
      commits_analysis: `
        CREATE TABLE IF NOT EXISTS commits_analysis (
          sha TEXT PRIMARY KEY,
          summary_md TEXT,
          raw_llm_json TEXT,
          symbols_added INTEGER DEFAULT 0,
          symbols_removed INTEGER DEFAULT 0,
          symbols_modified INTEGER DEFAULT 0,
          FOREIGN KEY (sha) REFERENCES commits_metadata(sha) ON DELETE CASCADE
        )
      `,
    },
  },

  symbols: {
    version: 3,
    tables: {
      symbol_versions: `
        CREATE TABLE IF NOT EXISTS symbol_versions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          symbol_dna_id TEXT NOT NULL,
          sha TEXT NOT NULL,
          file_path TEXT NOT NULL,
          name TEXT NOT NULL,
          kind TEXT NOT NULL,
          signature TEXT,
          body_hash TEXT,
          change_type TEXT,
          created_at TEXT NOT NULL,
          FOREIGN KEY (sha) REFERENCES commits_metadata(sha) ON DELETE CASCADE
        )
      `,
      symbol_changes: `
        CREATE TABLE IF NOT EXISTS symbol_changes (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          symbol_id INTEGER NOT NULL,
          change_type TEXT NOT NULL,
          old_value TEXT,
          new_value TEXT,
          FOREIGN KEY (symbol_id) REFERENCES symbol_versions(id) ON DELETE CASCADE
        )
      `,
    },
    indexes: {
      symbol_versions_dna:
        'CREATE INDEX IF NOT EXISTS idx_symbol_versions_dna ON symbol_versions(symbol_dna_id)',
      symbol_versions_sha:
        'CREATE INDEX IF NOT EXISTS idx_symbol_versions_sha ON symbol_versions(sha)',
      symbol_changes_symbol:
        'CREATE INDEX IF NOT EXISTS idx_symbol_changes_symbol ON symbol_changes(symbol_id)',
    },
  },

  edges: {
    version: 2,
    tables: {
      edges: `
        CREATE TABLE IF NOT EXISTS edges (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          sha TEXT NOT NULL,
          source_symbol_id TEXT NOT NULL,
          target_symbol_id TEXT NOT NULL,
          edge_type TEXT NOT NULL,
          confidence REAL DEFAULT 1.0,
          created_at TEXT NOT NULL,
          FOREIGN KEY (sha) REFERENCES commits_metadata(sha) ON DELETE CASCADE
        )
      `,
      renames: `
        CREATE TABLE IF NOT EXISTS renames (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          sha TEXT NOT NULL,
          old_symbol_id TEXT NOT NULL,
          new_symbol_id TEXT NOT NULL,
          old_name TEXT NOT NULL,
          new_name TEXT NOT NULL,
          confidence REAL DEFAULT 1.0,
          created_at TEXT NOT NULL,
          FOREIGN KEY (sha) REFERENCES commits_metadata(sha) ON DELETE CASCADE
        )
      `,
    },
  },

  conventions: {
    version: 1,
    tables: {
      import_conventions: `
        CREATE TABLE IF NOT EXISTS import_conventions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          sha TEXT NOT NULL,
          file_path TEXT NOT NULL,
          convention_type TEXT NOT NULL,
          pattern TEXT NOT NULL,
          confidence REAL DEFAULT 1.0,
          created_at TEXT NOT NULL,
          FOREIGN KEY (sha) REFERENCES commits_metadata(sha) ON DELETE CASCADE
        )
      `,
    },
  },

  structural: {
    version: 1,
    tables: {
      file_snapshots: `
        CREATE TABLE IF NOT EXISTS file_snapshots (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          sha TEXT NOT NULL,
          file_path TEXT NOT NULL,
          content_hash TEXT NOT NULL,
          size_bytes INTEGER NOT NULL,
          created_at TEXT NOT NULL,
          FOREIGN KEY (sha) REFERENCES commits_metadata(sha) ON DELETE CASCADE
        )
      `,
      workspace_analysis: `
        CREATE TABLE IF NOT EXISTS workspace_analysis (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          timestamp TEXT NOT NULL,
          file_path TEXT NOT NULL,
          analysis_type TEXT NOT NULL,
          result_json TEXT NOT NULL
        )
      `,
    },
  },

  hotspots: {
    version: 1,
    tables: {
      file_hotspots: `
        CREATE TABLE IF NOT EXISTS file_hotspots (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          file_path TEXT NOT NULL,
          score REAL NOT NULL,
          commit_count INTEGER NOT NULL,
          last_modified TEXT NOT NULL,
          created_at TEXT NOT NULL,
          UNIQUE(file_path)
        )
      `,
      symbol_hotspots: `
        CREATE TABLE IF NOT EXISTS symbol_hotspots (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          symbol_dna_id TEXT NOT NULL,
          name TEXT NOT NULL,
          score REAL NOT NULL,
          commit_count INTEGER NOT NULL,
          last_modified TEXT NOT NULL,
          created_at TEXT NOT NULL,
          UNIQUE(symbol_dna_id)
        )
      `,
    },
  },

  moved: {
    version: 1,
    tables: {
      moved_blocks: `
        CREATE TABLE IF NOT EXISTS moved_blocks (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          sha TEXT NOT NULL,
          source_file TEXT NOT NULL,
          dest_file TEXT NOT NULL,
          similarity REAL NOT NULL,
          block_hash TEXT NOT NULL,
          created_at TEXT NOT NULL,
          FOREIGN KEY (sha) REFERENCES commits_metadata(sha) ON DELETE CASCADE
        )
      `,
      symbol_lineage: `
        CREATE TABLE IF NOT EXISTS symbol_lineage (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          symbol_dna_id TEXT NOT NULL,
          from_sha TEXT NOT NULL,
          to_sha TEXT NOT NULL,
          move_type TEXT NOT NULL,
          confidence REAL DEFAULT 1.0,
          created_at TEXT NOT NULL,
          FOREIGN KEY (from_sha) REFERENCES commits_metadata(sha) ON DELETE CASCADE,
          FOREIGN KEY (to_sha) REFERENCES commits_metadata(sha) ON DELETE CASCADE
        )
      `,
    },
  },

  reports: {
    version: 1,
    tables: {
      reports: `
        CREATE TABLE IF NOT EXISTS reports (
          id TEXT PRIMARY KEY,
          bundle_id TEXT NOT NULL,
          title TEXT NOT NULL,
          summary TEXT NOT NULL,
          content_json TEXT NOT NULL,
          generated_at TEXT NOT NULL,
          format_version TEXT DEFAULT '1.0'
        )
      `,
    },
  },
};
```

### Migration System

Automatic migration with safe column addition:

```typescript
export async function migrateDatabase(db: Database): Promise<void> {
  const moduleOrder = [
    'core',
    'commits',
    'symbols',
    'edges',
    'conventions',
    'structural',
    'hotspots',
    'moved',
    'reports',
  ];

  for (const moduleName of moduleOrder) {
    const moduleSchema = MODULE_SCHEMAS[moduleName];
    const currentVersion = getCurrentVersion(db, moduleName);

    if (currentVersion < moduleSchema.version) {
      logInfo(`Migrating ${moduleName} from v${currentVersion} to v${moduleSchema.version}`);

      // Create tables if they don't exist
      for (const [tableName, createSql] of Object.entries(moduleSchema.tables)) {
        db.run(createSql);
      }

      // Create indexes if they exist
      if (moduleSchema.indexes) {
        for (const createIndexSql of Object.values(moduleSchema.indexes)) {
          db.run(createIndexSql);
        }
      }

      // Record migration
      db.run(
        'INSERT OR REPLACE INTO migration_log (module, version, migrated_at) VALUES (?, ?, ?)',
        [moduleName, moduleSchema.version, new Date().toISOString()]
      );
    }
  }
}
```

### Branch Manager (`branchManager.ts`)

Git branch tracking and commit organization.

```typescript
export class BranchManager {
  constructor(private db: Database) {}

  recordCommit(commitSha: string, branchName: string): void {
    const stmt = prepare(`
      INSERT OR REPLACE INTO branch_commits (commit_sha, branch_name, recorded_at)
      VALUES (?, ?, ?)
    `);
    stmt.run(commitSha, branchName, new Date().toISOString());
  }

  updateBranchHead(branchName: string, headSha: string): void {
    const stmt = prepare(`
      INSERT OR REPLACE INTO branch_heads (branch_name, head_sha, updated_at)
      VALUES (?, ?, ?)
    `);
    stmt.run(branchName, headSha, new Date().toISOString());
  }

  getBranchCommits(branchName: string, limit = 50): CommitMetadata[] {
    const stmt = prepare(`
      SELECT cm.* FROM commits_metadata cm
      JOIN branch_commits bc ON cm.sha = bc.commit_sha
      WHERE bc.branch_name = ?
      ORDER BY cm.date DESC
      LIMIT ?
    `);
    return stmt.all(branchName, limit) as CommitMetadata[];
  }
}
```

### Report Manager (`reportManager.ts`)

Analysis report storage and retrieval.

```typescript
export class ReportManager {
  constructor(private db: Database) {}

  saveReport(report: ReportDTO): void {
    const stmt = prepare(`
      INSERT OR REPLACE INTO reports (id, bundle_id, title, summary, content_json, generated_at, format_version)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      report.id,
      report.bundleId,
      report.title,
      report.summary,
      JSON.stringify(report.content),
      report.generatedAt,
      report.formatVersion || '1.0'
    );
  }

  getReport(reportId: string): ReportDTO | null {
    const stmt = prepare('SELECT * FROM reports WHERE id = ?');
    const row = stmt.get(reportId) as any;

    if (!row) return null;

    return {
      id: row.id,
      bundleId: row.bundle_id,
      title: row.title,
      summary: row.summary,
      content: JSON.parse(row.content_json),
      generatedAt: row.generated_at,
      formatVersion: row.format_version,
    };
  }

  listReports(bundleId?: string): ReportDTO[] {
    let sql = 'SELECT * FROM reports';
    const params: any[] = [];

    if (bundleId) {
      sql += ' WHERE bundle_id = ?';
      params.push(bundleId);
    }

    sql += ' ORDER BY generated_at DESC';

    const stmt = prepare(sql);
    const rows = stmt.all(...params) as any[];

    return rows.map(row => ({
      id: row.id,
      bundleId: row.bundle_id,
      title: row.title,
      summary: row.summary,
      content: JSON.parse(row.content_json),
      generatedAt: row.generated_at,
      formatVersion: row.format_version,
    }));
  }
}
```

### Embedding Storage (`embeddings.ts`)

Vector embedding storage utilities.

```typescript
export class EmbeddingStorage {
  constructor(private db: Database) {}

  storeEmbeddings(commitSha: string, embeddings: EmbeddingData[]): void {
    const stmt = prepare(`
      INSERT INTO embeddings (commit_sha, content_hash, vector_json, metadata_json, created_at)
      VALUES (?, ?, ?, ?, ?)
    `);

    for (const embedding of embeddings) {
      stmt.run(
        commitSha,
        embedding.contentHash,
        JSON.stringify(embedding.vector),
        JSON.stringify(embedding.metadata),
        new Date().toISOString()
      );
    }
  }

  getEmbeddings(commitSha: string): EmbeddingData[] {
    const stmt = prepare('SELECT * FROM embeddings WHERE commit_sha = ?');
    const rows = stmt.all(commitSha) as any[];

    return rows.map(row => ({
      contentHash: row.content_hash,
      vector: JSON.parse(row.vector_json),
      metadata: JSON.parse(row.metadata_json),
    }));
  }
}
```

### Qdrant Client (`qdrantClient.ts`)

Qdrant vector database integration for semantic search.

```typescript
export class QdrantClient {
  private client: any;

  constructor(endpoint: string, apiKey?: string) {
    this.client = new QdrantClient({
      url: endpoint,
      apiKey: apiKey,
    });
  }

  async storeEmbeddings(collection: string, embeddings: VectorPoint[]): Promise<void> {
    await this.client.upsert(collection, {
      wait: true,
      points: embeddings.map(emb => ({
        id: emb.id,
        vector: emb.vector,
        payload: emb.payload,
      })),
    });
  }

  async searchSimilar(
    collection: string,
    queryVector: number[],
    limit = 10
  ): Promise<SearchResult[]> {
    const results = await this.client.search(collection, {
      vector: queryVector,
      limit: limit,
      with_payload: true,
      with_vector: false,
    });

    return results.map(result => ({
      id: result.id,
      score: result.score,
      payload: result.payload,
    }));
  }

  async deleteEmbeddings(collection: string, ids: string[]): Promise<void> {
    await this.client.delete(collection, {
      points: ids,
    });
  }
}
```

## Architecture

### Database Schema Organization

The schema is organized into 9 logical modules:

1. **core**: Migration tracking and base infrastructure
2. **commits**: Commit metadata and analysis results
3. **symbols**: Symbol tracking with DNA-based identity
4. **edges**: Dependency relationships and renames
5. **conventions**: Code style convention tracking
6. **structural**: File snapshots and workspace analysis
7. **hotspots**: Code change frequency analysis
8. **moved**: Block movement and symbol lineage tracking
9. **reports**: Analysis report storage

### Migration Strategy

Safe, incremental migrations with no data loss:

```typescript
// Safe column addition (never removes columns)
export function safeAddColumn(
  db: Database,
  table: string,
  column: string,
  columnDef: string
): void {
  const pragmaStmt = db.prepare(`PRAGMA table_info(${table})`);
  const columns = pragmaStmt.all();

  const columnExists = columns.some((col: any) => col.name === column);

  if (!columnExists) {
    db.run(`ALTER TABLE ${table} ADD COLUMN ${column} ${columnDef}`);
  }
}
```

### Indexing Strategy

Comprehensive indexing for query performance:

- **Primary Keys**: SHA-based for commits, auto-increment for others
- **Foreign Keys**: Cascading deletes to maintain referential integrity
- **Composite Indexes**: Multi-column indexes for common query patterns
- **Unique Constraints**: Prevent duplicate data where appropriate

### Connection Management

Singleton database manager with lazy initialization:

```
Application Start → getDatabaseManager() → initialize() → load/create DB file
                                                                 ↓
                                                            run migrations
                                                                 ↓
                                                       audit schema gaps
                                                                 ↓
                                                         return connection
```

## Key Concepts

### Statement Wrapper Pattern

All database access must go through the statement wrapper:

```typescript
// ✅ Correct usage
const stmt = prepare('SELECT * FROM commits WHERE sha = ?');
const commit = stmt.get(commitSha);
stmt.finalize();

// ❌ Incorrect - never use db.prepare() directly
const stmt = db.prepare('SELECT * FROM commits WHERE sha = ?');
```

### Modular Schema Design

Independent schema modules allow for:

- **Incremental Development**: Add new features without affecting existing schema
- **Version Management**: Per-module versioning and migration tracking
- **Safe Deployments**: Modules can be migrated independently
- **Clear Boundaries**: Each module has well-defined responsibilities

### Migration Safety

Migrations follow strict safety rules:

- **Additive Only**: Never remove columns or tables
- **Backward Compatible**: Old code continues to work with new schema
- **Idempotent**: Can be run multiple times safely
- **Transactional**: All-or-nothing migration execution

### Embedding Storage Strategy

Multi-tier embedding storage:

1. **SQLite**: Structured metadata and basic search
2. **Qdrant**: High-performance vector similarity search
3. **Caching**: In-memory caching for frequently accessed embeddings

## Dependencies

- **sql.js**: SQLite WASM implementation
- **@qdrant/js-client-rest**: Qdrant vector database client
- **utils/**: Configuration, logging, path utilities

## Usage Examples

### Basic Database Operations

```typescript
import { prepare } from './storage/statement-wrapper';

// Insert commit metadata
const insertStmt = prepare(`
  INSERT INTO commits_metadata (sha, author, date, message, loaded_at)
  VALUES (?, ?, ?, ?, ?)
`);
insertStmt.run(sha, author, date, message, new Date().toISOString());
insertStmt.finalize();

// Query with parameters
const selectStmt = prepare('SELECT * FROM commits_metadata WHERE sha = ?');
const commit = selectStmt.get(commitSha);
selectStmt.finalize();
```

### Migration Execution

```typescript
import { migrateDatabase, auditAllModules } from './storage/schema';
import { getDatabase } from './storage/database';

// Run migrations on startup
const db = getDatabase();
await migrateDatabase(db);

// Check for schema issues
const gaps = auditAllModules(db);
if (gaps.length > 0) {
  console.warn('Schema gaps found:', gaps);
}
```

### Vector Search

```typescript
import { QdrantClient } from './storage/qdrantClient';

const qdrant = new QdrantClient('http://localhost:6333', apiKey);

// Store embeddings
await qdrant.storeEmbeddings('commits', embeddingPoints);

// Search similar commits
const similar = await qdrant.searchSimilar('commits', queryVector, 5);
```

## Performance Characteristics

- **Lazy Loading**: Database loaded only when needed
- **Prepared Statements**: Efficient query execution with parameter binding
- **Indexing**: Optimized indexes for common query patterns
- **Caching**: Application-level caching reduces database hits
- **Batch Operations**: Bulk inserts/updates for efficiency

## Error Handling

- **Connection Recovery**: Automatic reconnection on failure
- **Migration Safety**: Transactions prevent partial migration states
- **Data Validation**: Schema constraints prevent invalid data
- **Logging**: Comprehensive error logging for debugging

## Related Documentation

- [Services Module](services.md) - Business logic layer that uses storage
- [Analysis Module](analysis.md) - Analysis pipeline that stores results
- [Utils Module](utils.md) - Configuration and path utilities used by storage
