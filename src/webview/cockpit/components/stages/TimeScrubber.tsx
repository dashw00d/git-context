import * as React from 'react';

interface TimeScrubberProps {
  currentTimeFilter?: number;
  onTimeFilterChange: (timestamp: number) => void;
  startTime?: number;
  endTime?: number;
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
  currentTimeFilter,
  onTimeFilterChange,
  startTime = Date.now() - 30 * 24 * 60 * 60 * 1000,
  endTime = Date.now(),
}) => {
  const [isPlaying, setIsPlaying] = React.useState(false);
  const [currentValue, setCurrentValue] = React.useState(currentTimeFilter || endTime);

  React.useEffect(() => {
    if (currentTimeFilter) {
      setCurrentValue(currentTimeFilter);
    }
  }, [currentTimeFilter]);

  React.useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isPlaying) {
      interval = setInterval(() => {
        setCurrentValue(prev => {
          const next = prev + (endTime - startTime) / 100;
          if (next >= endTime) {
            setIsPlaying(false);
            return endTime;
          }
          return next;
        });
      }, 100);
    }
    return () => clearInterval(interval);
  }, [isPlaying, startTime, endTime]);

  React.useEffect(() => {
    if (Math.abs(currentValue - (currentTimeFilter || endTime)) > 1000) {
      onTimeFilterChange(currentValue);
    }
  }, [currentValue]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value, 10);
    setCurrentValue(val);
    onTimeFilterChange(val);
  };

  const formatTime = (ts: number) => new Date(ts).toLocaleDateString();

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
      >
        {isPlaying ? '⏸' : '▶'}
      </button>

      <span style={{ fontSize: '11px', opacity: 0.7, minWidth: '70px' }}>
        {formatTime(currentValue)}
      </span>

      <input
        type="range"
        min={startTime}
        max={endTime}
        value={currentValue}
        onChange={handleChange}
        style={SliderStyle}
      />

      <button
        onClick={() => {
          setCurrentValue(endTime);
          onTimeFilterChange(endTime);
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
      >
        Reset
      </button>
    </div>
  );
};
