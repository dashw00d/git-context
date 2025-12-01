import * as React from 'react';
import { createRoot } from 'react-dom/client';
import { EvidenceLink, LlmAnalysis } from '../analysis/llmAnalyst/blocks';
import { RefactorBundleFacts } from '../facts/types';
import { RefactorReportView } from './RefactorReportView';

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
    evidence,
  });
};

/**
 * Handle actions
 */
const handleAction = (action: string, data: any) => {
  vscode.postMessage({
    type: 'action',
    action,
    data,
  });
};

/**
 * Render the app
 */
function renderApp() {
  const rootElement = document.getElementById('root');
  if (!rootElement || !analysis || !facts) return;

  const root = createRoot(rootElement);
  root.render(
    React.createElement(RefactorReportView as any, {
      analysis,
      facts,
      onEvidenceClick: handleEvidenceClick,
      onAction: handleAction,
    })
  );
}

/**
 * Signal that the webview is ready
 */
vscode.postMessage({ type: 'ready' });
