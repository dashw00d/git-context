import * as React from 'react';
import { FileAnalysisData } from '../../hooks/useFileAnalysisData';
import { LineagePanel } from './LineagePanel';

// Browser-compatible path utilities
function dirname(filePath: string): string {
  const normalized = filePath;
  const lastSlash = normalized.lastIndexOf('/');
  return lastSlash === -1 ? '' : normalized.substring(0, lastSlash);
}

interface PortalsRailProps {
  incomingRefs?: number;
  outgoingRefs?: number;
  blastRadius?: { incoming: any[]; outgoing: any[] };
  focusedSymbolId?: string | null;
  currentFilePath?: string;
  currentCommitIndex?: number;
  orderedCommits?: string[];
  bundleFacts?: any;
  vscode?: any;
  commits?: Array<{ sha: string; date?: string; message?: string }>;
  analysisData?: FileAnalysisData;
}

const RailContainer: React.CSSProperties = {
  width: '220px',
  borderLeft: '1px solid var(--vscode-panel-border)',
  backgroundColor: 'var(--vscode-sideBar-background)',
  display: 'flex',
  flexDirection: 'column',
  overflow: 'auto',
  flexShrink: 0,
};

const SectionHeader: React.CSSProperties = {
  padding: '10px',
  fontSize: '10px',
  fontWeight: 600,
  textTransform: 'uppercase',
  opacity: 0.6,
  letterSpacing: '0.5px',
  borderBottom: '1px solid var(--vscode-panel-border)',
  marginTop: '10px',
};

const PortalGroup: React.FC<{
  name: string;
  count: number;
  type: 'incoming' | 'outgoing';
  isFuture?: boolean;
  opacity?: number;
}> = ({ name, count, type, isFuture, opacity = 1 }) => (
  <div
    style={{
      padding: '8px 12px',
      borderBottom: '1px solid var(--vscode-panel-border)',
      cursor: 'pointer',
      transition: 'background-color 0.1s, opacity 0.1s',
      opacity,
    }}
    onMouseEnter={e =>
      (e.currentTarget.style.backgroundColor = 'var(--vscode-list-hoverBackground)')
    }
    onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
  >
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <span
        style={{
          fontWeight: 600,
          fontSize: '11px',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
        }}
      >
        <span>{type === 'incoming' ? '↙' : '↗'}</span>
        {name}
        {isFuture && (
          <span
            style={{
              fontSize: '9px',
              opacity: 0.6,
              fontStyle: 'italic',
            }}
          >
            (future)
          </span>
        )}
      </span>
      <span
        style={{
          backgroundColor: 'var(--vscode-badge-background)',
          color: 'var(--vscode-badge-foreground)',
          borderRadius: '10px',
          padding: '1px 6px',
          fontSize: '9px',
          minWidth: '16px',
          textAlign: 'center',
        }}
      >
        {count}
      </span>
    </div>
  </div>
);

/**
 * Extract folder name from file path for grouping
 * Examples:
 * - src/utils/foo.ts -> UTILS
 * - src/controllers/api.ts -> CONTROLLERS
 * - src/types/index.ts -> TYPES
 */
function extractFolderName(filePath: string): string {
  const dir = dirname(filePath);
  const parts = dir.split('/').filter((p: string) => p);
  if (parts.length === 0) return 'ROOT';
  // Use the last directory name, uppercase
  const folderName = parts[parts.length - 1].toUpperCase();
  return folderName || 'ROOT';
}

/**
 * Group references by folder
 */
function groupByFolder(references: any[]): Map<string, number> {
  const groups = new Map<string, number>();
  references.forEach(ref => {
    // Extract path from reference (could be "from" or "to" depending on direction)
    const refPath = ref.from || ref.to || '';
    if (refPath) {
      const lastColon = refPath.lastIndexOf(':');
      const filePath = lastColon !== -1 ? refPath.substring(0, lastColon) : refPath;
      // Skip unknown/unresolved paths
      if (filePath === 'unknown') {
        return;
      }
      const folder = extractFolderName(filePath);
      groups.set(folder, (groups.get(folder) || 0) + 1);
    }
  });
  return groups;
}

export const PortalsRail: React.FC<PortalsRailProps> = ({
  incomingRefs = 0,
  outgoingRefs = 0,
  blastRadius,
  focusedSymbolId,
  currentFilePath,
  currentCommitIndex,
  orderedCommits = [],
  bundleFacts,
  vscode,
  commits = [],
  analysisData,
}) => {
  const [activeTab, setActiveTab] = React.useState<'connections' | 'lineage'>('connections');
  const isTimeTravelActive = currentCommitIndex !== undefined && orderedCommits.length > 0;

  // Use blastRadius.incoming/outgoing directly - edge.history is not produced by the pipeline
  // Filter references if a symbol is focused
  let filteredIncoming = blastRadius?.incoming || [];
  let filteredOutgoing = blastRadius?.outgoing || [];

  if (focusedSymbolId && currentFilePath) {
    const normalizedTarget = currentFilePath;
    // Ensure we handle both local and fully qualified IDs
    const baseSymbolId = focusedSymbolId.includes(':')
      ? focusedSymbolId.substring(focusedSymbolId.lastIndexOf(':') + 1)
      : focusedSymbolId;

    // Filter to only references involving the focused symbol
    filteredIncoming = (blastRadius?.incoming || []).filter(ref => {
      // Parse "to" path and symbol from reference
      const lastColon = ref.to?.lastIndexOf(':');
      if (lastColon !== undefined && lastColon !== -1) {
        const toPath = ref.to.substring(0, lastColon);
        const toSymbol = ref.to.substring(lastColon + 1);
        const normalizedPath = toPath;

        return (
          normalizedPath === normalizedTarget &&
          (toSymbol === baseSymbolId || toSymbol === focusedSymbolId)
        );
      }
      return false;
    });

    filteredOutgoing = (blastRadius?.outgoing || []).filter(ref => {
      // Parse "from" path and symbol from reference
      const lastColon = ref.from?.lastIndexOf(':');
      if (lastColon !== undefined && lastColon !== -1) {
        const fromPath = ref.from.substring(0, lastColon);
        const fromSymbol = ref.from.substring(lastColon + 1);
        const normalizedPath = fromPath;

        return (
          normalizedPath === normalizedTarget &&
          (fromSymbol === baseSymbolId || fromSymbol === focusedSymbolId)
        );
      }
      return false;
    });
  }

  // Use real data if available, otherwise fall back to counts
  const incomingGroups =
    filteredIncoming.length > 0 ? groupByFolder(filteredIncoming) : new Map<string, number>();
  const outgoingGroups =
    filteredOutgoing.length > 0 ? groupByFolder(filteredOutgoing) : new Map<string, number>();

  // If no real data, show empty state or use fallback counts
  const hasIncoming = incomingGroups.size > 0 || incomingRefs > 0;
  const hasOutgoing = outgoingGroups.size > 0 || outgoingRefs > 0;

  return (
    <div style={RailContainer}>
      {focusedSymbolId && (
        <>
          <div
            style={{
              ...SectionHeader,
              backgroundColor: 'var(--vscode-editor-selectionBackground)',
              marginTop: '0',
            }}
          >
            Filtered: {focusedSymbolId}
          </div>
          <div
            style={{
              display: 'flex',
              borderBottom: '1px solid var(--vscode-panel-border)',
            }}
          >
            <button
              onClick={() => setActiveTab('connections')}
              style={{
                flex: 1,
                padding: '6px',
                fontSize: '10px',
                background:
                  activeTab === 'connections' ? 'var(--vscode-button-background)' : 'transparent',
                color:
                  activeTab === 'connections'
                    ? 'var(--vscode-button-foreground)'
                    : 'var(--vscode-foreground)',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              Connections
            </button>
            <button
              onClick={() => setActiveTab('lineage')}
              style={{
                flex: 1,
                padding: '6px',
                fontSize: '10px',
                background:
                  activeTab === 'lineage' ? 'var(--vscode-button-background)' : 'transparent',
                color:
                  activeTab === 'lineage'
                    ? 'var(--vscode-button-foreground)'
                    : 'var(--vscode-foreground)',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              Lineage
            </button>
          </div>
        </>
      )}
      {activeTab === 'lineage' && focusedSymbolId ? (
        <LineagePanel
          symbolId={focusedSymbolId}
          movedLineage={bundleFacts?.bundle?.movedLineage || []}
          orderedCommits={orderedCommits}
          commits={commits}
          vscode={vscode}
        />
      ) : (
        <>
          {isTimeTravelActive && (
            <div
              style={{
                ...SectionHeader,
                backgroundColor: 'var(--vscode-inputValidation-warningBackground)',
                color: 'var(--vscode-inputValidation-warningForeground)',
                fontSize: '9px',
                padding: '6px 10px',
                marginTop: '0',
              }}
              title="References shown are current state. They may not have existed at the selected commit time."
            >
              ⚠️ Time travel active: References may differ
            </div>
          )}
          <div style={SectionHeader}>Incoming (Referenced By)</div>
          {hasIncoming ? (
            incomingGroups.size > 0 ? (
              Array.from(incomingGroups.entries())
                .sort((a, b) => b[1] - a[1]) // Sort by count descending
                .map(([folder, count]) => {
                  // Find representative ref for this folder to check time status
                  const representativeRef = filteredIncoming.find((ref: any) => {
                    const refPath = ref.from || ref.to || '';
                    const folderName = extractFolderName(refPath.split(':')[0]);
                    return folderName === folder;
                  });
                  return (
                    <PortalGroup
                      key={folder}
                      name={folder}
                      count={count}
                      type="incoming"
                      isFuture={representativeRef?.isFuture}
                      opacity={representativeRef?.opacity}
                    />
                  );
                })
            ) : (
              <PortalGroup name="UNKNOWN" count={incomingRefs} type="incoming" />
            )
          ) : (
            <div style={{ padding: '8px 12px', opacity: 0.5, fontSize: '11px' }}>
              {focusedSymbolId
                ? `No incoming references for ${focusedSymbolId}`
                : 'No incoming references'}
            </div>
          )}

          <div style={SectionHeader}>Outgoing (References)</div>
          {hasOutgoing ? (
            outgoingGroups.size > 0 ? (
              Array.from(outgoingGroups.entries())
                .sort((a, b) => b[1] - a[1]) // Sort by count descending
                .map(([folder, count]) => {
                  // Find representative ref for this folder to check time status
                  const representativeRef = filteredOutgoing.find((ref: any) => {
                    const refPath = ref.from || ref.to || '';
                    const folderName = extractFolderName(refPath.split(':')[0]);
                    return folderName === folder;
                  });
                  return (
                    <PortalGroup
                      key={folder}
                      name={folder}
                      count={count}
                      type="outgoing"
                      isFuture={representativeRef?.isFuture}
                      opacity={representativeRef?.opacity}
                    />
                  );
                })
            ) : (
              <PortalGroup name="UNKNOWN" count={outgoingRefs} type="outgoing" />
            )
          ) : (
            <div style={{ padding: '8px 12px', opacity: 0.5, fontSize: '11px' }}>
              {focusedSymbolId
                ? `No outgoing references for ${focusedSymbolId}`
                : 'No outgoing references'}
            </div>
          )}
        </>
      )}
    </div>
  );
};
