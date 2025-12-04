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
}) => {
  const [isPlaying, setIsPlaying] = React.useState(false);
  const maxIndex = commits.length > 0 ? commits.length - 1 : 0;
  const effectiveIndex = currentCommitIndex !== undefined ? currentCommitIndex : maxIndex;
  const [currentIndex, setCurrentIndex] = React.useState(effectiveIndex);

  React.useEffect(() => {
    if (currentCommitIndex !== undefined) {
      setCurrentIndex(currentCommitIndex);
    }
  }, [currentCommitIndex]);

  React.useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isPlaying && commits.length > 0) {
      interval = setInterval(() => {
        setCurrentIndex(prev => {
          if (prev >= maxIndex) {
            setIsPlaying(false);
            return maxIndex;
          }
          const next = prev + 1;
          onCommitIndexChange(next);
          return next;
        });
      }, 500); // Step through commits every 500ms
    }
    return () => clearInterval(interval);
  }, [isPlaying, maxIndex, commits.length, onCommitIndexChange]);

  React.useEffect(() => {
    if (currentIndex !== effectiveIndex) {
      onCommitIndexChange(currentIndex);
    }
  }, [currentIndex]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value, 10);
    setCurrentIndex(val);
    onCommitIndexChange(val);
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
    if (!bundleFacts?.findings?.patternDrift?.conventionDrift?.driftSymbols) {
      return new Set<number>();
    }

    const indices = new Set<number>();

    // Map drift symbols to commit indices via lineCommits
    // Note: This is a simplified heuristic - ideally we'd track when symbols were created
    if (lineCommits.length > 0 && commits.length > 0) {
      // For now, we'll use all commits that have line commit data as potential drift commits
      // A better implementation would track symbol creation time in the database
      lineCommits.forEach((lc: any) => {
        const commitIndex = commits.findIndex(c => c.sha === lc.commitSha);
        if (commitIndex >= 0) {
          indices.add(commitIndex);
        }
      });
    }

    return indices;
  }, [bundleFacts, lineCommits, commits]);

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
        }}
        title={isPlaying ? 'Pause' : 'Play History'}
        disabled={commits.length === 0}
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
        }}
      >
        {formatCommit(currentIndex)}
      </span>

      <div style={{ position: 'relative', flex: 1, display: 'flex', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1, display: 'flex', alignItems: 'center' }}>
          <input
            type="range"
            min={0}
            max={maxIndex}
            value={currentIndex}
            onChange={handleChange}
            style={SliderStyle}
            disabled={commits.length === 0}
          />
          {/* Drift markers */}
          {Array.from(driftCommitIndices).map(driftIndex => (
            <div
              key={driftIndex}
              style={{
                position: 'absolute',
                left: `${(driftIndex / maxIndex) * 100}%`,
                width: '2px',
                height: '20px',
                backgroundColor: 'var(--vscode-inputValidation-errorBorder)',
                pointerEvents: 'none',
                zIndex: 5,
              }}
              title="Convention drift introduced here"
            />
          ))}
        </div>
        {/* Drift markers */}
        {Array.from(driftCommitIndices).map(driftIndex => (
          <div
            key={driftIndex}
            style={{
              position: 'absolute',
              left: `${(driftIndex / maxIndex) * 100}%`,
              width: '2px',
              height: '20px',
              backgroundColor: 'var(--vscode-inputValidation-errorBorder)',
              pointerEvents: 'none',
              zIndex: 5,
            }}
            title="Convention drift introduced here"
          />
        ))}
      </div>

      <span style={{ fontSize: '11px', opacity: 0.7, minWidth: '50px', textAlign: 'right' }}>
        {currentIndex + 1} / {commits.length}
      </span>

      <button
        onClick={() => {
          setCurrentIndex(maxIndex);
          onCommitIndexChange(maxIndex);
        }}
        style={{
          fontSize: '11px',
          background: 'none',
          border: '1px solid var(--vscode-button-border)',
          borderRadius: '4px',
          padding: '2px 6px',
          color: 'var(--vscode-foreground)',
          cursor: 'pointer',
        }}
        disabled={commits.length === 0}
      >
        Reset
      </button>
    </div>
  );
};
