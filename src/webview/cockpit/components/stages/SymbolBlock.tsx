import * as React from 'react';

interface SymbolBlockProps {
  name: string;
  kind: string;
  startLine: number;
  endLine: number;
  complexity?: number;
  onClick?: () => void;
}

const BlockContainer: React.CSSProperties = {
  border: '1px solid var(--vscode-editor-lineHighlightBorder)',
  backgroundColor: 'var(--vscode-editor-inactiveSelectionBackground)',
  borderRadius: '4px',
  padding: '8px',
  margin: '4px 0',
  cursor: 'pointer',
  transition: 'transform 0.1s',
};

const HeaderStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: '4px',
};

const NameStyle: React.CSSProperties = {
  fontWeight: 600,
  fontSize: '12px',
  color: 'var(--vscode-symbolIcon-functionForeground)',
};

const MetaStyle: React.CSSProperties = {
  fontSize: '10px',
  color: 'var(--vscode-descriptionForeground)',
};

export const SymbolBlock: React.FC<SymbolBlockProps> = ({
  name,
  kind,
  startLine,
  endLine,
  complexity = 0,
  onClick,
}) => {
  const lineCount = endLine - startLine + 1;
  const height = Math.max(40, lineCount * 2);

  return (
    <div
      style={{ ...BlockContainer, height: `${height}px` }}
      onClick={onClick}
      title={`Click to zoom into ${name}`}
    >
      <div style={HeaderStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={NameStyle}>{name}</span>
          <span style={{ fontSize: '10px', opacity: 0.7 }}>({kind})</span>
        </div>
        <div style={MetaStyle}>
          {lineCount} lines • C{complexity}
        </div>
      </div>
      {/* Abstract representation of content */}
      <div style={{ opacity: 0.3, fontSize: '8px', overflow: 'hidden' }}>
        {Array.from({ length: Math.min(5, lineCount) }).map((_, i) => (
          <div
            key={i}
            style={{
              height: '4px',
              backgroundColor: 'currentColor',
              marginBottom: '2px',
              width: `${Math.random() * 60 + 40}%`,
            }}
          />
        ))}
      </div>
    </div>
  );
};
