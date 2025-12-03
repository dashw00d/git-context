# Spacial Cockpit Features Guide

This document describes the semantic zoom, focus mode, and time travel features implemented in the Spacial Cockpit "Deep Editor" experience.

## Table of Contents

1. [Semantic Zoom Levels](#semantic-zoom-levels)
2. [Focus Mode](#focus-mode)
3. [PortalsRail Symbol Filtering](#portalsrail-symbol-filtering)
4. [Neighbors Navigation](#neighbors-navigation)
5. [Time Travel Features](#time-travel-features)
6. [Component Architecture](#component-architecture)

---

## Semantic Zoom Levels

The Deep Editor supports three zoom levels that provide different views of the code. Zoom level state is managed in `CodeMicroscope`:

```61:62:src/webview/cockpit/components/CodeMicroscope.tsx
  const [zoomLevel, setZoomLevel] = React.useState<'focus' | 'normal' | 'overview'>('focus');
  const [focusedSymbolId, setFocusedSymbolId] = React.useState<string | null>(null);
```

### Overview Mode (Level 0)

**Purpose**: Quickly scan a file's public API and health indicators.

**Implementation**: Overview mode renders `SignatureView` components in a scrollable container. The rendering logic is in `CodeMicroscope.tsx`:

```186:216:src/webview/cockpit/components/CodeMicroscope.tsx
          ) : zoomLevel === 'overview' ? (
            <div style={{ flex: 1, overflow: 'auto', padding: '12px' }}>
              {symbols.length > 0 ? (
                symbols.map((sym: any) => {
                  const symbolDriftIssues = driftIssues.filter(
                    (issue: any) => issue.symbol === sym.name
                  );
                  const hasDrift = symbolDriftIssues.length > 0;
                  return (
                    <SignatureView
                      key={sym.id || sym.name}
                      name={sym.name}
                      kind={sym.kind}
                      signature={sym.signature}
                      startLine={sym.location?.start?.line || sym.startLine || 0}
                      endLine={sym.location?.end?.line || sym.endLine || 0}
                      hasDrift={hasDrift}
                      riskScore={metrics?.riskScore}
                      onClick={() => {
                        setZoomLevel('focus');
                        setFocusedSymbolId(sym.id || sym.name);
                      }}
                    />
                  );
                })
              ) : (
                <div style={{ opacity: 0.5, textAlign: 'center', marginTop: '40px' }}>
                  No symbols found. Switch to Focus view.
                </div>
              )}
            </div>
```

**SignatureView Component**: The `SignatureView` component displays collapsed signatures:

```53:121:src/webview/cockpit/components/stages/SignatureView.tsx
export const SignatureView: React.FC<SignatureViewProps> = ({
  name,
  kind,
  signature,
  startLine,
  endLine,
  hasDrift,
  riskScore,
  onClick,
}) => {
  const lineCount = endLine - startLine + 1;

  // Format signature display
  const displaySignature = signature || `${kind} ${name}`;
  const signatureText =
    displaySignature.length > 80 ? displaySignature.substring(0, 80) + '...' : displaySignature;

  return (
    <div
      style={SignatureContainer}
      onClick={onClick}
      onMouseEnter={e => {
        e.currentTarget.style.backgroundColor = 'var(--vscode-list-hoverBackground)';
      }}
      onMouseLeave={e => {
        e.currentTarget.style.backgroundColor = 'var(--vscode-editor-inactiveSelectionBackground)';
      }}
      title={`${name} (${kind}) - ${lineCount} lines - Click to focus`}
    >
      <span style={CollapseIcon}>▶</span>
      <span style={SignatureText}>{signatureText}</span>
      <span style={KindBadge}>{kind}</span>
      {hasDrift && (
        <span
          style={{
            fontSize: '10px',
            color: 'var(--vscode-inputValidation-warningForeground)',
          }}
          title="Has drift warnings"
        >
          ⚠️
        </span>
      )}
      {riskScore !== undefined && riskScore > 40 && (
        <span
          style={{
            fontSize: '8px',
            width: '6px',
            height: '6px',
            borderRadius: '50%',
            backgroundColor:
              riskScore > 70 ? 'var(--vscode-charts-red)' : 'var(--vscode-charts-yellow)',
          }}
          title={`Risk: ${riskScore}`}
        />
      )}
      <span
        style={{
          fontSize: '10px',
          opacity: 0.5,
          minWidth: '40px',
          textAlign: 'right',
        }}
      >
        {lineCount} lines
      </span>
    </div>
  );
};
```

**Visual Behavior**:

- Shows only function/class signatures (collapsed bodies)
- Displays signatures in a compact list format
- Each signature shows:
  - Symbol name and kind (function, class, method, etc.)
  - Signature text (truncated to 80 characters if longer) - see line 67-68
  - Line count - see line 117
  - Drift warning indicator (⚠️) if present - see lines 85-95
  - Risk score indicator (colored dot) if risk > 40 - see lines 96-108

**How to Access**:

- Click the `-` button in the zoom controls (lines 145-150)
- Use Ctrl+Scroll down when in Normal or Focus mode (lines 64-78)
- Keyboard shortcut: Ctrl+Scroll

**Use Cases**:

- Understanding file structure at a glance
- Identifying files with drift or high risk
- Quick navigation to specific symbols

### Normal Mode (Level 1)

**Purpose**: Standard code view for reading and understanding code structure.

**Implementation**: Normal mode renders `SymbolBlock` components. The rendering logic is in `CodeMicroscope.tsx`:

```217:240:src/webview/cockpit/components/CodeMicroscope.tsx
          ) : (
            <div style={{ flex: 1, overflow: 'auto', padding: '20px' }}>
              {symbols.length > 0 ? (
                symbols.map((sym: any) => (
                  <SymbolBlock
                    key={sym.id || sym.name}
                    name={sym.name}
                    kind={sym.kind}
                    startLine={sym.location?.start?.line || sym.startLine || 0}
                    endLine={sym.location?.end?.line || sym.endLine || 0}
                    complexity={metrics?.complexity || 0} // Mock
                    onClick={() => {
                      setZoomLevel('focus');
                      setFocusedSymbolId(sym.id || sym.name);
                    }}
                  />
                ))
              ) : (
                <div style={{ opacity: 0.5, textAlign: 'center', marginTop: '40px' }}>
                  No symbols found. Switch to Focus view.
                </div>
              )}
            </div>
          )}
```

**Visual Behavior**:

- Shows `SymbolBlock` components with abstract representations
- Each block displays:
  - Symbol name and kind
  - Line count and complexity
  - Visual representation of code structure (abstract bars)
- Clicking a symbol block zooms to Focus mode for that symbol (lines 228-231)

**How to Access**:

- Click the `=` button in the zoom controls (lines 151-156)
- Use Ctrl+Scroll to navigate between zoom levels (lines 64-78)
- Default mode when first opening a file (line 61)

**Use Cases**:

- Getting an overview of code structure
- Understanding symbol relationships
- Preparing to dive into specific symbols

### Focus Mode (Level 2)

**Purpose**: Deep dive into a specific symbol with full code visibility.

**Implementation**: Focus mode renders the `CodeEditor` component with full code content. The rendering logic is in `CodeMicroscope.tsx`:

```173:185:src/webview/cockpit/components/CodeMicroscope.tsx
          {zoomLevel === 'focus' ? (
            <CodeEditor
              content={content}
              language={renderFrame.data?.language || 'text'}
              driftIssues={driftIssues}
              symbols={symbols}
              focusedSymbolId={focusedSymbolId}
              onSymbolClick={(symbolId: string) => setFocusedSymbolId(symbolId)}
              onClearFocus={() => setFocusedSymbolId(null)}
              lineCommits={lineCommits}
              orderedCommits={orderedCommits}
              currentCommitIndex={currentCommitIndex}
            />
```

**Visual Behavior**:

- Shows full code content in `CodeEditor`
- When a symbol is focused:
  - Focused symbol's lines render at 120% font size (see `CodeEditor.tsx` line 271)
  - All other lines dim to 50% opacity (see `CodeEditor.tsx` line 272)
  - Focused symbol automatically scrolls into view (see `CodeEditor.tsx` lines 184-192)
  - Clear Focus button appears at top of editor (see `CodeEditor.tsx` lines 205-238)
- Clicking on any symbol line focuses that symbol (see `CodeEditor.tsx` lines 283-286)
- Clicking outside symbols clears focus (see `CodeEditor.tsx` lines 198-203)

**Focus Detection Logic**: The `CodeEditor` determines if a line is focused:

```79:90:src/webview/cockpit/components/stages/CodeEditor.tsx
  // Find focused symbol's line range
  const focusedSymbol = focusedSymbolId
    ? symbols.find(s => (s.id || s.name) === focusedSymbolId)
    : null;
  const focusedStartLine = focusedSymbol?.location?.start?.line || 0;
  const focusedEndLine = focusedSymbol?.location?.end?.line || 0;

  // Check if a line is within focused symbol range
  const isLineFocused = (lineNumber: number): boolean => {
    if (!focusedSymbolId || !focusedSymbol) return false;
    return lineNumber >= focusedStartLine && lineNumber <= focusedEndLine;
  };
```

**How to Access**:

- Click the `+` button in the zoom controls (lines 157-162)
- Click on a symbol in Overview or Normal mode (lines 204-207, 228-231)
- Use Ctrl+Scroll up from Normal mode (lines 64-78)
- Click directly on a symbol's first line in the code editor (see `CodeEditor.tsx` lines 283-286)

**Use Cases**:

- Debugging a specific function
- Understanding symbol implementation details
- Focusing on code without distractions

---

## Focus Mode

Focus mode provides enhanced visibility and filtering when examining a specific symbol.

### Features

1. **Visual Emphasis**
   - Focused symbol: 120% font size, 100% opacity
   - Other symbols: 100% font size, 50% opacity
   - Smooth transitions when switching focus

   **Implementation**: Applied in `CodeEditor.tsx`:

   ```265:282:src/webview/cockpit/components/stages/CodeEditor.tsx
         return (
           <div
             key={i}
             data-line={lineNumber}
             style={{
               ...LineStyle,
               fontSize: isFocused ? '120%' : '100%',
               opacity: shouldHide ? 0.2 : focusedSymbolId ? (isFocused ? 1 : 0.5) : 1,
               display: shouldHide ? 'none' : 'flex',
               backgroundColor: hasDrift
                 ? severity === 'error'
                   ? 'rgba(255, 0, 0, 0.05)'
                   : 'rgba(255, 165, 0, 0.05)'
                 : 'transparent',
               cursor: symbolAtLine && onSymbolClick ? 'pointer' : 'default',
               transition: 'opacity 0.2s, font-size 0.2s',
               pointerEvents: shouldHide ? 'none' : 'auto',
             }}
   ```

2. **Auto-Scroll**
   - Automatically scrolls focused symbol to center of viewport
   - Uses smooth scrolling animation

   **Implementation**: Auto-scroll effect in `CodeEditor.tsx`:

   ```183:192:src/webview/cockpit/components/stages/CodeEditor.tsx
   // Scroll focused symbol into view on mount/update
   const editorRef = React.useRef<HTMLDivElement>(null);
   React.useEffect(() => {
     if (focusedSymbolId && focusedStartLine > 0 && editorRef.current) {
       const lineElement = editorRef.current.querySelector(`[data-line="${focusedStartLine}"]`);
       if (lineElement) {
         lineElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
       }
     }
   }, [focusedSymbolId, focusedStartLine]);
   ```

3. **Focus Management**
   - Click any symbol line to focus it
   - Click "Clear Focus" button to unfocus
   - Click outside symbol area to clear focus
   - Focus automatically clears when zooming out from Focus mode

   **Implementation**: Focus clearing on zoom out in `CodeMicroscope.tsx`:

   ```64:78:src/webview/cockpit/components/CodeMicroscope.tsx
   const handleWheel = (e: React.WheelEvent) => {
     if (e.ctrlKey) {
       if (e.deltaY > 0) {
         setZoomLevel(prev => {
           if (prev === 'focus') {
             setFocusedSymbolId(null); // Clear focus when zooming out
             return 'normal';
           }
           return 'overview';
         });
       } else {
         setZoomLevel(prev => (prev === 'overview' ? 'normal' : 'focus'));
       }
     }
   };
   ```

4. **Integration with PortalsRail**
   - When a symbol is focused, PortalsRail filters to show only references for that symbol
   - See [PortalsRail Symbol Filtering](#portalsrail-symbol-filtering) for details

### Focus Header

When a symbol is focused, a header appears at the top of the code editor showing:

- "Focused: [symbol name]"
- "Clear Focus" button

**Implementation**: Focus header in `CodeEditor.tsx`:

```205:238:src/webview/cockpit/components/stages/CodeEditor.tsx
      {focusedSymbolId && (
        <div
          style={{
            padding: '4px 12px',
            fontSize: '11px',
            backgroundColor: 'var(--vscode-editor-selectionBackground)',
            borderBottom: '1px solid var(--vscode-panel-border)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span>
            Focused: <strong>{focusedSymbol?.name || focusedSymbolId}</strong>
          </span>
          <button
            onClick={e => {
              e.stopPropagation();
              if (onClearFocus) onClearFocus();
            }}
            style={{
              fontSize: '10px',
              padding: '2px 6px',
              background: 'var(--vscode-button-background)',
              color: 'var(--vscode-button-foreground)',
              border: 'none',
              borderRadius: '3px',
              cursor: 'pointer',
            }}
          >
            Clear Focus
          </button>
        </div>
      )}
```

---

## PortalsRail Symbol Filtering

The PortalsRail (right sidebar) shows incoming and outgoing references, and can be filtered by focused symbol.

**Component Location**: `src/webview/cockpit/components/stages/PortalsRail.tsx`

**Props Passed from CodeMicroscope**:

```242:250:src/webview/cockpit/components/CodeMicroscope.tsx
          <PortalsRail
            incomingRefs={metrics?.incomingRefs}
            outgoingRefs={metrics?.outgoingRefs}
            blastRadius={blastRadius}
            focusedSymbolId={focusedSymbolId}
            currentFilePath={renderFrame.id}
            currentCommitIndex={currentCommitIndex}
            orderedCommits={orderedCommits}
          />
```

### Normal Behavior

- Shows all incoming references (files/symbols that reference the current file)
- Shows all outgoing references (files/symbols that the current file references)
- Groups references by folder name
- Displays count for each folder group

**Grouping Logic**: References are grouped by folder using `groupByFolder`:

```98:113:src/webview/cockpit/components/stages/PortalsRail.tsx
/**
 * Group references by folder
 */
function groupByFolder(references: any[]): Map<string, number> {
  const groups = new Map<string, number>();
  references.forEach(ref => {
    // Extract path from reference (could be "from" or "to" depending on direction)
    const refPath = ref.from || ref.to || '';
    if (refPath) {
      const filePath = refPath.split(':')[0]; // Remove symbol part if present
      const folder = extractFolderName(filePath);
      groups.set(folder, (groups.get(folder) || 0) + 1);
    }
  });
  return groups;
}
```

### Filtered Behavior (Focus Mode)

When a symbol is focused:

- **Incoming**: Shows only references where the target is the focused symbol
- **Outgoing**: Shows only references where the source is the focused symbol
- Header shows "Filtered: [symbol name]"
- Empty state message indicates "No references for [symbol name]" if none found

**Filtering Implementation**: Symbol filtering logic in `PortalsRail.tsx`:

```135:163:src/webview/cockpit/components/stages/PortalsRail.tsx
  if (focusedSymbolId && currentFilePath) {
    // Filter to only references involving the focused symbol
    filteredIncoming = (blastRadius?.incoming || []).filter(ref => {
      // Parse "to" path and symbol from reference
      // Format: "filePath:symbolId -> otherPath:otherSymbol (type)"
      const toMatch = ref.to?.match(/^(.+):(.+)$/);
      if (toMatch) {
        const [, toPath, toSymbol] = toMatch;
        return (
          toPath === currentFilePath &&
          (toSymbol === focusedSymbolId || toSymbol.includes(focusedSymbolId))
        );
      }
      return false;
    });

    filteredOutgoing = (blastRadius?.outgoing || []).filter(ref => {
      // Parse "from" path and symbol from reference
      const fromMatch = ref.from?.match(/^(.+):(.+)$/);
      if (fromMatch) {
        const [, fromPath, fromSymbol] = fromMatch;
        return (
          fromPath === currentFilePath &&
          (fromSymbol === focusedSymbolId || fromSymbol.includes(focusedSymbolId))
        );
      }
      return false;
    });
  }
```

**Filter Header Display**:

```171:181:src/webview/cockpit/components/stages/PortalsRail.tsx
      {focusedSymbolId && (
        <div
          style={{
            ...SectionHeader,
            backgroundColor: 'var(--vscode-editor-selectionBackground)',
            marginTop: '0',
          }}
        >
          Filtered: {focusedSymbolId}
        </div>
      )}
```

### Reference Format

References are parsed from the format: `filePath:symbolId -> otherPath:otherSymbol (type)`

The filtering logic:

- Matches file path to current file (line 144, 157)
- Matches symbol ID/name to focused symbol (line 145, 158)
- Supports partial matching for symbol names (line 145, 158)

### Time Travel Warning

When time travel is active (see [Time Travel Features](#time-travel-features)):

- A warning banner appears: "⚠️ Time travel active: References may differ"
- Indicates that shown references are current state and may not have existed at the selected commit time

**Warning Banner Implementation**:

```182:196:src/webview/cockpit/components/stages/PortalsRail.tsx
      {isTimeTravelActive && (
        <div
          style={{
            ...SectionHeader,
            backgroundColor: 'var(--vscode-inputValidation-warningBackground)',
            color: 'var(--vscode-inputValidation-warningForeground)',
            fontSize: '9px',
            padding: '6px 10px',
            marginTop: '0',
          }}
          title="References shown are current state. They may not have existed at the selected commit time."
        >
          ⚠️ Time travel active: References may differ
        </div>
      )}
```

---

## Neighbors Navigation

The StageHeader displays sibling files (files in the same directory) for quick navigation.

**Component Location**: `src/webview/cockpit/components/stages/StageHeader.tsx`

**Props Passed from CodeMicroscope**:

```124:132:src/webview/cockpit/components/CodeMicroscope.tsx
        <StageHeader
          fileName={renderFrame.name}
          filePath={renderFrame.id}
          metrics={metrics}
          onNavigate={() => onZoomOut()}
          explorerData={cockpitState?.explorerData}
          bundleFacts={cockpitState?.bundleFacts}
          onNeighborClick={handleNeighborClick}
        />
```

### Visual Display

- Appears below the file name in the header
- Shows up to 6 sibling files as clickable buttons
- Format: "Neighbors: [File1.ts] [File2.ts] [File3.ts] ..."
- Buttons styled as secondary buttons with hover effects

**Rendering Implementation**:

```139:182:src/webview/cockpit/components/stages/StageHeader.tsx
          {siblings.length > 0 && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '10px',
                opacity: 0.7,
                flexWrap: 'wrap',
              }}
            >
              <span style={{ opacity: 0.5 }}>Neighbors:</span>
              {siblings.map(siblingPath => {
                const siblingName = path.basename(siblingPath);
                return (
                  <button
                    key={siblingPath}
                    onClick={() => onNeighborClick?.(siblingPath)}
                    style={{
                      fontSize: '10px',
                      padding: '2px 6px',
                      backgroundColor: 'var(--vscode-button-secondaryBackground)',
                      color: 'var(--vscode-button-secondaryForeground)',
                      border: '1px solid var(--vscode-button-border)',
                      borderRadius: '3px',
                      cursor: 'pointer',
                      transition: 'background-color 0.1s',
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.backgroundColor =
                        'var(--vscode-button-secondaryHoverBackground)';
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.backgroundColor =
                        'var(--vscode-button-secondaryBackground)';
                    }}
                    title={`Navigate to ${siblingName}`}
                  >
                    {siblingName}
                  </button>
                );
              })}
            </div>
          )}
```

### Finding Siblings

Sibling files are discovered from:

1. **Bundle Facts**: `bundleFacts.evidence['scope.files']` (primary source)
2. **Explorer Data**: Recursively searches `explorerData` tree for files in same directory

**Implementation**: The `findSiblingFiles` function in `StageHeader.tsx`:

```65:110:src/webview/cockpit/components/stages/StageHeader.tsx
/**
 * Find sibling files in the same directory
 */
function findSiblingFiles(
  currentFilePath: string,
  explorerData?: ExplorerNode[],
  bundleFacts?: any
): string[] {
  if (!currentFilePath) return [];

  const currentDir = path.dirname(currentFilePath);
  const siblings: string[] = [];

  // Try to get files from bundleFacts first
  if (bundleFacts?.evidence?.['scope.files']) {
    const files = bundleFacts.evidence['scope.files'] as string[];
    files.forEach(filePath => {
      if (filePath !== currentFilePath && path.dirname(filePath) === currentDir) {
        siblings.push(filePath);
      }
    });
  }

  // Also check explorerData
  if (explorerData && siblings.length < 5) {
    const collectFiles = (nodes: ExplorerNode[]): void => {
      for (const node of nodes) {
        if (node.type === 'file' && node.id) {
          const filePath = node.id;
          if (
            filePath !== currentFilePath &&
            path.dirname(filePath) === currentDir &&
            !siblings.includes(filePath)
          ) {
            siblings.push(filePath);
          }
        }
        if (node.children) {
          collectFiles(node.children);
        }
      }
    };
    collectFiles(explorerData);
  }

  // Limit to 6 siblings max
  return siblings.slice(0, 6);
}
```

**Matching Logic**:

- Extracts directory path using `path.dirname()` (line 75)
- Matches files where `path.dirname(filePath) === currentDir` (line 82, 96)
- Excludes the current file itself (line 82, 95)
- Limits to 6 files maximum (line 109)

**Memoization**: Sibling list is memoized for performance:

```110:113:src/webview/cockpit/components/stages/StageHeader.tsx
  const siblings = React.useMemo(
    () => (filePath ? findSiblingFiles(filePath, explorerData, bundleFacts) : []),
    [filePath, explorerData, bundleFacts]
  );
```

### Navigation Behavior

Clicking a neighbor file:

1. Creates a new `ContextFrame` with level 'file'
2. Sets status to 'scanning'
3. Sends `navigateToFrame` message to VS Code
4. Sends `analyzeFrame` message to trigger analysis
5. The new file loads in the Deep Editor

**Implementation**: Navigation handler in `CodeMicroscope.tsx`:

```108:120:src/webview/cockpit/components/CodeMicroscope.tsx
    const handleNeighborClick = (filePath: string) => {
      if (vscode) {
        const neighborFrame: ContextFrame = {
          level: 'file',
          id: filePath,
          name: filePath.split('/').pop() || filePath,
          status: 'scanning',
          parentId: frame.id,
        };
        vscode.postMessage({ type: 'navigateToFrame', frame: neighborFrame });
        vscode.postMessage({ type: 'analyzeFrame', frameId: filePath });
      }
    };
```

---

## Time Travel Features

Time travel allows viewing the file as it existed at a specific point in commit history.

**Component Location**: `src/webview/cockpit/components/stages/TimeScrubber.tsx`

**Integration in CodeMicroscope**:

```253:257:src/webview/cockpit/components/CodeMicroscope.tsx
        <TimeScrubber
          commits={commits}
          currentCommitIndex={currentCommitIndex}
          onCommitIndexChange={handleCommitIndexChange}
        />
```

**Commit Index Change Handler**:

```54:56:src/webview/cockpit/components/CodeMicroscope.tsx
  const handleCommitIndexChange = (index: number) => {
    vscode.postMessage({ type: 'updateCommitIndex', value: index });
  };
```

### Time Scrubber

The `TimeScrubber` component at the bottom of the editor provides:

- Slider to select commit index (0 = oldest, N = newest)
- Play/pause button to step through commits
- Display of commit message and date
- Current commit index indicator

**Commit Index**:

- Index in `orderedCommits` array (from `selectedCommitShas`)
- 0 = oldest commit in selection
- N-1 = newest commit in selection
- `undefined` = show all commits (current state)

**Commit Data Preparation**: Commits are filtered and sorted in `CodeMicroscope.tsx`:

```87:100:src/webview/cockpit/components/CodeMicroscope.tsx
    // Build commits array for TimeScrubber from state commits
    const commits = (cockpitState?.commits || [])
      .filter(c => orderedCommits.includes(c.sha))
      .sort((a, b) => {
        const aIndex = orderedCommits.indexOf(a.sha);
        const bIndex = orderedCommits.indexOf(b.sha);
        return aIndex - bIndex;
      })
      .map(c => ({
        sha: c.sha,
        date: c.authoredAt,
        message: c.message,
        author: c.author,
      }));
```

### Hiding Lines After Selected Time

**Behavior**:

- Lines added after the selected commit are hidden (`display: 'none'`)
- Applied in both `CodeEditor` and `SedimentGutter`
- Uses `lineCommits` data to map each line to its commit
- Compares line's commit index with `currentCommitIndex`

**Implementation in CodeEditor**: Line hiding logic in `CodeEditor.tsx`:

```92:109:src/webview/cockpit/components/stages/CodeEditor.tsx
  // Map line numbers to commit indices for time travel
  const lineToCommitIndex = new Map<number, number>();
  if (lineCommits.length > 0 && orderedCommits.length > 0) {
    lineCommits.forEach(({ line, commitSha }) => {
      const commitIndex = orderedCommits.indexOf(commitSha);
      if (commitIndex >= 0) {
        lineToCommitIndex.set(line, commitIndex);
      }
    });
  }

  // Check if line should be hidden/faded based on time travel
  const isLineAfterTime = (lineNumber: number): boolean => {
    if (currentCommitIndex === undefined) return false;
    const lineCommitIndex = lineToCommitIndex.get(lineNumber);
    if (lineCommitIndex === undefined) return false; // Unknown lines are shown
    return lineCommitIndex > currentCommitIndex;
  };
```

**Line Rendering with Time Travel**:

```262:282:src/webview/cockpit/components/stages/CodeEditor.tsx
        const isAfterTime = isLineAfterTime(lineNumber);
        const shouldHide = isAfterTime && currentCommitIndex !== undefined;

        return (
          <div
            key={i}
            data-line={lineNumber}
            style={{
              ...LineStyle,
              fontSize: isFocused ? '120%' : '100%',
              opacity: shouldHide ? 0.2 : focusedSymbolId ? (isFocused ? 1 : 0.5) : 1,
              display: shouldHide ? 'none' : 'flex',
              backgroundColor: hasDrift
                ? severity === 'error'
                  ? 'rgba(255, 0, 0, 0.05)'
                  : 'rgba(255, 165, 0, 0.05)'
                : 'transparent',
              cursor: symbolAtLine && onSymbolClick ? 'pointer' : 'default',
              transition: 'opacity 0.2s, font-size 0.2s',
              pointerEvents: shouldHide ? 'none' : 'auto',
            }}
```

**Implementation in SedimentGutter**: Similar logic in `SedimentGutter.tsx`:

```26:35:src/webview/cockpit/components/stages/SedimentGutter.tsx
  // Create a map of line number to commit index
  const lineToCommitIndex = new Map<number, number>();
  if (lineCommits.length > 0 && orderedCommits.length > 0) {
    lineCommits.forEach(({ line, commitSha }) => {
      const commitIndex = orderedCommits.indexOf(commitSha);
      if (commitIndex >= 0) {
        lineToCommitIndex.set(line, commitIndex);
      }
    });
  }
```

```83:89:src/webview/cockpit/components/stages/SedimentGutter.tsx
  // Check if line should be hidden based on time travel
  const isLineAfterTime = (lineNumber: number): boolean => {
    if (currentCommitIndex === undefined) return false;
    const lineCommitIndex = lineToCommitIndex.get(lineNumber);
    if (lineCommitIndex === undefined) return false;
    return lineCommitIndex > currentCommitIndex;
  };
```

```93:109:src/webview/cockpit/components/stages/SedimentGutter.tsx
      {Array.from({ length: lineCount }).map((_, i) => {
        const lineNumber = i + 1;
        const isAfterTime = isLineAfterTime(lineNumber);
        return (
          <div
            key={i}
            style={{
              height: '20px',
              width: '100%',
              backgroundColor: getAgeColor(lineNumber),
              opacity: isAfterTime ? 0.2 : 0.6,
              display: isAfterTime && currentCommitIndex !== undefined ? 'none' : 'block',
            }}
            title={getLineTitle(lineNumber)}
          />
        );
      })}
```

**Edge Cases**:

- Lines with unknown commit info are shown (conservative approach) - see `CodeEditor.tsx` line 107, `SedimentGutter.tsx` line 87
- When `currentCommitIndex` is `undefined`, all lines are shown - see `CodeEditor.tsx` line 105, `SedimentGutter.tsx` line 85

### Filtering Drift Warnings by Time

**Behavior**:

- Only drift warnings that existed at or before the selected commit are shown
- Uses `useMemo` for performance optimization
- Filters based on:
  - Explicit line number (if `issue.line` is set)
  - Symbol location (if `issue.symbol` is set and symbol found)
  - Conservative fallback: show issue if no line/symbol info available

**Implementation**: Drift filtering with `useMemo` in `CodeEditor.tsx`:

```111:135:src/webview/cockpit/components/stages/CodeEditor.tsx
  // Filter drift issues based on time travel (only show issues that existed at selected commit)
  const filteredDriftIssues = React.useMemo(() => {
    if (currentCommitIndex === undefined) return driftIssues;

    return driftIssues.filter(issue => {
      // If issue has explicit line number, check if line existed at selected commit
      if (issue.line) {
        const lineCommitIndex = lineToCommitIndex.get(issue.line);
        if (lineCommitIndex === undefined) return true; // Unknown lines are shown
        return lineCommitIndex <= currentCommitIndex;
      }
      // If issue is associated with a symbol, check symbol's line
      if (issue.symbol) {
        const symbol = symbols.find(s => s.name === issue.symbol);
        if (symbol?.location?.start?.line) {
          const lineNum = symbol.location.start.line;
          const lineCommitIndex = lineToCommitIndex.get(lineNum);
          if (lineCommitIndex === undefined) return true;
          return lineCommitIndex <= currentCommitIndex;
        }
      }
      // If no line/symbol info, show the issue (conservative approach)
      return true;
    });
  }, [driftIssues, currentCommitIndex, lineToCommitIndex, symbols]);
```

**Filtered Issues Mapping**: Filtered issues are then mapped to line numbers:

```137:158:src/webview/cockpit/components/stages/CodeEditor.tsx
  // Map filtered drift issues to line numbers
  const driftByLine = new Map<number, DriftIssue[]>();
  filteredDriftIssues.forEach(issue => {
    // If issue has explicit line number, use it
    if (issue.line) {
      if (!driftByLine.has(issue.line)) {
        driftByLine.set(issue.line, []);
      }
      driftByLine.get(issue.line)!.push(issue);
    }
    // Otherwise, try to find symbol by name and use its location
    else if (issue.symbol) {
      const symbol = symbols.find(s => s.name === issue.symbol);
      if (symbol?.location?.start?.line) {
        const lineNum = symbol.location.start.line;
        if (!driftByLine.has(lineNum)) {
          driftByLine.set(lineNum, []);
        }
        driftByLine.get(lineNum)!.push(issue);
      }
    }
  });
```

### Historical Portal Connections

**Current Implementation**:

- Shows warning banner when time travel is active
- Message: "⚠️ Time travel active: References may differ"
- Indicates that references shown are current state, not historical

**Future Enhancement** (Advanced):

- Could query database for edge history
- Filter references based on when edges were created/removed
- Show only references that existed at selected commit time
- Requires historical edge tracking in database

---

## Component Architecture

### Component Hierarchy

```
CodeMicroscope
├── StageHeader
│   └── Neighbors Navigation
├── SedimentGutter (time travel aware)
├── CodeEditor (focus mode + time travel)
│   └── Focus Header (when symbol focused)
├── PortalsRail (symbol filtering + time travel warning)
└── TimeScrubber
```

### Key Props Flow

**CodeMicroscope → CodeEditor**:

- `content`, `symbols`, `driftIssues`
- `focusedSymbolId`, `onSymbolClick`, `onClearFocus`
- `lineCommits`, `orderedCommits`, `currentCommitIndex`

**CodeMicroscope → PortalsRail**:

- `blastRadius`, `focusedSymbolId`, `currentFilePath`
- `currentCommitIndex`, `orderedCommits`

**CodeMicroscope → SedimentGutter**:

- `lineCommits`, `orderedCommits`, `currentCommitIndex`

**CodeMicroscope → StageHeader**:

- `filePath`, `explorerData`, `bundleFacts`, `onNeighborClick`

### State Management

**Local State (CodeMicroscope)**:

- `zoomLevel`: 'focus' | 'normal' | 'overview'
- `focusedSymbolId`: string | null

**Redux State (CockpitState)**:

- `currentCommitIndex`: number | undefined
- `selectedCommitShas`: string[]
- `commits`: CommitInfo[]
- `explorerData`: ExplorerNode[]
- `bundleFacts`: BundleFactsDTO

### Data Sources

**Symbol Data**:

- From `renderFrame.data.symbols` (extracted by FrameAnalyzer Tier 1)
- Includes: `id`, `name`, `kind`, `signature`, `location`
- Extracted in `FrameAnalyzer.analyzeTier1()` - see `src/webview/cockpit/services/FrameAnalyzer.ts`
- Used in `CodeMicroscope.tsx` line 78

**Line Commit Data**:

- From `renderFrame.data.lineCommits` (fetched by FrameAnalyzer Tier 2)
- Format: `Array<{ line: number, commitSha: string, author: string, date: string }>`
- Fetched via `GitOperations.getFileBlame()` - see `src/analysis/git.ts`
- Implementation in `FrameAnalyzer.analyzeTier2()` - see `src/webview/cockpit/services/FrameAnalyzer.ts` lines 217-225
- Used in `CodeMicroscope.tsx` line 79

**Blast Radius Data**:

- From `renderFrame.data.blastRadius`
- Format: `{ incoming: any[], outgoing: any[] }`
- Contains reference information for PortalsRail
- Used in `CodeMicroscope.tsx` line 80

**Drift Issues**:

- From `renderFrame.data.drift`
- Format: `Array<{ type?, issue?, severity?, symbol?, line?, detail?, count? }>`
- Populated in `FrameAnalyzer.analyzeTier2()` - see `src/webview/cockpit/services/FrameAnalyzer.ts` lines 175-197
- Used in `CodeMicroscope.tsx` line 81

---

## Usage Examples

### Example 1: Exploring a File's Structure

1. Open a file in the Deep Editor
2. Use Ctrl+Scroll down (or click `-`) to enter Overview mode
3. See all function/class signatures at a glance
4. Click on a signature to zoom to Focus mode for that symbol
5. Read the full implementation with other code dimmed

### Example 2: Debugging a Specific Function

1. Open a file in Focus mode
2. Click on the function's first line to focus it
3. Function expands to 120%, rest of file dims
4. Check PortalsRail to see only references for this function
5. Use Time Scrubber to see how function changed over time

### Example 3: Time Travel Investigation

1. Open a file with drift warnings
2. Use Time Scrubber to go back to an earlier commit
3. Lines added after that commit are hidden
4. Drift warnings filter to show only issues that existed then
5. PortalsRail shows warning that references may differ

### Example 4: Quick Navigation

1. Open a file in Deep Editor
2. See "Neighbors" line in header showing sibling files
3. Click a neighbor file button
4. File loads and analysis begins automatically

---

## Keyboard Shortcuts

- **Ctrl+Scroll Down**: Zoom out (Focus → Normal → Overview)
- **Ctrl+Scroll Up**: Zoom in (Overview → Normal → Focus)
- **Click Symbol**: Focus that symbol (in Focus mode)
- **Click Outside**: Clear focus (in Focus mode)

---

## Performance Considerations

1. **Drift Filtering**: Uses `React.useMemo` to avoid recalculating on every render
2. **Line Commit Mapping**: Map created once per render, reused for all lines
3. **Symbol Filtering**: PortalsRail filtering happens in render, but lightweight
4. **Neighbors Discovery**: Uses `React.useMemo` to cache sibling file list

---

## Future Enhancements

1. **Historical Portal Connections**: Full edge history tracking and filtering
2. **Zoom Level Persistence**: Remember zoom level per file
3. **Focus History**: Navigate between previously focused symbols
4. **Keyboard Navigation**: Arrow keys to move between symbols in Overview mode
5. **Symbol Search**: Quick search/filter in Overview mode
6. **Time Travel Animations**: Smooth transitions when scrubbing through commits

---

## Troubleshooting

### Symbols Not Showing in Overview Mode

- Check that `renderFrame.data.symbols` is populated
- Verify FrameAnalyzer Tier 1 is extracting symbols correctly
- Ensure Tree-sitter parser is working for the file's language

### Focus Mode Not Working

- Verify `focusedSymbolId` state is being set
- Check that symbols have valid `location.start.line` and `location.end.line`
- Ensure `onSymbolClick` handler is connected

### Time Travel Not Hiding Lines

- Verify `lineCommits` data is available
- Check that `orderedCommits` matches commit SHAs in `lineCommits`
- Ensure `currentCommitIndex` is being set correctly

### Neighbors Not Showing

- Check that `bundleFacts.evidence['scope.files']` contains files
- Verify `explorerData` is populated
- Ensure file paths use consistent directory separators

---

## Data Fetching Implementation

### Line Commit Data (Git Blame)

Line-by-line commit information is fetched using `GitOperations.getFileBlame()`:

**Location**: `src/analysis/git.ts`

**Method Signature**:

```typescript
async getFileBlame(
  filePath: string
): Promise<Array<{ line: number; commitSha: string; author: string; date: string }>>
```

**Implementation**: Uses `git blame -l --line-porcelain` to get line-by-line commit information:

```765:830:src/analysis/git.ts
  async getFileBlame(
    filePath: string
  ): Promise<Array<{ line: number; commitSha: string; author: string; date: string }>> {
    try {
      const { stdout } = await this.spawnGit(['blame', '-l', '--line-porcelain', '--', filePath]);

      const lines = stdout.trim().split('\n');
      const result: Array<{ line: number; commitSha: string; author: string; date: string }> = [];
      let currentLineNumber = 1;
      let currentCommitSha = '';
      let currentAuthor = '';
      let currentDate = '';
      let inMetadata = false;

      for (const line of lines) {
        // Check if this is a header line: <commit-sha> <original-line> <final-line> <num-lines>
        const headerMatch = line.match(/^([0-9a-f]{40})\s+(\d+)\s+(\d+)\s+(\d+)$/);
        if (headerMatch) {
          // Save previous commit's data if we have it
          if (currentCommitSha && currentLineNumber > 0) {
            // We'll add this when we see the content line
          }
          currentCommitSha = headerMatch[1];
          currentLineNumber = parseInt(headerMatch[3], 10); // final-line is the current line number
          inMetadata = true;
          // Reset metadata
          currentAuthor = '';
          currentDate = '';
        } else if (inMetadata) {
          if (line.startsWith('author ')) {
            currentAuthor = line.substring(7).trim();
          } else if (line.startsWith('author-time ')) {
            const timestamp = parseInt(line.substring(12).trim(), 10);
            if (!isNaN(timestamp)) {
              currentDate = new Date(timestamp * 1000).toISOString();
            }
          } else if (line.startsWith('\t')) {
            // Content line starts with tab - this means we're done with metadata
            // Add the current line to results
            result.push({
              line: currentLineNumber,
              commitSha: currentCommitSha,
              author: currentAuthor,
              date: currentDate,
            });
            currentLineNumber++;
            inMetadata = false;
          }
        } else if (line.startsWith('\t')) {
          // Continuation of previous commit's lines (same commit, next line)
          result.push({
```

The method parses the `--line-porcelain` output format which includes metadata blocks followed by content lines.

**Integration**: Called in `FrameAnalyzer.analyzeTier2()`:

```217:225:src/webview/cockpit/services/FrameAnalyzer.ts
      // Fetch line-by-line commit information (blame)
      try {
        const { GitOperations } = require('../../../analysis/git');
        const gitOps = new GitOperations();
        const lineCommits = await gitOps.getFileBlame(targetPath);
        data.lineCommits = lineCommits;
      } catch (e) {
        logDebug(`FrameAnalyzer: Failed to get blame for ${frameId}: ${e}`);
      }
```

### Symbol Extraction

Symbols are extracted in `FrameAnalyzer.analyzeTier1()` using Tree-sitter parser. The implementation extracts hybrid facts and filters for symbol kinds (function, class, method, etc.).

**Location**: `src/webview/cockpit/services/FrameAnalyzer.ts`

## Related Documentation

- [Spacial Cockpit Plan](../plans/spacial-cockpit-plan.md) - Original plan document
- [Frame Analyzer](../services/FrameAnalyzer.ts) - Tiered analysis system implementation
