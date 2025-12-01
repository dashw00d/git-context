import * as React from 'react';

export const TreemapNode: React.FC<{ node: any; depth?: number }> = ({ node, depth = 0 }) => {
  const children = node.children || [];
  const hasChildren = children.length > 0;
  const baseColor =
    node.score > 10
      ? 'var(--vscode-charts-red)'
      : node.score > 5
        ? 'var(--vscode-charts-orange)'
        : 'var(--vscode-charts-green)';

  return (
    <div
      style={{
        flex: node.weight || 1,
        minWidth: 80,
        minHeight: 60,
        border: '1px solid var(--vscode-panel-border)',
        borderRadius: 4,
        padding: 6,
        margin: 4,
        background: hasChildren
          ? 'var(--vscode-editor-background)'
          : 'var(--vscode-editor-inactiveSelectionBackground)',
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
      }}
      title={`${node.name}\nChurn: ${node.score.toFixed(1)}\n+${node.added || 0} / -${node.removed || 0}`}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: '0.8em',
          fontWeight: 'bold',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        <span>{node.name}</span>
        <span style={{ color: baseColor }}>{node.score}</span>
      </div>
      <div
        style={{
          height: 4,
          borderRadius: 2,
          background: 'var(--vscode-progressBar-background)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${Math.min((node.score || 0) * 2, 100)}%`,
            background: baseColor,
          }}
        />
      </div>
      <div style={{ fontSize: '0.7em', opacity: 0.7 }}>
        +{node.added || 0} / -{node.removed || 0}
      </div>
      {hasChildren && (
        <div style={{ display: 'flex', flexWrap: 'wrap', flex: 1, overflow: 'hidden' }}>
          {children.map((child: any) => (
            <TreemapNode key={child.id} node={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
};
