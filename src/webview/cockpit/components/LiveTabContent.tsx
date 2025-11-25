import * as React from 'react';
import { CockpitState } from '../../../types/cockpit';

interface LiveTabContentProps {
  state: CockpitState;
  vscode: any;
}

export const LiveTabContent: React.FC<LiveTabContentProps> = ({ state, vscode }) => {
  const { liveAnalysis } = state;

  return (
    <div className="cockpit__tab-content">
      <div className="cockpit__section-header">
        <h3>Live Analysis</h3>
        <span className={`cockpit__badge ${liveAnalysis.isTracking ? 'success' : 'warning'}`}>
          {liveAnalysis.isTracking ? 'Tracking Active' : 'Tracking Paused'}
        </span>
      </div>

      <div className="cockpit__card">
        <div className="cockpit__metrics-grid">
          <div className="cockpit__metric">
            <div className="cockpit__metric-value">{liveAnalysis.pendingChanges}</div>
            <div className="cockpit__metric-label">Pending Files</div>
          </div>
          <div className="cockpit__metric">
            <div className="cockpit__metric-value">{liveAnalysis.totalEdits}</div>
            <div className="cockpit__metric-label">Total Edits</div>
          </div>
        </div>
      </div>

      {liveAnalysis.summary && (
        <div className="cockpit__card">
          <h4>Analysis Results</h4>
          <div className="cockpit__metrics-grid">
            <div className="cockpit__metric danger">
              <div className="cockpit__metric-value">{liveAnalysis.summary.zombies}</div>
              <div className="cockpit__metric-label">Zombies</div>
            </div>
            <div className="cockpit__metric warning">
              <div className="cockpit__metric-value">{liveAnalysis.summary.missing}</div>
              <div className="cockpit__metric-label">Missing</div>
            </div>
            <div className="cockpit__metric info">
              <div className="cockpit__metric-value">{liveAnalysis.summary.drift}</div>
              <div className="cockpit__metric-label">Drift</div>
            </div>
            <div className="cockpit__metric secondary">
              <div className="cockpit__metric-value">{liveAnalysis.summary.dead}</div>
              <div className="cockpit__metric-label">Ghosts</div>
            </div>
          </div>
        </div>
      )}

      {liveAnalysis.facts?.drift?.zombie_symbols?.length > 0 && (
        <div className="cockpit__section">
          <h4>Zombies Detected</h4>
          <ul className="cockpit__list">
            {liveAnalysis.facts.drift.zombie_symbols.map((z: any) => (
              <li key={z.symbol_id} className="cockpit__list-item">
                <span className="codicon codicon-warning" />
                <span className="cockpit__list-label">{z.found.name}</span>
                <span className="cockpit__list-detail">Should be absent</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="cockpit__actions">
        {liveAnalysis.status === 'ready' && (
          <button
            className="cockpit__button primary"
            onClick={() => vscode.postMessage({ type: 'generateLiveReport' })}
          >
            Analyze Pending Changes
          </button>
        )}

        {liveAnalysis.status === 'analyzing' && (
          <div className="cockpit__loading">
            <span className="codicon codicon-loading codicon-modifier-spin" />
            Analyzing live changes...
          </div>
        )}

        {liveAnalysis.status === 'idle' && liveAnalysis.pendingChanges > 0 && !liveAnalysis.summary && (
          <div className="cockpit__dim">
            Edit threshold not yet reached for auto-analysis.
          </div>
        )}
      </div>
    </div>
  );
};
