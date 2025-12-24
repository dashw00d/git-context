import * as React from 'react';
import { RiskDots } from './RiskDots';

interface SymbolInfo {
  id?: string;
  name: string;
  kind: string;
  location?: { start: { line: number }; end: { line: number } };
}

interface SymbolHeaderBarProps {
  symbol: SymbolInfo;
  incomingRefs: number;
  outgoingRefs: number;
  riskScore?: number;
  lastModified?: string;
  author?: string;
  isCollapsed: boolean;
  isDead: boolean;
  isLegacy: boolean;
  hasDrift: boolean;
  onToggle: () => void;
  onRefsClick?: (direction: 'in' | 'out') => void;
  onFocus?: () => void;
}

const getKindIcon = (kind: string): string => {
  const kindLower = kind.toLowerCase();
  if (kindLower.includes('function') || kindLower.includes('method')) return 'ƒ';
  if (kindLower.includes('class')) return 'C';
  if (kindLower.includes('interface')) return 'I';
  if (kindLower.includes('type')) return 'T';
  if (kindLower.includes('enum')) return 'E';
  if (kindLower.includes('const') || kindLower.includes('constant')) return 'c';
  if (kindLower.includes('variable')) return 'v';
  return '•';
};

export const SymbolHeaderBar: React.FC<SymbolHeaderBarProps> = React.memo(
  ({
    symbol,
    incomingRefs,
    outgoingRefs,
    riskScore,
    lastModified,
    author,
    isCollapsed,
    isDead,
    isLegacy,
    hasDrift,
    onToggle,
    onRefsClick,
    onFocus,
  }) => {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '2px 8px',
          backgroundColor: 'var(--vscode-editor-lineHighlightBackground)',
          borderRadius: '3px',
          fontSize: '11px',
          marginBottom: '2px',
          cursor: onFocus ? 'pointer' : 'default',
        }}
        onClick={onFocus}
        onMouseEnter={e => {
          if (onFocus) {
            e.currentTarget.style.backgroundColor = 'var(--vscode-list-hoverBackground)';
          }
        }}
        onMouseLeave={e => {
          if (onFocus) {
            e.currentTarget.style.backgroundColor = 'var(--vscode-editor-lineHighlightBackground)';
          }
        }}
      >
        {/* Kind badge */}
        <span
          style={{
            fontSize: '12px',
            fontWeight: 600,
            opacity: 0.8,
          }}
          title={symbol.kind}
        >
          {getKindIcon(symbol.kind)}
        </span>

        {/* Symbol name */}
        <span style={{ fontWeight: 600 }}>{symbol.name}</span>

        {/* Ref counts */}
        <span style={{ opacity: 0.7, display: 'flex', gap: '4px' }}>
          <span
            onClick={e => {
              e.stopPropagation();
              onRefsClick?.('in');
            }}
            style={{
              cursor: onRefsClick ? 'pointer' : 'default',
              color: onRefsClick ? 'var(--vscode-textLink-foreground)' : 'inherit',
            }}
            title="Incoming references"
          >
            ↙{incomingRefs}
          </span>
          <span
            onClick={e => {
              e.stopPropagation();
              onRefsClick?.('out');
            }}
            style={{
              cursor: onRefsClick ? 'pointer' : 'default',
              color: onRefsClick ? 'var(--vscode-textLink-foreground)' : 'inherit',
            }}
            title="Outgoing references"
          >
            ↗{outgoingRefs}
          </span>
        </span>

        {/* Risk dots */}
        {riskScore !== undefined && <RiskDots score={riskScore} />}

        {/* Age */}
        {lastModified && (
          <span style={{ opacity: 0.5, fontSize: '10px' }} title={`Last modified: ${lastModified}`}>
            {lastModified}
          </span>
        )}

        {/* Author initial */}
        {author && (
          <span style={{ opacity: 0.6, fontSize: '10px' }} title={author}>
            @{author.charAt(0)}
          </span>
        )}

        {/* Status badges */}
        {isDead && (
          <span title="Dead symbol" style={{ fontSize: '12px' }}>
            👻
          </span>
        )}
        {isLegacy && (
          <span title="Legacy symbol" style={{ fontSize: '12px' }}>
            ⚠️
          </span>
        )}
        {hasDrift && (
          <span title="Convention drift" style={{ fontSize: '12px' }}>
            📝
          </span>
        )}

        {/* Collapse toggle */}
        <button
          onClick={e => {
            e.stopPropagation();
            onToggle();
          }}
          style={{
            marginLeft: 'auto',
            background: 'transparent',
            border: 'none',
            color: 'var(--vscode-foreground)',
            cursor: 'pointer',
            fontSize: '10px',
            padding: '2px 4px',
          }}
          title={isCollapsed ? 'Expand' : 'Collapse'}
        >
          {isCollapsed ? '▶' : '▼'}
        </button>
      </div>
    );
  }
);
