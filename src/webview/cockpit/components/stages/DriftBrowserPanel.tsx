import * as React from 'react';
import { RefactorBundleFacts } from '../../../../facts/types';

interface DriftBrowserPanelProps {
  bundleFacts: RefactorBundleFacts | null;
  onNavigate: (fileId: string, line?: number) => void;
}

const PanelContainer: React.CSSProperties = {
  borderTop: '1px solid var(--vscode-panel-border)',
  backgroundColor: 'var(--vscode-sideBar-background)',
  display: 'flex',
  flexDirection: 'column',
  maxHeight: '300px',
  overflow: 'hidden',
};

const TabContainer: React.CSSProperties = {
  display: 'flex',
  padding: '4px 8px',
  gap: '8px',
  fontSize: '11px',
  borderBottom: '1px solid var(--vscode-panel-border)',
  backgroundColor: 'var(--vscode-editor-background)',
};

const TabButton: React.CSSProperties = {
  padding: '4px 8px',
  fontSize: '10px',
  background: 'transparent',
  color: 'var(--vscode-foreground)',
  border: '1px solid var(--vscode-panel-border)',
  borderRadius: '3px',
  cursor: 'pointer',
  transition: 'background-color 0.1s',
};

const TabButtonActive: React.CSSProperties = {
  ...TabButton,
  backgroundColor: 'var(--vscode-button-background)',
  color: 'var(--vscode-button-foreground)',
};

const ContentContainer: React.CSSProperties = {
  maxHeight: '250px',
  overflow: 'auto',
  padding: '4px 8px',
  fontSize: '11px',
};

const DriftItem: React.CSSProperties = {
  padding: '6px 8px',
  borderBottom: '1px solid var(--vscode-panel-border)',
  cursor: 'pointer',
  transition: 'background-color 0.1s',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
};

export const DriftBrowserPanel: React.FC<DriftBrowserPanelProps> = ({
  bundleFacts,
  onNavigate,
}) => {
  const [activeTab, setActiveTab] = React.useState<'naming' | 'import' | 'file' | 'edges'>(
    'naming'
  );
  const [expanded, setExpanded] = React.useState(true);

  // Extract all drift data from bundleFacts (with fallbacks to both evidence and findings paths)
  // Note: driftImports and driftFiles arrays are only in evidence, not findings (findings only has counts)
  const namingDrift =
    bundleFacts?.findings?.patternDrift?.conventionDrift?.driftSymbols ||
    bundleFacts?.evidence?.['findings.patternDrift.conventionDrift']?.driftSymbols ||
    [];
  const importDrift =
    bundleFacts?.evidence?.['findings.patternDrift.conventionDrift']?.importDrift?.driftImports ||
    [];
  const fileDrift =
    bundleFacts?.evidence?.['findings.patternDrift.conventionDrift']?.fileNamingDrift?.driftFiles ||
    [];
  const missingEdges = bundleFacts?.evidence?.['findings.incompleteness']?.missing_edges || [];
  const zombieEdges = bundleFacts?.evidence?.['findings.incompleteness']?.zombie_edges || [];

  if (!expanded) {
    return (
      <div style={PanelContainer}>
        <div
          style={{
            ...TabContainer,
            cursor: 'pointer',
            padding: '6px 8px',
          }}
          onClick={() => setExpanded(true)}
        >
          <span>Drift Browser</span>
          <span style={{ opacity: 0.6, fontSize: '9px' }}>
            (
            {namingDrift.length +
              importDrift.length +
              fileDrift.length +
              missingEdges.length +
              zombieEdges.length}
            )
          </span>
        </div>
      </div>
    );
  }

  return (
    <div style={PanelContainer}>
      {/* Header with tabs */}
      <div style={TabContainer}>
        <button
          onClick={() => setActiveTab('naming')}
          style={activeTab === 'naming' ? TabButtonActive : TabButton}
          onMouseEnter={e => {
            if (activeTab !== 'naming') {
              e.currentTarget.style.backgroundColor = 'var(--vscode-list-hoverBackground)';
            }
          }}
          onMouseLeave={e => {
            if (activeTab !== 'naming') {
              e.currentTarget.style.backgroundColor = 'transparent';
            }
          }}
        >
          Naming ({namingDrift.length})
        </button>
        <button
          onClick={() => setActiveTab('import')}
          style={activeTab === 'import' ? TabButtonActive : TabButton}
          onMouseEnter={e => {
            if (activeTab !== 'import') {
              e.currentTarget.style.backgroundColor = 'var(--vscode-list-hoverBackground)';
            }
          }}
          onMouseLeave={e => {
            if (activeTab !== 'import') {
              e.currentTarget.style.backgroundColor = 'transparent';
            }
          }}
        >
          Imports ({importDrift.length})
        </button>
        <button
          onClick={() => setActiveTab('file')}
          style={activeTab === 'file' ? TabButtonActive : TabButton}
          onMouseEnter={e => {
            if (activeTab !== 'file') {
              e.currentTarget.style.backgroundColor = 'var(--vscode-list-hoverBackground)';
            }
          }}
          onMouseLeave={e => {
            if (activeTab !== 'file') {
              e.currentTarget.style.backgroundColor = 'transparent';
            }
          }}
        >
          Files ({fileDrift.length})
        </button>
        <button
          onClick={() => setActiveTab('edges')}
          style={activeTab === 'edges' ? TabButtonActive : TabButton}
          onMouseEnter={e => {
            if (activeTab !== 'edges') {
              e.currentTarget.style.backgroundColor = 'var(--vscode-list-hoverBackground)';
            }
          }}
          onMouseLeave={e => {
            if (activeTab !== 'edges') {
              e.currentTarget.style.backgroundColor = 'transparent';
            }
          }}
        >
          Edges ({missingEdges.length + zombieEdges.length})
        </button>
        <button
          onClick={() => setExpanded(false)}
          style={{
            ...TabButton,
            marginLeft: 'auto',
            padding: '2px 6px',
            fontSize: '9px',
          }}
        >
          −
        </button>
      </div>

      {/* Content - scrollable list */}
      <div style={ContentContainer}>
        {activeTab === 'naming' &&
          (namingDrift.length > 0 ? (
            namingDrift.map((item: any, i: number) => (
              <div
                key={i}
                style={DriftItem}
                onClick={() => onNavigate(item.path)}
                onMouseEnter={e => {
                  e.currentTarget.style.backgroundColor = 'var(--vscode-list-hoverBackground)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
                title={`Click to navigate to ${item.path}`}
              >
                <span style={{ fontWeight: 500 }}>{item.name}</span>
                <span style={{ opacity: 0.6, fontSize: '10px' }}>→ {item.suggestedName}</span>
              </div>
            ))
          ) : (
            <div style={{ padding: '12px', textAlign: 'center', opacity: 0.6, fontSize: '10px' }}>
              No naming drift issues
            </div>
          ))}
        {activeTab === 'import' &&
          (importDrift.length > 0 ? (
            importDrift.map((item: any, i: number) => (
              <div
                key={i}
                style={DriftItem}
                onClick={() => onNavigate(item.file, item.line)}
                onMouseEnter={e => {
                  e.currentTarget.style.backgroundColor = 'var(--vscode-list-hoverBackground)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
                title={`Click to navigate to ${item.file}:${item.line}`}
              >
                <span style={{ fontWeight: 500 }}>{item.importPath}</span>
                <span style={{ opacity: 0.6, fontSize: '10px' }}>style: {item.style}</span>
              </div>
            ))
          ) : (
            <div style={{ padding: '12px', textAlign: 'center', opacity: 0.6, fontSize: '10px' }}>
              No import drift issues
            </div>
          ))}
        {activeTab === 'file' &&
          (fileDrift.length > 0 ? (
            fileDrift.map((item: any, i: number) => (
              <div
                key={i}
                style={DriftItem}
                onClick={() => onNavigate(item.path)}
                onMouseEnter={e => {
                  e.currentTarget.style.backgroundColor = 'var(--vscode-list-hoverBackground)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
                title={`Click to navigate to ${item.path}`}
              >
                <span style={{ fontWeight: 500 }}>{item.filename || item.path}</span>
                <span style={{ opacity: 0.6, fontSize: '10px' }}>
                  {item.style} →{' '}
                  {bundleFacts?.findings?.patternDrift?.conventionDrift?.fileNamingDrift
                    ?.dominantStyle || 'unknown'}
                </span>
              </div>
            ))
          ) : (
            <div style={{ padding: '12px', textAlign: 'center', opacity: 0.6, fontSize: '10px' }}>
              No file naming drift issues
            </div>
          ))}
        {activeTab === 'edges' &&
          (missingEdges.length + zombieEdges.length > 0 ? (
            <>
              {missingEdges.map((edge: any, i: number) => (
                <div
                  key={`missing-${i}`}
                  style={DriftItem}
                  onMouseEnter={e => {
                    e.currentTarget.style.backgroundColor = 'var(--vscode-list-hoverBackground)';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                  title="Missing edge"
                >
                  <span
                    style={{
                      fontWeight: 500,
                      color: 'var(--vscode-inputValidation-errorForeground)',
                    }}
                  >
                    Missing: {edge.from || '?'} → {edge.to || '?'}
                  </span>
                  <span style={{ opacity: 0.6, fontSize: '10px' }}>
                    type: {edge.type || 'unknown'}
                  </span>
                </div>
              ))}
              {zombieEdges.map((edge: any, i: number) => (
                <div
                  key={`zombie-${i}`}
                  style={DriftItem}
                  onMouseEnter={e => {
                    e.currentTarget.style.backgroundColor = 'var(--vscode-list-hoverBackground)';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                  title="Zombie edge"
                >
                  <span
                    style={{
                      fontWeight: 500,
                      color: 'var(--vscode-inputValidation-warningForeground)',
                    }}
                  >
                    Zombie: {edge.from || '?'} → {edge.to || '?'}
                  </span>
                  <span style={{ opacity: 0.6, fontSize: '10px' }}>
                    type: {edge.type || 'unknown'}
                  </span>
                </div>
              ))}
            </>
          ) : (
            <div style={{ padding: '12px', textAlign: 'center', opacity: 0.6, fontSize: '10px' }}>
              No edge issues
            </div>
          ))}
      </div>
    </div>
  );
};
