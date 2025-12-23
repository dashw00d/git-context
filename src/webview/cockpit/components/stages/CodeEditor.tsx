import * as React from 'react';
import { FileAnalysisData } from '../../hooks/useFileAnalysisData';
import { useSymbolRefCounts } from '../../hooks/useSymbolRefCounts';
import { HoverInfoCard } from './HoverInfoCard';
import { SymbolHeaderBar } from './SymbolHeaderBar';
import { logDebug } from '../../../../utils/logger';

interface DriftIssue {
  type?: string;
  issue?: string;
  severity?: 'warning' | 'error' | 'medium' | 'low';
  symbol?: string;
  detail?: string;
  line?: number;
  count?: number;
}

interface MovedBlock {
  symbolId: string;
  previousSymbolId: string;
  sourceVersion: string;
  destVersion: string;
  moveType: 'rename' | 'relocate' | 'refactor';
  sourceFile?: string;
  destFile?: string;
  sourceStartLine?: number;
  sourceEndLine?: number;
  destStartLine?: number;
  destEndLine?: number;
}

interface CodeEditorProps {
  content: string;
  language: string;
  driftLines?: number[];
  driftIssues?: DriftIssue[];
  symbols?: Array<{
    id?: string;
    name: string;
    kind?: string;
    location?: { start: { line: number }; end: { line: number } };
  }>;
  focusedSymbolId?: string | null;
  onSymbolClick?: (symbolId: string) => void;
  onClearFocus?: () => void;
  lineCommits?: Array<{ line: number; commitSha: string; author: string; date: string }>;
  orderedCommits?: string[];
  currentCommitIndex?: number;
  filePath?: string;
  bundleFacts?: any;
  movedBlocks?: MovedBlock[];
  showLineNumbers?: boolean;
  showAgeGutter?: boolean;
  showMovedGutter?: boolean;
  metrics?: {
    riskScore?: number;
    incomingRefs?: number;
    outgoingRefs?: number;
    lastModified?: number;
    authors?: string[];
  };
  analysisData: FileAnalysisData;
}

const EditorContainer: React.CSSProperties = {
  flex: 1,
  overflow: 'auto',
  backgroundColor: 'var(--vscode-editor-background)',
  fontFamily: 'var(--vscode-editor-font-family)',
  fontSize: '13px',
  lineHeight: '20px',
  padding: '0',
  color: 'var(--vscode-editor-foreground)',
};

const LineRowStyle: React.CSSProperties = {
  height: '20px',
  display: 'flex',
  alignItems: 'center',
  whiteSpace: 'pre',
  position: 'relative',
};

const LineNumberStyle: React.CSSProperties = {
  width: '40px',
  textAlign: 'right',
  paddingRight: '8px',
  fontSize: '11px',
  opacity: 0.5,
  flexShrink: 0,
  userSelect: 'none',
};

const AgeGutterStyle: React.CSSProperties = {
  width: '8px',
  flexShrink: 0,
};

const MovedGutterStyle: React.CSSProperties = {
  width: '8px',
  flexShrink: 0,
};

const ContentColumnStyle: React.CSSProperties = {
  flex: 1,
  paddingLeft: '8px',
  paddingRight: '8px',
  overflow: 'hidden',
};

const RefIndicatorStyle: React.CSSProperties = {
  width: '20px',
  textAlign: 'center',
  fontSize: '10px',
  opacity: 0.6,
  flexShrink: 0,
};

const DriftWarningStyle: React.CSSProperties = {
  position: 'absolute',
  right: '20px',
  fontSize: '10px',
  color: 'var(--vscode-inputValidation-warningForeground)',
  backgroundColor: 'var(--vscode-inputValidation-warningBackground)',
  padding: '1px 6px',
  borderRadius: '4px',
  pointerEvents: 'none',
  display: 'flex',
  alignItems: 'center',
  gap: '4px',
};

export const CodeEditor: React.FC<CodeEditorProps> = ({
  content,
  driftLines = [],
  driftIssues = [],
  symbols = [],
  focusedSymbolId,
  onSymbolClick,
  onClearFocus,
  lineCommits = [],
  orderedCommits = [],
  currentCommitIndex,
  filePath,
  bundleFacts,
  movedBlocks = [],
  showLineNumbers = true,
  showAgeGutter = true,
  showMovedGutter = true,
  metrics,
  analysisData,
}) => {
  const lines = content.split('\n');

  const refCounts = useSymbolRefCounts(bundleFacts, filePath || '');

  // Symbol collapse state
  const [collapsedSymbols, setCollapsedSymbols] = React.useState<Set<string>>(new Set());

  const toggleSymbolCollapse = (symbolId: string) => {
    setCollapsedSymbols(prev => {
      const next = new Set(prev);
      if (next.has(symbolId)) {
        next.delete(symbolId);
      } else {
        next.add(symbolId);
      }
      return next;
    });
  };

  // Hover card state
  const [hoverCard, setHoverCard] = React.useState<{
    symbol: {
      id?: string;
      name: string;
      kind?: string;
      location?: { start: { line: number }; end: { line: number } };
    };
    position: { x: number; y: number };
  } | null>(null);

  const hoverTimeoutRef = React.useRef<number>();

  const handleSymbolHover = (
    symbol: {
      id?: string;
      name: string;
      kind?: string;
      location?: { start: { line: number }; end: { line: number } };
    },
    event: React.MouseEvent
  ) => {
    // Debounce hover
    if (hoverTimeoutRef.current) {
      window.clearTimeout(hoverTimeoutRef.current);
    }
    hoverTimeoutRef.current = window.setTimeout(() => {
      setHoverCard({
        symbol,
        position: { x: event.clientX + 10, y: event.clientY + 10 },
      });
    }, 500); // 500ms delay
  };

  const handleSymbolLeave = () => {
    if (hoverTimeoutRef.current) {
      window.clearTimeout(hoverTimeoutRef.current);
    }
    setHoverCard(null);
  };

  // Generate recent changes for a symbol from lineCommits
  const getRecentChangesForSymbol = (symbol: {
    id?: string;
    name: string;
    location?: { start: { line: number }; end: { line: number } };
  }): Array<{
    date: string;
    type: 'added' | 'modified' | 'removed';
    impact?: number;
    commitSha?: string;
    author?: string;
    message?: string;
  }> => {
    if (!symbol.location) return [];
    const startLine = symbol.location.start.line;
    const endLine = symbol.location.end.line;

    // Get commits that touched this symbol's lines
    const relevantCommits = lineCommits.filter(lc => lc.line >= startLine && lc.line <= endLine);

    // Group by commit and create change info
    const commitMap = new Map<string, (typeof relevantCommits)[0]>();
    relevantCommits.forEach(lc => {
      if (!commitMap.has(lc.commitSha)) {
        commitMap.set(lc.commitSha, lc);
      }
    });

    return Array.from(commitMap.values())
      .slice(0, 10) // Last 10 changes
      .map(lc => ({
        date: lc.date,
        type: 'modified' as const,
        impact: 1,
        commitSha: lc.commitSha,
        author: lc.author,
      }))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  };

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

  // Map line numbers to commit indices for time travel
  const lineToCommitIndex = new Map<number, number>();
  if (lineCommits.length > 0 && orderedCommits.length > 0) {
    lineCommits.forEach(({ line, commitSha }) => {
      // Robust matching: Try exact match first, then prefix match
      let commitIndex = orderedCommits.indexOf(commitSha);

      if (commitIndex === -1) {
        commitIndex = orderedCommits.findIndex(
          sha => sha.startsWith(commitSha) || commitSha.startsWith(sha)
        );
      }

      if (commitIndex >= 0) {
        lineToCommitIndex.set(line, commitIndex);
      }
    });
  }

  // Get age color for a line (from SedimentGutter logic)
  const getAgeColor = (lineNumber: number): string => {
    if (!lineCommits.length || !orderedCommits.length || currentCommitIndex === undefined) {
      return 'var(--vscode-editor-lineHighlightBorder)';
    }

    const lineCommitIndex = lineToCommitIndex.get(lineNumber);
    if (lineCommitIndex === undefined) {
      return 'var(--vscode-editor-lineHighlightBorder)';
    }

    const commitsAgo = currentCommitIndex - lineCommitIndex;
    const totalCommits = orderedCommits.length;
    const ageRatio = totalCommits > 0 ? commitsAgo / totalCommits : 0;

    if (ageRatio < 0.2 || commitsAgo <= 0) {
      return 'var(--vscode-charts-green)'; // Recent
    }
    if (ageRatio < 0.5) {
      return 'var(--vscode-charts-blue)'; // Medium age
    }
    return 'var(--vscode-editor-lineHighlightBorder)'; // Old
  };

  // Check if line has a moved block
  const getMovedBlockOnLine = (lineNumber: number): MovedBlock | null => {
    return (
      movedBlocks.find(
        block =>
          block.destFile === filePath &&
          block.destStartLine !== undefined &&
          block.destEndLine !== undefined &&
          lineNumber >= block.destStartLine &&
          lineNumber <= block.destEndLine
      ) || null
    );
  };

  // Check if line should be hidden/faded based on time travel
  const isLineAfterTime = (lineNumber: number): boolean => {
    if (currentCommitIndex === undefined) return false;
    const lineCommitIndex = lineToCommitIndex.get(lineNumber);
    if (lineCommitIndex === undefined) return false; // Unknown lines are shown
    return lineCommitIndex > currentCommitIndex;
  };

  // Check if line is inside a collapsed symbol
  const isLineCollapsed = (lineNumber: number): boolean => {
    return symbols.some(s => {
      const symbolId = s.id || s.name;
      if (!collapsedSymbols.has(symbolId)) return false;
      const start = s.location?.start?.line || 0;
      const end = s.location?.end?.line || 0;
      // Line is inside collapsed symbol (but not the first line which shows the header)
      return lineNumber > start && lineNumber <= end;
    });
  };

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

  // Also include explicit driftLines
  driftLines.forEach(lineNum => {
    if (!driftByLine.has(lineNum)) {
      driftByLine.set(lineNum, [{ type: 'drift', severity: 'warning' }]);
    }
  });

  const getDriftMessage = (issues: DriftIssue[]): string => {
    if (issues.length === 0) return '';
    const firstIssue = issues[0];
    if (firstIssue.issue) return firstIssue.issue;
    if (firstIssue.detail) return firstIssue.detail;
    if (firstIssue.type === 'missing_symbols' && firstIssue.count) {
      return `${firstIssue.count} missing symbol${firstIssue.count !== 1 ? 's' : ''}`;
    }
    return 'Drift detected';
  };

  const getDriftSeverity = (issues: DriftIssue[]): 'warning' | 'error' => {
    const hasError = issues.some(i => i.severity === 'error');
    return hasError ? 'error' : 'warning';
  };

  // Scroll focused symbol into view on mount/update
  const editorRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    if (focusedSymbolId && focusedStartLine > 0 && editorRef.current) {
      // Try to find the header row first, then fall back to the line row
      const lineElement =
        editorRef.current.querySelector(`[data-line="${focusedStartLine}-header"]`) ||
        editorRef.current.querySelector(`[data-line="${focusedStartLine}"]`);

      if (lineElement) {
        lineElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [focusedSymbolId, focusedStartLine]);

  return (
    <div
      ref={editorRef}
      style={EditorContainer}
      onClick={e => {
        // Clear focus when clicking outside symbols
        if (e.target === e.currentTarget && onClearFocus) {
          onClearFocus();
        }
      }}
    >
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
      {lines.map((line, i) => {
        const lineNumber = i + 1;
        const lineDriftIssues = driftByLine.get(lineNumber) || [];
        const hasDrift = lineDriftIssues.length > 0;
        const severity = hasDrift ? getDriftSeverity(lineDriftIssues) : 'warning';
        const driftMessage = hasDrift ? getDriftMessage(lineDriftIssues) : '';
        const isFocused = isLineFocused(lineNumber);

        const warningStyle: React.CSSProperties = {
          ...DriftWarningStyle,
          color:
            severity === 'error'
              ? 'var(--vscode-inputValidation-errorForeground)'
              : 'var(--vscode-inputValidation-warningForeground)',
          backgroundColor:
            severity === 'error'
              ? 'var(--vscode-inputValidation-errorBackground)'
              : 'var(--vscode-inputValidation-warningBackground)',
        };

        // Check if this line starts a symbol (for click handling)
        const symbolAtLine = symbols.find(s => s.location?.start?.line === lineNumber);

        // Check if symbol is dead or legacy
        const isDeadSymbol =
          symbolAtLine &&
          (analysisData.deadSymbols.has(symbolAtLine.id || '') ||
            analysisData.deadSymbols.has(symbolAtLine.name));
        const isLegacySymbol =
          symbolAtLine &&
          (analysisData.legacySymbols.has(symbolAtLine.id || '') ||
            analysisData.legacySymbols.has(symbolAtLine.name));

        // Check for convention drift
        const driftIssue = symbolAtLine
          ? analysisData.driftIssues.find(
              d => d.symbolId === symbolAtLine.id || d.name === symbolAtLine.name
            )
          : null;

        // Check for unresolved callers
        const unresolvedCaller = symbolAtLine
          ? analysisData.unresolvedCallers.find(
              u => u.symbolId === symbolAtLine.id || u.name === symbolAtLine.name
            )
          : null;

        // Check for hotspots
        const hotspot = symbolAtLine
          ? analysisData.hotspots.find(h => h.symbolId === symbolAtLine.id || h.path === filePath)
          : analysisData.hotspots.find(h => h.path === filePath);

        // Find import drift on this line
        const importDriftOnLine = analysisData.importDriftIssues.find(i => i.line === lineNumber);

        // Check divergent
        const isDivergent =
          symbolAtLine &&
          (analysisData.divergentSymbols.has(symbolAtLine.id || '') ||
            analysisData.divergentSymbols.has(symbolAtLine.name));

        // Build tooltip for dead/legacy symbols and drift
        let symbolTooltip = '';
        if (isDeadSymbol) {
          symbolTooltip = 'Dead symbol – removed but still referenced';
        } else if (isLegacySymbol) {
          symbolTooltip = 'Legacy symbol – deprecated but still in use';
        }
        if (driftIssue) {
          symbolTooltip = symbolTooltip
            ? `${symbolTooltip}\nConvention drift: Should be ${driftIssue.suggestedName}`
            : `Convention drift: Should be ${driftIssue.suggestedName}`;
        }
        if (unresolvedCaller) {
          const callerText = `${unresolvedCaller.callerCount || 1} unresolved caller${(unresolvedCaller.callerCount || 1) !== 1 ? 's' : ''}`;
          symbolTooltip = symbolTooltip ? `${symbolTooltip}\n${callerText}` : callerText;
        }
        if (hotspot) {
          const hotspotText = `Hotspot score: ${hotspot.score.toFixed(1)}`;
          symbolTooltip = symbolTooltip ? `${symbolTooltip}\n${hotspotText}` : hotspotText;
        }

        // Skip rendering if line is collapsed
        if (isLineCollapsed(lineNumber)) {
          return null;
        }

        const movedBlockOnLine = getMovedBlockOnLine(lineNumber);
        const ageColor = getAgeColor(lineNumber);
        const lineIsAfterTime = isLineAfterTime(lineNumber);
        const lineShouldHide = lineIsAfterTime && currentCommitIndex !== undefined;

        // Get symbol ref counts - MUST use DNA hash (id), not name
        // refCounts Map keys are DNA hashes, so we can't fall back to name
        const symbolId = symbolAtLine?.id || '';
        if (!symbolId && symbolAtLine) {
          logDebug(`[CodeEditor] Symbol ${symbolAtLine.name} missing ID, cannot lookup refs`);
        }
        const incomingRefs = symbolId ? refCounts.incoming.get(symbolId) || 0 : 0;
        const outgoingRefs = symbolId ? refCounts.outgoing.get(symbolId) || 0 : 0;

        // Debug logging for successful lookups
        if (symbolId && (incomingRefs > 0 || outgoingRefs > 0)) {
          logDebug(
            `[CodeEditor] Symbol ${symbolAtLine?.name} (${symbolId}): ${incomingRefs} incoming, ${outgoingRefs} outgoing refs`
          );
        }

        // Get line commit info for age display
        const lineCommit = lineCommits.find(lc => lc.line === lineNumber);
        const lineCommitIndex = lineToCommitIndex.get(lineNumber);
        const commitsAgo =
          lineCommitIndex !== undefined && currentCommitIndex !== undefined
            ? currentCommitIndex - lineCommitIndex
            : null;
        const ageText =
          commitsAgo !== null && commitsAgo >= 0
            ? commitsAgo === 0
              ? 'now'
              : commitsAgo === 1
                ? '1c'
                : `${commitsAgo}c`
            : '';

        // Check if this is the first line of a symbol (show header)
        const isSymbolStart = symbolAtLine && symbolAtLine.location?.start?.line === lineNumber;
        const isCollapsed = symbolAtLine && collapsedSymbols.has(symbolId);

        return (
          <React.Fragment key={i}>
            {/* Symbol Header Bar (shown on first line of symbol) */}
            {isSymbolStart && symbolAtLine && (
              <div
                data-line={`${lineNumber}-header`}
                style={{
                  ...LineRowStyle,
                  height: 'auto',
                  minHeight: '24px',
                  padding: '2px 0',
                }}
              >
                {showLineNumbers && <div style={LineNumberStyle} />}
                {showAgeGutter && <div style={AgeGutterStyle} />}
                {showMovedGutter && <div style={MovedGutterStyle} />}
                <div
                  style={ContentColumnStyle}
                  onMouseEnter={symbolAtLine ? e => handleSymbolHover(symbolAtLine, e) : undefined}
                  onMouseLeave={symbolAtLine ? handleSymbolLeave : undefined}
                >
                  <SymbolHeaderBar
                    symbol={{
                      id: symbolAtLine.id,
                      name: symbolAtLine.name,
                      kind: symbolAtLine.kind || 'unknown',
                      location: symbolAtLine.location,
                    }}
                    incomingRefs={incomingRefs}
                    outgoingRefs={outgoingRefs}
                    riskScore={metrics?.riskScore}
                    lastModified={ageText}
                    author={lineCommit?.author}
                    isCollapsed={isCollapsed || false}
                    isDead={isDeadSymbol || false}
                    isLegacy={isLegacySymbol || false}
                    hasDrift={!!driftIssue}
                    onToggle={() => toggleSymbolCollapse(symbolId)}
                    onRefsClick={() => onSymbolClick?.(symbolId)}
                    onFocus={() => onSymbolClick?.(symbolId)}
                  />
                </div>
                <div style={RefIndicatorStyle}>
                  {incomingRefs + outgoingRefs > 0 && (
                    <span title={`${incomingRefs} incoming, ${outgoingRefs} outgoing refs`}>
                      {incomingRefs + outgoingRefs > 9 ? '9+' : incomingRefs + outgoingRefs}
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Collapsed symbol placeholder */}
            {isCollapsed && isSymbolStart && symbolAtLine && (
              <div
                data-line={`${lineNumber}-collapsed`}
                style={{
                  ...LineRowStyle,
                  paddingLeft: '40px',
                  opacity: 0.5,
                  fontStyle: 'italic',
                  fontSize: '11px',
                  color: 'var(--vscode-descriptionForeground)',
                }}
              >
                {showLineNumbers && <div style={LineNumberStyle} />}
                {showAgeGutter && <div style={AgeGutterStyle} />}
                {showMovedGutter && <div style={MovedGutterStyle} />}
                <div style={ContentColumnStyle}>
                  [
                  {(symbolAtLine.location?.end?.line || lineNumber) -
                    (symbolAtLine.location?.start?.line || lineNumber)}{' '}
                  lines hidden] – click ▼ to expand
                </div>
                <div style={RefIndicatorStyle} />
              </div>
            )}

            {/* Regular code line */}
            {!isCollapsed && (
              <div
                key={i}
                data-line={lineNumber}
                style={{
                  ...LineRowStyle,
                  fontSize: isFocused ? '120%' : '100%',
                  opacity: lineShouldHide
                    ? 0.2
                    : isDeadSymbol
                      ? 0.4
                      : focusedSymbolId
                        ? isFocused
                          ? 1
                          : 0.5
                        : 1,
                  display: lineShouldHide ? 'none' : 'flex',
                  backgroundColor:
                    hotspot && !lineShouldHide
                      ? `rgba(255, 165, 0, ${Math.min(0.15, hotspot.score / 100)})`
                      : hasDrift
                        ? severity === 'error'
                          ? 'rgba(255, 0, 0, 0.05)'
                          : 'rgba(255, 165, 0, 0.05)'
                        : 'transparent',
                  cursor: symbolAtLine && onSymbolClick ? 'pointer' : 'default',
                  transition: 'opacity 0.2s, font-size 0.2s',
                  pointerEvents: lineShouldHide ? 'none' : 'auto',
                  textDecoration: isDeadSymbol ? 'line-through' : 'none',
                  fontStyle: isDivergent && !lineShouldHide ? 'italic' : 'normal',
                  textDecorationLine: driftIssue && !lineShouldHide ? 'underline' : undefined,
                  textDecorationStyle: driftIssue && !lineShouldHide ? 'wavy' : undefined,
                  textDecorationColor:
                    driftIssue && !lineShouldHide
                      ? 'var(--vscode-inputValidation-warningBorder)'
                      : undefined,
                }}
                onClick={
                  symbolAtLine && onSymbolClick && !lineShouldHide
                    ? () => onSymbolClick(symbolAtLine.id || symbolAtLine.name)
                    : undefined
                }
                title={
                  lineShouldHide
                    ? `Line added after selected commit (hidden)`
                    : importDriftOnLine
                      ? `Import style: ${importDriftOnLine.style} (expected: ${analysisData.conventionInfo?.dominantImportStyle || 'unknown'})`
                      : isDivergent
                        ? 'Symbol diverged from expected state'
                        : symbolTooltip ||
                          (symbolAtLine
                            ? `Click to focus on ${symbolAtLine.name}`
                            : isFocused
                              ? 'Focused symbol'
                              : undefined)
                }
              >
                {/* Line Number Column */}
                {showLineNumbers && (
                  <div style={LineNumberStyle} title={`Line ${lineNumber}`}>
                    {' '}
                    {lineNumber}{' '}
                  </div>
                )}

                {/* Age/Sediment Column */}
                {showAgeGutter && (
                  <div
                    style={{
                      ...AgeGutterStyle,
                      backgroundColor: ageColor,
                      opacity: lineIsAfterTime ? 0.2 : 0.6,
                    }}
                    title={
                      lineCommit
                        ? `Modified ${ageText || 'unknown'} (${lineCommit.commitSha.substring(0, 8)})`
                        : `Line ${lineNumber}`
                    }
                  />
                )}

                {/* Moved Block Column */}
                {showMovedGutter && (
                  <div style={MovedGutterStyle}>
                    {movedBlockOnLine && (
                      <div
                        style={{
                          width: '3px',
                          height: '100%',
                          backgroundColor: 'var(--vscode-charts-purple)',
                          cursor: 'pointer',
                        }}
                        title={`Moved from ${movedBlockOnLine.sourceFile || movedBlockOnLine.sourceVersion} (${movedBlockOnLine.moveType})`}
                      />
                    )}
                  </div>
                )}

                {/* Content Column */}
                <div
                  style={ContentColumnStyle}
                  onMouseEnter={symbolAtLine ? e => handleSymbolHover(symbolAtLine, e) : undefined}
                  onMouseLeave={symbolAtLine ? handleSymbolLeave : undefined}
                >
                  {hasDrift && !lineShouldHide && (
                    <span style={warningStyle} title={driftMessage}>
                      <span>{severity === 'error' ? '❌' : '⚠️'}</span> {driftMessage || 'DRIFT'}
                    </span>
                  )}
                  {isDeadSymbol && !lineShouldHide && (
                    <span
                      style={{
                        fontSize: '12px',
                        marginRight: '4px',
                        opacity: 0.7,
                      }}
                      title={symbolTooltip}
                    >
                      👻
                    </span>
                  )}
                  {isLegacySymbol && !lineShouldHide && (
                    <span
                      style={{
                        fontSize: '12px',
                        marginRight: '4px',
                        opacity: 0.7,
                      }}
                      title={symbolTooltip}
                    >
                      ⚠️
                    </span>
                  )}
                  {unresolvedCaller && !lineShouldHide && (
                    <span
                      style={{
                        fontSize: '12px',
                        marginRight: '4px',
                        opacity: 0.7,
                      }}
                      title={symbolTooltip}
                    >
                      ❓
                    </span>
                  )}
                  {importDriftOnLine && !lineShouldHide && (
                    <span
                      style={{
                        fontSize: '12px',
                        marginRight: '4px',
                        opacity: 0.7,
                        color: 'var(--vscode-charts-blue)',
                      }}
                      title={`Import style: ${importDriftOnLine.style}`}
                    >
                      ↳
                    </span>
                  )}
                  {isDivergent && !lineShouldHide && (
                    <span
                      style={{
                        fontSize: '12px',
                        marginRight: '4px',
                        opacity: 0.7,
                      }}
                      title="Symbol diverged from expected state"
                    >
                      🔀
                    </span>
                  )}
                  {line}
                </div>

                {/* Reference Indicator Column */}
                <div style={RefIndicatorStyle}>
                  {symbolAtLine && incomingRefs + outgoingRefs > 0 && (
                    <span title={`${incomingRefs} incoming, ${outgoingRefs} outgoing refs`}>
                      {incomingRefs + outgoingRefs > 9 ? '9+' : incomingRefs + outgoingRefs}
                    </span>
                  )}
                </div>
              </div>
            )}
          </React.Fragment>
        );
      })}

      {/* Hover Info Card */}
      {hoverCard && (
        <HoverInfoCard
          symbol={{
            id: hoverCard.symbol.id,
            name: hoverCard.symbol.name,
            kind: hoverCard.symbol.kind || 'unknown',
            location: hoverCard.symbol.location,
          }}
          metrics={{
            riskScore: metrics?.riskScore || 0,
            lastModified: metrics?.lastModified,
            driftCount: analysisData.driftIssues.length,
            incomingRefs: refCounts.incoming.get(hoverCard.symbol.id || hoverCard.symbol.name) || 0,
            outgoingRefs: refCounts.outgoing.get(hoverCard.symbol.id || hoverCard.symbol.name) || 0,
            authors: metrics?.authors,
            lineCount: hoverCard.symbol.location
              ? hoverCard.symbol.location.end.line - hoverCard.symbol.location.start.line + 1
              : undefined,
            lastCommitMessage: lineCommits.find(
              lc =>
                lc.line >= (hoverCard.symbol.location?.start.line || 0) &&
                lc.line <= (hoverCard.symbol.location?.end.line || 0)
            )?.commitSha,
          }}
          recentChanges={getRecentChangesForSymbol(hoverCard.symbol)}
          position={hoverCard.position}
          onClose={() => setHoverCard(null)}
          onGoToDefinition={
            onSymbolClick
              ? () => {
                  onSymbolClick(hoverCard.symbol.id || hoverCard.symbol.name);
                  setHoverCard(null);
                }
              : undefined
          }
          onFindReferences={
            onSymbolClick
              ? () => {
                  onSymbolClick(hoverCard.symbol.id || hoverCard.symbol.name);
                  setHoverCard(null);
                }
              : undefined
          }
        />
      )}
    </div>
  );
};
