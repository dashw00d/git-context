import * as React from 'react';

export const FileStage: React.FC<{ frame: any; onZoomIn: (frame: any) => void }> = ({
  frame,
  onZoomIn,
}) => {
  const [showSymbols, setShowSymbols] = React.useState(false);

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div
        style={{
          padding: '10px',
          borderBottom: '1px solid var(--vscode-panel-border)',
          flexShrink: 0,
        }}
      >
        <h3 style={{ fontSize: '1.1em', marginBottom: '5px' }}>{frame.name}</h3>
        <div style={{ fontSize: '0.8em', opacity: 0.8 }}>
          {frame.data?.lineCount} lines • {frame.data?.language}
          {frame.data?.changeStats && (
            <span style={{ marginLeft: '10px' }}>
              +{frame.data.changeStats.added} / -{frame.data.changeStats.removed}
            </span>
          )}
          {typeof frame.data?.hotspotScore === 'number' && (
            <span style={{ marginLeft: '10px', color: 'var(--vscode-charts-red)' }}>
              Hotspot: {frame.data.hotspotScore}
            </span>
          )}
        </div>
      </div>

      {/* Mobile: Toggle between symbols and content */}
      <div
        style={{
          padding: '8px 10px',
          borderBottom: '1px solid var(--vscode-panel-border)',
          display: 'flex',
          gap: '10px',
          flexShrink: 0,
        }}
      >
        <button
          onClick={() => setShowSymbols(false)}
          style={{
            flex: 1,
            padding: '6px',
            border: 'none',
            background: !showSymbols ? 'var(--vscode-button-background)' : 'transparent',
            color: !showSymbols ? 'var(--vscode-button-foreground)' : 'var(--vscode-foreground)',
            cursor: 'pointer',
            fontSize: '0.85em',
            borderRadius: '4px',
          }}
        >
          Content
        </button>
        <button
          onClick={() => setShowSymbols(true)}
          style={{
            flex: 1,
            padding: '6px',
            border: 'none',
            background: showSymbols ? 'var(--vscode-button-background)' : 'transparent',
            color: showSymbols ? 'var(--vscode-button-foreground)' : 'var(--vscode-foreground)',
            cursor: 'pointer',
            fontSize: '0.85em',
            borderRadius: '4px',
          }}
        >
          Symbols ({frame.data?.symbols?.length || 0})
        </button>
      </div>

      <div style={{ flex: 1, overflow: 'hidden', display: 'flex' }}>
        {!showSymbols ? (
          <div
            style={{
              flex: 1,
              overflow: 'auto',
              backgroundColor: 'var(--vscode-editor-background)',
              padding: '10px',
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
        ) : (
          <div style={{ flex: 1, overflow: 'auto' }}>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {frame.data?.symbols?.map((symbol: any) => (
                <li
                  key={symbol.id}
                  onClick={() =>
                    onZoomIn({
                      level: 'symbol',
                      id: `${frame.id}::${symbol.name}`,
                      name: symbol.name,
                      status: 'scanning',
                    })
                  }
                  style={{
                    padding: '10px',
                    borderBottom: '1px solid var(--vscode-input-border)',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                  }}
                >
                  <div style={{ fontSize: '0.9em', fontWeight: 'bold' }}>
                    <span style={{ opacity: 0.7, marginRight: '5px' }}>
                      {symbol.kind === 'function' ? '𝑓' : symbol.kind === 'class' ? 'C' : '•'}
                    </span>
                    {symbol.name}
                    {symbol.drift && (
                      <span
                        style={{
                          marginLeft: '8px',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          background: 'var(--vscode-inputValidation-warningBackground)',
                          color: 'var(--vscode-inputValidation-warningForeground)',
                          fontSize: '0.7em',
                          textTransform: 'uppercase',
                        }}
                      >
                        Drift
                      </span>
                    )}
                  </div>
                  {symbol.signature && (
                    <div
                      style={{
                        fontSize: '0.75em',
                        opacity: 0.7,
                        marginTop: '2px',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {symbol.signature}
                    </div>
                  )}
                </li>
              ))}
              {!frame.data?.symbols?.length && (
                <li style={{ padding: '20px', opacity: 0.6, textAlign: 'center' }}>
                  No symbols found
                </li>
              )}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};
