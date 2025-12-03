import * as React from 'react';

interface SedimentGutterProps {
  lineCount: number;
  lineCommits?: Array<{ line: number; commitSha: string; author: string; date: string }>;
  orderedCommits?: string[]; // Ordered list of commit SHAs (oldest to newest or newest to oldest)
  currentCommitIndex?: number; // Index in orderedCommits array
}

const GutterContainer: React.CSSProperties = {
  width: '12px',
  height: '100%',
  display: 'flex',
  flexDirection: 'column',
  flexShrink: 0,
  borderRight: '1px solid var(--vscode-editor-lineHighlightBorder)',
  backgroundColor: 'var(--vscode-editor-background)',
};

export const SedimentGutter: React.FC<SedimentGutterProps> = ({
  lineCount,
  lineCommits = [],
  orderedCommits = [],
  currentCommitIndex,
}) => {
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

  const getAgeColor = (lineNumber: number) => {
    // If no data available, use neutral color
    if (!lineCommits.length || !orderedCommits.length || currentCommitIndex === undefined) {
      return 'var(--vscode-editor-lineHighlightBorder)';
    }

    const lineCommitIndex = lineToCommitIndex.get(lineNumber);
    if (lineCommitIndex === undefined) {
      return 'var(--vscode-editor-lineHighlightBorder)';
    }

    // Calculate how many commits ago this line was modified
    // Assuming orderedCommits goes from oldest (0) to newest (length-1)
    const commitsAgo = currentCommitIndex - lineCommitIndex;
    const totalCommits = orderedCommits.length;

    // Normalize to 0-1 range (0 = very old, 1 = very recent)
    const ageRatio = totalCommits > 0 ? commitsAgo / totalCommits : 0;

    // Color based on age: green = recent, blue = medium, gray = old
    if (ageRatio < 0.2 || commitsAgo <= 0) {
      return 'var(--vscode-charts-green)'; // Recent (within 20% of commits)
    }
    if (ageRatio < 0.5) {
      return 'var(--vscode-charts-blue)'; // Medium age
    }
    return 'var(--vscode-editor-lineHighlightBorder)'; // Old
  };

  const getLineTitle = (lineNumber: number) => {
    const lineCommit = lineCommits.find(lc => lc.line === lineNumber);
    if (!lineCommit) {
      return `Line ${lineNumber}`;
    }
    const commitIndex = lineToCommitIndex.get(lineNumber);
    const commitsAgo =
      commitIndex !== undefined && currentCommitIndex !== undefined
        ? currentCommitIndex - commitIndex
        : null;
    const agoText =
      commitsAgo !== null && commitsAgo >= 0
        ? `${commitsAgo} commit${commitsAgo !== 1 ? 's' : ''} ago`
        : 'unknown';
    return `Line ${lineNumber + 1}: Modified ${agoText} (${lineCommit.commitSha.substring(0, 8)})`;
  };

  // Check if line should be hidden based on time travel
  const isLineAfterTime = (lineNumber: number): boolean => {
    if (currentCommitIndex === undefined) return false;
    const lineCommitIndex = lineToCommitIndex.get(lineNumber);
    if (lineCommitIndex === undefined) return false;
    return lineCommitIndex > currentCommitIndex;
  };

  return (
    <div style={GutterContainer}>
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
    </div>
  );
};
