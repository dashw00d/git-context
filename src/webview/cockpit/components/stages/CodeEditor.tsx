import * as React from 'react';

interface CodeEditorProps {
  content: string;
  language: string;
  driftLines?: number[]; // Lines that have drift warnings
}

const EditorContainer: React.CSSProperties = {
  flex: 1,
  overflow: 'auto',
  backgroundColor: 'var(--vscode-editor-background)',
  fontFamily: 'var(--vscode-editor-font-family)',
  fontSize: '13px',
  lineHeight: '20px',
  padding: '0',
  color: 'var(--vscode-editor-foreground)',
};

const LineStyle: React.CSSProperties = {
  height: '20px',
  paddingLeft: '12px',
  whiteSpace: 'pre',
  display: 'flex',
  alignItems: 'center',
  position: 'relative',
};

const DriftWarningStyle: React.CSSProperties = {
  position: 'absolute',
  right: '20px',
  fontSize: '10px',
  color: 'var(--vscode-inputValidation-warningForeground)',
  backgroundColor: 'var(--vscode-inputValidation-warningBackground)',
  padding: '1px 6px',
  borderRadius: '4px',
  pointerEvents: 'none',
  display: 'flex',
  alignItems: 'center',
  gap: '4px',
};

export const CodeEditor: React.FC<CodeEditorProps> = ({ content, language, driftLines = [] }) => {
  const lines = content.split('\n');

  return (
    <div style={EditorContainer}>
      {lines.map((line, i) => {
        const lineNumber = i + 1;
        const hasDrift = driftLines.includes(lineNumber) || line.includes('TODO') || line.includes('FIXME'); // Mock drift detection

        return (
          <div
            key={i}
            style={{
              ...LineStyle,
              backgroundColor: hasDrift ? 'rgba(255, 165, 0, 0.05)' : 'transparent',
            }}
          >
            {hasDrift && (
              <span style={DriftWarningStyle}>
                <span>⚠️</span> DRIFT
              </span>
            )}
            {line}
          </div>
        );
      })}
    </div>
  );
};
