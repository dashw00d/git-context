/* eslint-disable @typescript-eslint/no-explicit-any */
import { logDebug, logWarn } from './logger';

interface MessageTrace {
  direction: 'webview→extension' | 'extension→webview';
  type: string;
  payload: any;
  timestamp: number;
  responseTime?: number;
  sequenceId?: string;
}

export class MessageTracer {
  private traces: MessageTrace[] = [];
  private pendingRequests = new Map<string, number>();
  private maxHistory = 200;

  logOutgoing(type: string, payload: any, source: 'webview' | 'extension'): void {
    const trace: MessageTrace = {
      direction: source === 'webview' ? 'webview→extension' : 'extension→webview',
      type,
      payload: this.sanitizePayload(payload),
      timestamp: Date.now(),
    };

    this.traces.push(trace);
    if (this.traces.length > this.maxHistory) {
      this.traces.shift();
    }

    // Track request/response pairs
    if (
      type === 'analyzeFrame' ||
      type === 'getBundleData' ||
      type === 'getExplorerTree' ||
      type === 'switchBundle'
    ) {
      const requestKey = `${type}:${payload?.frameId || payload?.id || 'default'}`;
      this.pendingRequests.set(requestKey, trace.timestamp);
      trace.sequenceId = requestKey;
    }

    logDebug(`📤 ${trace.direction} [${type}]${trace.sequenceId ? ` (${trace.sequenceId})` : ''}`);
    if (payload && typeof payload === 'object') {
      const keys = Object.keys(payload);
      if (keys.length > 0 && keys.length <= 5) {
        logDebug(`   ${JSON.stringify(payload)}`);
      }
    }
  }

  logIncoming(type: string, payload: any, source: 'webview' | 'extension'): void {
    const direction = source === 'webview' ? 'extension→webview' : 'webview→extension';

    // Calculate response time if this is a response
    let responseTime: number | undefined;
    let sequenceId: string | undefined;

    // Try to match with pending request
    for (const [key, timestamp] of this.pendingRequests.entries()) {
      const [reqType] = key.split(':');
      if (
        (type === 'updateState' && reqType === 'analyzeFrame') ||
        (type === 'updateExplorerTree' && reqType === 'getExplorerTree') ||
        type === reqType
      ) {
        responseTime = Date.now() - timestamp;
        sequenceId = key;
        this.pendingRequests.delete(key);
        break;
      }
    }

    const trace: MessageTrace = {
      direction,
      type,
      payload: this.sanitizePayload(payload),
      timestamp: Date.now(),
      responseTime,
      sequenceId,
    };

    this.traces.push(trace);
    if (this.traces.length > this.maxHistory) {
      this.traces.shift();
    }

    logDebug(
      `📥 ${trace.direction} [${type}]${responseTime ? ` (${responseTime}ms)` : ''}${sequenceId ? ` (${sequenceId})` : ''}`
    );

    // Warn on slow responses
    if (responseTime && responseTime > 5000) {
      logWarn(`⏱️  SLOW RESPONSE: ${type} took ${responseTime}ms`);
    }
  }

  // Find message sequences
  findSequence(startType: string, endType: string): MessageTrace[] {
    const startIdx = this.traces.findIndex(t => t.type === startType);
    if (startIdx === -1) return [];

    const endIdx = this.traces.findIndex((t, i) => i > startIdx && t.type === endType);
    if (endIdx === -1) return [];

    return this.traces.slice(startIdx, endIdx + 1);
  }

  // Get pending requests (requests without responses)
  getPendingRequests(): Array<{ type: string; waitTime: number }> {
    const now = Date.now();
    return Array.from(this.pendingRequests.entries()).map(([key, timestamp]) => ({
      type: key,
      waitTime: now - timestamp,
    }));
  }

  exportHistory(): string {
    return JSON.stringify(this.traces, null, 2);
  }

  private sanitizePayload(payload: any): any {
    if (!payload) return payload;

    // Don't log huge objects
    if (typeof payload === 'object') {
      const str = JSON.stringify(payload);
      if (str.length > 500) {
        return `[Object: ${str.length} bytes]`;
      }
    }
    return payload;
  }

  // Cleanup old traces
  cleanup(olderThanMs: number = 300000): void {
    // 5 minutes
    const cutoff = Date.now() - olderThanMs;
    const before = this.traces.length;
    this.traces = this.traces.filter(t => t.timestamp > cutoff);
    const cleaned = before - this.traces.length;

    if (cleaned > 0) {
      logDebug(`[MessageTracer] Cleaned ${cleaned} old message traces`);
    }

    // Clean up stale pending requests (older than 30s)
    const staleCutoff = Date.now() - 30000;
    for (const [key, timestamp] of this.pendingRequests.entries()) {
      if (timestamp < staleCutoff) {
        logWarn(`[MessageTracer] Pending request never completed: ${key}`);
        this.pendingRequests.delete(key);
      }
    }
  }
}

// Singleton instance
let tracer: MessageTracer | null = null;

export function getMessageTracer(): MessageTracer {
  if (!tracer) {
    tracer = new MessageTracer();
  }
  return tracer;
}
