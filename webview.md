
/* ---- File: src/webview/cockpit/components/BundlePanel.tsx ---- */

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



/* ---- File: src/webview/cockpit/components/CommitList.tsx ---- */

import * as React from 'react';
import { CockpitState } from '../../../types/cockpit';

interface CommitListProps {
    state: CockpitState;
    vscode: any;
    formatDate: (date?: string | null) => string;
}

export const CommitList: React.FC<CommitListProps> = ({ state, vscode, formatDate }) => {
    const [expandedCommits, setExpandedCommits] = React.useState<Set<string>>(new Set());

    const toggleCommitExpanded = (sha: string, e: React.MouseEvent) => {
        e.stopPropagation();
        const newSet = new Set(expandedCommits);
        if (newSet.has(sha)) {
            newSet.delete(sha);
        } else {
            newSet.add(sha);
        }
        setExpandedCommits(newSet);
    };

    const filter = state.commitsFilterText.toLowerCase();

    // Filter by scope first
    let scopedCommits = state.commits.filter((c) => {
        if (c.scope === 'staged' && !state.commitsFilterScopes.staged) return false;
        if (c.scope === 'unstaged' && !state.commitsFilterScopes.unstaged) return false;
        if (c.scope === 'history' && !state.commitsFilterScopes.history) return false;
        return true;
    });

    // Then filter by text
    const list = scopedCommits.filter(
        (c) =>
            !filter ||
            c.message.toLowerCase().includes(filter) ||
            c.sha.toLowerCase().includes(filter) ||
            c.shortSha.toLowerCase().includes(filter)
    );

    if (!list.length) {
        const hasScopeFilters = !state.commitsFilterScopes.staged || !state.commitsFilterScopes.unstaged || !state.commitsFilterScopes.history;
        return (
            <div className="cockpit__empty">
                {hasScopeFilters ? (
                    <>
                        <div>No commits match current filters</div>
                        <div style={{ marginTop: '4px', fontSize: '11px', color: '#8a8f98' }}>
                            Try adjusting scope toggles or clearing the search filter
                        </div>
                    </>
                ) : (
                    <>
                        <div>No commits yet</div>
                        <div style={{ marginTop: '4px', fontSize: '11px', color: '#8a8f98' }}>
                            Start by clicking "Analyze last N" to analyze recent commits
                        </div>
                    </>
                )}
            </div>
        );
    }

    return (
        <ul className="cockpit__list">
            {list.map((c) => {
                const isExpanded = expandedCommits.has(c.sha);
                const isSelected = state.selectedCommitShas.includes(c.sha);

                return (
                    <li
                        key={c.sha}
                        className={`cockpit__list-item ${isSelected ? 'cockpit__list-item--active' : ''}`}
                        onClick={() => vscode.postMessage({ type: 'toggleCommit', sha: c.sha })}
                    >
                        <div className="cockpit__row">
                            <span
                                className={`cockpit__codicon codicon-${isExpanded ? 'chevron-down' : 'chevron-right'}`}
                                onClick={(e) => toggleCommitExpanded(c.sha, e)}
                                style={{ cursor: 'pointer', marginRight: '4px', fontSize: '12px' }}
                            />
                            <span className="cockpit__mono">{c.shortSha}</span>
                            <span>{c.author || '—'}</span>
                            <span className="cockpit__dim">{formatDate(c.authoredAt)}</span>
                            {c.inBundle ? <span className="cockpit__dim">In bundle</span> : null}
                            {typeof c.changes === 'number' && c.changes > 0 ? (
                                <span className="cockpit__dim">{c.changes} changes</span>
                            ) : null}
                        </div>
                        <div className="cockpit__message" style={{ paddingLeft: '20px' }}>{c.message}</div>

                        {isExpanded && c.files && (
                            <div className="cockpit__file-list" style={{ paddingLeft: '20px', marginTop: '4px' }}>
                                {c.files.length > 0 ? (
                                    c.files.map((f, i) => (
                                        <div key={i} className="cockpit__row" style={{ fontSize: '12px', padding: '2px 0' }}>
                                            <span className={`cockpit__file-status status-${f.status.toLowerCase()}`} style={{ width: '12px', display: 'inline-block', textAlign: 'center' }}>
                                                {f.status}
                                            </span>
                                            <span className="cockpit__dim">{f.path}</span>
                                        </div>
                                    ))
                                ) : (
                                    <div className="cockpit__dim" style={{ fontSize: '12px', fontStyle: 'italic' }}>No files changed</div>
                                )}
                            </div>
                        )}
                    </li>
                );
            })}
        </ul>
    );
};



/* ---- File: src/webview/cockpit/components/Header.tsx ---- */

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



/* ---- File: src/webview/cockpit/components/ReportList.tsx ---- */

import * as React from 'react';
import { CockpitState } from '../../../types/cockpit';
import { formatDate } from '../utils';

interface ReportListProps {
    state: CockpitState;
    vscode: any;
}

export const ReportList: React.FC<ReportListProps> = ({ state, vscode }) => {
    const filter = state.reportsFilterText.toLowerCase();
    const list = state.reports.filter(
        (r) =>
            (!filter ||
                (r.title || '').toLowerCase().includes(filter) ||
                (r.summary || '').toLowerCase().includes(filter)) &&
            (!state.reportsShowPinnedOnly || r.pinned) &&
            (state.reportsBranchFilter === 'all' || r.branch === state.reportsBranchFilter)
    );

    if (!list.length) {
        return (
            <div className="cockpit__empty">
                <div>No reports yet</div>
                <div style={{ marginTop: '4px', fontSize: '11px', color: '#8a8f98' }}>
                    Generate a report by analyzing commits or staged/unstaged changes
                </div>
            </div>
        );
    }

    return (
        <ul className="cockpit__list">
            {list.map((r) => (
                <li
                    key={r.id}
                    className="cockpit__list-item cockpit__list-item--clickable"
                    onClick={() => vscode.postMessage({ type: 'openReport', reportId: r.id })}
                >
                    <div className="cockpit__row">
                        <span>{r.title || 'Untitled report'}</span>
                        {r.branch && (
                            <span className="cockpit__badge" title={`Branch: ${r.branch}`}>
                                🌿 {r.branch}
                            </span>
                        )}
                        <span className="cockpit__dim">{r.pinned ? '📌' : ''}</span>
                        <span className="cockpit__dim">{formatDate(r.createdAt)}</span>
                    </div>
                    {r.summary ? <div className="cockpit__message">{r.summary}</div> : null}
                    <div className="cockpit__actions">
                        <button
                            className="cockpit__button ghost small"
                            onClick={(e) => {
                                e.stopPropagation();
                                vscode.postMessage({ type: 'regenerateReport', reportId: r.id });
                            }}
                        >
                            Regenerate
                        </button>
                        <button
                            className="cockpit__button ghost small"
                            onClick={(e) => {
                                e.stopPropagation();
                                vscode.postMessage({ type: 'togglePinReport', reportId: r.id });
                            }}
                        >
                            {r.pinned ? 'Unpin' : 'Pin'}
                        </button>
                        <button
                            className="cockpit__button ghost small danger"
                            onClick={(e) => {
                                e.stopPropagation();
                                if (confirm(`Are you sure you want to delete the report "${r.title || 'Untitled'}"? This cannot be undone.`)) {
                                    vscode.postMessage({ type: 'deleteReport', reportId: r.id });
                                }
                            }}
                        >
                            Delete
                        </button>
                    </div>
                </li>
            ))}
        </ul>
    );
};



/* ---- File: src/webview/cockpit/components/SelectionPanel.tsx ---- */

import * as React from 'react';
import { CockpitState } from '../../../types/cockpit';

interface SelectionPanelProps {
    state: CockpitState;
    vscode: any;
}

export const SelectionPanel: React.FC<SelectionPanelProps> = ({ state, vscode }) => {
    const totalSelected = state.selectedCommitShas.length + state.selectedStagedPaths.length + state.selectedUnstagedPaths.length;

    if (totalSelected === 0) {
        return (
            <div className="cockpit__card cockpit__card--selection">
                <div className="cockpit__card-title">Selection</div>
                <div className="cockpit__empty" style={{ padding: '12px 0', textAlign: 'center' }}>
                    <div style={{ fontSize: '32px', opacity: 0.3 }}>📋</div>
                    <div style={{ marginTop: '8px' }}>No items selected</div>
                    <div style={{ fontSize: '11px', marginTop: '4px' }}>
                        Select commits or files to analyze
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="cockpit__card cockpit__card--selection">
            <div className="cockpit__card-title">
                Selection ({totalSelected} item{totalSelected !== 1 ? 's' : ''})
            </div>

            {state.selectedCommitShas.length > 0 && (
                <div style={{ marginTop: '8px' }}>
                    <div style={{ fontSize: '11px', color: '#8a8f98', marginBottom: '4px' }}>
                        COMMITS ({state.selectedCommitShas.length})
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        {state.selectedCommitShas.slice(0, 3).map((sha) => {
                            const commit = state.commits.find(c => c.sha === sha);
                            return (
                                <div
                                    key={sha}
                                    style={{
                                        fontSize: '12px',
                                        padding: '4px 6px',
                                        background: '#14171c',
                                        borderRadius: '3px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '6px'
                                    }}
                                >
                                    <span className="cockpit__mono" style={{ color: '#4fc3f7' }}>
                                        {sha.slice(0, 7)}
                                    </span>
                                    <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {commit?.message || ''}
                                    </span>
                                </div>
                            );
                        })}
                        {state.selectedCommitShas.length > 3 && (
                            <div style={{ fontSize: '11px', color: '#8a8f98', paddingLeft: '6px' }}>
                                +{state.selectedCommitShas.length - 3} more
                            </div>
                        )}
                    </div>
                </div>
            )}

            {state.selectedStagedPaths.length > 0 && (
                <div style={{ marginTop: '8px' }}>
                    <div style={{ fontSize: '11px', color: '#8a8f98', marginBottom: '4px' }}>
                        STAGED FILES ({state.selectedStagedPaths.length})
                    </div>
                    <div style={{ fontSize: '12px' }}>
                        {state.selectedStagedPaths.slice(0, 3).map((path, i) => (
                            <div key={i} style={{ padding: '2px 0 ', color: '#81c784' }}>
                                📄 {path.split('/').pop()}
                            </div>
                        ))}
                        {state.selectedStagedPaths.length > 3 && (
                            <div style={{ fontSize: '11px', color: '#8a8f98' }}>
                                +{state.selectedStagedPaths.length - 3} more
                            </div>
                        )}
                    </div>
                </div>
            )}

            {state.selectedUnstagedPaths.length > 0 && (
                <div style={{ marginTop: '8px' }}>
                    <div style={{ fontSize: '11px', color: '#8a8f98', marginBottom: '4px' }}>
                        UNSTAGED FILES ({state.selectedUnstagedPaths.length})
                    </div>
                    <div style={{ fontSize: '12px' }}>
                        {state.selectedUnstagedPaths.slice(0, 3).map((path, i) => (
                            <div key={i} style={{ padding: '2px 0', color: '#ffb74d' }}>
                                📄 {path.split('/').pop()}
                            </div>
                        ))}
                        {state.selectedUnstagedPaths.length > 3 && (
                            <div style={{ fontSize: '11px', color: '#8a8f98' }}>
                                +{state.selectedUnstagedPaths.length - 3} more
                            </div>
                        )}
                    </div>
                </div>
            )}

            <button
                className="cockpit__button ghost small"
                onClick={() => vscode.postMessage({ type: 'clearSelection' })}
                style={{ marginTop: '12px', width: '100%' }}
            >
                Clear Selection
            </button>
        </div>
    );
};



/* ---- File: src/webview/cockpit/components/SymbolList.tsx ---- */

import * as React from 'react';
import { CockpitState, SymbolChangeType } from '../../../types/cockpit';
import { formatDate, getSymbolKindIcon, getChangeTypeBadge } from '../utils';

interface SymbolListProps {
    state: CockpitState;
    vscode: any;
}

export const SymbolList: React.FC<SymbolListProps> = ({ state, vscode }) => {
    const filter = state.symbolFilterText.toLowerCase();
    const list = state.symbols.filter(
        (s) =>
            (!filter || s.name.toLowerCase().includes(filter) || s.path.toLowerCase().includes(filter)) &&
            (state.symbolKindFilter === 'all' || s.kind === state.symbolKindFilter) &&
            (state.symbolChangeFilter === 'all' || (s.changeType || 'modified') === state.symbolChangeFilter)
    );

    if (!list.length) {
        const hasFilters = state.symbolFilterText || state.symbolKindFilter !== 'all' || state.symbolChangeFilter !== 'all';
        return (
            <div className="cockpit__empty">
                {hasFilters ? (
                    <>
                        <div>No symbols match current filters</div>
                        <div style={{ marginTop: '4px', fontSize: '11px', color: '#8a8f98' }}>
                            Try adjusting filters or clearing the search
                        </div>
                    </>
                ) : (
                    <>
                        <div>No symbols yet</div>
                        <div style={{ marginTop: '4px', fontSize: '11px', color: '#8a8f98' }}>
                            Symbols will appear after analyzing commits
                        </div>
                    </>
                )}
            </div>
        );
    }

    return (
        <ul className="cockpit__list">
            {list.map((s) => (
                <li key={s.id} className="cockpit__list-item">
                    <div className="cockpit__row">
                        <span className="cockpit__codicon" data-icon={getSymbolKindIcon(s.kind)} title={s.kind}></span>
                        <span>{s.name}</span>
                        {s.changeType && (
                            <span className="cockpit__badge" title={`${s.changeType} symbol`}>
                                {getChangeTypeBadge(s.changeType)}
                            </span>
                        )}
                        <span className="cockpit__dim">{s.kind || ''}</span>
                        <span className="cockpit__mono">{formatDate(s.lastChangedAt)}</span>
                    </div>
                    <div className="cockpit__message">{s.path}</div>
                    <div className="cockpit__actions">
                        <button
                            className="cockpit__button ghost small"
                            onClick={() => vscode.postMessage({ type: 'openSymbolHistory', symbolId: s.id })}
                        >
                            Open history
                        </button>
                        <button
                            className="cockpit__button ghost small"
                            onClick={() => vscode.postMessage({ type: 'openSymbolInEditor', symbolId: s.id })}
                        >
                            Open latest
                        </button>
                    </div>
                </li>
            ))}
        </ul>
    );
};



/* ---- File: src/webview/cockpit/index.tsx ---- */

import * as React from 'react';
import { createRoot } from 'react-dom/client';
import { CockpitSectionKey, CockpitState, SymbolChangeType } from '../../types/cockpit';
import { Header } from './components/Header';
import { CommitList } from './components/CommitList';
import { ReportList } from './components/ReportList';
import { SymbolList } from './components/SymbolList';
import { SelectionPanel } from './components/SelectionPanel';
import { BundlePanel } from './components/BundlePanel';
import { formatDate } from './utils';

declare global {
  interface Window {
    acquireVsCodeApi(): {
      postMessage: (message: any) => void;
    };
  }
}

const vscode = window.acquireVsCodeApi();

const defaultState: CockpitState = {
  repoName: null,
  branchName: null,
  activeSection: 'commits',
  isAnalyzing: false,
  analysisStep: undefined,
  analysisProgress: undefined,
  error: null,
  selectedCommitShas: [],
  selectedStagedPaths: [],
  selectedUnstagedPaths: [],
  selectedFiles: [],
  commits: [],
  hasMoreCommits: false,
  commitsFilterText: '',
  commitsFilterScopes: { staged: true, unstaged: true, history: true },
  lastNCommits: 20,
  stagedFiles: [],
  unstagedFiles: [],
  workspaceScope: 'workspace',
  bundleSummary: null,
  bundleFacts: null,
  bundleReportId: null,
  symbols: [],
  symbolFilterText: '',
  symbolKindFilter: 'all',
  symbolChangeFilter: 'all',
  activeSymbolId: null,
  activeSymbolHistory: [],
  reports: [],
  reportsFilterText: '',
  reportsBranchFilter: 'all',
  reportsShowPinnedOnly: false
};

const App: React.FC = () => {
  const [open, setOpen] = React.useState<Record<CockpitSectionKey, boolean>>({
    commits: true,
    bundle: true,
    symbols: false,
    reports: false
  });
  const [state, setState] = React.useState<CockpitState>(defaultState);
  const filterDebounceRef = React.useRef<Record<string, NodeJS.Timeout>>({});

  React.useEffect(() => {
    const handler = (event: MessageEvent) => {
      const message = event.data;
      if (message?.type === 'updateState' && message.payload) {
        const payload = message.payload as CockpitState;
        setState((prev) => ({ ...prev, ...payload }));
      } else if (message?.type === 'analysisProgress' && message.payload) {
        const payload = message.payload as { isAnalyzing: boolean; step?: string; progress?: number };
        setState((prev) => ({
          ...prev,
          isAnalyzing: payload.isAnalyzing,
          analysisStep: payload.step,
          analysisProgress: payload.progress
        }));
      } else if (message?.type === 'focusSection' && message.payload) {
        const payload = message.payload as { section: CockpitSectionKey };
        setState((prev) => ({ ...prev, activeSection: payload.section }));
        setOpen((prev) => ({ ...prev, [payload.section]: true }));
      }
    };
    window.addEventListener('message', handler);
    vscode.postMessage({ type: 'ready' });
    return () => window.removeEventListener('message', handler);
  }, []);

  const toggle = (key: CockpitSectionKey) => {
    setOpen((prev) => ({ ...prev, [key]: !prev[key] }));
    vscode.postMessage({ type: 'setActiveSection', section: key });
  };

  const updateCommitsFilterText = (text: string) => {
    setState((prev) => ({ ...prev, commitsFilterText: text }));
    if (filterDebounceRef.current.commitsFilter) {
      clearTimeout(filterDebounceRef.current.commitsFilter);
    }
    filterDebounceRef.current.commitsFilter = setTimeout(() => {
      vscode.postMessage({ type: 'setCommitsFilterText', text });
    }, 300);
  };

  const toggleCommitsScope = (scope: keyof CockpitState['commitsFilterScopes']) => {
    const scopes = { ...state.commitsFilterScopes, [scope]: !state.commitsFilterScopes[scope] };
    setState((prev) => ({ ...prev, commitsFilterScopes: scopes }));
    vscode.postMessage({ type: 'setCommitsFilterScopes', scopes });
  };

  const updateSymbolFilterText = (text: string) => {
    setState((prev) => ({ ...prev, symbolFilterText: text }));
    if (filterDebounceRef.current.symbolFilter) {
      clearTimeout(filterDebounceRef.current.symbolFilter);
    }
    filterDebounceRef.current.symbolFilter = setTimeout(() => {
      vscode.postMessage({ type: 'setSymbolFilterText', text });
    }, 300);
  };

  const updateSymbolKind = (kind: string | 'all') => {
    setState((prev) => ({ ...prev, symbolKindFilter: kind }));
    vscode.postMessage({ type: 'setSymbolKindFilter', kind });
  };

  const updateSymbolChangeFilter = (change: 'all' | SymbolChangeType) => {
    setState((prev) => ({ ...prev, symbolChangeFilter: change }));
    vscode.postMessage({ type: 'setSymbolChangeFilter', change });
  };

  const updateReportsFilterText = (text: string) => {
    setState((prev) => ({ ...prev, reportsFilterText: text }));
    if (filterDebounceRef.current.reportsFilter) {
      clearTimeout(filterDebounceRef.current.reportsFilter);
    }
    filterDebounceRef.current.reportsFilter = setTimeout(() => {
      vscode.postMessage({ type: 'setReportsFilterText', text });
    }, 300);
  };

  const updateReportsBranchFilter = (branch: string | 'all') => {
    setState((prev) => ({ ...prev, reportsBranchFilter: branch }));
    vscode.postMessage({ type: 'setReportsBranchFilter', branch });
  };

  const updateReportsPinned = (value: boolean) => {
    setState((prev) => ({ ...prev, reportsShowPinnedOnly: value }));
    vscode.postMessage({ type: 'setReportsShowPinnedOnly', value });
  };

  const selectionSummary = `${state.selectedCommitShas.length} commits • ${state.selectedStagedPaths.length} staged • ${state.selectedUnstagedPaths.length} unstaged`;
  const bundleSummaryText = state.bundleSummary
    ? `${state.bundleSummary.commitCount} commits, ${state.bundleSummary.fileCount} files${state.bundleSummary.symbolCount ? `, ${state.bundleSummary.symbolCount} symbols` : ''}`
    : 'Bundle: none';
  const reportBranches = Array.from(new Set(state.reports.map((r) => r.branch).filter(Boolean))) as string[];
  const commitsFiltered =
    !!state.commitsFilterText ||
    !state.commitsFilterScopes.staged ||
    !state.commitsFilterScopes.unstaged ||
    !state.commitsFilterScopes.history;

  return (
    <div className="cockpit">
      <Header
        state={state}
        vscode={vscode}
        bundleSummaryText={bundleSummaryText}
        onDismissError={() => {
          setState((prev) => ({ ...prev, error: null }));
          vscode.postMessage({ type: 'clearError' });
        }}
      />

      <section className="cockpit__dashboard">
        <SelectionPanel state={state} vscode={vscode} />
        <BundlePanel state={state} vscode={vscode} />
      </section>

      <div className="cockpit__accordion">
        <button className="cockpit__accordion-header" onClick={() => toggle('commits')}>
          <span>Commits & Selection</span>
          <span className="cockpit__dim">
            {selectionSummary}
            {commitsFiltered ? ' • Filtered' : ''}
          </span>
        </button>
        {open.commits && (
          <div className="cockpit__accordion-body">
            <div className="cockpit__actions">
              <button className="cockpit__button ghost" onClick={() => vscode.postMessage({ type: 'selectAllStaged' })}>
                Select all staged
              </button>
              <button className="cockpit__button ghost" onClick={() => vscode.postMessage({ type: 'selectAllUnstaged' })}>
                Select all unstaged
              </button>
              <button className="cockpit__button ghost" onClick={() => vscode.postMessage({ type: 'clearSelection' })}>
                Clear selection
              </button>
              <button
                className="cockpit__button ghost"
                onClick={() => {
                  const value = prompt('Add commit by SHA or ref');
                  if (value) {
                    vscode.postMessage({ type: 'addCommitBySha', shaOrRef: value });
                  }
                }}
              >
                Add commit by SHA
              </button>
            </div>
            <div className="cockpit__actions">
              <input
                className="cockpit__input"
                placeholder="Filter commits..."
                value={state.commitsFilterText}
                onChange={(e) => updateCommitsFilterText(e.target.value)}
              />
              <button
                className="cockpit__button ghost small"
                onClick={() => toggleCommitsScope('staged')}
                title="Show staged commits"
              >
                {state.commitsFilterScopes.staged ? 'Staged ✓' : 'Staged ✕'}
              </button>
              <button
                className="cockpit__button ghost small"
                onClick={() => toggleCommitsScope('unstaged')}
                title="Show unstaged commits"
              >
                {state.commitsFilterScopes.unstaged ? 'Unstaged ✓' : 'Unstaged ✕'}
              </button>
              <button
                className="cockpit__button ghost small"
                onClick={() => toggleCommitsScope('history')}
                title="Show history commits"
              >
                {state.commitsFilterScopes.history ? 'History ✓' : 'History ✕'}
              </button>
            </div>
            <div className="cockpit__message">
              Staged files: {state.stagedFiles.length ? (
                <>
                  {state.stagedFiles.map((f) => f.path).slice(0, 5).join(', ')}
                  {state.stagedFiles.length > 5 && ` (+${state.stagedFiles.length - 5} more)`}
                </>
              ) : (
                <span className="cockpit__dim">No staged files</span>
              )}
            </div>
            <div className="cockpit__message">
              Unstaged files:{' '}
              {state.unstagedFiles.length ? (
                <>
                  {state.unstagedFiles.map((f) => f.path).slice(0, 5).join(', ')}
                  {state.unstagedFiles.length > 5 && ` (+${state.unstagedFiles.length - 5} more)`}
                </>
              ) : (
                <span className="cockpit__dim">No unstaged files</span>
              )}
            </div>
            <div className="cockpit__actions">
              {state.hasMoreCommits ? (
                <button className="cockpit__button ghost" onClick={() => vscode.postMessage({ type: 'loadMoreCommits' })}>
                  Load more
                </button>
              ) : (
                <span className="cockpit__dim">Showing {state.commits.length} commits</span>
              )}
            </div>
            <CommitList state={state} vscode={vscode} formatDate={formatDate} />
          </div>
        )}

        <button className="cockpit__accordion-header" onClick={() => toggle('bundle')}>
          <span>Active Bundle</span>
          <span className="cockpit__dim">{bundleSummaryText}</span>
        </button>
        {open.bundle && (
          <div className="cockpit__accordion-body">
            <div className="cockpit__message">
              {state.bundleSummary ? (
                <>
                  <div>Commits: {state.bundleSummary.commitCount}</div>
                  <div>Files: {state.bundleSummary.fileCount}</div>
                  <div>Symbols: {state.bundleSummary.symbolCount}</div>
                  <div>Created: {formatDate(state.bundleSummary.createdAt)}</div>
                </>
              ) : (
                'No active bundle yet'
              )}
            </div>
            <div className="cockpit__actions">
              <button className="cockpit__button ghost" onClick={() => vscode.postMessage({ type: 'bundleRegenerate' })}>
                Regenerate
              </button>
              <button className="cockpit__button ghost" onClick={() => vscode.postMessage({ type: 'bundleExport' })}>
                Export JSON
              </button>
              <button className="cockpit__button ghost" onClick={() => vscode.postMessage({ type: 'openActiveReport' })}>
                Open full report
              </button>
              <button className="cockpit__button ghost" onClick={() => vscode.postMessage({ type: 'bundleClear' })}>
                Clear bundle
              </button>
              {state.isAnalyzing && (
                <button className="cockpit__button ghost danger" onClick={() => vscode.postMessage({ type: 'cancelAnalysis' })}>
                  Cancel analysis
                </button>
              )}
            </div>
            {state.bundleSummary && (
              <div className="cockpit__actions">
                <span className="cockpit__dim">Quick links:</span>
                <button
                  className="cockpit__button ghost small"
                  onClick={() => vscode.postMessage({ type: 'scrollReportToSection', sectionId: 'overview' })}
                >
                  Overview
                </button>
                <button
                  className="cockpit__button ghost small"
                  onClick={() => vscode.postMessage({ type: 'scrollReportToSection', sectionId: 'incompleteness' })}
                >
                  Incompleteness
                </button>
                <button
                  className="cockpit__button ghost small"
                  onClick={() => vscode.postMessage({ type: 'scrollReportToSection', sectionId: 'drift' })}
                >
                  Drift
                </button>
                <button
                  className="cockpit__button ghost small"
                  onClick={() => vscode.postMessage({ type: 'scrollReportToSection', sectionId: 'legacy' })}
                >
                  Legacy
                </button>
                <button
                  className="cockpit__button ghost small"
                  onClick={() => vscode.postMessage({ type: 'scrollReportToSection', sectionId: 'timeline' })}
                >
                  Timeline
                </button>
              </div>
            )}
          </div>
        )}

        <button className="cockpit__accordion-header" onClick={() => toggle('symbols')}>
          <span>Symbols</span>
          <span className="cockpit__dim">{state.symbols.length} rows</span>
        </button>
        {open.symbols && (
          <div className="cockpit__accordion-body">
            <div className="cockpit__actions">
              <input
                className="cockpit__input"
                placeholder="Search symbols..."
                value={state.symbolFilterText}
                onChange={(e) => updateSymbolFilterText(e.target.value)}
              />
              <select
                className="cockpit__input"
                value={state.symbolKindFilter}
                onChange={(e) => updateSymbolKind(e.target.value)}
              >
                <option value="all">All kinds</option>
                <option value="function">function</option>
                <option value="class">class</option>
                <option value="method">method</option>
                <option value="component">component</option>
              </select>
              <select
                className="cockpit__input"
                value={state.symbolChangeFilter}
                onChange={(e) => updateSymbolChangeFilter(e.target.value as 'all' | SymbolChangeType)}
              >
                <option value="all">All changes</option>
                <option value="added">added</option>
                <option value="modified">modified</option>
                <option value="removed">removed</option>
              </select>
            </div>
            <SymbolList state={state} vscode={vscode} />
          </div>
        )}

        <button className="cockpit__accordion-header" onClick={() => toggle('reports')}>
          <span>Reports</span>
          <span className="cockpit__dim">{state.reports.length} saved</span>
        </button>
        {open.reports && (
          <div className="cockpit__accordion-body">
            <div className="cockpit__actions">
              <input
                className="cockpit__input"
                placeholder="Filter reports..."
                value={state.reportsFilterText}
                onChange={(e) => updateReportsFilterText(e.target.value)}
              />
              <select
                className="cockpit__input"
                value={state.reportsBranchFilter}
                onChange={(e) => updateReportsBranchFilter(e.target.value)}
              >
                <option value="all">All branches</option>
                {reportBranches.map((branch) => (
                  <option key={branch} value={branch}>
                    {branch}
                  </option>
                ))}
              </select>
              <label className="cockpit__row">
                <input
                  type="checkbox"
                  checked={state.reportsShowPinnedOnly}
                  onChange={(e) => updateReportsPinned(e.target.checked)}
                />
                <span className="cockpit__dim">Pinned only</span>
              </label>
            </div>
            <ReportList state={state} vscode={vscode} />
          </div>
        )}
      </div>
    </div>
  );
};

const rootEl = document.getElementById('root');
if (rootEl) {
  const root = createRoot(rootEl);
  root.render(<App />);
}



/* ---- File: src/webview/cockpit/utils.ts ---- */

import { SymbolChangeType } from '../../types/cockpit';

export const formatDate = (value?: string | null) => {
    if (!value) return '';
    try {
        return new Date(value).toLocaleDateString();
    } catch {
        return value;
    }
};

export const getSymbolKindIcon = (kind: string): string => {
    const iconMap: Record<string, string> = {
        function: 'symbol-function',
        method: 'symbol-method',
        class: 'symbol-class',
        interface: 'symbol-interface',
        enum: 'symbol-enum',
        constant: 'symbol-constant',
        variable: 'symbol-variable',
        property: 'symbol-property',
        component: 'symbol-component',
        type: 'symbol-type'
    };
    return iconMap[kind.toLowerCase()] || 'symbol-misc';
};

export const getChangeTypeBadge = (changeType?: SymbolChangeType): string => {
    if (!changeType) return '';
    const badges: Record<SymbolChangeType, string> = {
        added: '➕',
        modified: '✏️',
        removed: '➖'
    };
    return badges[changeType] || '';
};



/* ---- File: src/webview/CockpitProvider.ts ---- */

import * as vscode from 'vscode';
import { logInfo, logError } from '../utils/logger';
import { CockpitClientMessage, CockpitSectionKey, CockpitState } from '../types/cockpit';

export class CockpitProvider implements vscode.WebviewViewProvider {
  private view?: vscode.WebviewView;
  private state: CockpitState = {
    repoName: null,
    branchName: null,
    activeSection: 'commits',
    isAnalyzing: false,
    analysisStep: undefined,
    analysisProgress: undefined,
    error: null,
    selectedCommitShas: [],
    selectedStagedPaths: [],
    selectedUnstagedPaths: [],
    selectedFiles: [],
    hasMoreCommits: false,
    commitsFilterText: '',
    commitsFilterScopes: { staged: true, unstaged: true, history: true },
    lastNCommits: 20,
    stagedFiles: [],
    unstagedFiles: [],
    workspaceScope: 'workspace',
    commits: [],
    bundleSummary: null,
    bundleFacts: null,
    bundleReportId: null,
    symbols: [],
    symbolFilterText: '',
    symbolKindFilter: 'all',
    symbolChangeFilter: 'all',
    activeSymbolId: null,
    activeSymbolHistory: [],
    reports: [],
    reportsFilterText: '',
    reportsBranchFilter: 'all',
    reportsShowPinnedOnly: false
  };

  constructor(private readonly extensionUri: vscode.Uri) { }

  resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ): void {
    this.view = webviewView;
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(this.extensionUri, 'media')]
    };
    webviewView.webview.html = this.getHtml(webviewView.webview);
    webviewView.webview.onDidReceiveMessage((msg) => this.handleMessage(msg));
    this.sendState();
  }

  getState(): CockpitState {
    return this.state;
  }

  updateCommits(commits: CockpitState['commits']) {
    this.state = { ...this.state, commits };
    this.sendState();
  }

  updateSelection(
    selectedCommitShas: string[],
    selectedStagedPaths: string[],
    selectedUnstagedPaths: string[],
    workspaceScope: CockpitState['workspaceScope'],
    selectedFiles?: string[]
  ) {
    this.state = {
      ...this.state,
      selectedCommitShas,
      selectedStagedPaths,
      selectedUnstagedPaths,
      selectedFiles,
      workspaceScope
    };
    this.sendState();
  }

  updateWorkspaceFiles(stagedFiles: CockpitState['stagedFiles'], unstagedFiles: CockpitState['unstagedFiles']) {
    this.state = { ...this.state, stagedFiles, unstagedFiles };
    this.sendState();
  }

  updateBundleFacts(bundleFacts: CockpitState['bundleFacts'], bundleSummary?: CockpitState['bundleSummary']) {
    this.state = { ...this.state, bundleFacts, bundleSummary: bundleSummary ?? this.state.bundleSummary };
    this.sendState();
  }

  updateSymbols(symbols: CockpitState['symbols']) {
    this.state = { ...this.state, symbols };
    this.sendState();
  }

  updateReports(reports: CockpitState['reports']) {
    this.state = { ...this.state, reports };
    this.sendState();
  }

  updateState(partial: Partial<CockpitState>) {
    this.state = { ...this.state, ...partial };
    this.sendState();
  }

  updateAnalysisProgress(isAnalyzing: boolean, step?: string, progress?: number) {
    this.state = { ...this.state, isAnalyzing, analysisStep: step, analysisProgress: progress };
    this.sendAnalysisProgress(isAnalyzing, step, progress);
  }

  focusSection(section: CockpitSectionKey) {
    this.state = { ...this.state, activeSection: section };
    this.sendFocusSection(section);
  }

  private sendFocusSection(section: CockpitSectionKey) {
    if (!this.view) {
      return;
    }
    try {
      this.view.webview.postMessage({
        type: 'focusSection',
        payload: { section }
      });
      logInfo(`[Cockpit] Sent focusSection message for ${section}`);
    } catch (error) {
      logError('[Cockpit] Failed to send focusSection', error);
    }
  }

  private sendAnalysisProgress(isAnalyzing: boolean, step?: string, progress?: number) {
    if (!this.view) {
      return;
    }
    try {
      this.view.webview.postMessage({
        type: 'analysisProgress',
        payload: { isAnalyzing, step, progress }
      });
      logInfo('[Cockpit] Sent analysis progress update');
    } catch (error) {
      logError('[Cockpit] Failed to send analysis progress', error);
    }
  }

  private async handleMessage(msg: CockpitClientMessage | { type: 'ready' } | { type: 'clearError' }) {
    logInfo(`[Cockpit] Received message: ${msg.type}`);
    console.log('[Cockpit] Message details:', msg);
    switch (msg.type) {
      case 'setActiveSection':
        this.state = { ...this.state, activeSection: msg.section };
        this.sendState();
        break;
      case 'generateReport': {
        const mode = msg.mode as 'selection' | 'lastN' | 'staged' | 'unstaged' | undefined;
        try {
          if (mode === 'staged') {
            await vscode.commands.executeCommand('git-context.analyzeStagedChanges');
          } else if (mode === 'unstaged') {
            await vscode.commands.executeCommand('git-context.analyzeUnstagedChanges');
          } else if (mode === 'lastN') {
            // Show VS Code input box for last N commits
            const { getExtensionConfig } = await import('../utils/config');
            const config = getExtensionConfig();
            const defaultValue = String(this.state.lastNCommits || config.defaultCommitCount || 20);

            const count = await vscode.window.showInputBox({
              prompt: 'Number of commits to analyze',
              value: defaultValue,
              validateInput: (value) => {
                const num = parseInt(value);
                if (isNaN(num) || num <= 0) {
                  return 'Please enter a positive number';
                }
                return undefined;
              }
            });

            if (count) {
              const lastN = parseInt(count);
              // Update state with the selected count
              this.state = { ...this.state, lastNCommits: lastN };
              this.sendState();
              // Execute the command with the count
              await vscode.commands.executeCommand('git-context.analyzeLastCommits', count);
            }
          } else {
            await vscode.commands.executeCommand('git-context.analyze');
          }
          this.state = { ...this.state, isAnalyzing: true, error: null };
          logInfo(`[Cockpit] Triggered analysis (${mode || 'selection'})`);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          this.state = { ...this.state, isAnalyzing: false, error: errorMessage };
          this.sendState();
          logError('[Cockpit] Failed to trigger analysis', error);
        }
        break;
      }
      case 'cancelAnalysis':
        await vscode.commands.executeCommand('git-context.bundle.cancel');
        this.state = { ...this.state, isAnalyzing: false };
        this.sendState();
        break;
      case 'toggleCommit':
        if (msg.sha) {
          await vscode.commands.executeCommand('git-context.toggleCommitSelection', msg.sha);
        }
        break;
      case 'addCommitBySha':
        if (msg.shaOrRef) {
          await vscode.commands.executeCommand('git-context.addCommitBySha', msg.shaOrRef);
        }
        break;
      case 'loadMoreCommits':
        await vscode.commands.executeCommand('git-context.addMoreCommits');
        break;
      case 'setCommitsFilterText':
        this.state = { ...this.state, commitsFilterText: msg.text ?? '' };
        this.sendState();
        break;
      case 'setCommitsFilterScopes':
        this.state = {
          ...this.state,
          commitsFilterScopes: { ...this.state.commitsFilterScopes, ...msg.scopes }
        };
        this.sendState();
        break;
      case 'selectAllStaged':
        await vscode.commands.executeCommand('git-context.selectAllStaged');
        break;
      case 'selectAllUnstaged':
        await vscode.commands.executeCommand('git-context.selectAllUnstaged');
        break;
      case 'clearSelection':
        await vscode.commands.executeCommand('git-context.clearSelection');
        break;
      case 'resetAll':
        await vscode.commands.executeCommand('git-context.resetAll');
        break;
      case 'openActiveReport':
        if (this.state.bundleReportId) {
          await vscode.commands.executeCommand('git-context.openReport', this.state.bundleReportId);
        }
        break;
      case 'openReport':
        if (msg.reportId) {
          await vscode.commands.executeCommand('git-context.openReport', msg.reportId);
        }
        break;
      case 'regenerateReport':
        if (msg.reportId) {
          await vscode.commands.executeCommand('git-context.regenerateReport', msg.reportId);
        }
        break;
      case 'deleteReport':
        if (msg.reportId) {
          await vscode.commands.executeCommand('git-context.deleteReport', msg.reportId);
        }
        break;
      case 'togglePinReport':
        if (msg.reportId) {
          await vscode.commands.executeCommand('git-context.togglePinReport', msg.reportId);
        }
        break;
      case 'openActiveReport':
        // Open the bundleReportId if it exists
        const reportId = this.state.bundleReportId;
        if (reportId) {
          await vscode.commands.executeCommand('git-context.openReport', reportId);
        } else {
          vscode.window.showInformationMessage('No active report available');
        }
        break;
      case 'bundleRegenerate':
        await vscode.commands.executeCommand('git-context.bundle.regenerate');
        break;
      case 'bundleClear':
        await vscode.commands.executeCommand('git-context.bundle.clear');
        break;
      case 'bundleExport':
        await vscode.commands.executeCommand('git-context.bundle.export');
        break;
      case 'openSymbolHistory':
        if (msg.symbolId) {
          await vscode.commands.executeCommand('git-context.openSymbolHistory', msg.symbolId);
        }
        break;
      case 'openSymbolInEditor':
        if (msg.symbolId) {
          await vscode.commands.executeCommand('git-context.openSymbol', msg.symbolId);
        }
        break;
      case 'setSymbolFilterText':
        this.state = { ...this.state, symbolFilterText: msg.text ?? '' };
        this.sendState();
        break;
      case 'setSymbolKindFilter':
        this.state = { ...this.state, symbolKindFilter: msg.kind ?? 'all' };
        this.sendState();
        break;
      case 'setSymbolChangeFilter':
        this.state = { ...this.state, symbolChangeFilter: msg.change ?? 'all' };
        this.sendState();
        break;
      case 'compareFilesToCommit':
        if (msg.sha) {
          await vscode.commands.executeCommand('git-context.compareFilesToCommit', msg.sha);
        }
        break;
      case 'setReportsFilterText':
        this.state = { ...this.state, reportsFilterText: msg.text ?? '' };
        this.sendState();
        break;
      case 'setReportsBranchFilter':
        this.state = { ...this.state, reportsBranchFilter: msg.branch ?? 'all' };
        this.sendState();
        break;
      case 'setReportsShowPinnedOnly':
        this.state = { ...this.state, reportsShowPinnedOnly: msg.value ?? false };
        this.sendState();
        break;
      case 'scrollReportToSection':
        if (msg.sectionId) {
          // First ensure report is open
          if (this.state.bundleReportId) {
            await vscode.commands.executeCommand('git-context.openReport', this.state.bundleReportId);
          }
          // Then scroll to the section
          await vscode.commands.executeCommand('git-context.scrollToReportSection', msg.sectionId);
          logInfo(`[Cockpit] Scrolled to report section ${msg.sectionId}`);
        }
        break;
      case 'openEvidence':
        if (msg.evidenceId) {
          await vscode.commands.executeCommand('git-context.openEvidence', msg.evidenceId);
        }
        break;
      case 'ready':
        this.sendState();
        break;
      case 'clearError':
        this.state = { ...this.state, error: null };
        this.sendState();
        break;
      default:
        break;
    }
  }

  private sendState() {
    if (!this.view) {
      return;
    }
    try {
      this.view.webview.postMessage({ type: 'updateState', payload: this.state });
      logInfo('[Cockpit] Sent state update to webview');
    } catch (error) {
      logError('[Cockpit] Failed to send state', error);
    }
  }

  private getHtml(webview: vscode.Webview): string {
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'media', 'cockpit.js')
    );
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'media', 'cockpit.css')
    );

    const cspSource = webview.cspSource;
    const nonce = getNonce();

    return /* html */ `
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${cspSource} blob: data:; style-src ${cspSource}; script-src 'nonce-${nonce}';">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <link rel="stylesheet" href="${styleUri}">
          <title>Cockpit</title>
        </head>
        <body>
          <div id="root"></div>
          <script nonce="${nonce}" src="${scriptUri}"></script>
        </body>
      </html>
    `;
  }
}

function getNonce() {
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let text = '';
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}



/* ---- File: src/webview/main.ts ---- */

import { RefactorReportView } from './RefactorReportView';
import { LlmAnalysis } from '../analysis/llmAnalyst/blocks';
import { RefactorBundleFacts } from '../facts/types';
import { EvidenceLink } from '../analysis/llmAnalyst/blocks';

/**
 * Main entry point for the webview
 */
declare global {
  interface Window {
    acquireVsCodeApi(): any;
  }
}

const vscode = window.acquireVsCodeApi();

// State
let analysis: LlmAnalysis | undefined;
let facts: RefactorBundleFacts | undefined;
let view: RefactorReportView | undefined;

/**
 * Handle messages from the extension
 */
window.addEventListener('message', event => {
  const message = event.data;

  switch (message.type) {
    case 'setData':
      analysis = message.analysis;
      facts = message.facts;
      renderApp();
      break;
    case 'scrollToSection':
      // Scroll to section by ID
      const sectionId = message.sectionId;
      if (sectionId) {
        const element = document.getElementById(sectionId);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'start' });
        } else {
          // Try to find by data attribute or class
          const altElement = document.querySelector(`[data-commit-sha="${sectionId.replace('commit-', '')}"]`) ||
                            document.querySelector(`.commit-section[data-sha="${sectionId.replace('commit-', '')}"]`);
          if (altElement) {
            altElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        }
      }
      break;
  }
});

/**
 * Handle evidence clicks
 */
const handleEvidenceClick = (evidence: EvidenceLink) => {
  vscode.postMessage({
    type: 'evidenceClick',
    evidence
  });
};

/**
 * Render the app
 */
function renderApp() {
  const rootElement = document.getElementById('root');
  if (!rootElement || !analysis || !facts) return;

  // Clean up previous view
  if (view) {
    // The view re-renders itself when data changes
  }

  // Create new view
  view = new RefactorReportView(rootElement, analysis, facts, handleEvidenceClick);
}

/**
 * Signal that the webview is ready
 */
vscode.postMessage({ type: 'ready' });

// Initial render
renderApp();



/* ---- File: src/webview/refactorReportProvider.ts ---- */

import * as vscode from 'vscode';
import * as path from 'path';
import { logInfo, logDebug, logError } from '../utils/logger';
import { LlmAnalysis } from '../analysis/llmAnalyst/blocks';
import { RefactorBundleFacts } from '../facts/types';
import { EvidenceLink } from '../analysis/llmAnalyst/blocks';
import { resolveEvidencePath } from '../analysis/llmAnalyst/renderer';
import { getGitRoot } from '../utils/config';

/**
 * Webview provider for the refactor report
 */
export class RefactorReportProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'gitContext.refactorReport';
  private _panel: vscode.WebviewPanel | undefined;
  private _analysis: LlmAnalysis | undefined;
  private _facts: RefactorBundleFacts | undefined;

  constructor(private readonly _extensionUri: vscode.Uri) { }

  /**
   * Set the analysis data and show the webview
   */
  public showReport(analysis: LlmAnalysis, facts: RefactorBundleFacts): void {
    logDebug('[WEBVIEW] showReport called');
    logDebug(`[WEBVIEW] Analysis provided: ${!!analysis}`);
    logDebug(`[WEBVIEW] Facts provided: ${!!facts}`);

    if (analysis) {
      logDebug(`[WEBVIEW] Analysis keys: ${Object.keys(analysis).join(', ')}`);
    }
    if (facts) {
      logDebug(`[WEBVIEW] Facts keys: ${Object.keys(facts).join(', ')}`);
      logDebug(`[WEBVIEW] Facts findings: ${JSON.stringify(facts.findings)}`);
    }

    this._analysis = analysis;
    this._facts = facts;

    if (this._panel) {
      logDebug('[WEBVIEW] Updating existing panel');
      this._panel.reveal(vscode.ViewColumn.Two);
      this._update();
    } else {
      logDebug('[WEBVIEW] Creating new panel');
      this._panel = vscode.window.createWebviewPanel(
        RefactorReportProvider.viewType,
        'Refactor Intelligence',
        vscode.ViewColumn.Two,
        {
          enableScripts: true,
          retainContextWhenHidden: true
        }
      );

      this._panel.webview.html = this._getHtmlForWebview(this._panel.webview);
      logDebug('[WEBVIEW] Panel created and HTML set');
      this._update();

      this._panel.onDidDispose(() => {
        logDebug('[WEBVIEW] Panel disposed');
        this._panel = undefined;
      });
    }
  }

  /**
   * VS Code WebviewViewProvider interface
   */
  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken,
  ): void {
    this._panel = webviewView as any; // Type assertion for compatibility
    this._update();
  }

  /**
   * Update the webview content
   */
  private _update(): void {
    logDebug('[WEBVIEW] _update called');
    const webview = this._panel?.webview;

    if (!webview) {
      logDebug('[WEBVIEW] No webview available to update');
      return;
    }

    // Set panel title if it's a WebviewPanel
    if (this._panel && 'title' in this._panel) {
      (this._panel as any).title = 'Refactor Intelligence Report';
    }

    logDebug(`[WEBVIEW] Posting message to webview - hasAnalysis: ${!!this._analysis}, hasFacts: ${!!this._facts}`);

    const message = {
      type: 'setData',  // Changed from 'update' to match webview listener
      analysis: this._analysis,
      facts: this._facts
    };

    // Log size of message being sent
    const messageStr = JSON.stringify(message);
    logDebug(`[WEBVIEW] Message size: ${messageStr.length} chars`);
    logDebug(`[WEBVIEW] Message preview (first 500 chars): ${messageStr.substring(0, 500)}`);

    webview.postMessage(message);
    logDebug('[WEBVIEW] Message posted to webview');

    // Set up message handler for clicks
    webview.onDidReceiveMessage(
      async (message) => {
        logDebug(`[WEBVIEW] Received message from webview: ${message.type}`);
        if (message.type === 'evidenceClick') {
          logDebug(`[WEBVIEW] Evidence click: ${JSON.stringify(message.evidence)}`);
          await this._handleEvidenceClick(message.evidence);
        }
      }
    );
  }

  /**
   * Navigate to a specific commit section in the report
   */
  public navigateToCommitSection(commitSha: string): void {
    const webview = this._panel?.webview;
    if (!webview) {
      return;
    }

    // Send scroll message to webview
    webview.postMessage({
      type: 'scrollToSection',
      sectionId: `commit-${commitSha.substring(0, 8)}`
    });
  }

  /**
   * Scroll to a specific section in the report (e.g., "overview", "incompleteness", "drift", "legacy", "timeline")
   */
  public scrollToSection(sectionId: string): void {
    const webview = this._panel?.webview;
    if (!webview) {
      return;
    }

    // Send scroll message to webview
    webview.postMessage({
      type: 'scrollToSection',
      sectionId
    });
  }

  /**
   * Handle evidence click from the webview
   */
  private async _handleEvidenceClick(evidence: EvidenceLink): Promise<void> {
    try {
      if (!this._facts) {
        vscode.window.showErrorMessage('Facts data not available');
        return;
      }

      // Resolve evidence path to file location
      const resolved = resolveEvidencePath(evidence.path, this._facts);

      if (resolved) {
        const gitRoot = getGitRoot();
        if (!gitRoot) {
          vscode.window.showErrorMessage('Not in a git repository');
          return;
        }

        const fullPath = path.join(gitRoot, resolved.filePath);
        const uri = vscode.Uri.file(fullPath);
        const doc = await vscode.workspace.openTextDocument(uri);

        const options: vscode.TextDocumentShowOptions = {
          preview: false
        };

        if (resolved.lineNumber !== undefined) {
          options.selection = new vscode.Range(
            resolved.lineNumber - 1, 0,
            resolved.lineNumber - 1, 1000
          );
        }

        await vscode.window.showTextDocument(doc, options);
      } else if (evidence.filePath) {
        // Fallback: Direct file path provided
        const uri = vscode.Uri.file(evidence.filePath);
        const doc = await vscode.workspace.openTextDocument(uri);
        await vscode.window.showTextDocument(doc, {
          preview: false,
          selection: evidence.lineNumber
            ? new vscode.Range(evidence.lineNumber - 1, 0, evidence.lineNumber - 1, 0)
            : undefined
        });
      } else if (evidence.symbolId) {
        // Symbol-based navigation
        const filePath = evidence.symbolId.split(':')[0];
        if (filePath) {
          const uri = vscode.Uri.file(filePath);
          const doc = await vscode.workspace.openTextDocument(uri);
          await vscode.window.showTextDocument(doc, { preview: false });
        }
      } else {
        // Try to resolve from facts JSON path using utility function
        const resolved = resolveEvidencePath(evidence.path, this._facts!);
        if (resolved && resolved.filePath) {
          const gitRoot = getGitRoot();
          if (!gitRoot) {
            vscode.window.showErrorMessage('Not in a git repository');
            return;
          }

          const fullPath = path.join(gitRoot, resolved.filePath);
          const uri = vscode.Uri.file(fullPath);
          const doc = await vscode.workspace.openTextDocument(uri);
          await vscode.window.showTextDocument(doc, {
            preview: false,
            selection: resolved.lineNumber
              ? new vscode.Range(resolved.lineNumber - 1, 0, resolved.lineNumber - 1, 1000)
              : undefined
          });
        } else {
          // Fallback: show a notification
          vscode.window.showInformationMessage(`Evidence: ${evidence.description}\nPath: ${evidence.path}`);
        }
      }
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to open evidence: ${error}`);
    }
  }

  /**
   * Post a message to the report webview (helper for external callers)
   */
  public postMessage(message: any): void {
    const webview = this._panel?.webview;
    if (!webview) {
      return;
    }
    webview.postMessage(message);
  }

  /**
   * Resolve evidence path to file location
   */
  private _resolveEvidencePath(pathParts: string[], facts?: RefactorBundleFacts): { filePath?: string; lineNumber?: number } | null {
    if (!facts) return null;

    try {
      let current: any = facts;

      for (let i = 0; i < pathParts.length; i++) {
        const part = pathParts[i];

        if (part.includes('[')) {
          // Handle array access like findings.incompleteness.missing[2]
          const match = part.match(/^([^[]+)\[(\d+)\]$/);
          if (match) {
            const [, arrayName, index] = match;
            current = current[arrayName];
            if (Array.isArray(current)) {
              current = current[parseInt(index)];
            }
          }
        } else {
          current = current[part];
        }
      }

      // Try to extract file information from the resolved data
      if (current && typeof current === 'object') {
        if (current.symbol_id) {
          const filePath = current.symbol_id.split(':')[0];
          return { filePath };
        }
        if (current.filePath || current.path) {
          return { filePath: current.filePath || current.path };
        }
      }
    } catch (error) {
      // Ignore resolution errors
    }

    return null;
  }

  /**
   * Generate HTML for the webview
   */
  private _getHtmlForWebview(webview: vscode.Webview): string {
    const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'out', 'webview', 'main.js'));
    const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'out', 'webview', 'styles.css'));

    // Use a nonce to only allow specific scripts to run
    const nonce = getNonce();

    return `<!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Refactor Intelligence Report</title>
        <link href="${styleUri}" rel="stylesheet">
      </head>
      <body>
        <div id="root"></div>
        <script nonce="${nonce}" src="${scriptUri}"></script>
      </body>
      </html>`;
  }
}

/**
 * Generate a nonce for CSP
 */
function getNonce(): string {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}



/* ---- File: src/webview/RefactorReportView.ts ---- */

import { LlmAnalysis, AnalysisBlock, Claim, Action, EvidenceLink } from '../analysis/llmAnalyst/blocks';
import { RefactorBundleFacts } from '../facts/types';

/**
 * Main refactor report webview with three-panel layout
 */
export class RefactorReportView {
  private analysis: LlmAnalysis;
  private facts: RefactorBundleFacts;
  private onEvidenceClick: (evidence: EvidenceLink) => void;
  private selectedBlock: AnalysisBlock | null = null;
  private selectedEvidence: EvidenceLink | null = null;
  private activeTab: 'analysis' | 'facts' = 'analysis';
  private container: any;

  constructor(
    container: HTMLElement,
    analysis: LlmAnalysis,
    facts: RefactorBundleFacts,
    onEvidenceClick: (evidence: EvidenceLink) => void
  ) {
    this.container = container;
    this.analysis = analysis;
    this.facts = facts;
    this.onEvidenceClick = onEvidenceClick;

    // Auto-select first block
    if (this.analysis.blocks.length > 0) {
      this.selectedBlock = this.analysis.blocks[0];
    }

    this.render();
  }

  /**
   * Render the complete UI
   */
  private render(): void {
    this.container.innerHTML = '';
    this.container.className = 'refactor-report-container';

    // Header
    const header = this.createHeader();
    this.container.appendChild(header);

    // Three-panel layout
    const layout = this.createThreePanelLayout();
    this.container.appendChild(layout);
  }

  /**
   * Create header section
   */
  private createHeader(): HTMLElement {
    const header = document.createElement('div');
    header.className = 'header';

    const title = document.createElement('h1');
    title.textContent = '🤖 Refactor Intelligence Report';
    header.appendChild(title);

    const meta = document.createElement('div');
    meta.className = 'header-meta';

    const span1 = document.createElement('span');
    span1.textContent = `Bundle: ${this.facts.bundle.shas.length} commits`;
    meta.appendChild(span1);

    const span2 = document.createElement('span');
    span2.textContent = `Analysis: ${this.analysis.metadata.model}`;
    meta.appendChild(span2);

    const span3 = document.createElement('span');
    span3.textContent = `Generated: ${new Date(this.analysis.metadata.timestamp).toLocaleString()}`;
    meta.appendChild(span3);
    header.appendChild(meta);

    return header;
  }

  /**
   * Create three-panel layout
   */
  private createThreePanelLayout(): HTMLElement {
    const layout = document.createElement('div');
    layout.className = 'three-panel-layout';

    // Sidebar
    const sidebar = this.createSidebar();
    layout.appendChild(sidebar);

    // Main panel
    const mainPanel = this.createMainPanel();
    layout.appendChild(mainPanel);

    // Inspector panel
    const inspector = this.createInspectorPanel();
    layout.appendChild(inspector);

    return layout;
  }

  /**
   * Create sidebar with navigation
   */
  private createSidebar(): HTMLElement {
    const sidebar = document.createElement('div');
    sidebar.className = 'sidebar';

    // Analysis blocks section
    const blocksSection = document.createElement('div');
    blocksSection.className = 'sidebar-section';

    const blocksTitle = document.createElement('h3');
    blocksTitle.textContent = '📊 Analysis Blocks';
    blocksSection.appendChild(blocksTitle);

    const blockList = document.createElement('div');
    blockList.className = 'block-list';

    this.analysis.blocks.forEach((block, index) => {
      const blockItem = document.createElement('div');
      blockItem.className = `block-item ${this.selectedBlock?.id === block.id ? 'active' : ''}`;
      blockItem.onclick = () => {
        this.selectedBlock = block;
        this.render();
      };

      const icon = document.createElement('div');
      icon.className = 'block-icon';
      icon.textContent = this.getBlockIcon(block.type);
      blockItem.appendChild(icon);

      const info = document.createElement('div');
      info.className = 'block-info';

      const title = document.createElement('div');
      title.className = 'block-title';
      title.textContent = block.title;
      info.appendChild(title);

      const stats = document.createElement('div');
      stats.className = 'block-stats';
      stats.textContent = `${block.claims.length} claims, ${block.actions.length} actions`;
      info.appendChild(stats);

      blockItem.appendChild(info);
      blockList.appendChild(blockItem);
    });

    blocksSection.appendChild(blockList);
    sidebar.appendChild(blocksSection);

    // Quick stats section
    const statsSection = document.createElement('div');
    statsSection.className = 'sidebar-section';

    const statsTitle = document.createElement('h3');
    statsTitle.textContent = '📈 Quick Stats';
    statsSection.appendChild(statsTitle);

    const statsGrid = document.createElement('div');
    statsGrid.className = 'stats-grid';

    // Missing stat
    const missingItem = document.createElement('div');
    missingItem.className = 'stat-item';
    const missingLabel = document.createElement('span');
    missingLabel.className = 'stat-label';
    missingLabel.textContent = 'Missing';
    missingItem.appendChild(missingLabel);
    const missingValue = document.createElement('span');
    missingValue.className = 'stat-value';
    missingValue.textContent = this.facts.findings.incompleteness.missing.toString();
    missingItem.appendChild(missingValue);
    statsGrid.appendChild(missingItem);

    // Zombies stat
    const zombiesItem = document.createElement('div');
    zombiesItem.className = 'stat-item';
    const zombiesLabel = document.createElement('span');
    zombiesLabel.className = 'stat-label';
    zombiesLabel.textContent = 'Zombies';
    zombiesItem.appendChild(zombiesLabel);
    const zombiesValue = document.createElement('span');
    zombiesValue.className = 'stat-value';
    zombiesValue.textContent = this.facts.findings.incompleteness.zombies.toString();
    zombiesItem.appendChild(zombiesValue);
    statsGrid.appendChild(zombiesItem);

    // Dead Code stat
    const deadItem = document.createElement('div');
    deadItem.className = 'stat-item';
    const deadLabel = document.createElement('span');
    deadLabel.className = 'stat-label';
    deadLabel.textContent = 'Dead Code';
    deadItem.appendChild(deadLabel);
    const deadValue = document.createElement('span');
    deadValue.className = 'stat-value';
    deadValue.textContent = this.facts.findings.legacyAudit.dead.toString();
    deadItem.appendChild(deadValue);
    statsGrid.appendChild(deadItem);

    // Replaced stat
    const replacedItem = document.createElement('div');
    replacedItem.className = 'stat-item';
    const replacedLabel = document.createElement('span');
    replacedLabel.className = 'stat-label';
    replacedLabel.textContent = 'Replaced';
    replacedItem.appendChild(replacedLabel);
    const replacedValue = document.createElement('span');
    replacedValue.className = 'stat-value';
    replacedValue.textContent = this.facts.findings.legacyAudit.replacedLeftovers.length.toString();
    replacedItem.appendChild(replacedValue);
    statsGrid.appendChild(replacedItem);
    statsSection.appendChild(statsGrid);
    sidebar.appendChild(statsSection);

    // Evidence browser section
    if (this.selectedBlock) {
      const evidenceSection = document.createElement('div');
      evidenceSection.className = 'sidebar-section';

      const evidenceTitle = document.createElement('h3');
      evidenceTitle.textContent = '🔍 Evidence Browser';
      evidenceSection.appendChild(evidenceTitle);

      const evidenceList = document.createElement('div');
      evidenceList.className = 'evidence-list';

      // Claims evidence
      this.selectedBlock.claims.forEach((claim, index) => {
        const group = document.createElement('div');
        group.className = 'evidence-group';

        const title = document.createElement('div');
        title.className = 'evidence-title';
        title.textContent = `Claim ${index + 1}`;
        group.appendChild(title);

        claim.evidence.forEach((evidence, evIndex) => {
          const item = document.createElement('div');
          item.className = `evidence-item ${this.selectedEvidence === evidence ? 'active' : ''}`;
          item.textContent = evidence.description;
          item.onclick = () => {
            this.selectedEvidence = evidence;
            this.onEvidenceClick(evidence);
            this.render();
          };
          group.appendChild(item);
        });

        evidenceList.appendChild(group);
      });

      // Actions evidence
      this.selectedBlock.actions.forEach((action, index) => {
        const group = document.createElement('div');
        group.className = 'evidence-group';

        const title = document.createElement('div');
        title.className = 'evidence-title';
        title.textContent = `Action ${index + 1}`;
        group.appendChild(title);

        action.evidence.forEach((evidence, evIndex) => {
          const item = document.createElement('div');
          item.className = `evidence-item ${this.selectedEvidence === evidence ? 'active' : ''}`;
          item.textContent = evidence.description;
          item.onclick = () => {
            this.selectedEvidence = evidence;
            this.onEvidenceClick(evidence);
            this.render();
          };
          group.appendChild(item);
        });

        evidenceList.appendChild(group);
      });

      evidenceSection.appendChild(evidenceList);
      sidebar.appendChild(evidenceSection);
    }

    return sidebar;
  }

  /**
   * Create main panel with content
   */
  private createMainPanel(): HTMLElement {
    const mainPanel = document.createElement('div');
    mainPanel.className = 'main-panel';

    // Tab bar
    const tabBar = document.createElement('div');
    tabBar.className = 'tab-bar';

    const analysisTab = document.createElement('button');
    analysisTab.className = `tab ${this.activeTab === 'analysis' ? 'active' : ''}`;
    analysisTab.textContent = '🤖 LLM Analysis';
    analysisTab.onclick = () => {
      this.activeTab = 'analysis';
      this.render();
    };
    tabBar.appendChild(analysisTab);

    const factsTab = document.createElement('button');
    factsTab.className = `tab ${this.activeTab === 'facts' ? 'active' : ''}`;
    factsTab.textContent = '📊 Raw Facts';
    factsTab.onclick = () => {
      this.activeTab = 'facts';
      this.render();
    };
    tabBar.appendChild(factsTab);

    mainPanel.appendChild(tabBar);

    // Content area
    const contentArea = document.createElement('div');
    contentArea.className = 'content-area';

    if (this.activeTab === 'analysis') {
      contentArea.appendChild(this.createAnalysisContent());
    } else {
      contentArea.appendChild(this.createFactsContent());
    }

    mainPanel.appendChild(contentArea);

    return mainPanel;
  }

  /**
   * Create analysis content
   */
  private createAnalysisContent(): HTMLElement {
    const content = document.createElement('div');
    content.className = 'analysis-content';

    if (!this.selectedBlock) {
      const empty = document.createElement('div');
      empty.className = 'empty-state';

      const emptyH2 = document.createElement('h2');
      emptyH2.textContent = 'Select an analysis block from the sidebar';
      empty.appendChild(emptyH2);

      const emptyP = document.createElement('p');
      emptyP.textContent = 'Choose an analysis block to view detailed findings and recommendations.';
      empty.appendChild(emptyP);
      content.appendChild(empty);
      return content;
    }

    // Block header
    const header = document.createElement('div');
    header.className = 'block-header';

    const title = document.createElement('h2');
    title.textContent = `${this.getBlockIcon(this.selectedBlock.type)} ${this.selectedBlock.title}`;
    header.appendChild(title);

    const meta = document.createElement('div');
    meta.className = 'block-meta';

    const confidenceSpan = document.createElement('span');
    confidenceSpan.textContent = `Confidence: ${(this.selectedBlock.confidence * 100).toFixed(0)}%`;
    meta.appendChild(confidenceSpan);

    const generatedSpan = document.createElement('span');
    generatedSpan.textContent = `Generated: ${new Date(this.selectedBlock.timestamp).toLocaleString()}`;
    meta.appendChild(generatedSpan);
    header.appendChild(meta);

    content.appendChild(header);

    // Claims section
    if (this.selectedBlock.claims.length > 0) {
      const claimsSection = document.createElement('div');
      claimsSection.className = 'claims-section';

      const claimsTitle = document.createElement('h3');
      claimsTitle.textContent = '🔍 Findings';
      claimsSection.appendChild(claimsTitle);

      this.selectedBlock.claims.forEach((claim, index) => {
        const claimItem = document.createElement('div');
        claimItem.className = `claim-item severity-${claim.severity}`;

        const header = document.createElement('div');
        header.className = 'claim-header';

        const icon = document.createElement('span');
        icon.className = 'severity-icon';
        icon.textContent = this.getSeverityIcon(claim.severity);
        header.appendChild(icon);

        const text = document.createElement('span');
        text.className = 'claim-text';
        text.textContent = claim.text;
        header.appendChild(text);

        const confidence = document.createElement('span');
        confidence.className = 'confidence';
        confidence.textContent = `(${(claim.confidence * 100).toFixed(0)}%)`;
        header.appendChild(confidence);

        claimItem.appendChild(header);

        // Evidence
        const evidenceDiv = document.createElement('div');
        evidenceDiv.className = 'claim-evidence';
        claim.evidence.forEach((evidence) => {
          const link = document.createElement('button');
          link.className = 'evidence-link';
          link.textContent = evidence.description;
          link.onclick = () => this.onEvidenceClick(evidence);
          evidenceDiv.appendChild(link);
        });
        claimItem.appendChild(evidenceDiv);

        claimsSection.appendChild(claimItem);
      });

      content.appendChild(claimsSection);
    }

    // Actions section
    if (this.selectedBlock.actions.length > 0) {
      const actionsSection = document.createElement('div');
      actionsSection.className = 'actions-section';

      const actionsTitle = document.createElement('h3');
      actionsTitle.textContent = '🛠️ Recommended Actions';
      actionsSection.appendChild(actionsTitle);

      this.selectedBlock.actions.forEach((action, index) => {
        const actionItem = document.createElement('div');
        actionItem.className = 'action-item';

        const header = document.createElement('div');
        header.className = 'action-header';

        const icon = document.createElement('span');
        icon.className = 'priority-icon';
        icon.textContent = this.getPriorityIcon(action.priority);
        header.appendChild(icon);

        const text = document.createElement('span');
        text.className = 'action-text';
        text.textContent = action.description;
        header.appendChild(text);

        const meta = document.createElement('div');
        meta.className = 'action-meta';

        const effortSpan = document.createElement('span');
        effortSpan.className = 'effort';
        effortSpan.textContent = `[${action.effort.toUpperCase()}]`;
        meta.appendChild(effortSpan);

        const riskSpan = document.createElement('span');
        riskSpan.className = 'risk';
        riskSpan.textContent = `Risk: ${action.risk}`;
        meta.appendChild(riskSpan);
        header.appendChild(meta);

        actionItem.appendChild(header);

        if (action.dependsOn && action.dependsOn.length > 0) {
          const deps = document.createElement('div');
          deps.className = 'action-dependencies';
          const strong = document.createElement('strong');
          strong.textContent = 'Depends on: ';
          deps.appendChild(strong);
          deps.appendChild(document.createTextNode(action.dependsOn.join(', ')));
          actionItem.appendChild(deps);
        }

        // Evidence
        const evidenceDiv = document.createElement('div');
        evidenceDiv.className = 'action-evidence';
        action.evidence.forEach((evidence) => {
          const link = document.createElement('button');
          link.className = 'evidence-link';
          link.textContent = evidence.description;
          link.onclick = () => this.onEvidenceClick(evidence);
          evidenceDiv.appendChild(link);
        });
        actionItem.appendChild(evidenceDiv);

        actionsSection.appendChild(actionItem);
      });

      content.appendChild(actionsSection);
    }

    return content;
  }

  /**
   * Create facts content
   */
  private createFactsContent(): HTMLElement {
    const content = document.createElement('div');
    content.className = 'facts-content';

    // Summary
    const summary = document.createElement('div');
    summary.className = 'facts-summary';

    const title = document.createElement('h2');
    title.textContent = '📊 Raw Facts Summary';
    summary.appendChild(title);

    const grid = document.createElement('div');
    grid.className = 'facts-grid';

    // Bundle Info Card
    const bundleCard = document.createElement('div');
    bundleCard.className = 'fact-card';
    const bundleTitle = document.createElement('h4');
    bundleTitle.textContent = 'Bundle Info';
    bundleCard.appendChild(bundleTitle);
    const bundleP1 = document.createElement('p');
    bundleP1.innerHTML = `<strong>Commits:</strong> ${this.facts.bundle.shas.length}`;
    bundleCard.appendChild(bundleP1);
    const bundleP2 = document.createElement('p');
    bundleP2.innerHTML = `<strong>Oldest:</strong> ${this.facts.bundle.oldestSha.substring(0, 8)}`;
    bundleCard.appendChild(bundleP2);
    grid.appendChild(bundleCard);

    // Analysis Scope Card
    const scopeCard = document.createElement('div');
    scopeCard.className = 'fact-card';
    const scopeTitle = document.createElement('h4');
    scopeTitle.textContent = 'Analysis Scope';
    scopeCard.appendChild(scopeTitle);
    const scopeP1 = document.createElement('p');
    scopeP1.innerHTML = `<strong>Files:</strong> ${this.facts.scope.files}`;
    scopeCard.appendChild(scopeP1);
    const scopeP2 = document.createElement('p');
    scopeP2.innerHTML = `<strong>Blast Radius:</strong> ${this.facts.scope.blastRadius}`;
    scopeCard.appendChild(scopeP2);
    grid.appendChild(scopeCard);

    // Symbols Card
    const symbolsCard = document.createElement('div');
    symbolsCard.className = 'fact-card';
    const symbolsTitle = document.createElement('h4');
    symbolsTitle.textContent = 'Symbols';
    symbolsCard.appendChild(symbolsTitle);
    const symbolsP1 = document.createElement('p');
    symbolsP1.innerHTML = `<strong>Intended:</strong> ${this.facts.intended.present + this.facts.intended.absent}`;
    symbolsCard.appendChild(symbolsP1);
    const symbolsP2 = document.createElement('p');
    symbolsP2.innerHTML = `<strong>Working:</strong> ${this.facts.working.symbols}`;
    symbolsCard.appendChild(symbolsP2);
    const symbolsP3 = document.createElement('p');
    symbolsP3.innerHTML = `<strong>Edges:</strong> ${this.facts.working.edges}`;
    symbolsCard.appendChild(symbolsP3);
    grid.appendChild(symbolsCard);
    summary.appendChild(grid);
    content.appendChild(summary);

    // JSON view
    const jsonSection = document.createElement('div');
    jsonSection.className = 'facts-json';

    const jsonTitle = document.createElement('h3');
    jsonTitle.textContent = '🔧 Full Facts JSON';
    jsonSection.appendChild(jsonTitle);

    const pre = document.createElement('pre');
    pre.textContent = JSON.stringify(this.facts, null, 2);
    jsonSection.appendChild(pre);

    content.appendChild(jsonSection);

    return content;
  }

  /**
   * Create inspector panel
   */
  private createInspectorPanel(): HTMLElement {
    const inspector = document.createElement('div');
    inspector.className = 'inspector-panel';

    const header = document.createElement('div');
    header.className = 'inspector-header';

    const title = document.createElement('h3');
    title.textContent = '🔍 JSON Inspector';
    header.appendChild(title);

    inspector.appendChild(header);

    const content = document.createElement('div');
    content.className = 'inspector-content';

    if (this.selectedEvidence) {
      const details = document.createElement('div');
      details.className = 'evidence-details';

      const detailsTitle = document.createElement('h4');
      detailsTitle.textContent = 'Evidence Details';
      details.appendChild(detailsTitle);

      const jsonDiv = document.createElement('div');
      jsonDiv.className = 'evidence-json';
      const jsonPre = document.createElement('pre');
      jsonPre.textContent = JSON.stringify(this.selectedEvidence, null, 2);
      jsonDiv.appendChild(jsonPre);
      details.appendChild(jsonDiv);

      const actions = document.createElement('div');
      actions.className = 'evidence-actions';
      const button = document.createElement('button');
      button.textContent = '📂 Open in Editor';
      button.onclick = () => this.onEvidenceClick(this.selectedEvidence!);
      actions.appendChild(button);
      details.appendChild(actions);

      content.appendChild(details);
    } else {
      const empty = document.createElement('div');
      empty.className = 'no-selection';
      const p = document.createElement('p');
      p.textContent = 'Click on evidence in the sidebar to inspect JSON details';
      empty.appendChild(p);
      content.appendChild(empty);
    }

    inspector.appendChild(content);

    return inspector;
  }

  /**
   * Helper functions
   */
  private getBlockIcon(type: AnalysisBlock['type']): string {
    switch (type) {
      case 'intent': return '🎯';
      case 'drift': return '🔍';
      case 'cleanup': return '🧹';
      case 'summary': return '📊';
      default: return '📝';
    }
  }

  private getSeverityIcon(severity: string): string {
    switch (severity) {
      case 'critical': return '🚨';
      case 'high': return '🔴';
      case 'medium': return '🟡';
      case 'low': return '🟢';
      default: return '⚪';
    }
  }

  private getPriorityIcon(priority: string): string {
    switch (priority) {
      case 'urgent': return '🚨';
      case 'high': return '🔴';
      case 'medium': return '🟡';
      case 'low': return '🟢';
      default: return '⚪';
    }
  }
}



/* ---- File: src/webview/RefactorReportView.tsx ---- */

import React, { useState, useEffect } from 'react';
import { LlmAnalysis, AnalysisBlock, Claim, Action, EvidenceLink } from '../analysis/llmAnalyst/blocks';
import { RefactorBundleFacts } from '../facts/types';
import { formatStats } from '../utils/statsFormatter';

/**
 * Props for the RefactorReportView component
 */
interface RefactorReportViewProps {
  analysis: LlmAnalysis;
  facts: RefactorBundleFacts;
  onEvidenceClick: (evidence: EvidenceLink) => void;
}

/**
 * Main refactor report webview component with three-panel layout
 */
export const RefactorReportView: React.FC<RefactorReportViewProps> = ({ analysis, facts, onEvidenceClick }) => {
  const [selectedBlock, setSelectedBlock] = useState<AnalysisBlock | null>(null);
  const [selectedEvidence, setSelectedEvidence] = useState<EvidenceLink | null>(null);
  const [activeTab, setActiveTab] = useState<'analysis' | 'facts'>('analysis');

  // Auto-select first block on load
  useEffect(() => {
    if (analysis.blocks.length > 0 && !selectedBlock) {
      setSelectedBlock(analysis.blocks[0]);
    }
  }, [analysis.blocks, selectedBlock]);

  return (
    <div className="refactor-report-container">
      {/* Header */}
      <div className="header">
        <h1>🤖 Refactor Intelligence Report</h1>
        <div className="header-meta">
          <span>Bundle: {facts.bundle.shas.length} commits</span>
          <span>Analysis: {analysis.metadata.model}</span>
          <span>Generated: {new Date(analysis.metadata.timestamp).toLocaleString()}</span>
        </div>
      </div>

      {/* Three-Panel Layout */}
      <div className="three-panel-layout">
        {/* Left Sidebar - Navigation */}
        <div className="sidebar">
          <div className="sidebar-section">
            <h3>📊 Analysis Blocks</h3>
            <div className="block-list">
              {analysis.blocks.map((block, index) => (
                <div
                  key={block.id}
                  className={`block-item ${selectedBlock?.id === block.id ? 'active' : ''}`}
                  onClick={() => setSelectedBlock(block)}
                >
                  <div className="block-icon">{getBlockIcon(block.type)}</div>
                  <div className="block-info">
                    <div className="block-title">{block.title}</div>
                    <div className="block-stats">
                      {block.claims.length} claims, {block.actions.length} actions
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="sidebar-section">
            <h3>📈 Quick Stats</h3>
            <div className="stats-grid">
              {(() => {
                const stats = formatStats(facts);
                return (
                  <>
                    <div className="stat-item">
                      <span className="stat-label">Missing</span>
                      <span className="stat-value">{stats.missing}</span>
                    </div>
                    <div className="stat-item">
                      <span className="stat-label">Zombies</span>
                      <span className="stat-value">{stats.zombies}</span>
                    </div>
                    <div className="stat-item">
                      <span className="stat-label">Dead Code</span>
                      <span className="stat-value">{stats.dead}</span>
                    </div>
                    <div className="stat-item">
                      <span className="stat-label">Replaced</span>
                      <span className="stat-value">{stats.replaced}</span>
                    </div>
                  </>
                );
              })()}
            </div>
          </div>

          <div className="sidebar-section">
            <h3>🔍 Evidence Browser</h3>
            <div className="evidence-list">
              {selectedBlock && (
                <>
                  {selectedBlock.claims.map((claim, index) => (
                    <div key={`claim-${index}`} className="evidence-group">
                      <div className="evidence-title">Claim {index + 1}</div>
                      {claim.evidence.map((evidence, evIndex) => (
                        <div
                          key={`claim-ev-${evIndex}`}
                          className={`evidence-item ${selectedEvidence === evidence ? 'active' : ''}`}
                          onClick={() => {
                            setSelectedEvidence(evidence);
                            onEvidenceClick(evidence);
                          }}
                        >
                          {evidence.description}
                        </div>
                      ))}
                    </div>
                  ))}
                  {selectedBlock.actions.map((action, index) => (
                    <div key={`action-${index}`} className="evidence-group">
                      <div className="evidence-title">Action {index + 1}</div>
                      {action.evidence.map((evidence, evIndex) => (
                        <div
                          key={`action-ev-${evIndex}`}
                          className={`evidence-item ${selectedEvidence === evidence ? 'active' : ''}`}
                          onClick={() => {
                            setSelectedEvidence(evidence);
                            onEvidenceClick(evidence);
                          }}
                        >
                          {evidence.description}
                        </div>
                      ))}
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>
        </div>

        {/* Main Panel - Content */}
        <div className="main-panel">
          <div className="tab-bar">
            <button
              className={`tab ${activeTab === 'analysis' ? 'active' : ''}`}
              onClick={() => setActiveTab('analysis')}
            >
              🤖 LLM Analysis
            </button>
            <button
              className={`tab ${activeTab === 'facts' ? 'active' : ''}`}
              onClick={() => setActiveTab('facts')}
            >
              📊 Raw Facts
            </button>
          </div>

          <div className="content-area">
            {activeTab === 'analysis' ? (
              <AnalysisContent
                block={selectedBlock}
                onEvidenceClick={onEvidenceClick}
              />
            ) : (
              <FactsContent
                facts={facts}
                onEvidenceClick={onEvidenceClick}
              />
            )}
          </div>
        </div>

        {/* Right Panel - JSON Inspector */}
        <div className="inspector-panel">
          <div className="inspector-header">
            <h3>🔍 JSON Inspector</h3>
          </div>

          <div className="inspector-content">
            {selectedEvidence ? (
              <div className="evidence-details">
                <h4>Evidence Details</h4>
                <div className="evidence-json">
                  <pre>{JSON.stringify(selectedEvidence, null, 2)}</pre>
                </div>
                <div className="evidence-actions">
                  <button onClick={() => onEvidenceClick(selectedEvidence)}>
                    📂 Open in Editor
                  </button>
                </div>
              </div>
            ) : (
              <div className="no-selection">
                <p>Click on evidence in the sidebar to inspect JSON details</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * Analysis content component
 */
const AnalysisContent: React.FC<{
  block: AnalysisBlock | null;
  onEvidenceClick: (evidence: EvidenceLink) => void;
}> = ({ block, onEvidenceClick }) => {
  if (!block) {
    return (
      <div className="empty-state">
        <h2>Select an analysis block from the sidebar</h2>
        <p>Choose an analysis block to view detailed findings and recommendations.</p>
      </div>
    );
  }

  return (
    <div className="analysis-content">
      <div className="block-header">
        <h2>{getBlockIcon(block.type)} {block.title}</h2>
        <div className="block-meta">
          <span>Confidence: {(block.confidence * 100).toFixed(0)}%</span>
          <span>Generated: {new Date(block.timestamp).toLocaleString()}</span>
        </div>
      </div>

      {block.claims.length > 0 && (
        <div className="claims-section">
          <h3>🔍 Findings</h3>
          {block.claims.map((claim, index) => (
            <div key={index} className={`claim-item severity-${claim.severity}`}>
              <div className="claim-header">
                <span className="severity-icon">{getSeverityIcon(claim.severity)}</span>
                <span className="claim-text">{claim.text}</span>
                <span className="confidence">({(claim.confidence * 100).toFixed(0)}%)</span>
              </div>
              <div className="claim-evidence">
                {claim.evidence.map((evidence, evIndex) => (
                  <button
                    key={evIndex}
                    className="evidence-link"
                    onClick={() => onEvidenceClick(evidence)}
                  >
                    {evidence.description}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {block.actions.length > 0 && (
        <div className="actions-section">
          <h3>🛠️ Recommended Actions</h3>
          {block.actions.map((action, index) => (
            <div key={index} className="action-item">
              <div className="action-header">
                <span className="priority-icon">{getPriorityIcon(action.priority)}</span>
                <span className="action-text">{action.description}</span>
                <div className="action-meta">
                  <span className="effort">[{action.effort.toUpperCase()}]</span>
                  <span className="risk">Risk: {action.risk}</span>
                </div>
              </div>
              {action.dependsOn && action.dependsOn.length > 0 && (
                <div className="action-dependencies">
                  <strong>Depends on:</strong> {action.dependsOn.join(', ')}
                </div>
              )}
              <div className="action-evidence">
                {action.evidence.map((evidence, evIndex) => (
                  <button
                    key={evIndex}
                    className="evidence-link"
                    onClick={() => onEvidenceClick(evidence)}
                  >
                    {evidence.description}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

/**
 * Facts content component
 */
const FactsContent: React.FC<{
  facts: RefactorBundleFacts;
  onEvidenceClick: (evidence: EvidenceLink) => void;
}> = ({ facts, onEvidenceClick }) => {
  return (
    <div className="facts-content">
      <div className="facts-summary">
        <h2>📊 Raw Facts Summary</h2>
        <div className="facts-grid">
          <div className="fact-card">
            <h4>Bundle Info</h4>
            <p><strong>Commits:</strong> {facts.bundle.shas.length}</p>
            <p><strong>Oldest:</strong> {facts.bundle.oldestSha.substring(0, 8)}</p>
          </div>
          <div className="fact-card">
            <h4>Analysis Scope</h4>
            <p><strong>Files:</strong> {facts.scope.files}</p>
            <p><strong>Blast Radius:</strong> {facts.scope.blastRadius}</p>
          </div>
          <div className="fact-card">
            <h4>Symbols</h4>
            <p><strong>Intended:</strong> {facts.intended.present + facts.intended.absent}</p>
            <p><strong>Working:</strong> {facts.working.symbols}</p>
            <p><strong>Edges:</strong> {facts.working.edges}</p>
          </div>
        </div>
      </div>

      <div className="facts-json">
        <h3>🔧 Full Facts JSON</h3>
        <pre>{JSON.stringify(facts, null, 2)}</pre>
      </div>
    </div>
  );
};

/**
 * Helper functions for icons and styling
 */
function getBlockIcon(type: AnalysisBlock['type']): string {
  switch (type) {
    case 'intent': return '🎯';
    case 'drift': return '🔍';
    case 'cleanup': return '🧹';
    case 'summary': return '📊';
    default: return '📝';
  }
}

function getSeverityIcon(severity: string): string {
  switch (severity) {
    case 'critical': return '🚨';
    case 'high': return '🔴';
    case 'medium': return '🟡';
    case 'low': return '🟢';
    default: return '⚪';
  }
}

function getPriorityIcon(priority: string): string {
  switch (priority) {
    case 'urgent': return '🚨';
    case 'high': return '🔴';
    case 'medium': return '🟡';
    case 'low': return '🟢';
    default: return '⚪';
  }
}



/* ---- File: src/webview/styles.css ---- */

/* Refactor Report Webview Styles */

.refactor-report-container {
  height: 100vh;
  display: flex;
  flex-direction: column;
  font-family: var(--vscode-font-family);
  font-size: var(--vscode-font-size);
  background-color: var(--vscode-editor-background);
  color: var(--vscode-editor-foreground);
}

/* Header */
.header {
  padding: 16px 24px;
  border-bottom: 1px solid var(--vscode-panel-border);
  background-color: var(--vscode-editorWidget-background);
}

.header h1 {
  margin: 0 0 8px 0;
  font-size: 1.5em;
  font-weight: 600;
}

.header-meta {
  display: flex;
  gap: 16px;
  font-size: 0.9em;
  color: var(--vscode-descriptionForeground);
}

.header-meta span:not(:last-child)::after {
  content: '•';
  margin-left: 16px;
}

/* Three-Panel Layout */
.three-panel-layout {
  flex: 1;
  display: flex;
  overflow: hidden;
}

/* Sidebar */
.sidebar {
  width: 300px;
  border-right: 1px solid var(--vscode-panel-border);
  background-color: var(--vscode-sideBar-background);
  display: flex;
  flex-direction: column;
  overflow-y: auto;
}

.sidebar-section {
  padding: 16px;
  border-bottom: 1px solid var(--vscode-panel-border);
}

.sidebar-section h3 {
  margin: 0 0 12px 0;
  font-size: 1.1em;
  font-weight: 600;
  color: var(--vscode-sideBarTitle-foreground);
}

.block-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.block-item {
  display: flex;
  align-items: center;
  padding: 12px;
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.2s;
}

.block-item:hover {
  background-color: var(--vscode-list-hoverBackground);
}

.block-item.active {
  background-color: var(--vscode-list-activeSelectionBackground);
  color: var(--vscode-list-activeSelectionForeground);
}

.block-icon {
  font-size: 1.2em;
  margin-right: 12px;
  width: 24px;
  text-align: center;
}

.block-info {
  flex: 1;
}

.block-title {
  font-weight: 500;
  margin-bottom: 4px;
}

.block-stats {
  font-size: 0.8em;
  color: var(--vscode-descriptionForeground);
}

/* Stats Grid */
.stats-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.stat-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  background-color: var(--vscode-editorWidget-background);
  border-radius: 4px;
  border: 1px solid var(--vscode-panel-border);
}

.stat-label {
  font-weight: 500;
}

.stat-value {
  font-weight: 600;
  color: var(--vscode-charts-orange);
}

/* Evidence Browser */
.evidence-list {
  max-height: 400px;
  overflow-y: auto;
}

.evidence-group {
  margin-bottom: 12px;
}

.evidence-title {
  font-weight: 500;
  font-size: 0.9em;
  color: var(--vscode-descriptionForeground);
  margin-bottom: 4px;
}

.evidence-item {
  padding: 6px 8px;
  margin: 2px 0;
  border-radius: 3px;
  cursor: pointer;
  font-size: 0.85em;
  border-left: 3px solid transparent;
  transition: all 0.2s;
}

.evidence-item:hover {
  background-color: var(--vscode-list-hoverBackground);
  border-left-color: var(--vscode-focusBorder);
}

.evidence-item.active {
  background-color: var(--vscode-list-activeSelectionBackground);
  color: var(--vscode-list-activeSelectionForeground);
  border-left-color: var(--vscode-focusBorder);
}

/* Main Panel */
.main-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  background-color: var(--vscode-editor-background);
}

/* Tab Bar */
.tab-bar {
  display: flex;
  border-bottom: 1px solid var(--vscode-panel-border);
  background-color: var(--vscode-editorWidget-background);
}

.tab {
  padding: 12px 24px;
  border: none;
  background: none;
  cursor: pointer;
  font-size: 0.9em;
  font-weight: 500;
  color: var(--vscode-tab-inactiveForeground);
  border-bottom: 2px solid transparent;
  transition: all 0.2s;
}

.tab:hover {
  color: var(--vscode-tab-activeForeground);
}

.tab.active {
  color: var(--vscode-tab-activeForeground);
  border-bottom-color: var(--vscode-focusBorder);
}

/* Content Area */
.content-area {
  flex: 1;
  padding: 24px;
  overflow-y: auto;
}

/* Empty State */
.empty-state {
  text-align: center;
  padding: 48px;
  color: var(--vscode-descriptionForeground);
}

.empty-state h2 {
  margin: 0 0 16px 0;
  color: var(--vscode-foreground);
}

/* Analysis Content */
.analysis-content {
  max-width: 800px;
}

.block-header {
  margin-bottom: 32px;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--vscode-panel-border);
}

.block-header h2 {
  margin: 0 0 8px 0;
  font-size: 1.4em;
}

.block-meta {
  display: flex;
  gap: 16px;
  font-size: 0.9em;
  color: var(--vscode-descriptionForeground);
}

.claims-section,
.actions-section {
  margin-bottom: 32px;
}

.claims-section h3,
.actions-section h3 {
  margin: 0 0 16px 0;
  font-size: 1.1em;
  color: var(--vscode-foreground);
}

.claim-item,
.action-item {
  margin-bottom: 16px;
  padding: 16px;
  border-radius: 6px;
  border: 1px solid var(--vscode-panel-border);
  background-color: var(--vscode-editorWidget-background);
}

.claim-item.severity-critical {
  border-left: 4px solid var(--vscode-errorForeground);
}

.claim-item.severity-high {
  border-left: 4px solid var(--vscode-charts-red);
}

.claim-item.severity-medium {
  border-left: 4px solid var(--vscode-charts-orange);
}

.claim-item.severity-low {
  border-left: 4px solid var(--vscode-charts-green);
}

.claim-header {
  display: flex;
  align-items: center;
  margin-bottom: 8px;
}

.severity-icon {
  font-size: 1.2em;
  margin-right: 12px;
}

.claim-text {
  flex: 1;
  font-weight: 500;
}

.confidence {
  font-size: 0.9em;
  color: var(--vscode-descriptionForeground);
  margin-left: 12px;
}

.claim-evidence,
.action-evidence {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.evidence-link {
  padding: 4px 8px;
  border-radius: 3px;
  border: 1px solid var(--vscode-panel-border);
  background-color: var(--vscode-button-secondaryBackground);
  color: var(--vscode-button-secondaryForeground);
  cursor: pointer;
  font-size: 0.8em;
  transition: all 0.2s;
}

.evidence-link:hover {
  background-color: var(--vscode-button-secondaryHoverBackground);
}

.action-header {
  margin-bottom: 8px;
}

.action-header .priority-icon {
  font-size: 1.1em;
  margin-right: 8px;
}

.action-text {
  font-weight: 500;
}

.action-meta {
  display: flex;
  gap: 12px;
  font-size: 0.9em;
  color: var(--vscode-descriptionForeground);
  margin-top: 4px;
}

.action-dependencies {
  font-size: 0.9em;
  color: var(--vscode-descriptionForeground);
  margin-bottom: 8px;
}

/* Facts Content */
.facts-content {
  max-width: 1000px;
}

.facts-summary {
  margin-bottom: 32px;
}

.facts-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
  margin-bottom: 32px;
}

.fact-card {
  padding: 16px;
  border: 1px solid var(--vscode-panel-border);
  border-radius: 6px;
  background-color: var(--vscode-editorWidget-background);
}

.fact-card h4 {
  margin: 0 0 12px 0;
  font-size: 1em;
  color: var(--vscode-foreground);
}

.fact-card p {
  margin: 6px 0;
  font-size: 0.9em;
}

.facts-json pre {
  background-color: var(--vscode-textBlockQuote-background);
  border: 1px solid var(--vscode-textBlockQuote-border);
  border-radius: 4px;
  padding: 16px;
  font-size: 0.8em;
  overflow-x: auto;
  max-height: 600px;
  overflow-y: auto;
}

/* Inspector Panel */
.inspector-panel {
  width: 350px;
  border-left: 1px solid var(--vscode-panel-border);
  background-color: var(--vscode-sideBar-background);
  display: flex;
  flex-direction: column;
}

.inspector-header {
  padding: 16px;
  border-bottom: 1px solid var(--vscode-panel-border);
  background-color: var(--vscode-editorWidget-background);
}

.inspector-header h3 {
  margin: 0;
  font-size: 1.1em;
  color: var(--vscode-sideBarTitle-foreground);
}

.inspector-content {
  flex: 1;
  padding: 16px;
  overflow-y: auto;
}

.evidence-details h4 {
  margin: 0 0 12px 0;
  color: var(--vscode-foreground);
}

.evidence-json pre {
  background-color: var(--vscode-textBlockQuote-background);
  border: 1px solid var(--vscode-textBlockQuote-border);
  border-radius: 4px;
  padding: 12px;
  font-size: 0.75em;
  overflow-x: auto;
  margin: 12px 0;
}

.evidence-actions {
  margin-top: 16px;
}

.evidence-actions button {
  padding: 8px 16px;
  border: 1px solid var(--vscode-button-border);
  border-radius: 3px;
  background-color: var(--vscode-button-background);
  color: var(--vscode-button-foreground);
  cursor: pointer;
  font-size: 0.9em;
  transition: all 0.2s;
}

.evidence-actions button:hover {
  background-color: var(--vscode-button-hoverBackground);
}

.no-selection {
  text-align: center;
  color: var(--vscode-descriptionForeground);
  font-style: italic;
  padding: 32px;
}

/* Responsive Design */
@media (max-width: 1200px) {
  .inspector-panel {
    width: 300px;
  }
}

@media (max-width: 1000px) {
  .sidebar {
    width: 250px;
  }
}

@media (max-width: 800px) {
  .three-panel-layout {
    flex-direction: column;
  }

  .sidebar {
    width: 100%;
    height: 200px;
    border-right: none;
    border-bottom: 1px solid var(--vscode-panel-border);
  }

  .inspector-panel {
    width: 100%;
    height: 300px;
    border-left: none;
    border-top: 1px solid var(--vscode-panel-border);
  }
}

/* Scrollbar Styling */
.sidebar::-webkit-scrollbar,
.content-area::-webkit-scrollbar,
.inspector-content::-webkit-scrollbar,
.facts-json pre::-webkit-scrollbar {
  width: 8px;
}

.sidebar::-webkit-scrollbar-track,
.content-area::-webkit-scrollbar-track,
.inspector-content::-webkit-scrollbar-track,
.facts-json pre::-webkit-scrollbar-track {
  background: var(--vscode-scrollbarSlider-background);
}

.sidebar::-webkit-scrollbar-thumb,
.content-area::-webkit-scrollbar-thumb,
.inspector-content::-webkit-scrollbar-thumb,
.facts-json pre::-webkit-scrollbar-thumb {
  background: var(--vscode-scrollbarSlider-hoverBackground);
  border-radius: 4px;
}

.sidebar::-webkit-scrollbar-thumb:hover,
.content-area::-webkit-scrollbar-thumb:hover,
.inspector-content::-webkit-scrollbar-thumb:hover,
.facts-json pre::-webkit-scrollbar-thumb:hover {
  background: var(--vscode-scrollbarSlider-activeBackground);
}


