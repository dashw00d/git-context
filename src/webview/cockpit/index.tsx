import * as React from 'react';
import { createRoot } from 'react-dom/client';

declare global {
  interface Window {
    acquireVsCodeApi(): {
      postMessage: (message: any) => void;
    };
  }
}

type CockpitState = {
  selectedCommitShas: string[];
  selectedFiles: string[];
  workspaceScope: 'workspace' | 'staged' | 'unstaged';
  commits: Array<{
    sha: string;
    message: string;
    author?: string;
    date?: string;
  }>;
  bundleFacts: any;
  symbols: any[];
  reports: any[];
  activeTab: 'commits' | 'bundle' | 'symbols' | 'reports';
};

const vscode = window.acquireVsCodeApi();

const App: React.FC = () => {
  const [state, setState] = React.useState<CockpitState>({
    selectedCommitShas: [],
    selectedFiles: [],
    workspaceScope: 'workspace',
    commits: [],
    bundleFacts: null,
    symbols: [],
    reports: [],
    activeTab: 'commits'
  });

  React.useEffect(() => {
    const handler = (event: MessageEvent) => {
      const message = event.data;
      if (message?.type === 'state' && message.payload) {
        setState(message.payload as CockpitState);
      }
    };
    window.addEventListener('message', handler);
    vscode.postMessage({ type: 'ready' });
    return () => window.removeEventListener('message', handler);
  }, []);

  const handleAnalyze = () => {
    vscode.postMessage({ type: 'generateReport' });
  };

  return (
    <div className="cockpit">
      <header className="cockpit__header">
        <div>
          <h2 className="cockpit__title">Cockpit</h2>
          <p className="cockpit__subtitle">Phase 1 • live state probe</p>
        </div>
        <button className="cockpit__button" onClick={handleAnalyze}>
          Analyze
        </button>
      </header>
      <section className="cockpit__grid">
        <div className="cockpit__card">
          <div className="cockpit__card-title">Selection</div>
          <div className="cockpit__stat">Commits: {state.selectedCommitShas.length}</div>
          <div className="cockpit__stat">Files: {state.selectedFiles.length}</div>
          <div className="cockpit__stat">Scope: {state.workspaceScope}</div>
        </div>
        <div className="cockpit__card">
          <div className="cockpit__card-title">Bundle</div>
          <div className="cockpit__stat">
            {state.bundleFacts?.bundle?.shas?.length
              ? `${state.bundleFacts.bundle.shas.length} commits`
              : 'None'}
          </div>
          <div className="cockpit__stat">
            Latest: {state.bundleFacts?.bundle?.newestSha?.slice(0, 8) ?? '—'}
          </div>
        </div>
        <div className="cockpit__card">
          <div className="cockpit__card-title">Symbols</div>
          <div className="cockpit__stat">{state.symbols.length} rows</div>
        </div>
        <div className="cockpit__card">
          <div className="cockpit__card-title">Reports</div>
          <div className="cockpit__stat">{state.reports.length} saved</div>
        </div>
      </section>
      <section className="cockpit__body">
        <pre className="cockpit__pre">
{JSON.stringify(state, null, 2)}
        </pre>
      </section>
    </div>
  );
};

const rootEl = document.getElementById('root');
if (rootEl) {
  const root = createRoot(rootEl);
  root.render(<App />);
}
