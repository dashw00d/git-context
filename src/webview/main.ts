import * as React from 'react';
import { createRoot } from 'react-dom/client';
import { EvidenceLink, LlmAnalysis } from '../analysis/llmAnalyst/blocks';
import { RefactorBundleFacts } from '../facts/types';
import { ReportHostMessage } from '../types/reportWebview';
import { RefactorReportView } from './RefactorReportView';
import { postReportMessage, validateHostMessage } from './reports/messageUtils';

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
  const message = validateHostMessage(event.data) as ReportHostMessage | null;
  if (!message) return;

  switch (message.type) {
    case 'setData':
      analysis = message.analysis as unknown as LlmAnalysis;
      facts = message.facts as unknown as RefactorBundleFacts;
      renderApp();
      break;
    case 'scrollToSection': {
      const sectionId = message.sectionId;
      if (sectionId) {
        const element = document.getElementById(sectionId);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }
      break;
    }
    default:
      break;
  }
});

/**
 * Handle evidence clicks
 */
const handleEvidenceClick = (evidence: EvidenceLink) => {
  postReportMessage(vscode, { type: 'evidenceClick', evidence: evidence as any });
};

/**
 * Handle actions
 */
const handleAction = (action: string, data: any) => {
  postReportMessage(vscode, { type: 'action', action, data });
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
postReportMessage(vscode, { type: 'ready' });
