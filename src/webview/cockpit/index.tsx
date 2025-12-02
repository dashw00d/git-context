import * as React from 'react';
import { createRoot } from 'react-dom/client';
import {
  CockpitHostMessage,
  CockpitSectionKey,
  CockpitState,
  SymbolChangeType,
} from '../../types/cockpit';
import { CockpitHostMessageSchema } from '../../state/schemas';
import { Header } from './components/Header';
import { StatsSection } from './components/StatsSection';
import { Tabs } from './components/Tabs';
import { CommitsTabContent } from './components/CommitsTabContent';
import { BundleTabContent } from './components/BundleTabContent';
import { SymbolsTabContent } from './components/SymbolsTabContent';
import { ReportsTabContent } from './components/ReportsTabContent';
import { LiveTabContent } from './components/LiveTabContent';
import { SuperWebview } from './components/SuperWebview';
import { ErrorBoundary } from './components/ErrorBoundary';
import { formatDate } from './utils';
import { postMessageWithTracing } from './utils/messageUtils';

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
  bundleViewVersion: 0,
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
    facts: null,
  },
  bundleConfig: {
    mode: 'repo',
    roots: [],
    includeConnected: false,
    exclusions: [],
  },
  activeFrame: {
    level: 'bundle',
    id: 'root',
    name: 'Bundle Overview',
    status: 'ready',
  },
  history: [],
  explorerData: [],
};

const App: React.FC = () => {
  const [state, setState] = React.useState<CockpitState>(defaultState);

  React.useEffect(() => {
    const handler = (event: MessageEvent) => {
      const parsed = CockpitHostMessageSchema.safeParse(event.data);
      if (!parsed.success) {
        console.warn('[Cockpit] Ignoring unknown host message', event.data);
        return;
      }

      const message = parsed.data as CockpitHostMessage;
      if (message.type === 'updateState') {
        setState(prev => ({ ...prev, ...message.payload }));
      } else if (message.type === 'analysisProgress') {
        setState(prev => ({
          ...prev,
          isAnalyzing: message.payload.isAnalyzing,
          analysisStep: message.payload.step,
          analysisProgress: message.payload.progress,
        }));
      } else if (message.type === 'focusSection') {
        setState(prev => ({ ...prev, activeSection: message.payload.section }));
      } else if (message.type === 'updateExplorerTree') {
        setState(prev => ({ ...prev, explorerData: message.payload }));
      } else if (message.type === 'updateBundle') {
        setState(prev => ({
          ...prev,
          bundleView: message.payload.view ?? prev.bundleView,
          bundleSummary: message.payload.summary ?? prev.bundleSummary,
          bundleFacts: message.payload.facts ?? prev.bundleFacts,
        }));
      }
    };
    window.addEventListener('message', handler);
    postMessageWithTracing(vscode, { type: 'ready' });
    return () => window.removeEventListener('message', handler);
  }, []);

  return (
    <ErrorBoundary>
      <div
        className="cockpit"
        style={{ padding: 0, margin: 0, height: '100vh', overflow: 'hidden' }}
      >
        <SuperWebview vscode={vscode} cockpitState={state} />
      </div>
    </ErrorBoundary>
  );
};

const rootEl = document.getElementById('root');
if (rootEl) {
  const root = createRoot(rootEl);
  root.render(<App />);
}
