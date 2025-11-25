import * as React from 'react';

export const LiveTabContent: React.FC = () => {
  return (
    <div className="cockpit__tab-body cockpit__empty">
      <div style={{ textAlign: 'center', padding: '40px 20px' }}>
        <div style={{ fontSize: '48px', opacity: 0.3 }}>⚡</div>
        <div style={{ marginTop: '12px', fontSize: '14px' }}>Live Change Tracking</div>
        <div style={{ marginTop: '8px', fontSize: '12px', color: '#8a8f98' }}>
          Coming soon: Real-time symbol tracking as you edit
        </div>
      </div>
    </div>
  );
};
