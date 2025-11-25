import * as React from 'react';
import { createRoot } from 'react-dom/client';
import { CockpitSectionKey, CockpitState, SymbolChangeType } from '../../types/cockpit';
import { Header } from './components/Header';
import { SelectionPanel } from './components/SelectionPanel';
import { BundlePanel } from './components/BundlePanel';
import { Tabs } from './components/Tabs';
import { MetricsRow } from './components/MetricsRow';
import { CommitsTabContent } from './components/CommitsTabContent';
import { BundleTabContent } from './components/BundleTabContent';
import { SymbolsTabContent } from './components/SymbolsTabContent';
import { ReportsTabContent } from './components/ReportsTabContent';
import { LiveTabContent } from './components/LiveTabContent';
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
      }
    };
    window.addEventListener('message', handler);
    vscode.postMessage({ type: 'ready' });
    return () => window.removeEventListener('message', handler);
  }, []);

  const setActiveSection = (section: CockpitSectionKey | 'live') => {
    if (section === 'live') return; // Disabled for now
    setState((prev) => ({ ...prev, activeSection: section }));
    vscode.postMessage({ type: 'setActiveSection', section });
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

  const bundleSummaryText = state.bundleSummary
    ? `${state.bundleSummary.commitCount} commits, ${state.bundleSummary.fileCount} files${state.bundleSummary.symbolCount ? `, ${state.bundleSummary.symbolCount} symbols` : ''}`
    : 'Bundle: none';

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

      <MetricsRow state={state} />

      <Tabs
        active={state.activeSection}
        onChange={setActiveSection}
        counts={{
          commits: state.commits.length,
          bundle: bundleSummaryText,
          symbols: state.symbols.length,
          reports: state.reports.length
        }}
      />

      <div className="cockpit__tab-container">
        {state.activeSection === 'commits' && (
          <CommitsTabContent
            state={state}
            vscode={vscode}
            updateCommitsFilterText={updateCommitsFilterText}
            toggleCommitsScope={toggleCommitsScope}
            formatDate={formatDate}
          />
        )}
        {state.activeSection === 'bundle' && (
          <BundleTabContent
            state={state}
            vscode={vscode}
            formatDate={formatDate}
          />
        )}
        {state.activeSection === 'symbols' && (
          <SymbolsTabContent
            state={state}
            vscode={vscode}
            updateSymbolFilterText={updateSymbolFilterText}
            updateSymbolKind={updateSymbolKind}
            updateSymbolChangeFilter={updateSymbolChangeFilter}
          />
        )}
        {state.activeSection === 'reports' && (
          <ReportsTabContent
            state={state}
            vscode={vscode}
            updateReportsFilterText={updateReportsFilterText}
            updateReportsBranchFilter={updateReportsBranchFilter}
            updateReportsPinned={updateReportsPinned}
          />
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
