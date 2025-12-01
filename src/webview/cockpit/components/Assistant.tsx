import * as React from 'react';
import { AssistantProps } from '../types/superWebviewTypes';

const AssistantContainer: React.CSSProperties = {
  height: '200px',
  borderTop: '1px solid var(--vscode-panel-border)',
  backgroundColor: 'var(--vscode-editor-background)',
  display: 'flex',
  flexDirection: 'column',
};

const HeaderStyle: React.CSSProperties = {
  padding: '8px 15px',
  backgroundColor: 'var(--vscode-panel-background)',
  borderBottom: '1px solid var(--vscode-panel-border)',
  fontSize: '0.9em',
  fontWeight: 'bold',
  display: 'flex',
  justifyContent: 'space-between',
};

const ChatAreaStyle: React.CSSProperties = {
  flex: 1,
  padding: '15px',
  overflow: 'auto',
};

const InputAreaStyle: React.CSSProperties = {
  padding: '10px',
  borderTop: '1px solid var(--vscode-panel-border)',
  display: 'flex',
  gap: '10px',
};

const InputStyle: React.CSSProperties = {
  flex: 1,
  padding: '8px',
  backgroundColor: 'var(--vscode-input-background)',
  color: 'var(--vscode-input-foreground)',
  border: '1px solid var(--vscode-input-border)',
  borderRadius: '2px',
};

const SuggestionChipStyle: React.CSSProperties = {
  padding: '4px 8px',
  backgroundColor: 'var(--vscode-badge-background)',
  color: 'var(--vscode-badge-foreground)',
  borderRadius: '12px',
  fontSize: '0.8em',
  cursor: 'pointer',
  marginRight: '8px',
  display: 'inline-block',
};

export const Assistant: React.FC<AssistantProps> = ({ frame, messages, onSend }) => {
  const [input, setInput] = React.useState('');

  const send = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setInput('');
  };

  return (
    <div style={AssistantContainer}>
      <div style={HeaderStyle}>
        <span>Assistant (Context: {frame.name})</span>
        <span style={{ fontSize: '0.8em', opacity: 0.7 }}>On-demand</span>
      </div>

      <div style={ChatAreaStyle}>
        {messages.map((m, idx) => (
          <div key={idx} style={{ marginBottom: '10px' }}>
            <span style={{ fontWeight: 'bold' }}>{m.role === 'user' ? 'You:' : 'AI:'} </span>
            <span>{m.content}</span>
          </div>
        ))}
        {!messages.length && (
          <div style={{ opacity: 0.7, fontSize: '0.9em' }}>
            I can explain this {frame.level}, summarize drift/risks, or review staged/unstaged
            changes in scope. Ask me something.
          </div>
        )}

        <div style={{ marginTop: '15px' }}>
          <div style={SuggestionChipStyle} onClick={() => send(`Explain this ${frame.level}`)}>
            Explain this {frame.level}
          </div>
          {frame.level === 'file' && (
            <>
              <div style={SuggestionChipStyle} onClick={() => send('Find hotspots in this file')}>
                Find Hotspots
              </div>
              <div
                style={SuggestionChipStyle}
                onClick={() => send('Generate unit tests for this file')}
              >
                Generate Unit Tests
              </div>
            </>
          )}
          {frame.data?.timeline?.some((t: any) => t.virtual) && (
            <div
              style={SuggestionChipStyle}
              onClick={() => send('Review staged changes for this scope')}
            >
              Review Staged Changes
            </div>
          )}
          <div style={SuggestionChipStyle} onClick={() => send('Identify risks here')}>
            Identify Risks
          </div>
        </div>
      </div>

      <div style={InputAreaStyle}>
        <input
          type="text"
          placeholder={`Ask about ${frame.name}...`}
          style={InputStyle}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') send(input);
          }}
        />
        <button style={{ padding: '8px 15px', cursor: 'pointer' }} onClick={() => send(input)}>
          Send
        </button>
      </div>
    </div>
  );
};
