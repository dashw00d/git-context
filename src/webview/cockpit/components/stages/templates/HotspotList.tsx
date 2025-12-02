import * as React from 'react';

export interface Hotspot {
  path: string;
  name: string;
  score: number;
  added?: number;
  removed?: number;
  count?: number;
}

export const HotspotList: React.FC<{
  hotspots: Hotspot[];
  onFileClick: (path: string, name: string) => void;
  isAnalyzing?: boolean;
}> = ({ hotspots, onFileClick, isAnalyzing }) => {
  if (hotspots.length === 0 && !isAnalyzing) {
    return (
      <p style={{ fontSize: '0.85em', color: 'var(--vscode-descriptionForeground)' }}>
        No hotspots available for this scope.
      </p>
    );
  }

  if (hotspots.length === 0) {
    return null;
  }

  return (
    <>
      <p
        style={{
          fontSize: '0.85em',
          color: 'var(--vscode-descriptionForeground)',
          marginBottom: '10px',
        }}
      >
        Most modified files (3 months)
      </p>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
          gap: '10px',
        }}
      >
        {hotspots.map((file, index) => (
          <div
            key={`${file.path}-${index}`}
            onClick={() => onFileClick(file.path, file.name || file.path.split('/').pop() || '')}
            style={{
              padding: '12px 10px',
              border: '1px solid var(--vscode-button-background)',
              backgroundColor: 'var(--vscode-editor-background)',
              cursor: 'pointer',
              borderRadius: '4px',
              display: 'flex',
              flexDirection: 'column',
              gap: '4px',
              minHeight: '80px',
            }}
            title={`${file.name}\nChurn: ${file.score || 0}\n+${file.added || 0} / -${file.removed || 0}`}
          >
            <div
              style={{
                fontWeight: 'bold',
                fontSize: '0.9em',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {file.name}
            </div>
            <div
              style={{
                fontSize: '0.75em',
                color: 'var(--vscode-descriptionForeground)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {file.path}
            </div>
            <div style={{ fontSize: '0.75em', opacity: 0.7 }}>
              +{file.added || 0} / -{file.removed || 0}
            </div>
            <div
              style={{
                height: '6px',
                borderRadius: '3px',
                background: 'var(--vscode-progressBar-background)',
                overflow: 'hidden',
                marginTop: 'auto',
              }}
            >
              <div
                style={{
                  width: `${Math.min((file.score || 0) * 2, 100)}%`,
                  height: '100%',
                  background:
                    file.score > 10
                      ? 'var(--vscode-charts-red)'
                      : file.score > 5
                        ? 'var(--vscode-charts-orange)'
                        : 'var(--vscode-charts-green)',
                }}
              ></div>
            </div>
          </div>
        ))}
      </div>
    </>
  );
};
