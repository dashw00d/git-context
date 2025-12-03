import * as React from 'react';

interface PortalsRailProps {
  incomingRefs?: number;
  outgoingRefs?: number;
  // In real app, pass detailed ref data:
  // refs: Array<{ path: string, type: 'incoming' | 'outgoing' }>
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

const PortalGroup: React.FC<{ name: string; count: number; type: 'incoming' | 'outgoing' }> = ({ name, count, type }) => (
  <div
    style={{
      padding: '8px 12px',
      borderBottom: '1px solid var(--vscode-panel-border)',
      cursor: 'pointer',
      transition: 'background-color 0.1s',
    }}
    onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--vscode-list-hoverBackground)'}
    onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
  >
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <span style={{ fontWeight: 600, fontSize: '11px', display: 'flex', alignItems: 'center', gap: '6px' }}>
        <span>{type === 'incoming' ? '↙' : '↗'}</span>
        {name}
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

export const PortalsRail: React.FC<PortalsRailProps> = ({ incomingRefs = 0, outgoingRefs = 0 }) => {
  return (
    <div style={RailContainer}>
      <div style={SectionHeader}>Incoming (Referenced By)</div>
      {/* Mock Data - In real app, group by folder */}
      <PortalGroup name="UTILS" count={Math.max(1, Math.floor(incomingRefs * 0.6))} type="incoming" />
      <PortalGroup name="CONTROLLERS" count={Math.max(0, Math.floor(incomingRefs * 0.4))} type="incoming" />

      <div style={SectionHeader}>Outgoing (References)</div>
      {/* Mock Data */}
      <PortalGroup name="TYPES" count={Math.max(1, Math.floor(outgoingRefs * 0.5))} type="outgoing" />
      <PortalGroup name="SERVICES" count={Math.max(0, Math.floor(outgoingRefs * 0.5))} type="outgoing" />
    </div>
  );
};
