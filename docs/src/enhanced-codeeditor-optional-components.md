# Enhanced CodeEditor with Optional Components

This document describes the optional components added to the Enhanced CodeEditor implementation, specifically the `HoverInfoCard` and `ChangeSparkline` components.

## Overview

The optional components add rich hover interactions to symbols in the code editor, providing detailed information about symbol metrics, change history, and quick navigation actions.

## New Components

### 1. ChangeSparkline Component

**Location:** `src/webview/cockpit/components/stages/ChangeSparkline.tsx`

A visual sparkline component that displays change history over time for symbols.

#### Features

- **Visual Timeline**: Shows change frequency and impact over time
- **Color Coding**:
  - Green for added changes
  - Blue for modified changes
  - Red for removed changes
- **Impact Normalization**: Automatically normalizes impact scores for consistent visualization
- **Accessibility**: Uses SVG `<title>` elements for tooltips
- **Empty State**: Handles cases with no change data gracefully

#### Props

```typescript
interface ChangeSparklineProps {
  changes: ChangeInfo[];
  width?: number; // Default: 100
  height?: number; // Default: 20
}

interface ChangeInfo {
  date: string;
  type: 'added' | 'modified' | 'removed';
  impact?: number;
}
```

#### Usage

```tsx
<ChangeSparkline changes={recentChanges} width={100} height={20} />
```

### 2. HoverInfoCard Component

**Location:** `src/webview/cockpit/components/stages/HoverInfoCard.tsx`

A rich hover card that displays comprehensive symbol information when hovering over symbols in the code editor.

#### Features

- **Symbol Information**: Name, kind, line count, risk level
- **Change Visualization**: Integrated ChangeSparkline showing recent changes
- **Reference Counts**: Incoming and outgoing reference counts
- **Author Information**: Last modified date (formatted) and author
- **Commit History**: Last commit message (truncated if long)
- **Action Buttons**:
  - Go to Definition
  - Find References
- **Auto-Positioning**: Automatically adjusts position to stay within viewport
- **Close Button**: Manual dismiss option
- **Auto-Close**: Closes when mouse leaves the card

#### Props

```typescript
interface HoverInfoCardProps {
  symbol: SymbolInfo;
  metrics: SymbolMetrics;
  recentChanges: ChangeInfo[];
  position: { x: number; y: number };
  onClose: () => void;
  onGoToDefinition?: () => void;
  onFindReferences?: () => void;
}

interface SymbolInfo {
  id?: string;
  name: string;
  kind: string;
  location?: { start: { line: number }; end: { line: number } };
}

interface SymbolMetrics {
  riskScore: number;
  lastModified?: number;
  driftCount?: number;
  incomingRefs: number;
  outgoingRefs: number;
  authors?: string[];
  lineCount?: number;
  lastCommitMessage?: string;
}
```

#### Usage

```tsx
<HoverInfoCard
  symbol={symbol}
  metrics={metrics}
  recentChanges={recentChanges}
  position={{ x: 100, y: 100 }}
  onClose={() => setHoverCard(null)}
  onGoToDefinition={() => handleGoToDefinition()}
  onFindReferences={() => handleFindReferences()}
/>
```

## Integration Details

### CodeEditor Integration

**Location:** `src/webview/cockpit/components/stages/CodeEditor.tsx`

The hover card functionality is integrated into the CodeEditor component with the following features:

#### Hover State Management

- **Debounced Hover**: 500ms delay before showing the card to prevent flicker
- **State Management**: Uses React state to track active hover card
- **Timeout Cleanup**: Properly cleans up timeouts on unmount and mouse leave

#### Hover Handlers

- **SymbolHeaderBar**: Hover handlers attached to the SymbolHeaderBar container (line 595)
- **Code Lines**: Hover handlers attached to code line content (line 754)
- **Mouse Events**: `onMouseEnter` and `onMouseLeave` handlers manage hover state

#### Recent Changes Extraction

The `getRecentChangesForSymbol` function extracts change history from `lineCommits`:

- Filters commits that touched the symbol's lines
- Groups by commit SHA to avoid duplicates
- Returns last 10 changes sorted by date (newest first)
- Maps to `ChangeInfo` format for the sparkline

#### Metrics Assembly

Metrics are assembled from multiple sources:

- `metrics` prop (risk score, last modified, authors)
- `refCounts` from `useSymbolRefCounts` hook (incoming/outgoing refs)
- `analysisData.driftIssues` (drift count)
- `lineCommits` (last commit message)
- Symbol location (line count calculation)

### Hook: useSymbolRefCounts

**Location:** `src/webview/cockpit/hooks/useSymbolRefCounts.ts`

A custom hook that extracts per-symbol reference counts from bundle facts.

#### Features

- Parses edges from `bundleFacts.evidence['working.edges']`
- Handles both string format (`"from -> to (type)"`) and object format
- Returns Maps for efficient lookup:
  - `incoming`: symbolId → count of incoming references
  - `outgoing`: symbolId → count of outgoing references
- Filters by file path to only count references for symbols in the current file

#### Usage

```typescript
const refCounts = useSymbolRefCounts(bundleFacts, filePath);
const incomingRefs = refCounts.incoming.get(symbolId) || 0;
const outgoingRefs = refCounts.outgoing.get(symbolId) || 0;
```

## Data Flow

```
lineCommits (from props)
  ↓
getRecentChangesForSymbol()
  ↓
ChangeInfo[] → HoverInfoCard → ChangeSparkline

bundleFacts.evidence['working.edges']
  ↓
useSymbolRefCounts()
  ↓
SymbolRefCounts { incoming, outgoing }
  ↓
HoverInfoCard metrics

metrics prop + analysisData + refCounts
  ↓
SymbolMetrics
  ↓
HoverInfoCard
```

## User Experience

### Hover Interaction

1. User hovers over a symbol (in SymbolHeaderBar or code line)
2. After 500ms delay, hover card appears
3. Card shows:
   - Symbol name and kind
   - Risk level and line count
   - Change sparkline visualization
   - Reference counts
   - Last modified date and author
   - Last commit message
   - Action buttons
4. Card auto-positions to stay in viewport
5. Card closes when:
   - Mouse leaves the card
   - Close button is clicked
   - Action button is clicked

### Visual Design

- Uses VS Code theme colors for consistency
- Fixed positioning with z-index 1000
- Rounded corners and shadow for depth
- Compact layout optimized for information density
- Responsive to viewport boundaries

## Technical Details

### Performance Considerations

- **Debouncing**: 500ms delay prevents excessive hover card creation
- **Memoization**: `useSymbolRefCounts` uses `React.useMemo` for efficient edge parsing
- **Conditional Rendering**: Hover card only renders when `hoverCard` state is not null

### Type Safety

- All components are fully typed with TypeScript
- Interfaces defined for all props and data structures
- No `any` types used (except for edge parsing which handles multiple formats)

### Accessibility

- SVG elements use `<title>` tags for tooltips
- Button elements have proper titles
- Color coding is semantic (green/blue/red for change types)

## Files Modified

1. **CodeEditor.tsx**: Added hover state, handlers, and HoverInfoCard rendering
2. **ChangeSparkline.tsx**: New component (113 lines)
3. **HoverInfoCard.tsx**: New component (240 lines)
4. **useSymbolRefCounts.ts**: New hook (89 lines)
5. **CodeMicroscope.tsx**: Removed unused `lineCount` variable

## Dependencies

- React (for hooks and component lifecycle)
- VS Code theme variables (for styling consistency)
- Existing CodeEditor infrastructure (symbols, lineCommits, metrics)

## Future Enhancements

Potential improvements:

- Add keyboard navigation for hover cards
- Show more detailed commit information on click
- Add filtering/sorting options for change history
- Support for multiple symbols in one card (for related symbols)
- Export hover card data to clipboard
- Add tooltips for all metric values
