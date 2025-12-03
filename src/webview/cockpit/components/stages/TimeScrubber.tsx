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

      <input
        type="range"
        min={0}
        max={maxIndex}
        value={currentIndex}
        onChange={handleChange}
        style={SliderStyle}
        disabled={commits.length === 0}
      />

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
