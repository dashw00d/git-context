import * as React from 'react';
import { ExplorerNode, NodeMetrics } from '../../../../types/cockpit';

// Browser-compatible path utilities
function dirname(filePath: string): string {
  const normalized = filePath.replace(/\\/g, '/');
  const lastSlash = normalized.lastIndexOf('/');
  return lastSlash === -1 ? '' : normalized.substring(0, lastSlash);
}

function basename(filePath: string): string {
  const normalized = filePath.replace(/\\/g, '/');
  const lastSlash = normalized.lastIndexOf('/');
  return lastSlash === -1 ? normalized : normalized.substring(lastSlash + 1);
}

interface StageHeaderProps {
  fileName: string;
  filePath?: string;
  metrics?: NodeMetrics;
  onNavigate?: (direction: 'prev' | 'next') => void;
  explorerData?: ExplorerNode[];
  bundleFacts?: any;
  onNeighborClick?: (filePath: string) => void;
}

const HeaderContainer: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '8px 16px',
  borderBottom: '1px solid var(--vscode-panel-border)',
  backgroundColor: 'var(--vscode-editor-background)',
  height: '40px',
  flexShrink: 0,
};

const TitleStyle: React.CSSProperties = {
  fontWeight: 600,
  fontSize: '13px',
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
};

const HealthBarStyle = (riskScore: number): React.CSSProperties => {
  const color =
    riskScore > 70
      ? 'var(--vscode-charts-red)'
      : riskScore > 40
        ? 'var(--vscode-charts-yellow)'
        : 'var(--vscode-charts-green)';

  return {
    height: '4px',
    width: '100%',
    position: 'absolute',
    bottom: 0,
    left: 0,
    backgroundColor: color,
    opacity: 0.5,
  };
};

/**
 * Find sibling files in the same directory
 */
function findSiblingFiles(
  currentFilePath: string,
  explorerData?: ExplorerNode[],
  bundleFacts?: any
): string[] {
  if (!currentFilePath) return [];

  const currentDir = dirname(currentFilePath);
  const siblings: string[] = [];

  // Try to get files from bundleFacts first
  if (bundleFacts?.evidence?.['scope.files']) {
    const files = bundleFacts.evidence['scope.files'] as string[];
    files.forEach(filePath => {
      if (filePath !== currentFilePath && dirname(filePath) === currentDir) {
        siblings.push(filePath);
      }
    });
  }

  // Also check explorerData
  if (explorerData && siblings.length < 5) {
    const collectFiles = (nodes: ExplorerNode[]): void => {
      for (const node of nodes) {
        if (node.type === 'file' && node.id) {
          const filePath = node.id;
          if (
            filePath !== currentFilePath &&
            dirname(filePath) === currentDir &&
            !siblings.includes(filePath)
          ) {
            siblings.push(filePath);
          }
        }
        if (node.children) {
          collectFiles(node.children);
        }
      }
    };
    collectFiles(explorerData);
  }

  // Limit to 6 siblings max
  return siblings.slice(0, 6);
}

export const StageHeader: React.FC<StageHeaderProps> = ({
  fileName,
  filePath,
  metrics,
  explorerData,
  bundleFacts,
  onNeighborClick,
}) => {
  const siblings = React.useMemo(
    () => (filePath ? findSiblingFiles(filePath, explorerData, bundleFacts) : []),
    [filePath, explorerData, bundleFacts]
  );

  return (
    <div style={{ position: 'relative' }}>
      <div style={HeaderContainer}>
        {/* Left: Title & Navigation */}
        <div
          style={{ ...TitleStyle, flexDirection: 'column', alignItems: 'flex-start', gap: '4px' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>{fileName}</span>
            {metrics && metrics.riskScore > 0 && (
              <span
                style={{
                  fontSize: '10px',
                  opacity: 0.7,
                  backgroundColor: 'var(--vscode-badge-background)',
                  color: 'var(--vscode-badge-foreground)',
                  padding: '1px 4px',
                  borderRadius: '4px',
                }}
              >
                Risk: {metrics.riskScore}
              </span>
            )}
          </div>
          {siblings.length > 0 && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '10px',
                opacity: 0.7,
                flexWrap: 'wrap',
              }}
            >
              <span style={{ opacity: 0.5 }}>Neighbors:</span>
              {siblings.map(siblingPath => {
                const siblingName = basename(siblingPath);
                return (
                  <button
                    key={siblingPath}
                    onClick={() => onNeighborClick?.(siblingPath)}
                    style={{
                      fontSize: '10px',
                      padding: '2px 6px',
                      backgroundColor: 'var(--vscode-button-secondaryBackground)',
                      color: 'var(--vscode-button-secondaryForeground)',
                      border: '1px solid var(--vscode-button-border)',
                      borderRadius: '3px',
                      cursor: 'pointer',
                      transition: 'background-color 0.1s',
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.backgroundColor =
                        'var(--vscode-button-secondaryHoverBackground)';
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.backgroundColor =
                        'var(--vscode-button-secondaryBackground)';
                    }}
                    title={`Navigate to ${siblingName}`}
                  >
                    {siblingName}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Right: Bus Factor & Stats */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '11px' }}>
          {metrics && (
            <>
              <div title="Bus Factor (Top Authors)" style={{ display: 'flex', gap: '4px' }}>
                {metrics.authors?.map(author => (
                  <div
                    key={author}
                    style={{
                      width: '16px',
                      height: '16px',
                      borderRadius: '50%',
                      backgroundColor: 'var(--vscode-button-background)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '9px',
                      color: 'var(--vscode-button-foreground)',
                      cursor: 'help',
                    }}
                    title={author}
                  >
                    {author.charAt(0).toUpperCase()}
                  </div>
                ))}
              </div>
              <div title="Incoming References">
                Refs: <strong>{metrics.incomingRefs}</strong>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Health Bar Overlay */}
      {metrics && <div style={HealthBarStyle(metrics.riskScore)} />}
    </div>
  );
};
