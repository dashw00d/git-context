# Implementation Plan: Git-Context-Deep Server Mode

## Overview

Add an optional HTTP server to the Git Context VS Code extension that exposes a "git-context-deep" mode via an OpenAI-compatible API. This mode provides deep code understanding by querying the extension's SQLite database and using LLM assimilation to answer questions about code evolution, refactoring patterns, and architectural changes.

**Key Principles:**
- ✅ Use existing data structures (`RefactorBundleFacts`, `CommitAnalysis`)
- ✅ Reuse existing LLM infrastructure (`LLMClient`, `LlmAnalyst`)
- ✅ Configuration-driven (no hardcoding)
- ✅ Optional feature (disabled by default)
- ✅ OpenAI-compatible API for external clients

## Architecture Overview

```
External Client (Kilo/Cursor/etc.)
    ↓ POST /v1/chat/completions
Express Server (optional)
    ↓ Parse model & control tags
    ├─→ model="git-context-deep": Deep Analysis
    │   ├─ Parse control tags ([deep_think], [fast])
    │   ├─ Extract goals & references
    │   ├─ Query SQLite database
    │   ├─ Build RefactorBundleFacts
    │   ├─ Multi-pass LLM assimilation
    │   └─ Return enriched response
    └─→ Other models: Pass-through to OpenRouter
```

---

## Phase 0: Dynamic Focus Extraction (Week 1)

**Core Principle:** Replace hardcoded focus areas with database-driven, dynamic extraction based on the actual codebase and user prompt.

### 0.1 File & Symbol Extractor

**Create:** `src/server/focusExtraction/promptAnalyzer.ts`

**Responsibilities:**
- Parse user prompt for explicit file references (e.g., "in `src/auth/Guard.ts`")
- Extract symbol/function names mentioned (e.g., "the `UserController` class")
- Identify keywords suggesting architectural areas (e.g., "authentication", "billing")
- Infer file patterns from context (e.g., "payment logic" → files with "payment", "billing", "stripe")

**Implementation:**
```typescript
interface ExtractedReferences {
  explicitFiles: string[];      // e.g., ["src/auth/Guard.ts"]
  symbols: string[];             // e.g., ["UserController", "authenticateUser"]
  keywords: string[];            // e.g., ["authentication", "billing"]
  inferredPatterns: string[];    // e.g., ["**/payment/**", "**/auth/**"]
}

export class PromptAnalyzer {
  private llmClient: LLMClient;

  constructor(llmClient: LLMClient) {
    this.llmClient = llmClient;
  }

  /**
   * Lightweight LLM call to extract references from user prompt
   */
  async extractReferences(userMessage: string): Promise<ExtractedReferences> {
    const prompt = `
Extract file paths, symbol names, and technical keywords from the user's message.
Return JSON with this structure:
{
  "explicitFiles": ["exact/file/paths.ts"],
  "symbols": ["ClassName", "functionName"],
  "keywords": ["technical", "terms"],
  "inferredPatterns": ["**/*pattern*/**"]
}

User message:
${userMessage}
`;

    const response = await this.llmClient.complete([
      { role: 'system', content: 'You are a precise code reference extractor. Output JSON only.' },
      { role: 'user', content: prompt }
    ], { jsonMode: true, maxTokens: 500, temperature: 0 });

    return JSON.parse(response);
  }
}
```

### 0.2 Database Context Fetcher

**Create:** `src/server/focusExtraction/contextFetcher.ts`

**Responsibilities:**
- Query `symbol_versions` table for symbolDNA data
- Fetch symbol metadata from live analysis if available
- Build context map of symbols → files → metadata

**Implementation:**
```typescript
interface SymbolContext {
  dnaId: string;
  name: string;
  kind: string;
  path: string;
  signatureHash: string;
  bodyHash: string;
  sha: string;
}

export class DatabaseContextFetcher {
  private dbManager: DatabaseManager;

  constructor(dbManager: DatabaseManager) {
    this.dbManager = dbManager;
  }

  /**
   * Fetch symbolDNA context for a list of files
   */
  async fetchSymbolContext(filePaths: string[]): Promise<Map<string, SymbolContext[]>> {
    const db = this.dbManager.getDatabase();
    const contextMap = new Map<string, SymbolContext[]>();

    for (const path of filePaths) {
      // Query symbol_versions for this file (prefer 'live' or latest SHA)
      const symbols = db.prepare(`
        SELECT dna_id, name, kind, path, signature_hash, body_hash, sha
        FROM symbol_versions
        WHERE path = ?
        ORDER BY
          CASE WHEN sha = 'live' THEN 0 ELSE 1 END,
          id DESC
      `).all(path) as SymbolContext[];

      if (symbols.length > 0) {
        contextMap.set(path, symbols);
      }
    }

    return contextMap;
  }

  /**
   * Fetch symbols by name (for symbol-based queries)
   */
  async fetchSymbolsByName(symbolNames: string[]): Promise<Map<string, SymbolContext[]>> {
    const db = this.dbManager.getDatabase();
    const symbolMap = new Map<string, SymbolContext[]>();

    for (const name of symbolNames) {
      const symbols = db.prepare(`
        SELECT dna_id, name, kind, path, signature_hash, body_hash, sha
        FROM symbol_versions
        WHERE name = ?
        ORDER BY
          CASE WHEN sha = 'live' THEN 0 ELSE 1 END,
          id DESC
        LIMIT 10
      `).all(name) as SymbolContext[];

      if (symbols.length > 0) {
        symbolMap.set(name, symbols);
      }
    }

    return symbolMap;
  }

  /**
   * Find files matching keywords/patterns
   */
  async findFilesByKeywords(keywords: string[]): Promise<string[]> {
    const db = this.dbManager.getDatabase();
    const likePatterns = keywords.map(k => `%${k}%`);

    const placeholders = likePatterns.map(() => 'path LIKE ?').join(' OR ');
    const files = db.prepare(`
      SELECT DISTINCT path FROM symbol_versions
      WHERE ${placeholders}
      LIMIT 50
    `).all(...likePatterns) as Array<{ path: string }>;

    return files.map(f => f.path);
  }
}
```

### 0.3 Direct File Scanner (Fallback)

**Create:** `src/server/focusExtraction/fileScanner.ts`

**Responsibilities:**
- Directly parse files not in database using existing `symbols.ts` extractor
- Extract symbol information for files without metadata
- Cache results in `symbol_versions` with `sha = 'live'`

**Implementation:**
```typescript
import { extractSymbols } from '../../analysis/symbols';
import { getDatabaseManager } from '../../storage/database';

export class DirectFileScanner {
  /**
   * Scan files directly if not in database
   */
  async scanFiles(filePaths: string[]): Promise<Map<string, SymbolContext[]>> {
    const contextMap = new Map<string, SymbolContext[]>();
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;

    if (!workspaceRoot) {
      return contextMap;
    }

    for (const relativePath of filePaths) {
      const absolutePath = path.join(workspaceRoot, relativePath);

      try {
        const content = await fs.readFile(absolutePath, 'utf-8');
        const symbols = await extractSymbols(content, relativePath);

        const symbolContexts: SymbolContext[] = symbols.map(sym => ({
          dnaId: crypto.randomUUID(), // Temporary ID
          name: sym.name,
          kind: sym.kind,
          path: relativePath,
          signatureHash: '',
          bodyHash: '',
          sha: 'live'
        }));

        contextMap.set(relativePath, symbolContexts);

      } catch (error) {
        logDebug(`[FileScanner] Failed to scan ${relativePath}: ${error}`);
      }
    }

    return contextMap;
  }
}
```

### 0.4 Focus Area Orchestrator

**Create:** `src/server/focusExtraction/orchestrator.ts`

**Responsibilities:**
- Coordinate the 4-step extraction process:
  1. Lightweight LLM extraction
  2. Database query
  3. Direct scan fallback
  4. Inference if no files mentioned

**Implementation:**
```typescript
export interface FocusContext {
  files: Map<string, SymbolContext[]>;  // File → symbols with DNA
  relevanceScore: Map<string, number>;   // File → relevance score
  totalSymbols: number;
  inferredDepth: 'minimal' | 'local' | 'cross' | 'architecture';
}

export class FocusExtractionOrchestrator {
  private promptAnalyzer: PromptAnalyzer;
  private contextFetcher: DatabaseContextFetcher;
  private fileScanner: DirectFileScanner;

  constructor(
    llmClient: LLMClient,
    dbManager: DatabaseManager
  ) {
    this.promptAnalyzer = new PromptAnalyzer(llmClient);
    this.contextFetcher = new DatabaseContextFetcher(dbManager);
    this.fileScanner = new DirectFileScanner();
  }

  /**
   * Main orchestration: Extract focus areas dynamically from prompt
   */
  async extractFocusContext(userMessage: string): Promise<FocusContext> {
    // Step 1: Extract references from prompt
    const refs = await this.promptAnalyzer.extractReferences(userMessage);
    logDebug(`[FocusExtraction] Extracted: ${refs.explicitFiles.length} files, ` +
             `${refs.symbols.length} symbols, ${refs.keywords.length} keywords`);

    // Step 2: Query database for known context
    const fileContext = await this.contextFetcher.fetchSymbolContext(refs.explicitFiles);
    const symbolContext = await this.contextFetcher.fetchSymbolsByName(refs.symbols);

    // Step 3: Find additional files by keywords
    const keywordFiles = await this.contextFetcher.findFilesByKeywords(refs.keywords);
    const keywordContext = await this.contextFetcher.fetchSymbolContext(keywordFiles);

    // Step 4: Direct scan for files not in DB
    const allFiles = new Set([
      ...refs.explicitFiles,
      ...Array.from(symbolContext.values()).flatMap(syms => syms.map(s => s.path)),
      ...keywordFiles
    ]);

    const missingFiles = Array.from(allFiles).filter(f =>
      !fileContext.has(f) && !keywordContext.has(f)
    );

    const scannedContext = await this.fileScanner.scanFiles(missingFiles);

    // Step 5: Merge all contexts
    const mergedContext = new Map<string, SymbolContext[]>([
      ...fileContext,
      ...keywordContext,
      ...scannedContext
    ]);

    // Step 6: Compute relevance scores
    const relevanceScore = new Map<string, number>();
    for (const [file, _] of mergedContext) {
      let score = 0;
      if (refs.explicitFiles.includes(file)) score += 10;
      if (refs.keywords.some(k => file.includes(k))) score += 5;
      relevanceScore.set(file, score);
    }

    // Step 7: Infer depth based on file count and keyword scope
    const inferredDepth = this.inferDepth(mergedContext.size, refs.keywords);

    const totalSymbols = Array.from(mergedContext.values())
      .reduce((sum, syms) => sum + syms.length, 0);

    logInfo(`[FocusExtraction] Built context: ${mergedContext.size} files, ` +
            `${totalSymbols} symbols, depth: ${inferredDepth}`);

    return {
      files: mergedContext,
      relevanceScore,
      totalSymbols,
      inferredDepth
    };
  }

  private inferDepth(fileCount: number, keywords: string[]): 'minimal' | 'local' | 'cross' | 'architecture' {
    const hasArchKeywords = keywords.some(k =>
      ['system', 'architecture', 'refactor', 'migration'].includes(k.toLowerCase())
    );

    if (hasArchKeywords || fileCount > 20) return 'architecture';
    if (fileCount > 5) return 'cross';
    if (fileCount > 1) return 'local';
    return 'minimal';
  }
}
```

### 0.5 Integration with Deep Analysis

**Modify:** `src/server/deepAnalysis/orchestrator.ts` (to be created in Phase 3)

The `DeepAnalysisOrchestrator` should call `FocusExtractionOrchestrator.extractFocusContext()` **before** running the database query or assimilation passes.

**Flow:**
```
User Prompt → FocusExtractionOrchestrator
  ↓
Extract files/symbols from prompt (LLM)
  ↓
Query database for symbolDNA context
  ↓
Direct scan files without metadata
  ↓
Build FocusContext (files + relevance scores)
  ↓
Pass to DeepAnalysisOrchestrator → DatabaseQueryBuilder
  ↓
Targeted queries based on actual context
```

---

## Phase 1: Server Infrastructure (Week 2)

### 1.1 Express Server Core

**Create:** `src/server/server.ts`

Main responsibilities:
- Express app with JSON body parser
- CORS middleware for external clients
- Route: `POST /v1/chat/completions` (OpenAI-compatible)
- Route: `GET /health` (server health check)
- Model-based routing logic
- Graceful start/stop methods

```typescript
export class GitContextServer {
  private app: Express;
  private server?: http.Server;
  private config: DeepServerConfig;

  constructor(
    private dbManager: DatabaseManager,
    private llmClient: LLMClient
  ) {}

  async start(port: number): Promise<void>
  async stop(): Promise<void>

  private handleChatCompletion(req, res): Promise<void>
  private handleHealth(req, res): void
}
```

**Request Flow:**
1. Parse incoming OpenAI-format request
2. Check `model` field: is it "git-context-deep"?
3. If yes → route to `DeepAnalysisOrchestrator`
4. If no → pass-through to existing `LLMClient`
5. Return OpenAI-compatible response

### 1.2 Extension Integration

**Modify:** `src/extension.ts`

In `activate()` function:
```typescript
// After database initialization
const config = getExtensionConfig();
if (config.deepServer?.enabled) {
  const server = new GitContextServer(
    getDatabaseManager(),
    getLLMClient()
  );

  await server.start(config.deepServer.port);
  context.subscriptions.push({
    dispose: () => server.stop()
  });

  logInfo(`[GitContext] Deep server started on port ${config.deepServer.port}`);
}
```

### 1.3 Configuration Schema

**Modify:** `package.json`

Add to `contributes.configuration.properties`:
```json
{
  "git-context.deepServer.enabled": {
    "type": "boolean",
    "default": false,
    "description": "Enable HTTP server for git-context-deep mode"
  },
  "git-context.deepServer.port": {
    "type": "number",
    "default": 3456,
    "description": "Port for the deep analysis server"
  },
  "git-context.deepServer.assimilationPasses": {
    "type": "number",
    "default": 3,
    "minimum": 1,
    "maximum": 5,
    "description": "Number of LLM passes for deep assimilation"
  },
  "git-context.deepServer.batchSize": {
    "type": "number",
    "default": 50,
    "description": "Symbols per batch during assimilation"
  },
  "git-context.deepServer.queryLimits": {
    "type": "object",
    "default": {
      "minimal": { "commits": 3, "symbols": 20, "edges": 10 },
      "local": { "commits": 5, "symbols": 50, "edges": 30 },
      "cross": { "commits": 20, "symbols": 200, "edges": 100 },
      "architecture": { "commits": 50, "symbols": 500, "edges": 300 }
    },
    "description": "Query limits by analysis depth"
  }
}
```

**Add dependencies:**
```json
{
  "dependencies": {
    "express": "^4.18.2",
    "cors": "^2.8.5"
  },
  "devDependencies": {
    "@types/express": "^4.17.17",
    "@types/cors": "^2.8.13"
  }
}
```

---

## Phase 2: Control Tags System (Week 3)

### 2.1 Tag Parser

**Create:** `src/server/controlTags/parser.ts`

**Supported Tags:**
- `[deep_think]` - Full multi-pass LLM assimilation
- `[deep_think:arch]` - Force architecture-level depth
- `[deep_think:local]` - Force local-level depth
- `[deep_scan]` - Extended database query depth
- `[fast]` - Minimal context, skip assimilation
- `[local_only]` - Single file scope only
- `[cross_file]` - Multi-file dependency analysis

```typescript
export interface ControlTags {
  deepThink?: boolean;
  deepScan?: boolean;
  fast?: boolean;
  localOnly?: boolean;
  forcedDepth?: 'minimal' | 'local' | 'cross' | 'architecture';
}

export function parseControlTags(messages: ChatMessage[]): {
  tags: ControlTags;
  cleanedMessages: ChatMessage[];
}
```

**Algorithm:**
1. Iterate through messages
2. Find tags with regex: `/\[(deep_think|deep_scan|fast|local_only|cross_file)(?::([^\]]+))?\]/gi`
3. Extract tag and optional argument
4. Remove tag from message content
5. Return cleaned messages + parsed tags

### 2.2 Goal Extraction

**Create:** `src/server/goalExtraction/analyzer.ts`

**Extract from messages:**
- Focus areas (via keyword matching against config)
- File references (regex: `/[A-Za-z0-9_\-/]+\.[a-zA-Z0-9]+/g`)
- SHA references (regex: `/\b[0-9a-f]{7,40}\b/gi`)
- Analysis depth (heuristic based on message length, keywords)

```typescript
export interface ExtractedGoal {
  question: string;           // User's question
  focusAreas: string[];       // ['auth', 'billing']
  fileReferences: string[];   // ['src/auth/login.ts']
  shaReferences: string[];    // ['a1b2c3d']
  depth: 'minimal' | 'local' | 'cross' | 'architecture';
  keywords: string[];         // Important terms
}

export class GoalAnalyzer {
  constructor(private config: DeepServerConfig) {}

  analyzeGoal(messages: ChatMessage[], tags: ControlTags): ExtractedGoal
}
```

**Depth Inference Logic:**
- If `tags.forcedDepth` exists → use it
- Else if message mentions "architecture", "flow", "system" → 'architecture'
- Else if message mentions "across files", "dependencies" → 'cross'
- Else if message > 800 chars → 'cross'
- Else if message > 200 chars → 'local'
- Else → 'minimal'

---

## Phase 3: Database Query & Fact Retrieval (Week 4)

### 3.1 Query Builder

**Create:** `src/server/factRetrieval/queryBuilder.ts`

**Multi-pronged query strategy:**

1. **Direct SHA queries:**
   ```sql
   SELECT * FROM commits_analysis WHERE sha IN (?)
   ```

2. **File-based queries:**
   ```sql
   SELECT DISTINCT sha FROM files WHERE path LIKE ? LIMIT ?
   ```

3. **Keyword-based queries:**
   ```sql
   SELECT sha FROM commits_metadata
   WHERE message LIKE ? OR message LIKE ?
   ORDER BY date DESC LIMIT ?
   ```

4. **Symbol queries:**
   ```sql
   SELECT * FROM symbols WHERE sha IN (?) AND path IN (?) LIMIT ?
   ```

5. **Edge queries:**
   ```sql
   SELECT * FROM edges WHERE sha IN (?) AND source_id IN (?) LIMIT ?
   ```

```typescript
export class DatabaseQueryBuilder {
  constructor(
    private db: DatabaseManager,
    private config: DeepServerConfig
  ) {}

  async queryRelevantCommits(goal: ExtractedGoal): Promise<string[]>
  async queryRelevantSymbols(shas: string[], goal: ExtractedGoal): Promise<SymbolInfo[]>
  async queryRelevantEdges(symbolIds: string[]): Promise<EdgeInfo[]>

  private getQueryLimits(depth: string): QueryLimits
}
```

**Configuration-based limits:**
```typescript
interface QueryLimits {
  maxCommits: number;
  maxSymbols: number;
  maxEdges: number;
}

// From config.deepServer.queryLimits[depth]
```

### 3.2 Facts Assembler

**Create:** `src/server/factRetrieval/assembler.ts`

**Converts database results to `RefactorBundleFacts`:**

```typescript
export class DeepFactsAssembler {
  assembleFacts(
    shas: string[],
    commits: CommitAnalysis[],
    symbols: SymbolInfo[],
    edges: EdgeInfo[],
    goal: ExtractedGoal
  ): RefactorBundleFacts {
    // Use existing RefactorBundleFacts structure
    return {
      version: '2.0',
      generated_at: new Date().toISOString(),
      bundle: {
        oldestSha: shas[shas.length - 1] || '',
        newestSha: shas[0] || '',
        shas
      },
      scope: {
        files: uniqueFiles.size,
        blastRadius: totalBlastRadius
      },
      intended: {
        present: symbolsAdded.length,
        absent: symbolsRemoved.length,
        renamed: renamedSymbols.length
      },
      working: {
        symbols: totalSymbols,
        edges: edges.length
      },
      findings: {
        incompleteness: { /* calculate from symbols */ },
        patternDrift: { /* analyze naming patterns */ },
        legacyAudit: { /* detect unused symbols */ }
      },
      evidence: {
        'scope.files': Array.from(uniqueFiles),
        'query.goal': goal,
        'query.depth': goal.depth,
        'symbols.sample': symbols.slice(0, 10)
      }
    };
  }
}
```

---

## Phase 4: Deep Assimilation Engine (Week 5)

### 4.1 Multi-Pass Assimilator

**Create:** `src/server/deepAnalysis/assimilator.ts`

**3-Pass Strategy:**

**Pass 1 - Overview (300 tokens max):**
```
Input: RefactorBundleFacts (high-level metrics)
Prompt: "Summarize this refactor: X commits, Y files, Z symbols changed"
Output: High-level story string
```

**Pass 2 - Symbol Analysis (batched, 50 symbols/batch):**
```
Input: Previous state + batch of symbols (name, kind, changes)
Prompt: "Given this state, analyze these symbols: [batch]"
Output: Updated state with symbol insights
```

**Pass 3 - Query Focus:**
```
Input: Accumulated state + user's specific question
Prompt: "Given context, answer: [user question]"
Output: Focused answer with evidence
```

```typescript
export interface AssimilationState {
  understanding: string;      // Accumulated from passes
  keyInsights: string[];
  passCount: number;
  totalTokens: number;
  facts: RefactorBundleFacts;
}

export class DeepAssimilator {
  constructor(
    private llmClient: LLMClient,
    private config: DeepServerConfig
  ) {}

  async assimilate(
    facts: RefactorBundleFacts,
    userQuery: string
  ): Promise<AssimilationState> {
    let state: AssimilationState = {
      understanding: '',
      keyInsights: [],
      passCount: 0,
      totalTokens: 0,
      facts
    };

    // Pass 1: Overview
    state = await this.overviewPass(state);

    // Pass 2: Symbol batches (if not fast mode)
    const batches = this.batchSymbols(facts, this.config.batchSize);
    for (const batch of batches.slice(0, 3)) { // Max 3 batches
      state = await this.symbolPass(state, batch);
    }

    // Pass 3: Focus on query
    state = await this.focusPass(state, userQuery);

    return state;
  }

  private async overviewPass(state: AssimilationState): Promise<AssimilationState>
  private async symbolPass(state: AssimilationState, batch: SymbolInfo[]): Promise<AssimilationState>
  private async focusPass(state: AssimilationState, query: string): Promise<AssimilationState>
}
```

### 4.2 Deep Analysis Orchestrator

**Create:** `src/server/deepAnalysis/orchestrator.ts`

**Main Pipeline:**

```typescript
export class DeepAnalysisOrchestrator {
  constructor(
    private dbManager: DatabaseManager,
    private llmClient: LLMClient,
    private config: DeepServerConfig
  ) {
    this.queryBuilder = new DatabaseQueryBuilder(dbManager, config);
    this.factsAssembler = new DeepFactsAssembler();
    this.assimilator = new DeepAssimilator(llmClient, config);
  }

  async handleDeepRequest(
    messages: ChatMessage[],
    options: any
  ): Promise<OpenAIResponse> {
    // 1. Parse control tags
    const { tags, cleanedMessages } = parseControlTags(messages);

    // 2. Extract goals
    const goalAnalyzer = new GoalAnalyzer(this.config);
    const goal = goalAnalyzer.analyzeGoal(cleanedMessages, tags);

    // 3. Query database
    const shas = await this.queryBuilder.queryRelevantCommits(goal);
    const symbols = await this.queryBuilder.queryRelevantSymbols(shas, goal);
    const edges = await this.queryBuilder.queryRelevantEdges(
      symbols.map(s => s.id)
    );

    // 4. Assemble facts
    const commits = await this.getCommitAnalyses(shas);
    const facts = this.factsAssembler.assembleFacts(shas, commits, symbols, edges, goal);

    // 5. Assimilate (skip if fast mode)
    let enrichedContext = '';
    if (!tags.fast) {
      const state = await this.assimilator.assimilate(facts, goal.question);
      enrichedContext = this.formatEnrichedContext(state);
    } else {
      enrichedContext = this.formatFactsOnly(facts);
    }

    // 6. Enrich messages with context
    const enrichedMessages = this.enrichMessages(cleanedMessages, enrichedContext);

    // 7. Call LLM
    const response = await this.llmClient.complete(enrichedMessages, {
      temperature: options.temperature ?? 0.2,
      maxTokens: options.max_tokens ?? 4096
    });

    // 8. Return OpenAI-compatible response
    return this.formatOpenAIResponse(response, facts, goal);
  }

  private enrichMessages(messages: ChatMessage[], context: string): ChatMessage[]
  private formatEnrichedContext(state: AssimilationState): string
  private formatFactsOnly(facts: RefactorBundleFacts): string
  private formatOpenAIResponse(llmResponse: string, facts: RefactorBundleFacts, goal: ExtractedGoal): OpenAIResponse
}
```

**Message Enrichment Strategy:**
```typescript
// Insert system message with context BEFORE last user message
messages = [
  ...previousMessages,
  {
    role: 'system',
    content: `# Codebase Context\n\n${enrichedContext}`
  },
  lastUserMessage
];
```

---

## Phase 5: Type Definitions

**Create:** `src/types/server.ts`

```typescript
export interface DeepServerConfig {
  enabled: boolean;
  port: number;
  assimilationPasses: number;
  batchSize: number;
  queryLimits: Record<string, QueryLimits>;
  focusAreas: Record<string, string[]>;
}

export interface QueryLimits {
  commits: number;
  symbols: number;
  edges: number;
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface OpenAIResponse {
  id: string;
  object: 'chat.completion';
  model: string;
  created: number;
  choices: Array<{
    index: number;
    message: ChatMessage;
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number | null;
    completion_tokens: number | null;
    total_tokens: number | null;
  };
  metadata?: {
    depth: string;
    facts_analyzed: {
      commits: number;
      symbols: number;
      edges: number;
    };
    assimilation_passes: number;
  };
}
```

---

## Phase 6: Testing & Validation (Week 6)

### Unit Tests

**Create:** `src/server/__tests__/`

Test files:
- `controlTags.test.ts`: Tag parsing, depth inference
- `goalExtraction.test.ts`: Goal analysis, file/SHA extraction
- `queryBuilder.test.ts`: Database query construction
- `assimilator.test.ts`: Multi-pass logic
- `orchestrator.test.ts`: End-to-end flow

### Integration Tests

**Sample request:**
```typescript
const response = await axios.post('http://localhost:3456/v1/chat/completions', {
  model: 'git-context-deep',
  messages: [
    { role: 'user', content: '[deep_think] Explain the auth flow' }
  ],
  temperature: 0.2
});

expect(response.data.choices[0].message.content).toContain('authentication');
expect(response.data.metadata.facts_analyzed.commits).toBeGreaterThan(0);
```

### Manual Testing Checklist

- [ ] Server starts when `deepServer.enabled` is true
- [ ] Server doesn't start when disabled
- [ ] Control tags are parsed correctly
- [ ] Tags are stripped from messages
- [ ] Goal extraction identifies files and SHAs
- [ ] Database queries return relevant data
- [ ] Facts assembly produces valid `RefactorBundleFacts`
- [ ] Assimilation passes complete without errors
- [ ] Response format matches OpenAI spec
- [ ] Pass-through mode works for non-deep models
- [ ] Server stops gracefully on extension deactivation

---

## API Contract

### Request Example
```json
POST http://localhost:3456/v1/chat/completions

{
  "model": "git-context-deep",
  "messages": [
    {
      "role": "user",
      "content": "[deep_think:arch] How did the authentication system evolve?"
    }
  ],
  "temperature": 0.2,
  "max_tokens": 4096
}
```

### Response Example
```json
{
  "id": "chatcmpl-abc123",
  "object": "chat.completion",
  "model": "git-context-deep",
  "created": 1234567890,
  "choices": [{
    "index": 0,
    "message": {
      "role": "assistant",
      "content": "Based on analysis of 25 commits across 8 files..."
    },
    "finish_reason": "stop"
  }],
  "usage": {
    "prompt_tokens": 2500,
    "completion_tokens": 800,
    "total_tokens": 3300
  },
  "metadata": {
    "depth": "architecture",
    "facts_analyzed": {
      "commits": 25,
      "symbols": 143,
      "edges": 67
    },
    "assimilation_passes": 3
  }
}
```

---

## File Structure

```
src/
├── server/
│   ├── server.ts                      # Express app & routing
│   ├── controlTags/
│   │   └── parser.ts                  # Tag parsing
│   ├── goalExtraction/
│   │   └── analyzer.ts                # Goal analysis
│   ├── factRetrieval/
│   │   ├── queryBuilder.ts            # Database queries
│   │   └── assembler.ts               # Facts assembly
│   ├── deepAnalysis/
│   │   ├── orchestrator.ts            # Main pipeline
│   │   └── assimilator.ts             # Multi-pass assimilation
│   └── __tests__/
│       ├── controlTags.test.ts
│       ├── goalExtraction.test.ts
│       ├── queryBuilder.test.ts
│       └── integration.test.ts
├── types/
│   └── server.ts                      # Type definitions
└── extension.ts                       # Modified (server lifecycle)
```

---

## Critical Files to Modify

1. **src/extension.ts** - Add server lifecycle integration
2. **package.json** - Configuration schema + dependencies
3. **src/llm/openrouter.ts** - Reuse existing LLM client
4. **src/storage/database.ts** - Reuse existing database manager
5. **src/facts/types.ts** - Reuse existing `RefactorBundleFacts`

---

## Security & Production Considerations

### Security Features
1. **Optional API Key Authentication**: Check `Authorization: Bearer <key>` header
2. **Rate Limiting**: 10 requests/minute per IP (configurable)
3. **Input Validation**: Message array validation, content length limits
4. **CORS**: Configurable allowed origins
5. **Error Handling**: No sensitive data in error responses

### Performance Optimizations
1. **Query Limits**: Prevent excessive database queries
2. **Batch Processing**: 50 symbols per batch default
3. **Token Budget**: Max 10K tokens total across passes
4. **Fast Mode**: Skip assimilation entirely
5. **Database Indexing**: Leverage existing indexes

### Monitoring & Logging
1. Log server start/stop events
2. Log request counts and depths
3. Track assimilation token usage
4. Monitor query performance
5. Alert on errors

---

## Example Usage Scenarios

### Scenario 1: Deep Authentication Analysis
```
User: [deep_think] How does authentication work across the codebase?

Flow:
1. Parse: deepThink=true
2. Extract: focusArea=['auth']
3. Query: 15 commits with 'auth' keywords, symbols in src/auth/*
4. Assimilate: 3 passes (overview → symbols → focused)
5. Response: Detailed explanation with commit evolution context
```

### Scenario 2: Quick File Explanation
```
User: [fast] What does src/billing/invoice.ts do?

Flow:
1. Parse: fast=true
2. Extract: fileReference=['src/billing/invoice.ts']
3. Query: 3 recent commits touching file, symbols in file
4. Skip assimilation (fast mode)
5. Response: Brief explanation with facts formatting
```

### Scenario 3: Cross-File Impact
```
User: [cross_file] What are all the callers of login()?

Flow:
1. Parse: crossFile=true → depth='cross'
2. Query: login symbol, edges (callers), cross-file dependencies
3. Assimilate: Focus on dependency graph
4. Response: List of callers with context from commits
```

---

## Implementation Timeline

**Week 1:** Server infrastructure + configuration
**Week 2:** Control tags + goal extraction
**Week 3:** Database queries + facts assembly
**Week 4:** Assimilation engine + orchestration
**Week 5:** Testing + documentation + polish

**Total: 5 weeks**
