### Comprehensive Implementation Plan for Live Change Tracker Feature

#### Executive Summary
**Goal**: Implement a live refactor detection system in the Commit Tracker VS Code extension. Track unsaved edits in real-time using `onDidChangeTextDocument`, buffer changes, compute change scores against configurable thresholds, and auto-trigger summary generation (facts assembly + LLM analysis + webview report) when thresholds are met. Integrate seamlessly with existing post-commit analysis without disrupting Git flow.

**Key Benefits**:
- Proactive UX: Detects refactors "in progress" before commit.
- Performance: Debounced, scoped to open files, incremental where possible.
- Extensible: Uses existing extractors (symbols.ts, difftastic.ts), factsAssembler.ts, llmAnalyst/runner.ts.
- Configurable: Thresholds via settings.json.

**Estimated Effort**: 5 days (as per roadmap), assuming familiarity with codebase.
- Day 1: Core tracking.
- Day 2: Enhanced parsing.
- Day 3: Auto-summary.
- Day 4: UX/sidebar.
- Day 5: Config, tests, polish.

**Assumptions from Codebase Scan**:
- Existing: `src/ui/commitTracker.ts` (likely TreeView provider), `src/analysis/symbols.ts` (SymbolExtractor), `src/analysis/difftastic.ts`, `src/facts/factsAssembler.ts`, `src/analysis/llmAnalyst/runner.ts`, `src/webview/refactorReportProvider.ts`.
- New: `src/liveTracker.ts` (modular class for tracking).
- Dependencies: Add `lodash` if not present (for debounce; check `package.json`).
- No conflicts: Feature is orthogonal to commit-based analysis (resets on save/commit).

**Risks & Mitigations**:
- Perf: Debounce + cap to 10 files.
- Tree-sitter incremental: Fallback to full parse.
- Dirty docs: Use `doc.isDirty` + `fs.readFileSync` for baseline.
- Reset: Listen to `onDidSaveTextDocument` + Git commit events.

**Success Metrics**:
- Edit > threshold → Notification + optional summary.
- Sidebar shows "Working Changes" node.
- No >5% CPU idle usage.

#### Step-by-Step Roadmap

##### 1. Setup Live Change Tracking (Core Listener) – `src/liveTracker.ts` (New File) & Integrate in `src/extension.ts`
   - Create `LiveDiffTracker` class: Buffers deltas per URI, debounces threshold checks.
   - Threshold: From config (`commitTracker.liveThreshold` – add later).
   - On threshold: Notify + optional generate.
   - Parse: Use existing `SymbolExtractor` from `src/analysis/symbols.ts`, `DependencyExtractor`? (from `src/analysis/dependencies.ts`).
   - Reset: On save (`onDidSaveTextDocument`), commit (via existing Git hooks in `src/cli/hooks.ts`?).
   - File watchers: For create/delete/rename (`workspace.createFileSystemWatcher`).

   **Suggested Code for New File**:
   ```typescript src/liveTracker.ts
   import * as vscode from 'vscode';
   import { debounce } from 'lodash'; // npm i lodash if missing
   import { SymbolExtractor } from '../analysis/symbols'; // Adjust import
   import { DependencyExtractor } from '../analysis/dependencies'; // If exists, else adapt
   // Import difftastic from '../analysis/difftastic';

   interface ThresholdConfig { lines: number; symbols: number; }

   export class LiveDiffTracker {
     private changeBuffers = new Map<string, vscode.TextDocumentContentChangeEvent[]>();
     private threshold: ThresholdConfig = { lines: 50, symbols: 5 };
     private disposables: vscode.Disposable[] = [];
     private symbolExtractor = new SymbolExtractor();
     // private depExtractor = new DependencyExtractor();

     constructor() {
       this.disposables.push(
         vscode.workspace.onDidChangeTextDocument(this.handleChange, this),
         vscode.workspace.onDidSaveTextDocument(this.resetBuffer, this),
         vscode.workspace.createFileSystemWatcher('**/*.{php,js,ts}') // Configurable patterns
       );
       this.updateThreshold();
       vscode.workspace.onDidChangeConfiguration((e) => {
         if (e.affectsConfiguration('commitTracker.liveThreshold')) this.updateThreshold();
       });
     }

     private updateThreshold() {
       const config = vscode.workspace.getConfiguration('commitTracker');
       this.threshold = config.get<ThresholdConfig>('liveThreshold', { lines: 50, symbols: 5 });
     }

     private handleChange(e: vscode.TextDocumentChangeEvent) {
       const uri = e.document.uri.toString();
       let buffer = this.changeBuffers.get(uri) || [];
       buffer.push(...e.contentChanges);
       this.changeBuffers.set(uri, buffer.slice(-1000)); // Cap buffer size
       this.debouncedCheck(uri);
     }

     private debouncedCheck = debounce(async (uri: string) => {
       const buffer = this.changeBuffers.get(uri);
       if (!buffer) return;

       const linesChanged = buffer.reduce((sum, c) => sum + (c.text.split('\n').length - 1), 0);
       if (linesChanged < this.threshold.lines) return;

       const doc = vscode.workspace.textDocuments.find(d => d.uri.toString() === uri);
       if (!doc) return;

       const { symbols, edges } = await this.parseLiveDiff(doc);
       if ((symbols?.length || 0) + (edges?.length || 0) < this.threshold.symbols) return;

       const choice = await vscode.window.showInformationMessage(
         'Refactor threshold reached. Generate live summary?', 'Yes', 'Later'
       );
       if (choice === 'Yes') await this.generateLiveSummary();
     }, 500);

     private async parseLiveDiff(doc: vscode.TextDocument) {
       const content = doc.getText();
       const path = doc.uri.fsPath;
       const symbols = this.symbolExtractor.extract(content, path);
       const edges = []; // TODO: depExtractor.extractDependencies(content, path, symbols);
       // const highlights = await getDifftasticHighlights(doc); // Step 2
       return { symbols, edges /*, highlights */ };
     }

     private async generateLiveSummary() {
       // Collect all
       const allChanges = Array.from(this.changeBuffers.values()).flat();
       // Trigger facts/analysis (Step 3)
       vscode.commands.executeCommand('commit-tracker.generateLiveReport', { liveChanges: allChanges });
       this.clearAllBuffers();
     }

     private resetBuffer(doc: vscode.TextDocument) {
       this.changeBuffers.delete(doc.uri.toString());
     }

     clearAllBuffers() { this.changeBuffers.clear(); }

     hasPendingChanges(): { files: number; progress: number } {
       const files = this.changeBuffers.size;
       // Compute progress logic here
       return { files, progress: 0 }; // Placeholder
     }

     dispose() {
       this.disposables.forEach(d => d.dispose());
       this.changeBuffers.clear();
     }
   }
   ```

   **Integration**:
   - In `src/extension.ts` (read to confirm activation):
     ```typescript src/extension.ts
     // In activate():
     const liveTracker = new LiveDiffTracker();
     // Export or store in context.subscriptions
     ```

##### 2. Enhance Parsing for Live Diffs – `src/analysis/symbols.ts`, `src/analysis/difftastic.ts`
   - Incremental symbols: Add `extractIncremental(prevSymbols, changes)`.
   - Difftastic: `getLiveHighlights(doc)` vs saved content.
   - Baseline: `fs.readFileSync(path)` if dirty.

   **Suggested Additions** (brief, as >20 lines use placeholders):
   ```typescript src/analysis/symbols.ts
   // Add method to existing SymbolExtractor class
   extractIncremental(prevSymbols: SymbolInfo[], changes: vscode.TextDocumentContentChangeEvent[], content: string, path: string): SymbolDelta {
     // Tree-sitter incremental if supported, else:
     const newSymbols = this.extract(content, path);
     return computeDeltas(prevSymbols, newSymbols); // Implement delta util
   }
   ```

   ```typescript src/analysis/difftastic.ts
   // Add:
   export async function getLiveHighlights(doc: vscode.TextDocument): Promise<any[]> {
     if (!doc.isDirty) return [];
     const path = doc.uri.fsPath;
     const savedContent = await vscode.workspace.fs.readFile(doc.uri); // Or fs.readFileSync(path)
     const liveContent = doc.getText();
     return runDifftastic(savedContent.toString(), liveContent, path);
   }
   ```

##### 3. Auto-Summary Generation – `src/facts/factsAssembler.ts`, `src/analysis/llmAnalyst/runner.ts`, New Command
   - Live mode: `assembleRefactorBundleFacts([], liveChanges)` → use working snapshot vs baseline.
   - Prompts: Tweak for "in-progress" (e.g., "Partial refactor: suggest completions").
   - Command: `commit-tracker.generateLiveReport`.

   **Suggested Changes**:
   ```typescript src/facts/factsAssembler.ts
   // In assembleRefactorBundleFacts(shas: string[], liveChanges?: any[])
   if (shas.length === 0 && liveChanges) {
     const baseline = await getBaselineFromHEAD(); // Use src/analysis/git.ts
     const working = await getWorkingSnapshot(); // Existing src/facts/workingSnapshot.ts
     return computeLiveFacts(baseline, working, liveChanges);
   }
   // ... existing
   ```

   - Register command in `src/extension.ts` or `src/ui/commands.ts`:
     ```typescript
     // Calls analyzeWithLlm(facts, {mode: 'live'}), then showReport({facts, analysis, mode: 'live'})
     ```

##### 4. Sidebar/UX Polish – `src/ui/commitTracker.ts`
   - Add "Working Changes" node if `liveTracker.hasPendingChanges()`.
   - Status bar: `window.createStatusBarItem`.
   - Webview: In `src/webview/refactorReportProvider.ts`, add `mode: 'live'` header.

   **Suggested Addition** (in TreeDataProvider `getChildren`):
   ```typescript src/ui/commitTracker.ts
   // Assume liveTracker injected
   if (this.liveTracker.hasPendingChanges().files > 0) {
     yield {
       id: 'working-changes',
       label: `Working Changes (${progress}%)`,
       description: `${files} files`,
       command: { command: 'commit-tracker.generateLiveSummary' }
     };
   }
   ```

##### 5. Config, Edge Cases, Testing
   - `package.json` contributes.configuration:
     ```json package.json
     {
       "commitTracker.liveThreshold": { "type": "object", "default": {"lines":50,"symbols":5} },
       "commitTracker.liveAutoSummary": { "type": "boolean", "default": true },
       "commitTracker.watchPatterns": { "type": "array", "default": ["**/*.php", "**/*.js"] }
     }
     ```
   - Edge: Large files → cap parse; multi-file → aggregate buffers.
   - Tests: Unit (tracker logic), Integration (edit file → notify).
   - Reset on commit: Hook into existing `src/cli/hooks.ts` or `onDidChangeGitRepository`.

#### Next Steps
- **Validate**: Review existing `src/extension.ts`, `src/ui/commitTracker.ts` for integration points (use `read_currently_open_file` if editing).
- **Prototype**: Implement Step 1 first.
- **Ready to Build?** Switch to **Agent mode** for write tools (e.g., create files, edit). Confirm with "Switch to Agent mode" or provide feedback.

Thoughts on refinements? E.g., dynamic thresholds via LLM?
- **Dynamic Thresholds**: Consider adding an LLM-powered threshold calculator that adjusts based on:
  - File complexity (cyclomatic complexity)
  - Team conventions (e.g., "never auto-summarize >1000 lines")
  - Historical patterns (e.g., "auto-summarize if >75% of recent changes were small")
- **Performance**: Profile the live parser to identify bottlenecks (e.g., regex patterns, AST traversals).
- **UX**: Add a "Force Summary" button for manual triggers when thresholds aren't met.
- **Testing**: Add property-based tests for edge cases (e.g., empty files, binary files).
- **LLM Integration**: Explore using Grok-4.1-fast to:
  - Generate commit messages from diffs
  - Suggest refactor opportunities
  - Explain complex changes in natural language
  - Validate configuration settings
  - Provide context-aware code suggestions
  - **Code Quality**: Integrate Grok-4.1-fast to:
  - Detect anti-patterns in real-time
  - Suggest architectural improvements
  - Enforce style guidelines
  - Identify potential security vulnerabilities
  - Provide code review feedback
