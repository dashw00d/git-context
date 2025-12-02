import * as React from 'react';

export const SummaryStats: React.FC<{
  commitCount: number;
  fileCount: number;
  symbolCount?: number;
}> = ({ commitCount, fileCount, symbolCount }) => {
  return (
    <div
      style={{
        display: 'flex',
        gap: '15px',
        marginBottom: '15px',
        fontSize: '0.85em',
        color: 'var(--vscode-descriptionForeground)',
        borderBottom: '1px solid var(--vscode-panel-border)',
        paddingBottom: '10px',
      }}
    >
      <div>
        <strong>{commitCount}</strong> commits
      </div>
      <div>
        <strong>{fileCount}</strong> files
      </div>
      {symbolCount !== undefined && (
        <div>
          <strong>{symbolCount}</strong> symbols
        </div>
      )}
    </div>
  );
};
