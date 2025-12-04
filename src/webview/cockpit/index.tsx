import * as React from 'react';
import { createRoot } from 'react-dom/client';
import { CockpitHostMessageSchema } from '../../state/schemas';
import { CockpitHostMessage, CockpitState } from '../../types/cockpit';
import { ErrorBoundary } from './components/ErrorBoundary';
import { SuperWebview } from './components/SuperWebview';
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
  nodeMetrics: {},
};

const App: React.FC = () => {
  const [state, setState] = React.useState<CockpitState>(defaultState);

  React.useEffect(() => {
    const handler = (event: MessageEvent) => {
      try {
        // Handle unparsed analysisError messages (legacy support)
        if (event.data?.type === 'analysisError' && event.data?.payload) {
          setState(prev => ({
            ...prev,
            error: event.data.payload?.error || event.data.payload?.message || 'Analysis failed',
            isAnalyzing: false,
          }));
          return;
        }

        const parsed = CockpitHostMessageSchema.safeParse(event.data);
        if (!parsed.success) {
          // Log validation errors for debugging
          return;
        }

        const message = parsed.data as CockpitHostMessage;

        if (message.type === 'setData') {
          // Direct state replacement - no merge
          setState(() => {
            const newState: CockpitState = {
              ...defaultState,
              ...message.payload,
              // Ensure required fields have defaults
              activeFrame: message.payload.activeFrame || defaultState.activeFrame,
              history: message.payload.history || [],
              explorerData: message.payload.explorerData || [],
              nodeMetrics: message.payload.nodeMetrics || {},
              liveAnalysis: message.payload.liveAnalysis || defaultState.liveAnalysis,
            };
            return newState;
          });
        } else if (message.type === 'setProgress') {
          setState(prev => ({
            ...prev,
            isAnalyzing: message.payload.isAnalyzing,
            analysisStep: message.payload.step,
            analysisProgress: message.payload.progress,
          }));
        } else if (message.type === 'focusSection') {
          setState(prev => ({ ...prev, activeSection: message.payload.section }));
        } else if (message.type === 'assistantResponse') {
          // This is handled by SuperWebview's message handler
        } else if (message.type === 'updateExplorerTree') {
          setState(prev => ({ ...prev, explorerData: message.payload }));
        } else if (message.type === 'updateFrame') {
          setState(prev => ({
            ...prev,
            activeFrame: message.payload.frame,
          }));
        }
      } catch (error) {
        // Log errors but don't crash
      }
    };

    window.addEventListener('message', handler);
    postMessageWithTracing(vscode, { type: 'ready' });
    return () => {
      window.removeEventListener('message', handler);
    };
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
