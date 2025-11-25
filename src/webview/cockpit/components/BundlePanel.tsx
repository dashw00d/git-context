import * as React from 'react';
import { CockpitState } from '../../../types/cockpit';

interface BundlePanelProps {
    state: CockpitState;
    vscode: any;
}

export const BundlePanel: React.FC<BundlePanelProps> = ({ state, vscode }) => {
    const facts = state.bundleFacts;
    const summary = state.bundleSummary;

    if (!facts || !summary) {
        return (
            <div className="cockpit__card cockpit__card--bundle">
                <div className="cockpit__card-title">Analysis Results</div>
                <div className="cockpit__empty" style={{ padding: '12px 0', textAlign: 'center' }}>
                    <div style={{ fontSize: '32px', opacity: 0.3 }}>📊</div>
                    <div style={{ marginTop: '8px' }}>No analysis yet</div>
                    <div style={{ fontSize: '11px', marginTop: '4px' }}>
                        Run an analysis to see results
                    </div>
                </div>
            </div>
        );
    }

    const findings = facts.findings;
    const criticalIssues = (findings?.incompleteness?.missing || 0) +
        (findings?.incompleteness?.zombies || 0) +
        (findings?.legacyAudit?.dead || 0);

    const warnings = (findings?.patternDrift?.mixedTargets || 0) +
        (findings?.patternDrift?.oldNamespaces || 0) +
        (findings?.legacyAudit?.legacyUsed || 0);

    return (
        <div className="cockpit__card cockpit__card--bundle">
            <div className="cockpit__card-title">
                Analysis Results
                {summary.createdAt && (
                    <span style={{ fontSize: '10px', color: '#8a8f98', marginLeft: '6px' }}>
                        {new Date(summary.createdAt).toLocaleTimeString()}
                    </span>
                )}
            </div>

            {/* Scope Summary */}
            <div style={{ marginTop: '8px' }}>
                <div style={{ fontSize: '11px', color: '#8a8f98', marginBottom: '4px' }}>SCOPE</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    <div className="cockpit__badge">
                        {summary.commitCount} commit{summary.commitCount !== 1 ? 's' : ''}
                    </div>
                    <div className="cockpit__badge">
                        {summary.fileCount} file{summary.fileCount !== 1 ? 's' : ''}
                    </div>
                    {summary.symbolCount > 0 && (
                        <div className="cockpit__badge">
                            {summary.symbolCount} symbol{summary.symbolCount !== 1 ? 's' : ''}
                        </div>
                    )}
                </div>
            </div>

            {/* Key Findings */}
            <div style={{ marginTop: '12px' }}>
                <div style={{ fontSize: '11px', color: '#8a8f98', marginBottom: '4px' }}>KEY FINDINGS</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                    <div
                        style={{
                            padding: '6px 8px',
                            background: criticalIssues > 0 ? '#3a1f1f' : '#14171c',
                            border: `1px solid ${criticalIssues > 0 ? '#b73a3a' : '#1e232b'}`,
                            borderRadius: '4px'
                        }}
                    >
                        <div style={{ fontSize: '18px', fontWeight: '600', color: criticalIssues > 0 ? '#ffb3b3' : '#81c784' }}>
                            {criticalIssues}
                        </div>
                        <div style={{ fontSize: '10px', color: '#8a8f98' }}>Critical</div>
                    </div>
                    <div
                        style={{
                            padding: '6px 8px',
                            background: warnings > 0 ? '#3a2f1f' : '#14171c',
                            border: `1px solid ${warnings > 0 ? '#b7853a' : '#1e232b'}`,
                            borderRadius: '4px'
                        }}
                    >
                        <div style={{ fontSize: '18px', fontWeight: '600', color: warnings > 0 ? '#ffcc80' : '#81c784' }}>
                            {warnings}
                        </div>
                        <div style={{ fontSize: '10px', color: '#8a8f98' }}>Warnings</div>
                    </div>
                </div>
            </div>

            {/* Incompleteness Summary */}
            {findings?.incompleteness && (criticalIssues > 0) && (
                <div style={{ marginTop: '12px' }}>
                    <div style={{ fontSize: '11px', color: '#8a8f98', marginBottom: '4px' }}>INCOMPLETENESS</div>
                    <div style={{ fontSize: '12px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        {findings.incompleteness.missing > 0 && (
                            <div style={{ color: '#ffb3b3' }}>
                                ⚠️ {findings.incompleteness.missing} missing symbol{findings.incompleteness.missing !== 1 ? 's' : ''}
                            </div>
                        )}
                        {findings.incompleteness.zombies > 0 && (
                            <div style={{ color: '#ffb3b3' }}>
                                👻 {findings.incompleteness.zombies} zombie{findings.incompleteness.zombies !== 1 ? 's' : ''}
                            </div>
                        )}
                        {findings.legacyAudit?.dead > 0 && (
                            <div style={{ color: '#ffb3b3' }}>
                                💀 {findings.legacyAudit.dead} dead code path{findings.legacyAudit.dead !== 1 ? 's' : ''}
                            </div>
                        )}
                    </div>
                </div>
            )}

            <button
                className="cockpit__button ghost small"
                onClick={() => vscode.postMessage({ type: 'openActiveReport' })}
                style={{ marginTop: '12px', width: '100%' }}
                disabled={!state.bundleReportId}
            >
                Open Full Report →
            </button>
        </div>
    );
};
