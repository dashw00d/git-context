import * as React from 'react';

export interface Risk {
  name?: string;
  path?: string;
  issue: string;
  detail?: string;
}

export const RisksList: React.FC<{
  risks: Risk[];
}> = ({ risks }) => {
  if (risks.length === 0) {
    return null;
  }

  return (
    <div style={{ marginTop: '20px' }}>
      <h4 style={{ fontSize: '0.95em', marginBottom: '10px' }}>Top Risks</h4>
      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {risks.map((risk, idx) => (
          <li
            key={idx}
            style={{
              padding: '8px',
              border: '1px solid var(--vscode-inputValidation-warningBorder)',
              borderRadius: '4px',
              background: 'var(--vscode-inputValidation-warningBackground)',
              marginBottom: '8px',
            }}
          >
            <div style={{ fontWeight: 'bold' }}>{risk.name || risk.path}</div>
            <div style={{ fontSize: '0.8em', opacity: 0.8 }}>{risk.issue}</div>
            {risk.detail && <div style={{ fontSize: '0.8em', opacity: 0.8 }}>{risk.detail}</div>}
          </li>
        ))}
      </ul>
    </div>
  );
};
