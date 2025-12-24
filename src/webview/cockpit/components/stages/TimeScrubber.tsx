import * as React from 'react';

interface CommitInfo {
  sha: string;
  date: string;
  message: string;
  author?: string;
}

interface TimeScrubberProps {
  commits?: CommitInfo[];
  currentCommitIndex?: number;
  onCommitIndexChange: (index: number) => void;
  bundleFacts?: any;
  lineCommits?: Array<{ line: number; commitSha: string; author: string; date: string }>;
  symbols?: Array<{
    id?: string;
    name: string;
    location?: { start: { line: number }; end: { line: number } };
  }>;
}

const ScrubberContainer: React.CSSProperties = {
  height: '40px',
  borderTop: '1px solid var(--vscode-panel-border)',
  backgroundColor: 'var(--vscode-editor-background)',
  display: 'flex',
  alignItems: 'center',
  padding: '0 16px',
  gap: '12px',
  flexShrink: 0,
};

const SliderStyle: React.CSSProperties = {
  flex: 1,
  cursor: 'pointer',
};

export const TimeScrubber: React.FC<TimeScrubberProps> = ({
  commits = [],
  currentCommitIndex,
  onCommitIndexChange,
  bundleFacts,
  lineCommits = [],
  symbols = [],
}) => {
  const [isPlaying, setIsPlaying] = React.useState(false);
  const maxIndex = commits.length > 0 ? commits.length - 1 : 0;

  // Local index state for smooth scrubbing, synced with prop
  const [localIndex, setLocalIndex] = React.useState<number>(
    currentCommitIndex !== undefined ? currentCommitIndex : maxIndex
  );

  // Sync local state when prop changes from outside
  React.useEffect(() => {
    if (currentCommitIndex !== undefined && currentCommitIndex !== localIndex) {
      setLocalIndex(currentCommitIndex);
    }
  }, [currentCommitIndex]);

  // Handle playing animation
  React.useEffect(() => {
    let interval: any;
    if (isPlaying && commits.length > 0) {
      interval = setInterval(() => {
        setLocalIndex(prev => {
          if (prev >= maxIndex) {
            setIsPlaying(false);
            return maxIndex;
          }
          const next = prev + 1;
          // Trigger change immediately for animation
          onCommitIndexChange(next);
          return next;
        });
      }, 800); // Slightly slower for better visibility
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isPlaying, maxIndex, commits.length, onCommitIndexChange]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value, 10);
    if (!isNaN(val)) {
      setLocalIndex(val);
      onCommitIndexChange(val);
    }
  };

  const handleReset = () => {
    setLocalIndex(maxIndex);
    onCommitIndexChange(maxIndex);
    setIsPlaying(false);
  };

  const formatCommit = (index: number) => {
    if (commits.length === 0 || index < 0 || index >= commits.length) {
      return 'No commits';
    }
    const commit = commits[index];
    const shortSha = commit.sha.substring(0, 8);
    const date = commit.date ? new Date(commit.date).toLocaleDateString() : '';
    const message = commit.message || 'No message';
    const shortMessage = message.length > 40 ? message.substring(0, 40) + '...' : message;
    return `${shortSha} - ${shortMessage}${date ? ` (${date})` : ''}`;
  };

  // Extract drift commit indices
  const driftCommitIndices = React.useMemo(() => {
    // Check if we have drift symbols
    const driftSymbols = bundleFacts?.findings?.patternDrift?.conventionDrift?.driftSymbols || [];
    if (driftSymbols.length === 0) {
      return new Set<number>();
    }

    const indices = new Set<number>();

    // Map drift symbols to commit indices via lineCommits and symbol locations
    if (lineCommits.length > 0 && commits.length > 0 && symbols.length > 0) {
      driftSymbols.forEach((ds: any) => {
        // Find the symbol in our current symbols list
        const symbol = symbols.find(s => s.name === ds.name);
        if (symbol?.location) {
          const start = symbol.location.start.line;
          const end = symbol.location.end.line;

          // Find commits that touched these lines
          const relevantLineCommits = lineCommits.filter(lc => lc.line >= start && lc.line <= end);
          relevantLineCommits.forEach(lc => {
            const commitIndex = commits.findIndex(c => c.sha === lc.commitSha);
            if (commitIndex >= 0) {
              indices.add(commitIndex);
            }
          });
        }
      });
    }

    return indices;
  }, [bundleFacts, lineCommits, commits, symbols]);

  if (commits.length === 0) {
    return (
      <div style={ScrubberContainer}>
        <span style={{ fontSize: '11px', opacity: 0.7 }}>No commits available</span>
      </div>
    );
  }

  return (
    <div style={ScrubberContainer}>
      <button
        onClick={() => setIsPlaying(!isPlaying)}
        style={{
          background: 'none',
          border: 'none',
          color: 'var(--vscode-button-foreground)',
          cursor: 'pointer',
          fontSize: '16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '24px',
        }}
        title={isPlaying ? 'Pause' : 'Play History'}
      >
        {isPlaying ? '⏸' : '▶'}
      </button>

      <span
        style={{
          fontSize: '11px',
          opacity: 0.7,
          minWidth: '200px',
          maxWidth: '300px',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {formatCommit(localIndex)}
      </span>

      <div style={{ position: 'relative', flex: 1, display: 'flex', alignItems: 'center' }}>
        <input
          type="range"
          min={0}
          max={maxIndex}
          value={localIndex}
          onChange={handleChange}
          style={SliderStyle}
        />
        {/* Drift markers */}
        {Array.from(driftCommitIndices).map(driftIndex => (
          <div
            key={driftIndex}
            style={{
              position: 'absolute',
              left: `${(driftIndex / maxIndex) * 100}%`,
              width: '2px',
              height: '12px',
              backgroundColor: 'var(--vscode-charts-orange)',
              pointerEvents: 'none',
              zIndex: 5,
              opacity: 0.8,
            }}
            title="Convention drift potentially introduced here"
          />
        ))}
      </div>

      <span style={{ fontSize: '11px', opacity: 0.7, minWidth: '50px', textAlign: 'right' }}>
        {localIndex + 1} / {commits.length}
      </span>

      <button
        onClick={handleReset}
        style={{
          fontSize: '11px',
          background: 'none',
          border: '1px solid var(--vscode-button-border)',
          borderRadius: '4px',
          padding: '2px 8px',
          color: 'var(--vscode-foreground)',
          cursor: 'pointer',
        }}
      >
        Reset
      </button>
    </div>
  );
};
