import * as React from 'react';
import { postMessageWithTracing } from '../../utils/messageUtils';

export const SymbolStage: React.FC<{ frame: any; vscode?: any }> = ({ frame, vscode }) => (
  <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
    <div
      style={{
        padding: '10px',
        borderBottom: '1px solid var(--vscode-panel-border)',
        flexShrink: 0,
      }}
    >
      <h3 style={{ fontSize: '1.1em', marginBottom: '5px' }}>{frame.name}</h3>
      <div style={{ fontSize: '0.8em', opacity: 0.8 }}>{frame.data?.filePath}</div>
      {frame.data?.drift?.length > 0 && (
        <div style={{ marginTop: '6px', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {frame.data.drift.map((d: any, idx: number) => (
            <span
              key={idx}
              style={{
                padding: '2px 6px',
                borderRadius: '4px',
                background: 'var(--vscode-inputValidation-warningBackground)',
                color: 'var(--vscode-inputValidation-warningForeground)',
                fontSize: '0.75em',
              }}
            >
              Drift: {d.suggestedName || d.issue || 'Rename suggested'}
            </span>
          ))}
        </div>
      )}
      <div style={{ marginTop: '8px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        {frame.data?.symbolId && vscode && (
          <button
            onClick={() => {
              postMessageWithTracing(vscode, {
                type: 'openSymbolInEditor',
                symbolId: frame.data.symbolId,
              });
            }}
            style={{
              padding: '4px 8px',
              border: '1px solid var(--vscode-button-border)',
              background: 'var(--vscode-button-secondaryBackground)',
              color: 'var(--vscode-button-foreground)',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '0.8em',
            }}
          >
            Open in Editor
          </button>
        )}
        {frame.data?.drift?.[0]?.suggestedName && vscode && (
          <button
            onClick={() => {
              const suggestion = frame.data.drift[0].suggestedName;
              postMessageWithTracing(vscode, {
                type: 'applyRefactorSuggestion',
                payload: {
                  symbolId: frame.data.symbolId,
                  suggestedName: suggestion,
                  filePath: frame.data.filePath,
                },
              });
            }}
            style={{
              padding: '4px 8px',
              border: '1px solid var(--vscode-button-border)',
              background: 'var(--vscode-button-background)',
              color: 'var(--vscode-button-foreground)',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '0.8em',
            }}
          >
            Apply Suggestion (manual)
          </button>
        )}
        {vscode && (
          <button
            onClick={() => {
              postMessageWithTracing(vscode, {
                type: 'askAssistant',
                payload: {
                  symbolId: frame.data?.symbolId,
                  filePath: frame.data?.filePath,
                  drift: frame.data?.drift,
                },
              });
            }}
            style={{
              padding: '4px 8px',
              border: '1px solid var(--vscode-button-border)',
              background: 'var(--vscode-button-secondaryBackground)',
              color: 'var(--vscode-button-foreground)',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '0.8em',
            }}
          >
            Ask Assistant
          </button>
        )}
      </div>
    </div>

    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Code */}
      <div
        style={{
          flex: 1,
          overflow: 'auto',
          backgroundColor: 'var(--vscode-editor-background)',
          padding: '10px',
          borderBottom: '1px solid var(--vscode-panel-border)',
        }}
      >
        <pre
          style={{
            margin: 0,
            fontFamily: 'var(--vscode-editor-font-family)',
            fontSize: '0.85em',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            lineHeight: '1.5',
          }}
        >
          {frame.data?.content || 'Loading...'}
        </pre>
      </div>

      {/* History */}
      <div style={{ maxHeight: '220px', overflow: 'auto', padding: '10px', flexShrink: 0 }}>
        <h4 style={{ fontSize: '0.95em', marginBottom: '10px' }}>Evolution</h4>
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {frame.data?.history?.map((commit: any) => (
            <li
              key={commit.hash || commit.message || commit.date || commit.author}
              style={{
                marginBottom: '12px',
                borderLeft: '2px solid var(--vscode-charts-blue)',
                paddingLeft: '8px',
              }}
            >
              <div style={{ fontWeight: 'bold', fontSize: '0.85em' }}>
                {commit.message || commit.summary || commit.change}
              </div>
              <div style={{ fontSize: '0.75em', opacity: 0.7, marginTop: '2px' }}>
                {commit.date ? new Date(commit.date).toLocaleDateString() : ''} •{' '}
                {commit.author || 'unknown'}
              </div>
            </li>
          ))}
          {!frame.data?.history?.length && (
            <li style={{ opacity: 0.6, fontSize: '0.85em' }}>No evolution found.</li>
          )}
        </ul>
      </div>
    </div>
  </div>
);
