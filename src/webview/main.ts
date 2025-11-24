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
