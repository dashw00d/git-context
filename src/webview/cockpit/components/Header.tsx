import * as React from 'react';
import { CockpitState } from '../../../types/cockpit';

interface HeaderProps {
    state: CockpitState;
    vscode: any;
    bundleSummaryText: string;
    onDismissError: () => void;
}

export const Header: React.FC<HeaderProps> = ({ state, vscode, bundleSummaryText, onDismissError }) => {
    const handleAnalyze = () => {
        vscode.postMessage({ type: 'generateReport', mode: 'selection' });
    };

    const handleAnalyzeStaged = () => {
        vscode.postMessage({ type: 'generateReport', mode: 'staged' });
    };

    const handleAnalyzeUnstaged = () => {
        vscode.postMessage({ type: 'generateReport', mode: 'unstaged' });
    };

    const handleAnalyzeLast = () => {
        vscode.postMessage({ type: 'generateReport', mode: 'lastN' });
    };

    return (
        <header className="cockpit__header">
            <div>
                <h2 className="cockpit__title">Cockpit</h2>
                <p className="cockpit__subtitle">
                    {state.repoName || 'Repo'} • {state.branchName || 'branch'}
                </p>
                {state.error && (
                    <div className="cockpit__error" style={{ marginTop: '4px', padding: '6px 8px', background: '#3a1f1f', border: '1px solid #b73a3a', borderRadius: '4px', color: '#ffb3b3', fontSize: '12px' }}>
                        ⚠️ {state.error}
                        <button
                            className="cockpit__button ghost small"
                            onClick={onDismissError}
                            style={{ marginLeft: '8px', padding: '2px 6px' }}
                        >
                            Dismiss
                        </button>
                    </div>
                )}
                <div className="cockpit__status-pill">
                    {state.isAnalyzing ? (
                        <span className="cockpit__status-pill--analyzing">
                            Analyzing{state.analysisStep ? ` — ${state.analysisStep}` : ''}
                            {state.analysisProgress !== undefined ? ` (${Math.round(state.analysisProgress * 100)}%)` : ''}
                        </span>
                    ) : (
                        <span className="cockpit__status-pill--bundle">
                            {bundleSummaryText}
                        </span>
                    )}
                </div>
            </div>
            <div className="cockpit__header-actions">
                <button className="cockpit__button" onClick={handleAnalyze} disabled={state.isAnalyzing}>
                    {state.isAnalyzing ? 'Analyzing...' : 'Analyze'}
                </button>
                <button className="cockpit__button ghost" onClick={handleAnalyzeStaged} disabled={state.isAnalyzing}>
                    Analyze staged
                </button>
                <button className="cockpit__button ghost" onClick={handleAnalyzeUnstaged} disabled={state.isAnalyzing}>
                    Analyze unstaged
                </button>
                <button className="cockpit__button ghost" onClick={handleAnalyzeLast} disabled={state.isAnalyzing}>
                    Analyze last N
                </button>
                <button className="cockpit__button ghost" onClick={() => vscode.postMessage({ type: 'bundleExport' })} disabled={state.isAnalyzing}>
                    Export bundle
                </button>
                <button
                    className="cockpit__button ghost danger"
                    onClick={() => {
                        if (confirm('Are you sure you want to reset all selections and clear the workspace? This will deselect all commits and files.')) {
                            vscode.postMessage({ type: 'resetAll' });
                        }
                    }}
                    disabled={state.isAnalyzing}
                >
                    Reset all
                </button>
                {state.isAnalyzing ? (
                    <button className="cockpit__button ghost danger" onClick={() => vscode.postMessage({ type: 'cancelAnalysis' })}>
                        Cancel
                    </button>
                ) : null}
            </div>
        </header>
    );
};
