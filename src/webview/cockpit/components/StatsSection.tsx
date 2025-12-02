import * as React from 'react';
import { CockpitState } from '../../../types/cockpit';
import { postMessageWithTracing } from '../utils/messageUtils';

interface StatsSectionProps {
  state: CockpitState;
  vscode: any;
}

export const StatsSection: React.FC<StatsSectionProps> = ({ state, vscode }) => {
  const selectionCount =
    state.selectedCommitShas.length +
    (state.selectedStagedPaths.length > 0 ? 1 : 0) +
    (state.selectedUnstagedPaths.length > 0 ? 1 : 0);

  const bundleFacts = state.bundleFacts;
  const bundleSummary = state.bundleSummary;

  const findings = bundleFacts?.findings;
  const criticalCount =
    (findings?.incompleteness?.missing || 0) +
    (findings?.incompleteness?.zombies || 0) +
    (findings?.legacyAudit?.dead || 0);
  const warningCount =
    (findings?.legacyAudit?.legacyUsed || 0) +
    (findings?.legacyAudit?.replacedLeftovers?.length || 0) +
    (findings?.patternDrift?.conventionDrift?.driftSymbolCount || 0);

  // Pipeline health snapshot
  const stepTimings = Object.entries(state.pipelineStepTimings || {}).sort(
    ([, a], [, b]) => (b || 0) - (a || 0)
  );
  const topSteps = stepTimings.slice(0, 3);
  const pipelineErrors = state.pipelineErrors || [];
  const currentStep = state.currentStepId ?? 'idle';

  // Calculate health score (replicated from MetricsRow logic)
  let healthScore = 100;
  if (findings) {
    const warnings =
      (findings.patternDrift?.mixedTargets || 0) +
      (findings.patternDrift?.oldNamespaces || 0) +
      (findings.legacyAudit?.legacyUsed || 0);
    const driftPct = findings.patternDrift?.conventionDrift?.driftPercent || 0;

    healthScore -= criticalCount * 10;
    healthScore -= warnings * 3;
    healthScore -= driftPct * 0.5;
    healthScore = Math.max(0, Math.min(100, healthScore));
  }

  return (
    <div className="cockpit__stats-section">
      <div className="cockpit__stat-group">
        <h3>Selection</h3>
        <div className="cockpit__stat-value">
          {selectionCount} <span className="cockpit__stat-label">commits/scopes</span>
        </div>
        <div className="cockpit__stat-list">
          {state.selectedStagedPaths.length > 0 && (
            <span className="tag">Staged ({state.selectedStagedPaths.length})</span>
          )}
          {state.selectedUnstagedPaths.length > 0 && (
            <span className="tag">Unstaged ({state.selectedUnstagedPaths.length})</span>
          )}
          {state.selectedCommitShas.slice(0, 3).map(sha => (
            <span key={sha} className="tag">
              {sha.substring(0, 7)}
            </span>
          ))}
          {state.selectedCommitShas.length > 3 && (
            <span className="tag">+{state.selectedCommitShas.length - 3}</span>
          )}
        </div>
      </div>

      <div className="cockpit__stat-group">
        <h3>Analysis Results</h3>
        <div className="cockpit__stat-row">
          <div className="cockpit__stat-item">
            <span className="value">
              {bundleSummary?.commitCount || state.selectedCommitShas.length}
            </span>
            <span className="label">Scope Commits</span>
          </div>
          <div className="cockpit__stat-item">
            <span className="value">{bundleSummary?.fileCount || 0}</span>
            <span className="label">Scope Files</span>
          </div>
          <div className="cockpit__stat-item">
            <span className="value">{bundleSummary?.symbolCount || 0}</span>
            <span className="label">Scope Symbols</span>
          </div>
        </div>
        <div className="cockpit__stat-row">
          <div className="cockpit__stat-item">
            <span className="value danger">{criticalCount}</span>
            <span className="label">Critical</span>
          </div>
          <div className="cockpit__stat-item">
            <span className="value warning">{warningCount}</span>
            <span className="label">Warnings</span>
          </div>
        </div>
        <div className="cockpit__stat-row">
          <div className="cockpit__stat-item">
            <span className="value">{bundleFacts?.findings?.legacyAudit?.dead || 0}</span>
            <span className="label">Dead code paths</span>
          </div>
          <div className="cockpit__stat-item">
            <span className="value">{bundleFacts?.findings?.incompleteness?.missing || 0}</span>
            <span className="label">Missing</span>
          </div>
          <div className="cockpit__stat-item">
            <span className="value">{bundleFacts?.findings?.incompleteness?.zombies || 0}</span>
            <span className="label">Zombies</span>
          </div>
        </div>
        {state.bundleReportId && (
          <button
            className="cockpit__button small ghost"
            onClick={() =>
              postMessageWithTracing(vscode, {
                type: 'openReport',
                reportId: state.bundleReportId!,
              })
            }
          >
            Open Full Report
          </button>
        )}
      </div>

      <div className="cockpit__stat-group cockpit__stat-group--full">
        <h3>Global Stats</h3>
        <div className="cockpit__stat-cards">
          <div className="stat-card">
            <div className="stat-card__title">Health</div>
            <div className="stat-card__value">{healthScore.toFixed(0)}%</div>
          </div>
          <div className="stat-card">
            <div className="stat-card__title">Critical</div>
            <div className="stat-card__value">{criticalCount}</div>
          </div>
          <div className="stat-card">
            <div className="stat-card__title">Warnings</div>
            <div className="stat-card__value">{warningCount}</div>
          </div>
          <div className="stat-card">
            <div className="stat-card__title">Files</div>
            <div className="stat-card__value">{state.bundleSummary?.fileCount || 0}</div>
          </div>
          <div className="stat-card">
            <div className="stat-card__title">Symbols</div>
            <div className="stat-card__value">{state.bundleSummary?.symbolCount || 0}</div>
          </div>
        </div>
      </div>

      <div className="cockpit__stat-group cockpit__stat-group--full">
        <h3>Pipeline Health</h3>
        <div className="cockpit__stat-row">
          <div className="cockpit__stat-item">
            <span className="label">Current step</span>
            <span className="value">{currentStep}</span>
          </div>
          <div className="cockpit__stat-item">
            <span className="label">Errors</span>
            <span className="value warning">{pipelineErrors.length}</span>
          </div>
        </div>
        {topSteps.length > 0 && (
          <div className="cockpit__stat-row" style={{ flexWrap: 'wrap', gap: '8px' }}>
            {topSteps.map(([stepId, duration]) => (
              <div key={stepId} className="cockpit__stat-item">
                <span className="label">{stepId}</span>
                <span className="value">{Math.round(duration)}ms</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
