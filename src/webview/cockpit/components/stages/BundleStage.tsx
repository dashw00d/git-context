import * as React from 'react';
import { CockpitState } from '../../../../types/cockpit';
import { TreemapNode } from './TreemapNode';

export const BundleStage: React.FC<{
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
            : frame.data?.hotspots && frame.data.hotspots.length > 0
              ? '' // Don't show "No churn data" if we have hotspots but no treemap (fallback to list below)
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
