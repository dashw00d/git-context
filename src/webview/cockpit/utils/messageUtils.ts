import { CockpitClientMessageSchema } from '../../../state/schemas';
import { CockpitClientMessage } from '../../../types/cockpit';
import { MessageTracer } from '../../../utils/messageTracer';

let webviewTracer: MessageTracer | null = null;

export function getMessageTracer(): MessageTracer {
  if (!webviewTracer) {
    webviewTracer = new MessageTracer();
  }
  return webviewTracer;
}

export function postMessageWithTracing(vscode: any, message: CockpitClientMessage): void {
  const parsed = CockpitClientMessageSchema.safeParse(message);
  if (!parsed.success) {
    // Validation failed - message won't be posted
    return;
  }
  getMessageTracer().logOutgoing(parsed.data.type, parsed.data, 'webview');
  vscode.postMessage(parsed.data);
}
