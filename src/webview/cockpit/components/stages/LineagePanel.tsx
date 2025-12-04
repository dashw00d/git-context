import * as React from 'react';

interface LineageEntry {
  symbolId: string;
  previousSymbolId: string;
  sourceVersion: string;
  destVersion: string;
  moveType: 'rename' | 'relocate' | 'refactor';
  commitSha?: string;
  date?: string;
}

interface LineagePanelProps {
  symbolId?: string | null;
  movedLineage?: Array<LineageEntry>;
  orderedCommits?: string[];
  commits?: Array<{ sha: string; date?: string; message?: string }>;
  vscode?: any;
}

const PanelContainer: React.CSSProperties = {
  padding: '12px',
  overflow: 'auto',
  height: '100%',
};

const TimelineContainer: React.CSSProperties = {
  position: 'relative',
  paddingLeft: '24px',
};

const TimelineLine: React.CSSProperties = {
  position: 'absolute',
  left: '8px',
  top: '0',
  bottom: '0',
  width: '2px',
  backgroundColor: 'var(--vscode-panel-border)',
};

const TimelineEntry: React.CSSProperties = {
  position: 'relative',
  marginBottom: '16px',
  paddingLeft: '20px',
};

const EntryDot: React.CSSProperties = {
  position: 'absolute',
  left: '0',
  top: '4px',
  width: '16px',
  height: '16px',
  borderRadius: '50%',
  backgroundColor: 'var(--vscode-button-background)',
  border: '2px solid var(--vscode-panel-border)',
  zIndex: 10,
  cursor: 'pointer',
};

const EntryContent: React.CSSProperties = {
  backgroundColor: 'var(--vscode-editor-background)',
  border: '1px solid var(--vscode-panel-border)',
  borderRadius: '4px',
  padding: '8px 12px',
  fontSize: '11px',
  cursor: 'pointer',
  transition: 'background-color 0.1s',
};

export const LineagePanel: React.FC<LineagePanelProps> = ({
  symbolId,
  movedLineage = [],
  orderedCommits = [],
  commits = [],
  vscode,
}) => {
  // Filter lineage entries for the focused symbol
  const relevantLineage = React.useMemo(() => {
    if (!symbolId) return [];
    return movedLineage.filter(
      entry => entry.symbolId === symbolId || entry.previousSymbolId === symbolId
    );
  }, [symbolId, movedLineage]);

  // Sort by version/commit order
  const sortedLineage = React.useMemo(() => {
    return [...relevantLineage].sort((a, b) => {
      const aIndex = orderedCommits.indexOf(a.sourceVersion || a.destVersion);
      const bIndex = orderedCommits.indexOf(b.sourceVersion || b.destVersion);
      return aIndex - bIndex;
    });
  }, [relevantLineage, orderedCommits]);

  const handleEntryClick = (entry: LineageEntry) => {
    if (!vscode) return;

    // Navigate to the source version
    const targetSha = entry.sourceVersion || entry.destVersion;
    const commitIndex = orderedCommits.indexOf(targetSha);

    if (commitIndex >= 0) {
      vscode.postMessage({ type: 'updateCommitIndex', value: commitIndex });
    }

    // Also navigate to the file if we have file info
    if (entry.sourceVersion && entry.sourceVersion.includes('/')) {
      const frame = {
        level: 'file' as const,
        id: entry.sourceVersion,
        name: entry.sourceVersion.split('/').pop() || 'Source',
        status: 'scanning' as const,
      };
      vscode.postMessage({ type: 'navigateToFrame', frame });
    }
  };

  const getMoveTypeLabel = (moveType: string): string => {
    switch (moveType) {
      case 'rename':
        return 'Renamed';
      case 'relocate':
        return 'Moved';
      case 'refactor':
        return 'Refactored';
      default:
        return 'Changed';
    }
  };

  const getCommitInfo = (sha: string) => {
    const commit = commits.find(c => c.sha === sha);
    if (commit) {
      return {
        date: commit.date ? new Date(commit.date).toLocaleDateString() : '',
        message: commit.message || 'No message',
      };
    }
    return { date: '', message: 'Unknown commit' };
  };

  if (!symbolId) {
    return (
      <div style={PanelContainer}>
        <div style={{ opacity: 0.6, fontSize: '11px', textAlign: 'center', padding: '20px' }}>
          Select a symbol to view its lineage
        </div>
      </div>
    );
  }

  if (sortedLineage.length === 0) {
    return (
      <div style={PanelContainer}>
        <div style={{ opacity: 0.6, fontSize: '11px', textAlign: 'center', padding: '20px' }}>
          No lineage information available for this symbol
        </div>
      </div>
    );
  }

  return (
    <div style={PanelContainer}>
      <div style={{ fontSize: '12px', fontWeight: 600, marginBottom: '16px' }}>Symbol Lineage</div>
      <div style={TimelineContainer}>
        <div style={TimelineLine} />
        {sortedLineage.map((entry, idx) => {
          const commitInfo = getCommitInfo(entry.sourceVersion || entry.destVersion);
          const shortSha = (entry.sourceVersion || entry.destVersion).substring(0, 8);

          return (
            <div key={idx} style={TimelineEntry}>
              <div style={EntryDot} onClick={() => handleEntryClick(entry)} />
              <div
                style={EntryContent}
                onClick={() => handleEntryClick(entry)}
                onMouseEnter={e => {
                  e.currentTarget.style.backgroundColor = 'var(--vscode-list-hoverBackground)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.backgroundColor = 'var(--vscode-editor-background)';
                }}
              >
                <div style={{ fontWeight: 600, marginBottom: '4px' }}>
                  {getMoveTypeLabel(entry.moveType)}
                </div>
                <div style={{ fontSize: '10px', opacity: 0.7, marginBottom: '2px' }}>
                  {shortSha} {commitInfo.date ? `• ${commitInfo.date}` : ''}
                </div>
                <div style={{ fontSize: '10px', opacity: 0.8 }}>
                  {commitInfo.message.length > 50
                    ? `${commitInfo.message.substring(0, 50)}...`
                    : commitInfo.message}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
