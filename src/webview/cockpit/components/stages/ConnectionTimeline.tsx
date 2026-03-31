import * as React from 'react';

interface EdgeInfo {
  from: string;
  to: string;
  createdAt?: string;
  type?: string;
}

interface ConnectionTimelineProps {
  edges: EdgeInfo[];
  orderedCommits?: string[];
  currentCommitIndex?: number;
}

const TimelineContainer: React.CSSProperties = {
  padding: '8px',
  fontSize: '10px',
};

const EdgeItem: React.CSSProperties = {
  padding: '4px 8px',
  marginBottom: '4px',
  borderRadius: '3px',
  fontSize: '9px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
};

export const ConnectionTimeline: React.FC<ConnectionTimelineProps> = ({
  edges,
  orderedCommits = [],
  currentCommitIndex,
}) => {
  // Group edges by creation time (filter out unknown paths first)
  const edgesByTime = React.useMemo(() => {
    const groups = new Map<number, EdgeInfo[]>();

    // Filter out edges with unknown paths
    const validEdges = edges.filter(
      edge => !edge.from?.startsWith('unknown:') && !edge.to?.startsWith('unknown:')
    );

    validEdges.forEach(edge => {
      if (!edge.createdAt) {
        // Unknown time - put in a special group
        const unknownGroup = groups.get(-1) || [];
        unknownGroup.push(edge);
        groups.set(-1, unknownGroup);
        return;
      }

      const commitIndex = orderedCommits.indexOf(edge.createdAt);
      if (commitIndex >= 0) {
        const group = groups.get(commitIndex) || [];
        group.push(edge);
        groups.set(commitIndex, group);
      }
    });

    return groups;
  }, [edges, orderedCommits]);

  // Check if edge is active at current commit
  const isEdgeActive = (edge: EdgeInfo): boolean => {
    if (currentCommitIndex === undefined) return true;
    if (!edge.createdAt) return true; // Unknown edges are shown as active

    const createdIndex = orderedCommits.indexOf(edge.createdAt);
    return createdIndex >= 0 && createdIndex <= currentCommitIndex;
  };

  // Sort commit indices
  const sortedIndices = React.useMemo(() => {
    const indices = Array.from(edgesByTime.keys()).filter(k => k >= 0);
    return indices.sort((a, b) => a - b);
  }, [edgesByTime]);

  if (edges.length === 0) {
    return (
      <div style={TimelineContainer}>
        <div style={{ opacity: 0.6, fontSize: '9px', textAlign: 'center', padding: '8px' }}>
          No connection timeline data
        </div>
      </div>
    );
  }

  return (
    <div style={TimelineContainer}>
      <div style={{ fontSize: '10px', fontWeight: 600, marginBottom: '8px' }}>
        Connection Timeline
      </div>
      {sortedIndices.map(commitIndex => {
        const edgesAtTime = edgesByTime.get(commitIndex) || [];
        const commitSha = orderedCommits[commitIndex] || '';
        const shortSha = commitSha.substring(0, 8);

        return (
          <div key={commitIndex} style={{ marginBottom: '12px' }}>
            <div
              style={{
                fontSize: '9px',
                fontWeight: 600,
                opacity: 0.7,
                marginBottom: '4px',
                paddingLeft: '4px',
              }}
            >
              {shortSha} ({edgesAtTime.length} edge{edgesAtTime.length !== 1 ? 's' : ''})
            </div>
            {edgesAtTime.map((edge, idx) => {
              const isActive = isEdgeActive(edge);
              const fromName = edge.from.split(':').pop() || edge.from;
              const toName = edge.to.split(':').pop() || edge.to;

              return (
                <div
                  key={idx}
                  style={{
                    ...EdgeItem,
                    backgroundColor: isActive
                      ? 'var(--vscode-editor-background)'
                      : 'var(--vscode-editor-inactiveSelectionBackground)',
                    opacity: isActive ? 1 : 0.3,
                    borderLeft: isActive
                      ? '2px solid var(--vscode-charts-blue)'
                      : '2px solid var(--vscode-panel-border)',
                  }}
                >
                  <span>
                    {fromName} → {toName}
                  </span>
                  {!isActive && (
                    <span style={{ fontSize: '8px', opacity: 0.6, fontStyle: 'italic' }}>
                      (future)
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        );
      })}
      {/* Unknown time edges */}
      {edgesByTime.has(-1) && (
        <div style={{ marginTop: '12px' }}>
          <div
            style={{
              fontSize: '9px',
              fontWeight: 600,
              opacity: 0.7,
              marginBottom: '4px',
              paddingLeft: '4px',
            }}
          >
            Unknown time
          </div>
          {(edgesByTime.get(-1) || []).map((edge, idx) => {
            const fromName = edge.from.split(':').pop() || edge.from;
            const toName = edge.to.split(':').pop() || edge.to;

            return (
              <div
                key={idx}
                style={{
                  ...EdgeItem,
                  backgroundColor: 'var(--vscode-editor-background)',
                  opacity: 0.7,
                  borderLeft: '2px solid var(--vscode-panel-border)',
                }}
              >
                <span>
                  {fromName} → {toName}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
