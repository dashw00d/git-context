import * as React from 'react';
import { ChangeSparkline } from './ChangeSparkline';

interface SymbolInfo {
  id?: string;
  name: string;
  kind: string;
  location?: { start: { line: number }; end: { line: number } };
}

interface ChangeInfo {
  date: string;
  type: 'added' | 'modified' | 'removed';
  impact?: number;
  commitSha?: string;
  author?: string;
  message?: string;
}

interface SymbolMetrics {
  riskScore: number;
  churnScore?: number;
  lastModified?: number;
  driftCount?: number;
  incomingRefs: number;
  outgoingRefs: number;
  authors?: string[];
  ageDays?: number;
  lineCount?: number;
  lastCommitMessage?: string;
}

interface HoverInfoCardProps {
  symbol: SymbolInfo;
  metrics: SymbolMetrics;
  recentChanges: ChangeInfo[];
  position: { x: number; y: number };
  onClose: () => void;
  onGoToDefinition?: () => void;
  onFindReferences?: () => void;
}

const getRiskLabel = (score: number): string => {
  if (score > 70) return 'High Risk';
  if (score > 40) return 'Medium Risk';
  return 'Low Risk';
};

const formatDate = (timestamp?: number): string => {
  if (!timestamp) return 'Unknown';
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
  return `${Math.floor(diffDays / 365)} years ago`;
};

export const HoverInfoCard: React.FC<HoverInfoCardProps> = ({
  symbol,
  metrics,
  recentChanges,
  position,
  onClose,
  onGoToDefinition,
  onFindReferences,
}) => {
  const cardRef = React.useRef<HTMLDivElement>(null);

  // Adjust position if card would go off-screen
  React.useEffect(() => {
    if (cardRef.current) {
      const rect = cardRef.current.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      // Adjust horizontal position if needed
      if (rect.right > viewportWidth) {
        cardRef.current.style.left = `${viewportWidth - rect.width - 10}px`;
      }
      if (rect.left < 0) {
        cardRef.current.style.left = '10px';
      }

      // Adjust vertical position if needed
      if (rect.bottom > viewportHeight) {
        cardRef.current.style.top = `${viewportHeight - rect.height - 10}px`;
      }
      if (rect.top < 0) {
        cardRef.current.style.top = '10px';
      }
    }
  }, [position]);

  return (
    <div
      ref={cardRef}
      style={{
        position: 'fixed',
        left: `${position.x}px`,
        top: `${position.y}px`,
        zIndex: 1000,
        backgroundColor: 'var(--vscode-editorWidget-background)',
        border: '1px solid var(--vscode-editorWidget-border)',
        borderRadius: '4px',
        padding: '8px 12px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
        maxWidth: '300px',
        fontSize: '11px',
        color: 'var(--vscode-editorWidget-foreground)',
      }}
      onClick={e => e.stopPropagation()}
    >
      {/* Header with close button */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '4px',
        }}
      >
        <div style={{ fontWeight: 600, fontSize: '12px' }}>{symbol.name}</div>
        <button
          onClick={onClose}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--vscode-foreground)',
            cursor: 'pointer',
            fontSize: '14px',
            padding: '0',
            width: '18px',
            height: '18px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          title="Close"
        >
          ×
        </button>
      </div>

      {/* Meta */}
      <div style={{ opacity: 0.7, marginBottom: '8px', fontSize: '10px' }}>
        {symbol.kind} · {metrics.lineCount || '?'} lines · {getRiskLabel(metrics.riskScore)}
      </div>

      {/* Change sparkline */}
      {recentChanges.length > 0 && (
        <div style={{ marginBottom: '8px' }}>
          <ChangeSparkline changes={recentChanges} width={100} height={20} />
        </div>
      )}

      {/* Stats */}
      <div style={{ marginBottom: '8px', fontSize: '10px', opacity: 0.8 }}>
        <div style={{ display: 'flex', gap: '12px' }}>
          <span>↙ {metrics.incomingRefs} incoming</span>
          <span>↗ {metrics.outgoingRefs} outgoing</span>
        </div>
        {metrics.authors && metrics.authors.length > 0 && (
          <div style={{ marginTop: '4px' }}>
            Authors: {metrics.authors.slice(0, 3).join(', ')}
            {metrics.authors.length > 3 && ` +${metrics.authors.length - 3}`}
          </div>
        )}
      </div>

      {/* Last change */}
      {metrics.lastModified && (
        <div style={{ fontSize: '10px', opacity: 0.6, marginBottom: '8px' }}>
          Last: {formatDate(metrics.lastModified)}
          {metrics.authors && metrics.authors.length > 0 && ` by @${metrics.authors[0]}`}
          {metrics.lastCommitMessage && (
            <>
              <br />"
              {metrics.lastCommitMessage.length > 50
                ? metrics.lastCommitMessage.substring(0, 50) + '...'
                : metrics.lastCommitMessage}
              "
            </>
          )}
        </div>
      )}

      {/* Actions */}
      {(onGoToDefinition || onFindReferences) && (
        <div
          style={{
            marginTop: '8px',
            display: 'flex',
            gap: '8px',
            borderTop: '1px solid var(--vscode-panel-border)',
            paddingTop: '8px',
          }}
        >
          {onGoToDefinition && (
            <button
              onClick={onGoToDefinition}
              style={{
                fontSize: '10px',
                padding: '4px 8px',
                background: 'var(--vscode-button-background)',
                color: 'var(--vscode-button-foreground)',
                border: 'none',
                borderRadius: '3px',
                cursor: 'pointer',
              }}
            >
              Go to Definition
            </button>
          )}
          {onFindReferences && (
            <button
              onClick={onFindReferences}
              style={{
                fontSize: '10px',
                padding: '4px 8px',
                background: 'var(--vscode-button-secondaryBackground)',
                color: 'var(--vscode-button-secondaryForeground)',
                border: '1px solid var(--vscode-button-border)',
                borderRadius: '3px',
                cursor: 'pointer',
              }}
            >
              Find References
            </button>
          )}
        </div>
      )}
    </div>
  );
};
