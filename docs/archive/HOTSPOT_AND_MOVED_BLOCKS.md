# Hotspot Detection and Moved Block Analysis

## Overview

This document describes two advanced analysis features in Git Context:

1. **Hotspot Detection**: Identifying files and symbols that change frequently, indicating potential code smell or architectural issues
2. **Moved Block Detection**: Tracking when code blocks are moved between files (refactoring detection)

Both features enhance the analysis pipeline by providing deeper insights into code evolution patterns and maintenance risks.

---

## Hotspot Detection

### Purpose

Hotspot detection identifies files and symbols that are changed frequently across commits. High-churn areas often indicate:

- **Code Smells**: Unstable or poorly designed code that requires constant fixes
- **Feature Centers**: Core business logic that evolves rapidly with requirements
- **Maintenance Burden**: Areas requiring extra attention during code review
- **Refactoring Candidates**: Code that might benefit from redesign or stabilization

### Implementation Location

Primary implementation: [src/analysis/hotspotDetector.ts](src/analysis/hotspotDetector.ts) (to be created)

Integration points:
- [src/analysis/pipeline.ts](src/analysis/pipeline.ts) - Call during commit analysis
- [src/storage/database.ts](src/storage/database.ts) - Store hotspot metrics
- [src/webview/Cockpit.tsx](src/webview/Cockpit.tsx) - Display hotspot visualizations

### Database Schema

```sql
-- Track file-level hotspots
CREATE TABLE file_hotspots (
    file_path TEXT PRIMARY KEY,
    total_commits INTEGER DEFAULT 0,           -- Total commits affecting this file
    total_changes INTEGER DEFAULT 0,           -- Total symbol changes in this file
    unique_authors INTEGER DEFAULT 0,          -- Number of different authors
    last_changed_sha TEXT,                     -- Most recent commit
    last_changed_date TEXT,                    -- Most recent change timestamp
    hotspot_score REAL DEFAULT 0.0,           -- Composite metric (0-100)
    first_seen_sha TEXT,                       -- First commit introducing this file
    risk_level TEXT,                           -- low | medium | high | critical

    FOREIGN KEY (last_changed_sha) REFERENCES commits_metadata(sha)
);

CREATE INDEX idx_file_hotspots_score ON file_hotspots(hotspot_score DESC);
CREATE INDEX idx_file_hotspots_risk ON file_hotspots(risk_level);

-- Track symbol-level hotspots
CREATE TABLE symbol_hotspots (
    symbol_id TEXT PRIMARY KEY,                -- Semantic symbol ID
    file_path TEXT NOT NULL,
    symbol_type TEXT NOT NULL,                 -- function | class | method | etc.
    symbol_name TEXT NOT NULL,
    total_modifications INTEGER DEFAULT 0,      -- Times this symbol was modified
    total_commits INTEGER DEFAULT 0,           -- Commits affecting this symbol
    last_change_type TEXT,                     -- added | modified | removed | renamed
    last_changed_sha TEXT,
    last_changed_date TEXT,
    hotspot_score REAL DEFAULT 0.0,
    risk_level TEXT,

    FOREIGN KEY (last_changed_sha) REFERENCES commits_metadata(sha)
);

CREATE INDEX idx_symbol_hotspots_score ON symbol_hotspots(hotspot_score DESC);
CREATE INDEX idx_symbol_hotspots_file ON symbol_hotspots(file_path);
CREATE INDEX idx_symbol_hotspots_type ON symbol_hotspots(symbol_type);

-- Track hotspot evolution over time (for trend analysis)
CREATE TABLE hotspot_snapshots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    snapshot_sha TEXT NOT NULL,                -- Commit when snapshot was taken
    snapshot_date TEXT NOT NULL,
    entity_type TEXT NOT NULL,                 -- file | symbol
    entity_id TEXT NOT NULL,                   -- file_path or symbol_id
    hotspot_score REAL NOT NULL,
    total_changes INTEGER NOT NULL,

    FOREIGN KEY (snapshot_sha) REFERENCES commits_metadata(sha)
);

CREATE INDEX idx_hotspot_snapshots_entity ON hotspot_snapshots(entity_type, entity_id);
CREATE INDEX idx_hotspot_snapshots_date ON hotspot_snapshots(snapshot_date);
```

### Hotspot Scoring Algorithm

The hotspot score is a composite metric (0-100) calculated from multiple factors:

```typescript
interface HotspotMetrics {
    commitFrequency: number;      // How often the entity changes
    recency: number;              // How recently it changed (decay factor)
    authorDiversity: number;      // How many different authors touched it
    changeIntensity: number;      // Average size/impact of changes
    temporalClustering: number;   // Are changes clustered in time or spread out?
}

function calculateHotspotScore(metrics: HotspotMetrics): number {
    // Weighted combination
    const weights = {
        commitFrequency: 0.35,     // Most important: how often it changes
        recency: 0.20,             // Recent changes matter more
        authorDiversity: 0.15,     // Multiple authors = coordination issues
        changeIntensity: 0.20,     // Large changes = higher risk
        temporalClustering: 0.10   // Burst changes = instability
    };

    const rawScore =
        metrics.commitFrequency * weights.commitFrequency +
        metrics.recency * weights.recency +
        metrics.authorDiversity * weights.authorDiversity +
        metrics.changeIntensity * weights.changeIntensity +
        metrics.temporalClustering * weights.temporalClustering;

    // Normalize to 0-100 and apply logarithmic scaling to prevent outliers
    return Math.min(100, Math.log10(1 + rawScore * 9) * 100);
}

function classifyRiskLevel(score: number): 'low' | 'medium' | 'high' | 'critical' {
    if (score >= 80) return 'critical';
    if (score >= 60) return 'high';
    if (score >= 40) return 'medium';
    return 'low';
}
```

### Integration with Analysis Pipeline

```typescript
// src/analysis/pipeline.ts

class AnalysisPipeline {
    async analyzeCommit(sha: string): Promise<AnalysisResult> {
        // ... existing analysis ...

        // Update hotspot metrics after symbol extraction
        await this.updateHotspots(sha, symbolChanges, fileChanges);

        return result;
    }

    private async updateHotspots(
        sha: string,
        symbolChanges: SymbolInfo[],
        fileChanges: FileChange[]
    ): Promise<void> {
        const detector = new HotspotDetector(this.db);

        // Update file-level hotspots
        for (const file of fileChanges) {
            await detector.updateFileHotspot(file.path, sha, symbolChanges);
        }

        // Update symbol-level hotspots
        for (const symbol of symbolChanges) {
            await detector.updateSymbolHotspot(symbol, sha);
        }

        // Optionally create snapshot for trend analysis
        if (this.shouldCreateSnapshot(sha)) {
            await detector.createSnapshot(sha);
        }
    }
}
```

### API Methods

```typescript
class HotspotDetector {
    constructor(private db: Database) {}

    // Update hotspot metrics for a file
    async updateFileHotspot(
        filePath: string,
        sha: string,
        symbolChanges: SymbolInfo[]
    ): Promise<void>;

    // Update hotspot metrics for a symbol
    async updateSymbolHotspot(
        symbol: SymbolInfo,
        sha: string
    ): Promise<void>;

    // Get top N hotspot files
    async getTopFileHotspots(limit: number = 20): Promise<FileHotspot[]>;

    // Get top N hotspot symbols
    async getTopSymbolHotspots(
        limit: number = 20,
        filterByFile?: string
    ): Promise<SymbolHotspot[]>;

    // Get hotspot trend over time
    async getHotspotTrend(
        entityType: 'file' | 'symbol',
        entityId: string,
        since?: Date
    ): Promise<HotspotSnapshot[]>;

    // Identify hotspot clusters (files that change together)
    async findHotspotClusters(): Promise<HotspotCluster[]>;

    // Create periodic snapshot for trend analysis
    async createSnapshot(sha: string): Promise<void>;
}
```

### UI Integration (Cockpit)

Add a new "Hotspots" tab to the Cockpit UI:

```tsx
// src/webview/Cockpit.tsx

function HotspotsTab() {
    const [fileHotspots, setFileHotspots] = useState<FileHotspot[]>([]);
    const [symbolHotspots, setSymbolHotspots] = useState<SymbolHotspot[]>([]);
    const [selectedEntity, setSelectedEntity] = useState<string | null>(null);

    return (
        <div className="hotspots-tab">
            <h2>Code Hotspots</h2>

            {/* File Hotspots */}
            <section>
                <h3>Top File Hotspots</h3>
                <HotspotHeatmap data={fileHotspots} type="file" />
                <HotspotTable
                    data={fileHotspots}
                    onSelect={setSelectedEntity}
                    columns={['path', 'score', 'commits', 'authors', 'risk']}
                />
            </section>

            {/* Symbol Hotspots */}
            <section>
                <h3>Top Symbol Hotspots</h3>
                <HotspotTable
                    data={symbolHotspots}
                    onSelect={setSelectedEntity}
                    columns={['name', 'type', 'score', 'modifications', 'risk']}
                />
            </section>

            {/* Trend Visualization */}
            {selectedEntity && (
                <section>
                    <h3>Hotspot Trend: {selectedEntity}</h3>
                    <HotspotTrendChart entityId={selectedEntity} />
                </section>
            )}
        </div>
    );
}
```

### Configuration

Add to VS Code settings:

```json
{
    "git-context.hotspots.enabled": true,
    "git-context.hotspots.snapshotInterval": 10,  // Create snapshot every N commits
    "git-context.hotspots.lookbackWindow": 180,   // Days to consider for scoring
    "git-context.hotspots.minimumCommits": 3,     // Minimum commits to qualify as hotspot
    "git-context.hotspots.scoreWeights": {
        "commitFrequency": 0.35,
        "recency": 0.20,
        "authorDiversity": 0.15,
        "changeIntensity": 0.20,
        "temporalClustering": 0.10
    }
}
```

---

## Moved Block Detection

### Purpose

Moved block detection identifies when code blocks are moved between files, which is a common refactoring pattern. This helps:

- **Track Code Migration**: Understand how code moves during refactoring
- **Preserve History**: Maintain symbol lineage across file moves
- **Reduce False Positives**: Avoid flagging moves as "added + deleted"
- **Refactoring Insight**: Identify architectural reorganization patterns

### Implementation Location

Primary implementation: [src/analysis/movedBlockDetector.ts](src/analysis/movedBlockDetector.ts) (to be created)

Integration points:
- [src/analysis/pipeline.ts](src/analysis/pipeline.ts) - Call after symbol extraction
- [src/analysis/tree-sitter.ts](src/analysis/tree-sitter.ts) - Extract code block hashes
- [src/storage/database.ts](src/storage/database.ts) - Store move relationships

### Database Schema

```sql
-- Track moved code blocks
CREATE TABLE moved_blocks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    commit_sha TEXT NOT NULL,

    -- Source location
    source_file TEXT NOT NULL,
    source_symbol_id TEXT,                     -- May be NULL for unattributed blocks
    source_start_line INTEGER NOT NULL,
    source_end_line INTEGER NOT NULL,
    source_content_hash TEXT NOT NULL,         -- Hash for similarity matching

    -- Destination location
    dest_file TEXT NOT NULL,
    dest_symbol_id TEXT,
    dest_start_line INTEGER NOT NULL,
    dest_end_line INTEGER NOT NULL,
    dest_content_hash TEXT NOT NULL,

    -- Move metadata
    similarity_score REAL NOT NULL,            -- 0.0-1.0 how similar the blocks are
    block_type TEXT NOT NULL,                  -- function | class | method | block
    move_reason TEXT,                          -- refactoring | extraction | consolidation
    line_count INTEGER NOT NULL,               -- Size of moved block

    FOREIGN KEY (commit_sha) REFERENCES commits_metadata(sha)
);

CREATE INDEX idx_moved_blocks_commit ON moved_blocks(commit_sha);
CREATE INDEX idx_moved_blocks_source ON moved_blocks(source_file, source_symbol_id);
CREATE INDEX idx_moved_blocks_dest ON moved_blocks(dest_file, dest_symbol_id);
CREATE INDEX idx_moved_blocks_hash ON moved_blocks(source_content_hash);

-- Track symbol lineage across moves
CREATE TABLE symbol_lineage (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    symbol_id TEXT NOT NULL,                   -- Current symbol ID
    previous_symbol_id TEXT NOT NULL,          -- Symbol ID before move
    commit_sha TEXT NOT NULL,                  -- When the move happened
    move_type TEXT NOT NULL,                   -- file_rename | block_move | symbol_rename

    FOREIGN KEY (commit_sha) REFERENCES commits_metadata(sha)
);

CREATE INDEX idx_symbol_lineage_current ON symbol_lineage(symbol_id);
CREATE INDEX idx_symbol_lineage_previous ON symbol_lineage(previous_symbol_id);
```

### Detection Algorithm

Moved block detection uses a multi-stage approach:

#### Stage 1: Content Hashing

```typescript
interface CodeBlock {
    file: string;
    symbolId?: string;
    startLine: number;
    endLine: number;
    content: string;
    normalizedHash: string;  // Hash with whitespace/comments removed
    structureHash: string;   // Hash of AST structure only
}

function extractCodeBlocks(file: FileChange, symbols: SymbolInfo[]): CodeBlock[] {
    const blocks: CodeBlock[] = [];

    // For each symbol, extract its code block
    for (const symbol of symbols) {
        const content = extractSymbolContent(file, symbol);
        blocks.push({
            file: file.path,
            symbolId: symbol.symbolId,
            startLine: symbol.startLine,
            endLine: symbol.endLine,
            content,
            normalizedHash: hashNormalized(content),
            structureHash: hashStructure(content)
        });
    }

    return blocks;
}

function hashNormalized(content: string): string {
    // Remove comments, whitespace, and normalize variable names
    const normalized = content
        .replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, '')  // Remove comments
        .replace(/\s+/g, ' ')                      // Normalize whitespace
        .trim();

    return createHash('sha256').update(normalized).digest('hex');
}

function hashStructure(content: string): string {
    // Parse with Tree-sitter and hash AST structure (ignore identifiers)
    const tree = parseCode(content);
    const structure = extractStructure(tree);
    return createHash('sha256').update(JSON.stringify(structure)).digest('hex');
}
```

#### Stage 2: Similarity Matching

```typescript
interface MoveCandidate {
    sourceBlock: CodeBlock;
    destBlock: CodeBlock;
    similarityScore: number;
}

function findMoveCandidates(
    deletedBlocks: CodeBlock[],
    addedBlocks: CodeBlock[]
): MoveCandidate[] {
    const candidates: MoveCandidate[] = [];

    for (const deleted of deletedBlocks) {
        for (const added of addedBlocks) {
            // Quick reject: different files must be involved
            if (deleted.file === added.file) continue;

            // Check exact hash match (perfect move)
            if (deleted.normalizedHash === added.normalizedHash) {
                candidates.push({
                    sourceBlock: deleted,
                    destBlock: added,
                    similarityScore: 1.0
                });
                continue;
            }

            // Check structure match (move with minor edits)
            if (deleted.structureHash === added.structureHash) {
                const similarity = calculateTextSimilarity(
                    deleted.content,
                    added.content
                );

                if (similarity >= 0.8) {
                    candidates.push({
                        sourceBlock: deleted,
                        destBlock: added,
                        similarityScore: similarity
                    });
                }
                continue;
            }

            // Fuzzy match for partial moves (expensive, use sparingly)
            const similarity = calculateLevenshteinSimilarity(
                deleted.normalizedHash,
                added.normalizedHash
            );

            if (similarity >= 0.85) {
                candidates.push({
                    sourceBlock: deleted,
                    destBlock: added,
                    similarityScore: similarity
                });
            }
        }
    }

    // Deduplicate: prefer highest similarity matches
    return deduplicateCandidates(candidates);
}

function calculateTextSimilarity(text1: string, text2: string): number {
    // Use diff-match-patch or similar for character-level similarity
    const dmp = new DiffMatchPatch();
    const diffs = dmp.diff_main(text1, text2);
    const levenshtein = dmp.diff_levenshtein(diffs);
    const maxLength = Math.max(text1.length, text2.length);

    return 1 - (levenshtein / maxLength);
}
```

#### Stage 3: Move Classification

```typescript
type MoveReason =
    | 'refactoring'      // Code reorganization
    | 'extraction'       // Extracting helper/utility
    | 'consolidation'    // Merging similar code
    | 'module_split'     // Splitting large files
    | 'unclear';         // Cannot determine

function classifyMoveReason(candidate: MoveCandidate): MoveReason {
    const { sourceBlock, destBlock } = candidate;

    // Extraction: moved to a utility/helper file
    if (isUtilityFile(destBlock.file) && !isUtilityFile(sourceBlock.file)) {
        return 'extraction';
    }

    // Consolidation: multiple similar blocks moved to same file
    if (hasMultipleMovesToSameFile(destBlock.file)) {
        return 'consolidation';
    }

    // Module split: moving from large file to new smaller file
    if (isNewFile(destBlock.file) && isLargeFile(sourceBlock.file)) {
        return 'module_split';
    }

    // Default: generic refactoring
    if (candidate.similarityScore >= 0.95) {
        return 'refactoring';
    }

    return 'unclear';
}

function isUtilityFile(filePath: string): boolean {
    const patterns = ['/utils/', '/helpers/', '/lib/', '/common/'];
    return patterns.some(p => filePath.includes(p));
}
```

### Integration with Analysis Pipeline

```typescript
// src/analysis/pipeline.ts

class AnalysisPipeline {
    async analyzeCommit(sha: string): Promise<AnalysisResult> {
        // ... existing analysis ...

        // Extract symbols first
        const symbolChanges = await this.extractSymbols(sha, fileChanges);

        // Detect moved blocks
        const movedBlocks = await this.detectMovedBlocks(
            sha,
            fileChanges,
            symbolChanges
        );

        // Update symbol change types based on moves
        this.reconcileMovesWithSymbols(symbolChanges, movedBlocks);

        // Store moved blocks
        await this.storeMovedBlocks(sha, movedBlocks);

        return result;
    }

    private async detectMovedBlocks(
        sha: string,
        fileChanges: FileChange[],
        symbolChanges: SymbolInfo[]
    ): Promise<MovedBlock[]> {
        const detector = new MovedBlockDetector(this.db);

        // Separate added vs deleted symbols
        const deletedSymbols = symbolChanges.filter(s =>
            s.changeType === 'removed'
        );
        const addedSymbols = symbolChanges.filter(s =>
            s.changeType === 'added'
        );

        // Extract code blocks for deleted/added symbols
        const deletedBlocks = detector.extractCodeBlocks(fileChanges, deletedSymbols);
        const addedBlocks = detector.extractCodeBlocks(fileChanges, addedSymbols);

        // Find move candidates
        const candidates = detector.findMoveCandidates(deletedBlocks, addedBlocks);

        // Classify and filter
        return candidates
            .filter(c => c.similarityScore >= 0.8)
            .map(c => ({
                commitSha: sha,
                sourceFile: c.sourceBlock.file,
                sourceSymbolId: c.sourceBlock.symbolId,
                sourceStartLine: c.sourceBlock.startLine,
                sourceEndLine: c.sourceBlock.endLine,
                sourceContentHash: c.sourceBlock.normalizedHash,
                destFile: c.destBlock.file,
                destSymbolId: c.destBlock.symbolId,
                destStartLine: c.destBlock.startLine,
                destEndLine: c.destBlock.endLine,
                destContentHash: c.destBlock.normalizedHash,
                similarityScore: c.similarityScore,
                blockType: detector.inferBlockType(c.sourceBlock),
                moveReason: detector.classifyMoveReason(c),
                lineCount: c.sourceBlock.endLine - c.sourceBlock.startLine + 1
            }));
    }

    private reconcileMovesWithSymbols(
        symbolChanges: SymbolInfo[],
        movedBlocks: MovedBlock[]
    ): void {
        // Update symbol change types from 'added'/'removed' to 'moved'
        for (const move of movedBlocks) {
            const sourceSymbol = symbolChanges.find(s =>
                s.symbolId === move.sourceSymbolId
            );
            const destSymbol = symbolChanges.find(s =>
                s.symbolId === move.destSymbolId
            );

            if (sourceSymbol && destSymbol) {
                sourceSymbol.changeType = 'moved';
                destSymbol.changeType = 'moved';
                sourceSymbol.movedTo = move.destSymbolId;
                destSymbol.movedFrom = move.sourceSymbolId;
            }
        }
    }
}
```

### API Methods

```typescript
class MovedBlockDetector {
    constructor(private db: Database) {}

    // Extract code blocks from file changes
    extractCodeBlocks(
        fileChanges: FileChange[],
        symbols: SymbolInfo[]
    ): CodeBlock[];

    // Find move candidates between deleted and added blocks
    findMoveCandidates(
        deletedBlocks: CodeBlock[],
        addedBlocks: CodeBlock[]
    ): MoveCandidate[];

    // Classify why a block was moved
    classifyMoveReason(candidate: MoveCandidate): MoveReason;

    // Get all moves for a commit
    async getMovedBlocks(sha: string): Promise<MovedBlock[]>;

    // Get symbol lineage (history of moves)
    async getSymbolLineage(symbolId: string): Promise<SymbolLineage[]>;

    // Find all moves involving a file
    async getFileMoves(filePath: string): Promise<MovedBlock[]>;

    // Infer block type from AST
    inferBlockType(block: CodeBlock): string;
}
```

### UI Integration

Display moved blocks in the commit detail view:

```tsx
// src/webview/CommitDetail.tsx

function MovedBlocksSection({ sha }: { sha: string }) {
    const [moves, setMoves] = useState<MovedBlock[]>([]);

    useEffect(() => {
        // Fetch moved blocks for this commit
        vscode.postMessage({ type: 'getMovedBlocks', sha });
    }, [sha]);

    if (moves.length === 0) return null;

    return (
        <section className="moved-blocks">
            <h3>Code Moves Detected ({moves.length})</h3>
            {moves.map(move => (
                <div key={move.id} className="move-item">
                    <div className="move-header">
                        <span className="block-type">{move.blockType}</span>
                        <span className="similarity">
                            {(move.similarityScore * 100).toFixed(0)}% match
                        </span>
                        <span className="reason">{move.moveReason}</span>
                    </div>

                    <div className="move-path">
                        <div className="source">
                            <strong>From:</strong> {move.sourceFile}:{move.sourceStartLine}
                        </div>
                        <div className="arrow">→</div>
                        <div className="dest">
                            <strong>To:</strong> {move.destFile}:{move.destStartLine}
                        </div>
                    </div>

                    <div className="move-stats">
                        {move.lineCount} lines moved
                    </div>
                </div>
            ))}
        </section>
    );
}
```

### Configuration

Add to VS Code settings:

```json
{
    "git-context.movedBlocks.enabled": true,
    "git-context.movedBlocks.minimumSimilarity": 0.8,     // 0.0-1.0
    "git-context.movedBlocks.minimumBlockSize": 5,        // Minimum lines to detect
    "git-context.movedBlocks.trackLineage": true,         // Track symbol history
    "git-context.movedBlocks.useStructuralHash": true,    // Use AST-based hashing
    "git-context.movedBlocks.maxCandidates": 100          // Limit comparisons
}
```

---

## Performance Considerations

### Hotspot Detection

- **Incremental Updates**: Only recalculate affected files/symbols per commit
- **Snapshot Throttling**: Create snapshots every N commits (configurable)
- **Score Caching**: Cache hotspot scores; invalidate on new commits
- **Lookback Window**: Limit historical data (e.g., last 180 days)

### Moved Block Detection

- **Early Rejection**: Use content hashes to quickly reject non-matches
- **Batch Processing**: Process all moves in a commit together
- **Size Filters**: Ignore tiny blocks (< 5 lines) to reduce candidates
- **Structure Hashing**: Use AST hashing to avoid expensive text comparison
- **Candidate Limits**: Cap maximum comparisons per commit

### Combined Optimization

```typescript
// Shared infrastructure for both features
class AnalysisOptimizer {
    private blockHashCache = new Map<string, string>();
    private hotspotScoreCache = new Map<string, number>();

    // Cache block hashes to avoid recomputation
    getCachedBlockHash(content: string): string {
        const key = content.substring(0, 100); // Quick key
        if (!this.blockHashCache.has(key)) {
            this.blockHashCache.set(key, hashNormalized(content));
        }
        return this.blockHashCache.get(key)!;
    }

    // Batch update hotspots to reduce DB writes
    async batchUpdateHotspots(updates: HotspotUpdate[]): Promise<void> {
        const db = this.db.getDatabase();
        const tx = db.prepare('BEGIN TRANSACTION');
        tx.run();

        try {
            for (const update of updates) {
                await this.applyHotspotUpdate(update);
            }
            db.prepare('COMMIT').run();
        } catch (error) {
            db.prepare('ROLLBACK').run();
            throw error;
        }
    }
}
```

---

## Testing Strategy

### Hotspot Detection Tests

```typescript
describe('HotspotDetector', () => {
    test('should calculate hotspot score correctly', () => {
        const metrics = {
            commitFrequency: 0.8,
            recency: 0.9,
            authorDiversity: 0.6,
            changeIntensity: 0.7,
            temporalClustering: 0.5
        };

        const score = calculateHotspotScore(metrics);
        expect(score).toBeGreaterThan(0);
        expect(score).toBeLessThanOrEqual(100);
    });

    test('should classify risk levels correctly', () => {
        expect(classifyRiskLevel(85)).toBe('critical');
        expect(classifyRiskLevel(65)).toBe('high');
        expect(classifyRiskLevel(45)).toBe('medium');
        expect(classifyRiskLevel(25)).toBe('low');
    });

    test('should update file hotspot incrementally', async () => {
        const detector = new HotspotDetector(db);
        await detector.updateFileHotspot('src/test.ts', 'sha1', []);
        await detector.updateFileHotspot('src/test.ts', 'sha2', []);

        const hotspot = await detector.getFileHotspot('src/test.ts');
        expect(hotspot.totalCommits).toBe(2);
    });
});
```

### Moved Block Detection Tests

```typescript
describe('MovedBlockDetector', () => {
    test('should detect exact move (100% similarity)', () => {
        const deleted = createCodeBlock('src/a.ts', 'function foo() { ... }');
        const added = createCodeBlock('src/b.ts', 'function foo() { ... }');

        const candidates = findMoveCandidates([deleted], [added]);
        expect(candidates).toHaveLength(1);
        expect(candidates[0].similarityScore).toBe(1.0);
    });

    test('should detect move with minor edits', () => {
        const deleted = createCodeBlock('src/a.ts', 'function foo(x) { return x + 1; }');
        const added = createCodeBlock('src/b.ts', 'function foo(x) { return x + 2; }');

        const candidates = findMoveCandidates([deleted], [added]);
        expect(candidates).toHaveLength(1);
        expect(candidates[0].similarityScore).toBeGreaterThan(0.8);
    });

    test('should classify move reason correctly', () => {
        const candidate = createMoveCandidate(
            'src/components/Button.tsx',
            'src/utils/helpers.ts'
        );

        const reason = classifyMoveReason(candidate);
        expect(reason).toBe('extraction');
    });

    test('should not detect moves within same file', () => {
        const deleted = createCodeBlock('src/a.ts', 'function foo() {}');
        const added = createCodeBlock('src/a.ts', 'function foo() {}');

        const candidates = findMoveCandidates([deleted], [added]);
        expect(candidates).toHaveLength(0);
    });
});
```

---

## Future Enhancements

### Hotspot Detection

1. **Predictive Hotspots**: Use ML to predict which files will become hotspots
2. **Team Hotspots**: Track which team members work on which hotspots
3. **Coupling Detection**: Identify files that always change together
4. **Hotspot Alerts**: Notify when a file crosses into "critical" territory
5. **Historical Comparison**: Compare current hotspots to previous periods

### Moved Block Detection

1. **Partial Moves**: Detect when part of a function is moved
2. **Cross-Branch Moves**: Track moves across different branches
3. **Rename Detection**: Detect renames in addition to moves
4. **Semantic Similarity**: Use LLM embeddings for semantic matching
5. **Refactoring Patterns**: Identify common refactoring patterns (e.g., Extract Method)

### Integration

1. **Risk Scoring**: Combine hotspot + moves + complexity for risk score
2. **Review Recommendations**: Suggest extra reviewers for hotspot changes
3. **CI/CD Integration**: Block PRs that modify critical hotspots without tests
4. **Dashboard**: Visualize hotspots and moves over time
5. **Automated Cleanup**: Suggest refactoring opportunities based on hotspot data

---

## References

- **Hotspot Analysis**: [Adam Tornhill - Your Code as a Crime Scene](https://www.adamtornhill.com/articles/crimescene/codeascrimescene.htm)
- **Code Churn**: [Microsoft Research - Code Churn Metrics](https://www.microsoft.com/en-us/research/publication/dont-touch-my-code-examining-the-effects-of-ownership-on-software-quality/)
- **Move Detection**: [Git's rename detection algorithm](https://git-scm.com/docs/git-diff#Documentation/git-diff.txt--M)
- **Structural Hashing**: [Tree-sitter documentation](https://tree-sitter.github.io/tree-sitter/)
- **Similarity Algorithms**: [Diff Match Patch](https://github.com/google/diff-match-patch)
