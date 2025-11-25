import * as React from 'react';
import { CockpitState } from '../../../types/cockpit';

interface MetricsRowProps {
  state: CockpitState;
}

export const MetricsRow: React.FC<MetricsRowProps> = ({ state }) => {
  const metrics = state.metrics ?? {};
  const facts = state.bundleFacts;
  if (!facts && !metrics.debtScore) return null;

  const findings = facts?.findings;
  const critical = (findings?.incompleteness?.missing || 0) +
    (findings?.incompleteness?.zombies || 0) +
    (findings?.legacyAudit?.dead || 0) +
    (metrics.debtScore || 0); // debtScore rolls up other issues

  const warnings = (findings?.patternDrift?.mixedTargets || 0) +
    (findings?.patternDrift?.oldNamespaces || 0) +
    (findings?.legacyAudit?.legacyUsed || 0);

  const driftPct = findings?.patternDrift?.conventionDrift?.driftPercent || 0;

  // Weighted health score formula
  let health = 100;
  health -= critical * 10;
  health -= warnings * 3;
  health -= driftPct * 0.5;
  health = Math.max(0, Math.min(100, health));

  const healthColor = health >= 80 ? '#81c784' : health >= 60 ? '#ffcc80' : '#ffb3b3';

  return (
    <div className="cockpit__metrics">
      <div className="cockpit__metric">
        <div className="cockpit__metric-value" style={{ color: healthColor }}>
          {Math.round(health)}
        </div>
        <div className="cockpit__metric-label">Health</div>
      </div>
      <div className="cockpit__metric">
        <div className={`cockpit__metric-value${critical > 0 ? ' cockpit__metric-value--bad' : ''}`}>
          {critical}
        </div>
        <div className="cockpit__metric-label">Critical</div>
      </div>
      <div className="cockpit__metric">
        <div className={`cockpit__metric-value${warnings > 0 ? ' cockpit__metric-value--warn' : ''}`}>
          {warnings}
        </div>
        <div className="cockpit__metric-label">Warnings</div>
      </div>
      <div className="cockpit__metric">
        <div className="cockpit__metric-value">
          {metrics.fileCount ?? facts?.scope?.files ?? 0}
        </div>
        <div className="cockpit__metric-label">Files</div>
      </div>
      <div className="cockpit__metric">
        <div className="cockpit__metric-value">
          {metrics.symbolCount ?? facts?.working?.symbols ?? 0}
        </div>
        <div className="cockpit__metric-label">Symbols</div>
      </div>
    </div>
  );
};
