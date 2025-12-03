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

  const stepTimings = Object.entries(state.pipelineStepTimings || {}).sort(
    ([, a], [, b]) => (b || 0) - (a || 0)
  );
  const topSteps = stepTimings.slice(0, 3);
  const pipelineErrors = state.pipelineErrors || [];
  const currentStep = state.currentStepId ?? 'idle';

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

  const GroupStyle: React.CSSProperties = {
    marginBottom: '20px',
    padding: '15px',
    backgroundColor: 'var(--vscode-editor-inactiveSelectionBackground)',
    borderRadius: '6px',
  };

  const TitleStyle: React.CSSProperties = {
    fontSize: '1.1em',
    fontWeight: 600,
    marginBottom: '10px',
    color: 'var(--vscode-editor-foreground)',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  };

  const RowStyle: React.CSSProperties = {
    display: 'flex',
    gap: '20px',
    marginBottom: '10px',
    flexWrap: 'wrap',
  };

  const ItemStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
  };

  const ValueStyle: React.CSSProperties = {
    fontSize: '1.4em',
    fontWeight: 'bold',
    color: 'var(--vscode-editor-foreground)',
  };

  const LabelStyle: React.CSSProperties = {
    fontSize: '0.85em',
    color: 'var(--vscode-descriptionForeground)',
    marginTop: '2px',
  };

  return (
    <div style={{ padding: '10px' }}>
      {/* Global Stats */}
      <div style={GroupStyle}>
        <h3 style={TitleStyle}>Global Health</h3>
        <div style={RowStyle}>
          <div style={ItemStyle}>
            <span
              style={{
                ...ValueStyle,
                color:
                  healthScore > 70
                    ? 'var(--vscode-charts-green)'
                    : healthScore > 40
                      ? 'var(--vscode-charts-yellow)'
                      : 'var(--vscode-charts-red)',
              }}
            >
              {healthScore.toFixed(0)}%
            </span>
            <span style={LabelStyle}>Health Score</span>
          </div>
          <div style={ItemStyle}>
            <span
              style={{
                ...ValueStyle,
                color: criticalCount > 0 ? 'var(--vscode-charts-red)' : 'inherit',
              }}
            >
              {criticalCount}
            </span>
            <span style={LabelStyle}>Critical Issues</span>
          </div>
          <div style={ItemStyle}>
            <span
              style={{
                ...ValueStyle,
                color: warningCount > 0 ? 'var(--vscode-charts-yellow)' : 'inherit',
              }}
            >
              {warningCount}
            </span>
            <span style={LabelStyle}>Warnings</span>
          </div>
        </div>
      </div>

      {/* Analysis Results */}
      <div style={GroupStyle}>
        <h3 style={TitleStyle}>Scope Analysis</h3>
        <div style={RowStyle}>
          <div style={ItemStyle}>
            <span style={ValueStyle}>
              {bundleSummary?.commitCount || state.selectedCommitShas.length}
            </span>
            <span style={LabelStyle}>Commits</span>
          </div>
          <div style={ItemStyle}>
            <span style={ValueStyle}>{bundleSummary?.fileCount || 0}</span>
            <span style={LabelStyle}>Files</span>
          </div>
          <div style={ItemStyle}>
            <span style={ValueStyle}>{bundleSummary?.symbolCount || 0}</span>
            <span style={LabelStyle}>Symbols</span>
          </div>
        </div>
        {state.bundleReportId && (
          <button
            onClick={() =>
              postMessageWithTracing(vscode, {
                type: 'openReport',
                reportId: state.bundleReportId!,
              })
            }
            style={{
              marginTop: '10px',
              padding: '6px 12px',
              backgroundColor: 'transparent',
              border: '1px solid var(--vscode-button-background)',
              color: 'var(--vscode-button-background)',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '0.9em',
            }}
          >
            Open Full Report
          </button>
        )}
      </div>

      {/* Pipeline Health */}
      <div style={GroupStyle}>
        <h3 style={TitleStyle}>Pipeline Diagnostics</h3>
        <div style={RowStyle}>
          <div style={ItemStyle}>
            <span style={ValueStyle}>{currentStep}</span>
            <span style={LabelStyle}>Current Step</span>
          </div>
          <div style={ItemStyle}>
            <span
              style={{
                ...ValueStyle,
                color: pipelineErrors.length > 0 ? 'var(--vscode-charts-red)' : 'inherit',
              }}
            >
              {pipelineErrors.length}
            </span>
            <span style={LabelStyle}>Errors</span>
          </div>
        </div>
        {topSteps.length > 0 && (
          <div style={{ marginTop: '10px' }}>
            <div style={{ fontSize: '0.9em', fontWeight: 'bold', marginBottom: '5px' }}>
              Top Step Timings
            </div>
            {topSteps.map(([stepId, duration]) => (
              <div
                key={stepId}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: '0.85em',
                  marginBottom: '4px',
                }}
              >
                <span>{stepId}</span>
                <span style={{ fontFamily: 'monospace' }}>{Math.round(duration)}ms</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
