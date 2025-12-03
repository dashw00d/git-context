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
      console.log('[Webview] Received message event:', event.data?.type || 'unknown');

      // Handle unparsed analysisError messages (legacy support, before schema validation)
      if (event.data?.type === 'analysisError' && event.data?.payload) {
        console.log('[Webview] Analysis error received (legacy)');
        setState(prev => ({
          ...prev,
          error: event.data.payload?.error || event.data.payload?.message || 'Analysis failed',
          isAnalyzing: false,
        }));
        return;
      }

      const parsed = CockpitHostMessageSchema.safeParse(event.data);
      if (!parsed.success) {
        console.warn('[Webview] Ignoring invalid host message', event.data, parsed.error);
        return;
      }

      const message = parsed.data as CockpitHostMessage;
      console.log(`[Webview] Processing message type: ${message.type}`);

      if (message.type === 'updateState') {
        console.log('[Webview] Received updateState keys:', Object.keys(message.payload));
        console.log(
          '[Webview] bundleFacts:',
          message.payload.bundleFacts ? 'EXISTS' : 'NULL/UNDEFINED'
        );
        console.log('[Webview] bundleSummary:', message.payload.bundleSummary);
        console.log('[Webview] isAnalyzing:', message.payload.isAnalyzing);

        setState(prev => {
          const newState: any = { ...prev };
          for (const key in message.payload) {
            const value = (message.payload as any)[key];
            if (
              value &&
              typeof value === 'object' &&
              !Array.isArray(value) &&
              value.constructor === Object
            ) {
              newState[key] = { ...(prev as any)[key], ...value };
            } else {
              newState[key] = value;
            }
          }
          console.log('[Webview] State updated, new keys:', Object.keys(newState));
          return newState as CockpitState;
        });
      } else if (message.type === 'analysisProgress') {
        console.log('[Webview] Updating analysis progress');
        setState(prev => ({
          ...prev,
          isAnalyzing: message.payload.isAnalyzing,
          analysisStep: message.payload.step,
          analysisProgress: message.payload.progress,
        }));
      } else if (message.type === 'focusSection') {
        console.log('[Webview] Focusing section:', message.payload.section);
        setState(prev => ({ ...prev, activeSection: message.payload.section }));
      } else if (message.type === 'updateExplorerTree') {
        console.log('[Webview] Updating explorer tree');
        setState(prev => ({ ...prev, explorerData: message.payload }));
      } else if (message.type === 'updateBundle') {
        console.log('[Webview] Updating bundle');
        setState(prev => ({
          ...prev,
          bundleView: message.payload.view ?? prev.bundleView,
          bundleSummary: message.payload.summary ?? prev.bundleSummary,
          bundleFacts: message.payload.facts ?? prev.bundleFacts,
        }));
      }
    };

    console.log('[Webview] Setting up message listener');
    window.addEventListener('message', handler);
    postMessageWithTracing(vscode, { type: 'ready' });
    return () => {
      console.log('[Webview] Cleaning up message listener');
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
