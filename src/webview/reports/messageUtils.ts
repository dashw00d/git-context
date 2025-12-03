import {
  ReportClientMessage,
  ReportClientMessageSchema,
  ReportHostMessage,
  ReportHostMessageSchema,
} from '../../types/reportWebview';
import { MessageTracer } from '../../utils/messageTracer';

let tracer: MessageTracer | null = null;

function getTracer(): MessageTracer {
  if (!tracer) {
    tracer = new MessageTracer();
  }
  return tracer;
}

export function postReportMessage(vscode: any, message: ReportClientMessage): void {
  const parsed = ReportClientMessageSchema.parse(message);
  getTracer().logOutgoing(parsed.type, parsed, 'webview');
  vscode.postMessage(parsed);
}

export function validateHostMessage(raw: any): ReportHostMessage | null {
  const result = ReportHostMessageSchema.safeParse(raw);
  if (!result.success) {
    return null;
  }
  getTracer().logIncoming(
    result.data.type,
    (result.data as any).payload ?? result.data,
    'extension'
  );
  return result.data;
}
