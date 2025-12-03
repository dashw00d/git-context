import * as React from 'react';
import { NodeMetrics } from '../../../../types/cockpit';

interface StageHeaderProps {
  fileName: string;
  metrics?: NodeMetrics;
  onNavigate?: (direction: 'prev' | 'next') => void;
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
  const color = riskScore > 70 ? 'var(--vscode-charts-red)' : 
                riskScore > 40 ? 'var(--vscode-charts-yellow)' : 
                'var(--vscode-charts-green)';
  
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

export const StageHeader: React.FC<StageHeaderProps> = ({ fileName, metrics, onNavigate }) => {
  return (
    <div style={{ position: 'relative' }}>
      <div style={HeaderContainer}>
        {/* Left: Title & Navigation */}
        <div style={TitleStyle}>
          <span>{fileName}</span>
          {metrics && metrics.riskScore > 0 && (
            <span style={{ 
              fontSize: '10px', 
              opacity: 0.7, 
              backgroundColor: 'var(--vscode-badge-background)', 
              color: 'var(--vscode-badge-foreground)',
              padding: '1px 4px',
              borderRadius: '4px'
            }}>
              Risk: {metrics.riskScore}
            </span>
          )}
        </div>

        {/* Right: Bus Factor & Stats */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '11px' }}>
          {metrics && (
            <>
              <div title="Bus Factor (Top Authors)" style={{ display: 'flex', gap: '4px' }}>
                {metrics.authors?.map(author => (
                   <div key={author} style={{ 
                     width: '16px', 
                     height: '16px', 
                     borderRadius: '50%', 
                     backgroundColor: 'var(--vscode-button-background)',
                     display: 'flex',
                     alignItems: 'center',
                     justifyContent: 'center',
                     fontSize: '9px',
                     color: 'var(--vscode-button-foreground)',
                     cursor: 'help'
                   }} title={author}>
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
