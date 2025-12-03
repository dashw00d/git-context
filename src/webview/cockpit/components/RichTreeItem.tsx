import * as React from 'react';
import { ExplorerNode, NodeMetrics } from '../../../types/cockpit';

interface RichTreeItemProps {
  node: ExplorerNode;
  depth: number;
  activeId: string;
  allMetrics?: Record<string, NodeMetrics>;
  onSelect: (node: ExplorerNode) => void;
}

const NodeStyle = (isActive: boolean): React.CSSProperties => ({
  padding: '4px 8px 4px 0',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  backgroundColor: isActive ? 'var(--vscode-list-activeSelectionBackground)' : 'transparent',
  color: isActive
    ? 'var(--vscode-list-activeSelectionForeground)'
    : 'var(--vscode-list-foreground)',
  position: 'relative',
  fontSize: '13px',
  lineHeight: '22px',
  transition: 'background-color 0.1s ease',
  minHeight: '24px',
});

const SentinelStrip: React.FC<{ lastModified?: number }> = ({ lastModified }) => {
  if (!lastModified) {
    return (
      <div
        style={{
          width: '4px',
          height: '100%',
          marginRight: '6px',
          borderRight: '1px solid var(--vscode-tree-indentGuidesStroke)',
        }}
      />
    );
  }

  const now = Date.now();
  const diff = now - lastModified;
  const isToday = diff < 24 * 60 * 60 * 1000;
  const isWeek = diff < 7 * 24 * 60 * 60 * 1000;

  if (isToday) {
    return (
      <div
        title="Edited Today"
        style={{
          width: '4px',
          height: '100%',
          backgroundColor: 'var(--vscode-charts-green)',
          marginRight: '6px',
        }}
      />
    );
  }

  if (isWeek) {
    return (
      <div
        title="Edited this week"
        style={{
          width: '4px',
          height: '100%',
          borderLeft: '1px solid var(--vscode-charts-blue)',
          borderRight: '1px solid var(--vscode-charts-blue)',
          marginRight: '6px',
        }}
      />
    );
  }

  return (
    <div
      title="Stable (Older than 1 week)"
      style={{
        width: '4px',
        height: '100%',
        borderRight: '1px solid var(--vscode-tree-indentGuidesStroke)',
        marginRight: '6px',
      }}
    />
  );
};

const RiskIndicator: React.FC<{ score: number }> = ({ score }) => {
  if (score < 10) return null;

  let color = 'var(--vscode-charts-green)';
  if (score > 70) color = 'var(--vscode-charts-red)';
  else if (score > 40) color = 'var(--vscode-charts-yellow)';

  return (
    <div
      title={`Risk Score: ${score}`}
      style={{
        width: '8px',
        height: '8px',
        borderRadius: '50%',
        backgroundColor: color,
        marginLeft: '6px',
        flexShrink: 0,
        boxShadow: '0 0 2px rgba(0,0,0,0.2)',
      }}
    />
  );
};

const DriftIcon: React.FC<{ count: number }> = ({ count }) => {
  if (count <= 0) return null;
  return (
    <span
      title={`${count} Drift Warnings`}
      style={{ fontSize: '12px', marginLeft: '6px', cursor: 'help' }}
    >
      👻
    </span>
  );
};

const TrafficBadge: React.FC<{ count: number }> = ({ count }) => {
  if (count <= 5) return null;
  return (
    <span
      title={`${count} Incoming References`}
      style={{
        fontSize: '10px',
        color: 'var(--vscode-descriptionForeground)',
        marginLeft: '6px',
        fontFamily: 'monospace',
        cursor: 'pointer',
      }}
      onMouseEnter={e => {
        // TODO: Trigger highlight in tree (requires state lift)
        e.currentTarget.style.color = 'var(--vscode-textLink-foreground)';
      }}
      onMouseLeave={e => {
        e.currentTarget.style.color = 'var(--vscode-descriptionForeground)';
      }}
    >
      {count}
    </span>
  );
};

export const RichTreeItem: React.FC<RichTreeItemProps> = ({
  node,
  depth,
  activeId,
  allMetrics,
  onSelect,
}) => {
  const [expanded, setExpanded] = React.useState(true);
  const hasChildren = node.children && node.children.length > 0;
  const isActive = node.id === activeId;
  const metrics = allMetrics ? allMetrics[node.id] : undefined;

  const handleSelect = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelect(node);
    if (hasChildren) setExpanded(!expanded);
  };

  const tooltip = metrics
    ? `${node.name}\nRisk: ${metrics.riskScore}\nChurn: ${metrics.churnScore}\nDrift: ${metrics.driftCount}\nLast Modified: ${new Date(metrics.lastModified).toLocaleDateString()}`
    : node.name;

  return (
    <div>
      <div
        style={{ ...NodeStyle(isActive), paddingLeft: 0 }}
        onClick={handleSelect}
        title={tooltip}
      >
        {/* Indentation + Sentinel */}
        <div style={{ display: 'flex', height: '22px', alignItems: 'center' }}>
          {/* Indent spacer */}
          <div style={{ width: `${depth * 12}px`, height: '100%' }} />
          {/* Sentinel Strip */}
          <SentinelStrip lastModified={metrics?.lastModified} />
        </div>

        {/* Icon / Status */}
        <div
          style={{
            width: '6px',
            height: '6px',
            borderRadius: '50%',
            backgroundColor:
              node.status === 'ready'
                ? 'var(--vscode-charts-green)'
                : node.status === 'scanning'
                  ? 'var(--vscode-charts-yellow)'
                  : 'var(--vscode-disabledForeground)',
            marginRight: '6px',
            flexShrink: 0,
            opacity: 0.7,
            animation: node.status === 'scanning' ? 'pulse 1.5s infinite ease-in-out' : 'none',
          }}
        />

        {/* Name */}
        <span
          style={{
            flex: 1,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            opacity: metrics?.riskScore && metrics.riskScore > 70 ? 1 : 0.9,
            fontWeight: isActive ? 600 : 400,
            textDecoration:
              metrics?.driftCount && metrics.driftCount > 0
                ? 'underline wavy var(--vscode-charts-orange)'
                : 'none',
          }}
        >
          {node.name}
        </span>

        {/* Telemetry (Right Aligned) */}
        <div
          style={{ display: 'flex', alignItems: 'center', marginLeft: 'auto', paddingRight: '8px' }}
        >
          {metrics && (
            <>
              <TrafficBadge count={metrics.incomingRefs} />
              <DriftIcon count={metrics.driftCount} />
              <RiskIndicator score={metrics.riskScore} />
            </>
          )}
        </div>
      </div>

      {/* Children */}
      {hasChildren && expanded && (
        <div>
          {node.children!.map(child => (
            <RichTreeItem
              key={child.id}
              node={child}
              depth={depth + 1}
              activeId={activeId}
              allMetrics={allMetrics}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </div>
  );
};
