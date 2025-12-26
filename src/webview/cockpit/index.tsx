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
  bundleFactsSkeleton: null,
  bundleReportId: null,
  bundleView: null,
  bundleViewVersion: 0,
  fileEvidenceCache: {},
  symbolEvidenceCache: {},
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
          // Merge payload into existing state - never reset to defaults
          // Quick scan should only ADD data, never remove existing state
          setState(prev => {
            const payload = message.payload;
            const newState: CockpitState = {
              ...prev, // Preserve ALL existing state
              // Only update fields that are explicitly in the payload
              ...(payload.bundleFacts !== undefined && { bundleFacts: payload.bundleFacts }),
              ...(payload.bundleFactsSkeleton !== undefined && {
                bundleFactsSkeleton: payload.bundleFactsSkeleton,
              }),
              ...(payload.bundleSummary !== undefined && { bundleSummary: payload.bundleSummary }),
              ...(payload.bundleView !== undefined && { bundleView: payload.bundleView }),
              ...(payload.activeFrame !== undefined && { activeFrame: payload.activeFrame }),
              ...(payload.history !== undefined && { history: payload.history }),
              ...(payload.explorerData !== undefined && { explorerData: payload.explorerData }),
              ...(payload.nodeMetrics !== undefined && { nodeMetrics: payload.nodeMetrics }),
              ...(payload.isAnalyzing !== undefined && { isAnalyzing: payload.isAnalyzing }),
              ...(payload.analysisStep !== undefined && { analysisStep: payload.analysisStep }),
              ...(payload.analysisProgress !== undefined && {
                analysisProgress: payload.analysisProgress,
              }),
              ...(payload.error !== undefined && { error: payload.error }),
              ...(payload.liveAnalysis !== undefined && { liveAnalysis: payload.liveAnalysis }),
              ...(payload.repoName !== undefined && { repoName: payload.repoName }),
              ...(payload.branchName !== undefined && { branchName: payload.branchName }),
              ...(payload.bundleConfig !== undefined && { bundleConfig: payload.bundleConfig }),
              ...(payload.lastNCommits !== undefined && { lastNCommits: payload.lastNCommits }),
              ...(payload.currentCommitIndex !== undefined && {
                currentCommitIndex: payload.currentCommitIndex,
              }),
              ...(payload.llmOutputs !== undefined && { llmOutputs: payload.llmOutputs }),
              ...(payload.retrievedHistory !== undefined && {
                retrievedHistory: payload.retrievedHistory,
              }),
              ...(payload.commits !== undefined && { commits: payload.commits }),
              ...(payload.hasMoreCommits !== undefined && {
                hasMoreCommits: payload.hasMoreCommits,
              }),
              ...(payload.headInfo !== undefined && { headInfo: payload.headInfo }),
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
        } else if (message.type === 'fileDetailsResponse') {
          setState(prev => ({
            ...prev,
            fileEvidenceCache: {
              ...(prev.fileEvidenceCache || {}),
              [message.payload.filePath]: message.payload.evidence,
            },
          }));
        } else if (message.type === 'symbolDetailsResponse') {
          setState(prev => ({
            ...prev,
            symbolEvidenceCache: {
              ...(prev.symbolEvidenceCache || {}),
              [message.payload.symbolId]: message.payload.evidence,
            },
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
