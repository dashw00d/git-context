import * as React from 'react';
import { createRoot } from 'react-dom/client';
import { CockpitSectionKey, CockpitState, SymbolChangeType } from '../../types/cockpit';
import { Header } from './components/Header';
import { StatsSection } from './components/StatsSection';
import { Tabs } from './components/Tabs';
import { CommitsTabContent } from './components/CommitsTabContent';
import { BundleTabContent } from './components/BundleTabContent';
import { SymbolsTabContent } from './components/SymbolsTabContent';
import { ReportsTabContent } from './components/ReportsTabContent';
import { LiveTabContent } from './components/LiveTabContent';
import { SuperWebview } from './components/SuperWebview';
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
  bundleView: null,
  symbols: [],
  symbolFilterText: '',
  symbolKindFilter: 'all',
  symbolChangeFilter: 'all',
  activeSymbolId: null,
  activeSymbolHistory: [],
  reports: [],
  reportsFilterText: '',
  reportsBranchFilter: 'all',
  reportsShowPinnedOnly: false,
  liveAnalysis: {
    isTracking: true,
    pendingChanges: 0,
    totalEdits: 0,
    status: 'idle',
    summary: null,
    facts: null
  },
  bundleConfig: {
    mode: 'repo',
    roots: [],
    includeConnected: false,
    exclusions: []
  },
  activeFrame: {
    level: 'bundle',
    id: 'root',
    name: 'Bundle Overview',
    status: 'ready'
  },
  history: [],
  explorerData: []
};

const App: React.FC = () => {
  const [state, setState] = React.useState<CockpitState>(defaultState);

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

  return (
    <div className="cockpit" style={{ padding: 0, margin: 0, height: '100vh', overflow: 'hidden' }}>
      <SuperWebview vscode={vscode} cockpitState={state} />
    </div>
  );
};

const rootEl = document.getElementById('root');
if (rootEl) {
  const root = createRoot(rootEl);
  root.render(<App />);
}
