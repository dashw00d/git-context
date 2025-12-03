/* eslint-disable @typescript-eslint/no-explicit-any */
import { logDebug, logError, logWarn } from './logger';

interface TierTrace {
  frameId: string;
  tier: 1 | 2 | 3;
  startTime: number;
  endTime?: number;
  duration?: number;
  status: 'pending' | 'success' | 'failed';
  dataSize?: number;
  error?: string;
  activeFrameAtStart: string;
  activeFrameAtEnd?: string;
}

export class PipelineDebugger {
  private traces = new Map<string, TierTrace[]>();

  startTier(frameId: string, tier: 1 | 2 | 3, activeFrame: string): void {
    if (!this.traces.has(frameId)) {
      this.traces.set(frameId, []);
    }

    const trace: TierTrace = {
      frameId,
      tier,
      startTime: Date.now(),
      status: 'pending',
      activeFrameAtStart: activeFrame,
    };

    this.traces.get(frameId)!.push(trace);

    logDebug(`🔬 Tier ${tier} START for ${frameId} (activeFrame: ${activeFrame})`);
  }

  completeTier(frameId: string, tier: 1 | 2 | 3, data: any, activeFrame: string): void {
    const traces = this.traces.get(frameId);
    if (!traces) {
      logWarn(
        `[PipelineDebugger] completeTier called for unknown frameId: ${frameId} tier ${tier}`
      );
      return;
    }

    const trace = traces.find(t => t.tier === tier && t.status === 'pending');
    if (!trace) {
      logWarn(`[PipelineDebugger] No pending tier ${tier} found for frameId: ${frameId}`);
      return;
    }

    trace.endTime = Date.now();
    trace.duration = trace.endTime - trace.startTime;
    trace.status = 'success';
    trace.dataSize = JSON.stringify(data).length;
    trace.activeFrameAtEnd = activeFrame;

    const frameMismatch = trace.activeFrameAtStart !== trace.activeFrameAtEnd;

    logDebug(
      `✅ Tier ${tier} COMPLETE for ${frameId} (${trace.duration}ms, ${trace.dataSize} bytes)`
    );

    if (frameMismatch) {
      logWarn(`⚠️  FRAME CHANGED: ${trace.activeFrameAtStart} → ${trace.activeFrameAtEnd}`);
      logWarn(`🚨 STALE UPDATE DETECTED: Tier ${tier} data for ${frameId} will be dropped!`);
    }

    if (trace.duration && trace.duration > 2000) {
      logWarn(`⏱️  SLOW TIER: Tier ${tier} took ${trace.duration}ms for ${frameId}`);
    }

    if (trace.dataSize && trace.dataSize > 1000000) {
      logWarn(`📦 LARGE DATA: Tier ${tier} returned ${trace.dataSize} bytes for ${frameId}`);
    }
  }

  failTier(frameId: string, tier: 1 | 2 | 3, error: string): void {
    const traces = this.traces.get(frameId);
    if (!traces) {
      logWarn(`[PipelineDebugger] failTier called for unknown frameId: ${frameId} tier ${tier}`);
      return;
    }

    const trace = traces.find(t => t.tier === tier && t.status === 'pending');
    if (!trace) {
      logWarn(`[PipelineDebugger] No pending tier ${tier} found for frameId: ${frameId}`);
      return;
    }

    trace.endTime = Date.now();
    trace.duration = trace.endTime - trace.startTime;
    trace.status = 'failed';
    trace.error = error;

    logError(`❌ Tier ${tier} FAILED for ${frameId} (${trace.duration}ms)`, new Error(error));
  }

  getFrameSummary(frameId: string): {
    total: number;
    success: number;
    failed: number;
    pending: number;
    avgDuration: number;
  } {
    const traces = this.traces.get(frameId) || [];
    const durations = traces.filter(t => t.duration).map(t => t.duration!);
    return {
      total: traces.length,
      success: traces.filter(t => t.status === 'success').length,
      failed: traces.filter(t => t.status === 'failed').length,
      pending: traces.filter(t => t.status === 'pending').length,
      avgDuration:
        durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : 0,
    };
  }

  exportHistory(frameId?: string): string {
    if (frameId) {
      const traces = this.traces.get(frameId) || [];
      return JSON.stringify(traces, null, 2);
    }
    const allTraces: any = {};
    for (const [fid, traces] of this.traces.entries()) {
      allTraces[fid] = traces;
    }
    return JSON.stringify(allTraces, null, 2);
  }

  cleanup(olderThanMs: number = 300000): void {
    const cutoff = Date.now() - olderThanMs;
    let cleaned = 0;

    for (const [frameId, traces] of this.traces.entries()) {
      const recentTraces = traces.filter(t => t.startTime > cutoff);
      if (recentTraces.length === 0) {
        this.traces.delete(frameId);
        cleaned++;
      } else if (recentTraces.length < traces.length) {
        this.traces.set(frameId, recentTraces);
      }
    }

    if (cleaned > 0) {
      logDebug(`[PipelineDebugger] Cleaned ${cleaned} old frame traces`);
    }
  }
}
