import * as React from 'react';
import { SidebarProps } from '../types/superWebviewTypes';
import { RichTreeItem } from './RichTreeItem';
import { TimeSlider } from './TimeSlider';

const SidebarContainer: React.CSSProperties = {
  minWidth: '200px',
  width: '100%',
  maxWidth: '250px',
  borderRight: '1px solid var(--vscode-panel-border)',
  backgroundColor: 'var(--vscode-sideBar-background)',
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
  height: '100%',
};

const HeaderStyle: React.CSSProperties = {
  padding: '12px 16px',
  fontWeight: 600,
  borderBottom: '1px solid var(--vscode-panel-border)',
  fontSize: '11px',
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
  color: 'var(--vscode-sideBarTitle-foreground)',
  backgroundColor: 'var(--vscode-sideBarSectionHeader-background)',
  display: 'flex',
  flexDirection: 'column',
  gap: '4px',
};

const ListStyle: React.CSSProperties = {
  flex: 1,
  overflowY: 'auto',
  overflowX: 'hidden',
  padding: '8px 0',
};

export const Sidebar: React.FC<SidebarProps> = ({ 
  data, 
  activeId, 
  onSelect, 
  repoName, 
  branchName, 
  allMetrics,
  currentTimeFilter,
  onTimeFilterChange
}) => {
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
          <RichTreeItem 
            key={node.id} 
            node={node} 
            depth={0} 
            activeId={activeId} 
            onSelect={onSelect} 
            allMetrics={allMetrics}
          />
        ))}
      </div>
      {currentTimeFilter !== undefined && onTimeFilterChange && (
        <TimeSlider value={currentTimeFilter} onChange={onTimeFilterChange} />
      )}
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
