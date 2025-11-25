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
