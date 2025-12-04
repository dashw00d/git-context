import * as React from 'react';

interface DriftIssue {
  type?: string;
  issue?: string;
  severity?: 'warning' | 'error' | 'medium' | 'low';
  symbol?: string;
  detail?: string;
  line?: number;
  count?: number;
}

interface CodeEditorProps {
  content: string;
  language: string;
  driftLines?: number[];
  driftIssues?: DriftIssue[];
  symbols?: Array<{
    id?: string;
    name: string;
    location?: { start: { line: number }; end: { line: number } };
  }>;
  focusedSymbolId?: string | null;
  onSymbolClick?: (symbolId: string) => void;
  onClearFocus?: () => void;
  lineCommits?: Array<{ line: number; commitSha: string; author: string; date: string }>;
  orderedCommits?: string[];
  currentCommitIndex?: number;
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

const LineStyle: React.CSSProperties = {
  height: '20px',
  paddingLeft: '12px',
  whiteSpace: 'pre',
  display: 'flex',
  alignItems: 'center',
  position: 'relative',
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
}) => {
  const lines = content.split('\n');

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
      const lineElement = editorRef.current.querySelector(`[data-line="${focusedStartLine}"]`);
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
            onClick={
              symbolAtLine && onSymbolClick && !shouldHide
                ? () => onSymbolClick(symbolAtLine.id || symbolAtLine.name)
                : undefined
            }
            title={
              shouldHide
                ? `Line added after selected commit (hidden)`
                : symbolAtLine
                  ? `Click to focus on ${symbolAtLine.name}`
                  : isFocused
                    ? 'Focused symbol'
                    : undefined
            }
          >
            {hasDrift && !shouldHide && (
              <span style={warningStyle} title={driftMessage}>
                <span>{severity === 'error' ? '❌' : '⚠️'}</span> {driftMessage || 'DRIFT'}
              </span>
            )}
            {line}
          </div>
        );
      })}
    </div>
  );
};
