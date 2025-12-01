import * as React from 'react';
import { SidebarProps } from '../types/superWebviewTypes';
import { ExplorerNode, AnalysisStatus } from '../../../types/cockpit';

const SidebarContainer: React.CSSProperties = {
  minWidth: '200px',
  width: '100%',
  maxWidth: '250px',
  borderRight: '1px solid var(--vscode-panel-border)',
  backgroundColor: 'var(--vscode-sideBar-background)',
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
};

const HeaderStyle: React.CSSProperties = {
  padding: '10px',
  fontWeight: 'bold',
  borderBottom: '1px solid var(--vscode-panel-border)',
  fontSize: '0.8em',
  textTransform: 'uppercase',
  color: 'var(--vscode-sideBarTitle-foreground)',
};

const ListStyle: React.CSSProperties = {
  flex: 1,
  overflow: 'auto',
  padding: '5px 0',
};

const NodeStyle = (isActive: boolean): React.CSSProperties => ({
  padding: '4px 10px',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  backgroundColor: isActive ? 'var(--vscode-list-activeSelectionBackground)' : 'transparent',
  color: isActive
    ? 'var(--vscode-list-activeSelectionForeground)'
    : 'var(--vscode-list-foreground)',
});

const StatusIcon = ({ status }: { status: AnalysisStatus }) => {
  let color = 'gray';
  let title = 'Unknown';

  switch (status) {
    case 'ready':
      color = 'var(--vscode-charts-green)';
      title = 'Ready';
      break;
    case 'scanning':
      color = 'var(--vscode-charts-yellow)';
      title = 'Scanning';
      break;
    case 'unknown':
      color = 'var(--vscode-disabledForeground)';
      title = 'Not Scanned';
      break;
  }

  return (
    <div
      title={title}
      style={{
        width: '8px',
        height: '8px',
        borderRadius: '50%',
        backgroundColor: color,
        marginRight: '8px',
        flexShrink: 0,
        animation: status === 'scanning' ? 'pulse 1s infinite' : 'none',
      }}
    />
  );
};

const TreeNode: React.FC<{
  node: ExplorerNode;
  depth: number;
  activeId: string;
  onSelect: (n: ExplorerNode) => void;
}> = ({ node, depth, activeId, onSelect }) => {
  const [expanded, setExpanded] = React.useState(true);
  const hasChildren = node.children && node.children.length > 0;

  return (
    <div>
      <div
        style={{ ...NodeStyle(node.id === activeId), paddingLeft: `${depth * 15 + 10}px` }}
        onClick={() => {
          onSelect(node);
          if (hasChildren) setExpanded(!expanded);
        }}
      >
        <StatusIcon status={node.status} />
        <span
          style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
        >
          {node.name}
        </span>
      </div>
      {hasChildren && expanded && (
        <div>
          {node.children!.map(child => (
            <TreeNode
              key={child.id}
              node={child}
              depth={depth + 1}
              activeId={activeId}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export const Sidebar: React.FC<
  SidebarProps & { repoName?: string | null; branchName?: string | null }
> = ({ data, activeId, onSelect, repoName, branchName }) => {
  return (
    <div style={SidebarContainer}>
      <div style={HeaderStyle}>
        <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {repoName || 'EXPLORER'}
        </div>
        {branchName && (
          <div
            style={{
              fontSize: '0.8em',
              opacity: 0.7,
              fontWeight: 'normal',
              marginTop: '2px',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            ⎇ {branchName}
          </div>
        )}
      </div>
      <div style={ListStyle}>
        {data.map(node => (
          <TreeNode key={node.id} node={node} depth={0} activeId={activeId} onSelect={onSelect} />
        ))}
      </div>
      <style>
        {`
          @keyframes pulse {
            0% { opacity: 1; }
            50% { opacity: 0.4; }
            100% { opacity: 1; }
          }
        `}
      </style>
    </div>
  );
};
