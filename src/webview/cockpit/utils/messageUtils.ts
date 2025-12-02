/* eslint-disable @typescript-eslint/no-explicit-any */
import { MessageTracer } from '../../../utils/messageTracer';

// Singleton tracer for webview side
let webviewTracer: MessageTracer | null = null;

export function getMessageTracer(): MessageTracer {
  if (!webviewTracer) {
    webviewTracer = new MessageTracer();
  }
  return webviewTracer;
}

export function postMessageWithTracing(vscode: any, type: string, payload?: any): void {
  getMessageTracer().logOutgoing(type, payload || {}, 'webview');
  vscode.postMessage({ type, ...payload });
}
