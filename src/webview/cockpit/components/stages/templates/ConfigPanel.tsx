import * as React from 'react';
import { postMessageWithTracing } from '../../../utils/messageUtils';

export type BundleConfig = {
  mode: 'repo' | 'module' | 'changes' | 'custom';
  roots: string[];
  includeConnected: boolean;
  exclusions: string[];
};

export const ConfigPanel: React.FC<{
  config: BundleConfig;
  depth: number;
  isAnalyzing?: boolean;
  onConfigChange: (updates: Partial<BundleConfig>) => void;
  onDepthChange: (depth: number) => void;
  onApply: () => void;
  onClose: () => void;
}> = ({ config, depth, isAnalyzing, onConfigChange, onDepthChange, onApply, onClose }) => {
  return (
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
          value={config.mode}
          onChange={e => onConfigChange({ mode: e.target.value as BundleConfig['mode'] })}
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

      {config.mode === 'custom' && (
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
            value={config.roots.join(', ')}
            onChange={e =>
              onConfigChange({
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
            checked={config.includeConnected}
            onChange={e => onConfigChange({ includeConnected: e.target.checked })}
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
          value={config.exclusions.join(', ')}
          onChange={e =>
            onConfigChange({
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
              onDepthChange(val);
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
            onApply();
            onClose();
          }}
          disabled={isAnalyzing}
          style={{
            flex: 1,
            padding: '6px',
            background: isAnalyzing
              ? 'var(--vscode-button-secondaryBackground)'
              : 'var(--vscode-button-background)',
            color: isAnalyzing
              ? 'var(--vscode-button-secondaryForeground)'
              : 'var(--vscode-button-foreground)',
            border: 'none',
            borderRadius: '2px',
            cursor: isAnalyzing ? 'not-allowed' : 'pointer',
            opacity: isAnalyzing ? 0.7 : 1,
          }}
        >
          {isAnalyzing ? 'Analyzing...' : 'Apply Scope'}
        </button>
      </div>
    </div>
  );
};
