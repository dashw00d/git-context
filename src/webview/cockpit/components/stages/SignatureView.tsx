import * as React from 'react';

interface SignatureViewProps {
  name: string;
  kind: string;
  signature?: string;
  startLine: number;
  endLine: number;
  hasDrift?: boolean;
  riskScore?: number;
  onClick?: () => void;
}

const SignatureContainer: React.CSSProperties = {
  border: '1px solid var(--vscode-editor-lineHighlightBorder)',
  backgroundColor: 'var(--vscode-editor-inactiveSelectionBackground)',
  borderRadius: '4px',
  padding: '6px 10px',
  margin: '2px 0',
  cursor: 'pointer',
  transition: 'background-color 0.1s',
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  fontSize: '12px',
  lineHeight: '18px',
};

const SignatureText: React.CSSProperties = {
  fontFamily: 'var(--vscode-editor-font-family)',
  color: 'var(--vscode-editor-foreground)',
  flex: 1,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

const KindBadge: React.CSSProperties = {
  fontSize: '10px',
  opacity: 0.7,
  padding: '1px 4px',
  borderRadius: '3px',
  backgroundColor: 'var(--vscode-badge-background)',
  color: 'var(--vscode-badge-foreground)',
};

const CollapseIcon: React.CSSProperties = {
  fontSize: '10px',
  opacity: 0.5,
  marginRight: '4px',
};

export const SignatureView: React.FC<SignatureViewProps> = ({
  name,
  kind,
  signature,
  startLine,
  endLine,
  hasDrift,
  riskScore,
  onClick,
}) => {
  const lineCount = endLine - startLine + 1;

  // Format signature display
  const displaySignature = signature || `${kind} ${name}`;
  const signatureText =
    displaySignature.length > 80 ? displaySignature.substring(0, 80) + '...' : displaySignature;

  return (
    <div
      style={SignatureContainer}
      onClick={onClick}
      onMouseEnter={e => {
        e.currentTarget.style.backgroundColor = 'var(--vscode-list-hoverBackground)';
      }}
      onMouseLeave={e => {
        e.currentTarget.style.backgroundColor = 'var(--vscode-editor-inactiveSelectionBackground)';
      }}
      title={`${name} (${kind}) - ${lineCount} lines - Click to focus`}
    >
      <span style={CollapseIcon}>▶</span>
      <span style={SignatureText}>{signatureText}</span>
      <span style={KindBadge}>{kind}</span>
      {hasDrift && (
        <span
          style={{
            fontSize: '10px',
            color: 'var(--vscode-inputValidation-warningForeground)',
          }}
          title="Has drift warnings"
        >
          ⚠️
        </span>
      )}
      {riskScore !== undefined && riskScore > 40 && (
        <span
          style={{
            fontSize: '8px',
            width: '6px',
            height: '6px',
            borderRadius: '50%',
            backgroundColor:
              riskScore > 70 ? 'var(--vscode-charts-red)' : 'var(--vscode-charts-yellow)',
          }}
          title={`Risk: ${riskScore}`}
        />
      )}
      <span
        style={{
          fontSize: '10px',
          opacity: 0.5,
          minWidth: '40px',
          textAlign: 'right',
        }}
      >
        {lineCount} lines
      </span>
    </div>
  );
};
