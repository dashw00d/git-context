import * as React from 'react';

interface ChangeInfo {
  date: string;
  type: 'added' | 'modified' | 'removed';
  impact?: number;
}

interface ChangeSparklineProps {
  changes: ChangeInfo[];
  width?: number;
  height?: number;
}

export const ChangeSparkline: React.FC<ChangeSparklineProps> = ({
  changes,
  width = 100,
  height = 20,
}) => {
  if (changes.length === 0) {
    return (
      <div
        style={{
          width: `${width}px`,
          height: `${height}px`,
          backgroundColor: 'var(--vscode-editor-lineHighlightBackground)',
          borderRadius: '2px',
          opacity: 0.3,
        }}
      />
    );
  }

  // Sort changes by date (oldest to newest)
  const sortedChanges = [...changes].sort((a, b) => {
    const dateA = new Date(a.date).getTime();
    const dateB = new Date(b.date).getTime();
    return dateA - dateB;
  });

  // Normalize impact scores (0-1 range)
  const maxImpact = Math.max(...sortedChanges.map(c => c.impact || 1), 1);
  const normalizedChanges = sortedChanges.map(c => ({
    ...c,
    normalizedImpact: (c.impact || 1) / maxImpact,
  }));

  // Calculate points for the sparkline
  const pointCount = sortedChanges.length;
  const pointWidth = width / Math.max(pointCount, 1);
  const maxHeight = height - 4; // Padding

  const points: string[] = [];
  normalizedChanges.forEach((change, i) => {
    const x = i * pointWidth + pointWidth / 2;
    const y = height - 2 - change.normalizedImpact * maxHeight;
    points.push(`${x},${y}`);
  });

  // Create path for the sparkline
  const pathData = points.length > 0 ? `M ${points.join(' L ')}` : '';

  // Get color based on change type distribution
  const hasRemoved = sortedChanges.some(c => c.type === 'removed');
  const hasAdded = sortedChanges.some(c => c.type === 'added');
  const strokeColor = hasRemoved
    ? 'var(--vscode-charts-red)'
    : hasAdded
      ? 'var(--vscode-charts-green)'
      : 'var(--vscode-charts-blue)';

  return (
    <svg width={width} height={height} style={{ display: 'block' }}>
      <title>{`${changes.length} changes over time`}</title>
      {/* Background */}
      <rect
        width={width}
        height={height}
        fill="var(--vscode-editor-lineHighlightBackground)"
        opacity={0.2}
        rx="2"
      />
      {/* Sparkline path */}
      {pathData && (
        <path
          d={pathData}
          fill="none"
          stroke={strokeColor}
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
      {/* Points */}
      {normalizedChanges.map((change, i) => {
        const x = i * pointWidth + pointWidth / 2;
        const y = height - 2 - change.normalizedImpact * maxHeight;
        const pointColor =
          change.type === 'removed'
            ? 'var(--vscode-charts-red)'
            : change.type === 'added'
              ? 'var(--vscode-charts-green)'
              : 'var(--vscode-charts-blue)';
        return (
          <circle key={i} cx={x} cy={y} r="1.5" fill={pointColor}>
            <title>{`${change.type} on ${new Date(change.date).toLocaleDateString()}`}</title>
          </circle>
        );
      })}
    </svg>
  );
};
