import * as React from 'react';
import { StageProps } from '../types/superWebviewTypes';
import { ZoomLevel } from '../../../types/cockpit';

const StageContainer: React.CSSProperties = {
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  backgroundColor: 'var(--vscode-editor-background)',
  overflow: 'hidden',
  position: 'relative',
};

const HeaderStyle: React.CSSProperties = {
  padding: '10px 20px',
  borderBottom: '1px solid var(--vscode-panel-border)',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  backgroundColor: 'var(--vscode-editor-background)',
};

const ContentStyle: React.CSSProperties = {
  flex: 1,
  padding: '20px',
  overflow: 'auto',
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
};

const TreemapNode: React.FC<{ node: any; depth?: number }> = ({ node, depth = 0 }) => {
  const children = node.children || [];
  const hasChildren = children.length > 0;
  const baseColor =
    node.score > 10
      ? 'var(--vscode-charts-red)'
      : node.score > 5
        ? 'var(--vscode-charts-orange)'
        : 'var(--vscode-charts-green)';

  return (
    <div
      style={{
        flex: node.weight || 1,
        minWidth: 80,
        minHeight: 60,
        border: '1px solid var(--vscode-panel-border)',
        borderRadius: 4,
        padding: 6,
        margin: 4,
        background: hasChildren
          ? 'var(--vscode-editor-background)'
          : 'var(--vscode-editor-inactiveSelectionBackground)',
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
      }}
      title={`${node.name}\nChurn: ${node.score.toFixed(1)}\n+${node.added || 0} / -${node.removed || 0}`}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: '0.8em',
          fontWeight: 'bold',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        <span>{node.name}</span>
        <span style={{ color: baseColor }}>{node.score}</span>
      </div>
      <div
        style={{
          height: 4,
          borderRadius: 2,
          background: 'var(--vscode-progressBar-background)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${Math.min((node.score || 0) * 2, 100)}%`,
            background: baseColor,
          }}
        />
      </div>
      <div style={{ fontSize: '0.7em', opacity: 0.7 }}>
        +{node.added || 0} / -{node.removed || 0}
      </div>
      {hasChildren && (
        <div style={{ display: 'flex', flexWrap: 'wrap', flex: 1, overflow: 'hidden' }}>
          {children.map((child: any) => (
            <TreemapNode key={child.id} node={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
};

// --- Placeholder Sub-Stages ---

const BundleStage: React.FC<{
  frame: any;
  onZoomIn: (frame: any) => void;
  cockpitState?: CockpitState;
  vscode?: any;
}> = ({ frame, onZoomIn, cockpitState, vscode }) => {
  const [isConfigOpen, setIsConfigOpen] = React.useState(false);
  type BundleConfig = {
    mode: 'repo' | 'module' | 'changes' | 'custom';
    roots: string[];
    includeConnected: boolean;
    exclusions: string[];
  };
  const defaultConfig: BundleConfig = {
    mode: 'repo',
    roots: [],
    includeConnected: false,
    exclusions: [],
  };
  const [formConfig, setFormConfig] = React.useState<BundleConfig>(
    cockpitState?.bundleConfig || defaultConfig
  );
  const [depth, setDepth] = React.useState<number>(cockpitState?.lastNCommits || 20);

  React.useEffect(() => {
    setFormConfig(
      cockpitState?.bundleConfig || {
        mode: 'repo',
        roots: [],
        includeConnected: false,
        exclusions: [],
      }
    );
    setDepth(cockpitState?.lastNCommits || 20);
  }, [cockpitState?.bundleConfig, cockpitState?.lastNCommits]);

  const handleConfigChange = (updates: Partial<BundleConfig>) => {
    setFormConfig(prev => ({ ...prev, ...updates }));
  };

  const applyConfig = () => {
    if (!vscode) return;
    vscode.postMessage({ type: 'updateBundleConfig', config: formConfig });
    vscode.postMessage({ type: 'setLastNCommits', value: depth });
    vscode.postMessage({ type: 'generateReport', mode: 'selection', force: true });
  };

  return (
    <div style={{ width: '100%', padding: '10px', overflow: 'auto' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '10px',
        }}
      >
        <h3 style={{ fontSize: '1.2em', margin: 0 }}>Hotspots</h3>
        <button
          onClick={() => setIsConfigOpen(!isConfigOpen)}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--vscode-textLink-foreground)',
            cursor: 'pointer',
            fontSize: '0.9em',
          }}
        >
          {isConfigOpen ? 'Hide Scope' : 'Configure Scope'}
        </button>
      </div>

      {isConfigOpen && (
        <div
          style={{
            marginBottom: '15px',
            padding: '10px',
            backgroundColor: 'var(--vscode-editor-inactiveSelectionBackground)',
            borderRadius: '4px',
            border: '1px solid var(--vscode-panel-border)',
          }}
        >
          <div style={{ marginBottom: '10px' }}>
            <label
              style={{
                display: 'block',
                marginBottom: '5px',
                fontWeight: 'bold',
                fontSize: '0.9em',
              }}
            >
              Mode
            </label>
            <select
              value={formConfig.mode}
              onChange={e => handleConfigChange({ mode: e.target.value as BundleConfig['mode'] })}
              style={{
                width: '100%',
                padding: '4px',
                background: 'var(--vscode-dropdown-background)',
                color: 'var(--vscode-dropdown-foreground)',
                border: '1px solid var(--vscode-dropdown-border)',
              }}
            >
              <option value="repo">Full Repo</option>
              <option value="module">Current Module</option>
              <option value="changes">My Changes (Staged + Unstaged)</option>
              <option value="custom">Custom Roots</option>
            </select>
          </div>

          {formConfig.mode === 'custom' && (
            <div style={{ marginBottom: '10px' }}>
              <label
                style={{
                  display: 'block',
                  marginBottom: '5px',
                  fontWeight: 'bold',
                  fontSize: '0.9em',
                }}
              >
                Roots (comma separated)
              </label>
              <input
                type="text"
                value={formConfig.roots.join(', ')}
                onChange={e =>
                  handleConfigChange({
                    roots: e.target.value
                      .split(',')
                      .map(s => s.trim())
                      .filter(Boolean),
                  })
                }
                placeholder="src/auth, utils.ts"
                style={{
                  width: '100%',
                  padding: '4px',
                  background: 'var(--vscode-input-background)',
                  color: 'var(--vscode-input-foreground)',
                  border: '1px solid var(--vscode-input-border)',
                }}
              />
            </div>
          )}

          <div style={{ marginBottom: '10px' }}>
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                fontSize: '0.9em',
                cursor: 'pointer',
              }}
            >
              <input
                type="checkbox"
                checked={formConfig.includeConnected}
                onChange={e => handleConfigChange({ includeConnected: e.target.checked })}
                style={{ marginRight: '8px' }}
              />
              Include Connected Set (Callers/Callees)
            </label>
          </div>

          <div style={{ marginBottom: '10px' }}>
            <label
              style={{
                display: 'block',
                marginBottom: '5px',
                fontWeight: 'bold',
                fontSize: '0.9em',
              }}
            >
              Exclusions (glob)
            </label>
            <input
              type="text"
              value={formConfig.exclusions.join(', ')}
              onChange={e =>
                handleConfigChange({
                  exclusions: e.target.value
                    .split(',')
                    .map(s => s.trim())
                    .filter(Boolean),
                })
              }
              placeholder="**/*.test.ts"
              style={{
                width: '100%',
                padding: '4px',
                background: 'var(--vscode-input-background)',
                color: 'var(--vscode-input-foreground)',
                border: '1px solid var(--vscode-input-border)',
              }}
            />
          </div>

          <div style={{ marginBottom: '10px' }}>
            <label
              style={{
                display: 'block',
                marginBottom: '5px',
                fontWeight: 'bold',
                fontSize: '0.9em',
              }}
            >
              Analysis Depth (Commits)
            </label>
            <input
              type="number"
              min="1"
              max="100"
              value={depth}
              onChange={e => {
                const val = parseInt(e.target.value);
                if (!isNaN(val)) {
                  setDepth(val);
                }
              }}
              style={{
                width: '100%',
                padding: '4px',
                background: 'var(--vscode-input-background)',
                color: 'var(--vscode-input-foreground)',
                border: '1px solid var(--vscode-input-border)',
              }}
            />
          </div>

          <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
            <button
              onClick={() => {
                applyConfig();
                setIsConfigOpen(false); // Close the config panel immediately for better UX
              }}
              disabled={cockpitState?.isAnalyzing} // Disable button while analysis is in progress
              style={{
                flex: 1,
                padding: '6px',
                background: cockpitState?.isAnalyzing
                  ? 'var(--vscode-button-secondaryBackground)'
                  : 'var(--vscode-button-background)',
                color: cockpitState?.isAnalyzing
                  ? 'var(--vscode-button-secondaryForeground)'
                  : 'var(--vscode-button-foreground)',
                border: 'none',
                borderRadius: '2px',
                cursor: cockpitState?.isAnalyzing ? 'not-allowed' : 'pointer',
                opacity: cockpitState?.isAnalyzing ? 0.7 : 1,
              }}
            >
              {cockpitState?.isAnalyzing ? 'Analyzing...' : 'Apply & Analyze'}
            </button>
          </div>
        </div>
      )}

      {cockpitState?.bundleSummary && (
        <div
          style={{
            display: 'flex',
            gap: '15px',
            marginBottom: '15px',
            fontSize: '0.85em',
            color: 'var(--vscode-descriptionForeground)',
            borderBottom: '1px solid var(--vscode-panel-border)',
            paddingBottom: '10px',
          }}
        >
          <div>
            <strong>{cockpitState.bundleSummary.commitCount}</strong> commits
          </div>
          <div>
            <strong>{cockpitState.bundleSummary.fileCount}</strong> files
          </div>
          {cockpitState.bundleSummary.symbolCount && (
            <div>
              <strong>{cockpitState.bundleSummary.symbolCount}</strong> symbols
            </div>
          )}
        </div>
      )}

      {/* Treemap heatmap */}
      {frame.data?.treemap && frame.data.treemap.length > 0 ? (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '15px' }}>
          {frame.data.treemap.map((node: any) => (
            <TreemapNode key={node.id} node={node} />
          ))}
        </div>
      ) : (
        <p style={{ fontSize: '0.85em', color: 'var(--vscode-descriptionForeground)' }}>
          {cockpitState?.isAnalyzing
            ? 'Loading heatmap...'
            : 'No churn data yet. Run Analyze to populate the heatmap.'}
        </p>
      )}

      {/* Hotspot list fallback */}
      {frame.data?.hotspots && frame.data.hotspots.length > 0 && (
        <>
          <p
            style={{
              fontSize: '0.85em',
              color: 'var(--vscode-descriptionForeground)',
              marginBottom: '10px',
            }}
          >
            Most modified files (3 months)
          </p>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
              gap: '10px',
            }}
          >
            {frame.data.hotspots.map((file: any) => (
              <div
                key={file.path}
                onClick={() =>
                  onZoomIn({
                    level: 'file',
                    id: file.path,
                    name: file.name || file.path.split('/').pop(),
                    status: 'scanning',
                  })
                }
                style={{
                  padding: '12px 10px',
                  border: '1px solid var(--vscode-button-background)',
                  backgroundColor: 'var(--vscode-editor-background)',
                  cursor: 'pointer',
                  borderRadius: '4px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px',
                  minHeight: '80px',
                }}
                title={`${file.name}\nChurn: ${file.score || 0}\n+${file.added || 0} / -${file.removed || 0}`}
              >
                <div
                  style={{
                    fontWeight: 'bold',
                    fontSize: '0.9em',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {file.name}
                </div>
                <div
                  style={{
                    fontSize: '0.75em',
                    color: 'var(--vscode-descriptionForeground)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {file.path}
                </div>
                <div style={{ fontSize: '0.75em', opacity: 0.7 }}>
                  +{file.added || 0} / -{file.removed || 0}
                </div>
                <div
                  style={{
                    height: '6px',
                    borderRadius: '3px',
                    background: 'var(--vscode-progressBar-background)',
                    overflow: 'hidden',
                    marginTop: 'auto',
                  }}
                >
                  <div
                    style={{
                      width: `${Math.min((file.score || 0) * 2, 100)}%`,
                      height: '100%',
                      background:
                        file.score > 10
                          ? 'var(--vscode-charts-red)'
                          : file.score > 5
                            ? 'var(--vscode-charts-orange)'
                            : 'var(--vscode-charts-green)',
                    }}
                  ></div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
      {frame.data?.hotspots && frame.data.hotspots.length === 0 && !cockpitState?.isAnalyzing && (
        <p style={{ fontSize: '0.85em', color: 'var(--vscode-descriptionForeground)' }}>
          No hotspots available for this scope.
        </p>
      )}

      {frame.data?.risks?.length > 0 && (
        <div style={{ marginTop: '20px' }}>
          <h4 style={{ fontSize: '0.95em', marginBottom: '10px' }}>Top Risks</h4>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {frame.data.risks.map((risk: any, idx: number) => (
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
                {risk.detail && (
                  <div style={{ fontSize: '0.8em', opacity: 0.8 }}>{risk.detail}</div>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

const BlastRadiusStage: React.FC<{ frame: any; onZoomIn: (frame: any) => void }> = ({
  frame,
  onZoomIn,
}) => {
  const [showIncoming, setShowIncoming] = React.useState(true);
  const [showOutgoing, setShowOutgoing] = React.useState(true);
  const incoming = frame.data?.blastRadius?.incoming || [];
  const outgoing = frame.data?.blastRadius?.outgoing || [];
  const center = frame.name;
  const nodes = [
    ...incoming.map((edge: any) => ({ id: edge.from.split(':')[0], direction: 'in' })),
    ...outgoing.map((edge: any) => ({ id: edge.to.split(':')[0], direction: 'out' })),
  ];
  const uniqueNodes = Array.from(new Map(nodes.map(n => [n.id, n])).values());
  const edges = [
    ...incoming.map((e: any) => ({
      from: e.from.split(':')[0],
      to: center,
      direction: 'in',
      type: e.type,
    })),
    ...outgoing.map((e: any) => ({
      from: center,
      to: e.to.split(':')[0],
      direction: 'out',
      type: e.type,
    })),
  ];
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        padding: '10px',
        overflow: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
      }}
    >
      <h3 style={{ fontSize: '1.2em', marginBottom: '5px' }}>Dependencies</h3>
      <p
        style={{
          fontSize: '0.85em',
          color: 'var(--vscode-descriptionForeground)',
          marginBottom: '10px',
        }}
      >
        {frame.name}
      </p>
      {/* Simple radial graph */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '6px' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.85em' }}>
          <input
            type="checkbox"
            checked={showIncoming}
            onChange={e => setShowIncoming(e.target.checked)}
          />{' '}
          Incoming
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.85em' }}>
          <input
            type="checkbox"
            checked={showOutgoing}
            onChange={e => setShowOutgoing(e.target.checked)}
          />{' '}
          Outgoing
        </label>
      </div>
      <div
        style={{
          border: '1px solid var(--vscode-panel-border)',
          borderRadius: '4px',
          padding: '8px',
          minHeight: 180,
        }}
      >
        <div style={{ position: 'relative', width: '100%', height: 200 }}>
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              padding: '6px 10px',
              borderRadius: '8px',
              background: 'var(--vscode-editor-background)',
              border: '1px solid var(--vscode-panel-border)',
              fontWeight: 'bold',
              fontSize: '0.9em',
            }}
          >
            {center}
          </div>
          {uniqueNodes.map((n, idx) => {
            const angle = (idx / uniqueNodes.length) * Math.PI * 2;
            const radius = 65;
            const x = 50 + radius * Math.cos(angle);
            const y = 50 + radius * Math.sin(angle);
            return (
              <div
                key={n.id}
                onClick={() =>
                  onZoomIn({
                    level: 'file',
                    id: n.id,
                    name: n.id.split('/').pop(),
                    status: 'scanning',
                  })
                }
                style={{
                  position: 'absolute',
                  top: `${y}%`,
                  left: `${x}%`,
                  transform: 'translate(-50%, -50%)',
                  padding: '4px 6px',
                  borderRadius: '6px',
                  background:
                    n.direction === 'in'
                      ? 'var(--vscode-charts-blue)'
                      : 'var(--vscode-charts-orange)',
                  color: 'var(--vscode-editor-foreground)',
                  fontSize: '0.75em',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                {n.id.split('/').pop()}
              </div>
            );
          })}
          {edges
            .filter(
              e => (e.direction === 'in' && showIncoming) || (e.direction === 'out' && showOutgoing)
            )
            .map((e, idx) => {
              const fromIdx = uniqueNodes.findIndex(n => n.id === e.from);
              const toIdx = uniqueNodes.findIndex(n => n.id === e.to);
              if (fromIdx === -1 || toIdx === -1) return null;
              const angleFrom = (fromIdx / uniqueNodes.length) * Math.PI * 2;
              const angleTo = (toIdx / uniqueNodes.length) * Math.PI * 2;
              const radius = 65;
              const x1 = 50 + radius * Math.cos(angleFrom);
              const y1 = 50 + radius * Math.sin(angleFrom);
              const x2 = 50 + radius * Math.cos(angleTo);
              const y2 = 50 + radius * Math.sin(angleTo);
              return (
                <svg
                  key={idx}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    pointerEvents: 'none',
                  }}
                >
                  <line
                    x1={`${x1}%`}
                    y1={`${y1}%`}
                    x2={`${x2}%`}
                    y2={`${y2}%`}
                    stroke={
                      e.direction === 'in'
                        ? 'var(--vscode-charts-blue)'
                        : 'var(--vscode-charts-orange)'
                    }
                    strokeWidth={1.5}
                    opacity={0.6}
                  />
                </svg>
              );
            })}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', flex: 1 }}>
        <div
          style={{
            border: '1px solid var(--vscode-panel-border)',
            borderRadius: '4px',
            padding: '8px',
            overflow: 'auto',
          }}
        >
          <div style={{ fontWeight: 'bold', marginBottom: '6px' }}>
            Incoming ({incoming.length})
          </div>
          {incoming.length ? (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {incoming.map((edge: any, idx: number) => (
                <li
                  key={idx}
                  onClick={() =>
                    onZoomIn({
                      level: 'file',
                      id: edge.from.split(':')[0],
                      name: edge.from.split(':')[0].split('/').pop(),
                      status: 'scanning',
                    })
                  }
                  style={{
                    padding: '6px',
                    borderBottom: '1px solid var(--vscode-panel-border)',
                    cursor: 'pointer',
                    fontSize: '0.85em',
                  }}
                >
                  {edge.from.split(':')[0]} → {edge.to.split(':')[0]} ({edge.type})
                </li>
              ))}
            </ul>
          ) : (
            <div style={{ opacity: 0.6, fontSize: '0.85em' }}>None</div>
          )}
        </div>
        <div
          style={{
            border: '1px solid var(--vscode-panel-border)',
            borderRadius: '4px',
            padding: '8px',
            overflow: 'auto',
          }}
        >
          <div style={{ fontWeight: 'bold', marginBottom: '6px' }}>
            Outgoing ({outgoing.length})
          </div>
          {outgoing.length ? (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {outgoing.map((edge: any, idx: number) => (
                <li
                  key={idx}
                  onClick={() =>
                    onZoomIn({
                      level: 'file',
                      id: edge.to.split(':')[0],
                      name: edge.to.split(':')[0].split('/').pop(),
                      status: 'scanning',
                    })
                  }
                  style={{
                    padding: '6px',
                    borderBottom: '1px solid var(--vscode-panel-border)',
                    cursor: 'pointer',
                    fontSize: '0.85em',
                  }}
                >
                  {edge.from.split(':')[0]} → {edge.to.split(':')[0]} ({edge.type})
                </li>
              ))}
            </ul>
          ) : (
            <div style={{ opacity: 0.6, fontSize: '0.85em' }}>None</div>
          )}
        </div>
      </div>
    </div>
  );
};

const FileStage: React.FC<{ frame: any; onZoomIn: (frame: any) => void }> = ({
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

const SymbolStage: React.FC<{ frame: any; vscode?: any }> = ({ frame, vscode }) => (
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
              vscode.postMessage({ type: 'openSymbolInEditor', symbolId: frame.data.symbolId });
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
              vscode.postMessage({
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
              vscode.postMessage({
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

import { ReportList } from './ReportList';
import { CockpitState } from '../../../types/cockpit';

// ... existing imports ...

export const Stage: React.FC<StageProps & { cockpitState?: CockpitState; vscode?: any }> = ({
  frame,
  onZoomIn,
  onZoomOut,
  cockpitState,
  vscode,
}) => {
  const handleZoomIn = (id: string, name: string) => {
    // ... existing zoom logic ...
    let nextLevel: ZoomLevel = 'bundle';
    if (frame.level === 'bundle') nextLevel = 'blast_radius';
    else if (frame.level === 'blast_radius') nextLevel = 'file';
    else if (frame.level === 'file') nextLevel = 'symbol';
    else return;

    onZoomIn({
      level: nextLevel,
      id,
      name,
      parentId: frame.id,
      status: 'ready',
    });
  };

  const bundleData =
    frame.level === 'bundle' ? frame.data || cockpitState?.bundleView || undefined : undefined;
  const frameData = bundleData ?? frame.data;
  const tier = frame.tier || frameData?.tier;

  return (
    <div style={StageContainer}>
      <div style={HeaderStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <button
            onClick={onZoomOut}
            disabled={!frame.parentId}
            style={{
              marginRight: '6px',
              background: 'none',
              border: 'none',
              color: 'var(--vscode-button-foreground)',
              cursor: 'pointer',
              opacity: !frame.parentId ? 0.5 : 1,
            }}
          >
            ← Back
          </button>
          <strong>{frame.name}</strong> <span style={{ opacity: 0.7 }}>({frame.level})</span>
          {frame.breadcrumbs && (
            <span style={{ fontSize: '0.8em', opacity: 0.7 }}>{frame.breadcrumbs.join(' / ')}</span>
          )}
          {tier && (
            <span
              style={{
                padding: '2px 6px',
                borderRadius: '4px',
                background:
                  tier === 'structure'
                    ? 'var(--vscode-badge-background)'
                    : tier === 'hybrid'
                      ? 'var(--vscode-inputValidation-warningBackground)'
                      : 'var(--vscode-charts-green)',
                color:
                  tier === 'structure'
                    ? 'var(--vscode-badge-foreground)'
                    : 'var(--vscode-foreground)',
                fontSize: '0.75em',
                textTransform: 'uppercase',
              }}
            >
              {tier}
            </span>
          )}
          {frame.level === 'bundle' && frameData?.summary && (
            <span style={{ fontSize: '0.8em', opacity: 0.7 }}>
              • {frameData.summary.files} files • {frameData.summary.symbols} symbols
            </span>
          )}
        </div>
      </div>
      <div style={ContentStyle}>
        {frame.status === 'scanning' ? (
          <div style={{ textAlign: 'center', color: 'var(--vscode-descriptionForeground)' }}>
            <div style={{ fontSize: '2em', marginBottom: '10px' }}>⏳</div>
            <h3>Scanning {frame.name}...</h3>
            <p>Analyzing history, drift, and risks.</p>
          </div>
        ) : (
          <>
            {frame.id === 'reports-root' && cockpitState && vscode ? (
              <div style={{ width: '100%', height: '100%', overflow: 'auto' }}>
                <ReportList state={cockpitState} vscode={vscode} />
              </div>
            ) : (
              <>
                {frame.level === 'bundle' && (
                  <BundleStage
                    frame={frame}
                    onZoomIn={f => onZoomIn(f)}
                    cockpitState={cockpitState}
                    vscode={vscode}
                  />
                )}
                {frame.level === 'blast_radius' && (
                  <BlastRadiusStage frame={frame} onZoomIn={f => onZoomIn(f)} />
                )}
                {frame.level === 'file' && <FileStage frame={frame} onZoomIn={f => onZoomIn(f)} />}
                {frame.level === 'symbol' && <SymbolStage frame={frame} vscode={vscode} />}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
};
