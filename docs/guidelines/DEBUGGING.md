# SuperWebview Debugging System

## Overview

Comprehensive debugging system for tracking state transitions, message flow, and pipeline execution in the SuperWebview. The system provides visibility into race conditions, stale updates, and data flow issues.

## Components

### 1. State Debugger (`src/utils/stateDebugger.ts`)

Tracks every Redux state transition with detailed diffs and validation.

**Features:**
- Before/After state snapshots
- Deep diff computation for critical fields
- Zod schema validation
- Suspicious pattern detection
- Validation of frameId matching

**Suspicious Patterns Detected:**
- Data leak: Frame level changes but data not cleared
- Duplicate navigation: Same frame pushed to history twice
- Bundle sync issues: BundleView updated but frame.data empty
- Unexpected explorer clears

**Usage:**
```typescript
// Automatically enabled in store.dispatch() when DEBUG_COCKPIT=true
// Check logs in "Git Context (Debug)" output channel
```

### 2. Pipeline Debugger (`src/utils/pipelineDebugger.ts`)

Tracks each tier of frame analysis with timing and frame mismatch detection.

**Features:**
- Start/Complete/Fail tracking for each tier
- Duration and data size metrics
- Active frame tracking (start vs end)
- Stale update detection
- Performance warnings (>2s or >1MB)

**Output Example:**
```
🔬 Tier 1 START for src/foo.ts (activeFrame: src/foo.ts)
✅ Tier 1 COMPLETE for src/foo.ts (123ms, 5000 bytes)
⚠️ FRAME CHANGED: src/foo.ts → root
🚨 STALE UPDATE DETECTED: Tier 1 data for src/foo.ts will be dropped!
```

### 3. Message Tracer (`src/utils/messageTracer.ts`)

Tracks all messages between webview and extension host.

**Features:**
- Request/Response matching
- Response time tracking
- Pending request monitoring
- Slow response warnings (>5s)
- Stale request detection (>30s)

**Output Example:**
```
📤 webview→extension [analyzeFrame] (analyzeFrame:src/foo.ts)
   {"frameId":"src/foo.ts"}
📥 extension→webview [updateState] (2345ms) (analyzeFrame:src/foo.ts)
```

### 4. Debug Config (`src/utils/debugConfig.ts`)

Centralized debug mode toggle.

**Enable Methods:**
1. Environment variable: `DEBUG_COCKPIT=true`
2. Automatically enabled in development mode
3. Can be toggled at runtime: `setDebugMode(true)`

## Integration Points

### Store (Extension Host)

`src/state/store.ts` - Lines 16-18, 49-51
```typescript
if (getDebugMode()) {
  this.debugger = new StateDebugger();
}
// ...
if (this.debugger) {
  this.debugger.logTransition(action, prevState, newState);
}
```

### Analysis Controller (Extension Host)

`src/webview/cockpit/services/AnalysisController.ts` - Lines 10, 48-52, 68-72, 89-94
```typescript
private pipelineDebugger = new PipelineDebugger();

this.pipelineDebugger.startTier(frameId, 1, activeFrame);
// ... tier execution ...
this.pipelineDebugger.completeTier(frameId, 1, tier1Data, currentState.activeFrame.id);
// OR
this.pipelineDebugger.failTier(frameId, 1, String(error));
```

### Message Controller (Extension Host)

`src/webview/cockpit/services/MessageController.ts` - Lines 5, 11, 21, 460
```typescript
import { MessageTracer } from '../../../utils/messageTracer';

private tracer = new MessageTracer();

this.tracer.logIncoming(rawMsg.type, rawMsg, 'webview');
// ...
this.tracer.logOutgoing(type, payload, 'extension');
```

### SuperWebview (Webview)

`src/webview/cockpit/components/SuperWebview.tsx` - Lines 3, 50-51, 55, 77-79
```typescript
import { getMessageTracer, postMessageWithTracing } from '../utils/messageUtils';

postMessageWithTracing(vscode, 'getExplorerTree');
getMessageTracer().logIncoming(message.type, message.payload, 'extension');
postMessageWithTracing(vscode, 'dispatch', { action: { ... } });
```

## How to Use

### 1. Enable Debug Mode

```bash
# In terminal before running extension
export DEBUG_COCKPIT=true
code .
```

OR automatically enabled in development builds.

### 2. Open Debug Output

1. Open VSCode Command Palette (Cmd+Shift+P)
2. Search: "Output: Show Output Channels"
3. Select: "Git Context (Debug)"

### 3. Reproduce the Bug

Navigate around the SuperWebview while watching the debug output.

### 4. Analyze Logs

Look for:
- **⚠️ Warnings**: Suspicious patterns detected
- **❌ Errors**: Validation failures
- **🚨 Stale Updates**: Frame mismatches
- **⏱️ Slow Operations**: Performance issues

### Example Debug Session

```
🔄 [NAVIGATE_TO] @ 10:30:00
   Payload: {"frame":{"id":"src/foo.ts","level":"file"}}
   activeFrame: bundle:root (ready) → file:src/foo.ts (scanning)
   history: 0 entries → 1 entries
      Added: root

📤 webview→extension [analyzeFrame] (analyzeFrame:src/foo.ts)
   {"frameId":"src/foo.ts"}

🔬 Tier 1 START for src/foo.ts (activeFrame: src/foo.ts)
✅ Tier 1 COMPLETE for src/foo.ts (123ms, 5000 bytes)

🔄 [FRAME_ANALYSIS_TIER_1_COMPLETE] @ 10:30:00
   Payload: {"frameId":"src/foo.ts"}
   activeFrame: file:src/foo.ts (scanning) → file:src/foo.ts (ready)
      status: scanning → ready, tier: undefined → structure
   activeFrame.data: empty → content, lineCount

🔬 Tier 3 START for src/foo.ts (activeFrame: src/foo.ts)

🔄 [NAVIGATE_BACK] @ 10:30:00
   activeFrame: file:src/foo.ts (ready) → bundle:root (ready)
   history: 1 entries → 0 entries

✅ Tier 3 COMPLETE for src/foo.ts (89ms, 1200 bytes)
⚠️ FRAME CHANGED: src/foo.ts → root
🚨 STALE UPDATE DETECTED: Tier 3 data for src/foo.ts will be dropped!

🔄 [FRAME_ANALYSIS_TIER_3_COMPLETE] @ 10:30:00
   Payload: {"frameId":"src/foo.ts"}
   ⚠️ Tier completion frameId mismatch: action=src/foo.ts, state=root
   [Reducer] Dropping stale tier 3 data for src/foo.ts (current frame: root)
```

**Analysis:** User navigated back before Tier 3 completed. The stale update was correctly detected and dropped by the reducer's frameId validation.

## What to Look For

### Race Conditions

1. **Frame Mismatch**: Tier completes but activeFrame changed
   ```
   ⚠️ FRAME CHANGED: src/foo.ts → root
   ```

2. **Duplicate Navigation**: Same frame pushed twice
   ```
   ⚠️ _suspicious_duplicate_nav: NAVIGATE_TO pushed duplicate frame
   ```

3. **Slow Response**: Message took >5s
   ```
   ⏱️ SLOW RESPONSE: analyzeFrame took 6789ms
   ```

### Data Issues

1. **Validation Errors**: Data shape mismatch
   ```
   ❌ Validation Errors:
      activeFrame validation failed: status: Invalid enum value
   ```

2. **Data Leak**: Frame changed but data not cleared
   ```
   ⚠️ _suspicious_data_leak: Frame level changed but data not cleared! bundle → file
   ```

3. **Bundle Sync**: BundleView not reflected in frame
   ```
   ⚠️ _suspicious_bundle_sync: BundleView updated but activeFrame.data is empty
   ```

### Performance Issues

1. **Slow Tier**: Analysis tier took >2s
   ```
   ⏱️ SLOW TIER: Tier 2 took 3456ms for src/foo.ts
   ```

2. **Large Data**: Tier returned >1MB
   ```
   📦 LARGE DATA: Tier 3 returned 1500000 bytes for src/foo.ts
   ```

3. **Pending Requests**: Requests without responses
   ```
   [MessageTracer] Pending request never completed: analyzeFrame:src/foo.ts
   ```

## Export Debug Data

For bug reports or deeper analysis:

```typescript
// In browser console (webview):
window.exportDebugData = () => {
  const tracer = require('./utils/messageUtils').getMessageTracer();
  console.log('Message History:', tracer.exportHistory());
};

// In extension host:
import { getStore } from './state/store';
const debugger = (getStore() as any).debugger;
console.log('State History:', debugger.exportHistory());
```

## Cleanup

The debugging system automatically cleans up old traces:
- State transitions: Last 100 kept
- Message traces: Last 200 kept
- Pipeline traces: Cleaned every 5 minutes (older than 5min removed)
- Pending requests: Warned after 30s, cleaned

## Performance Impact

- **When Disabled**: Zero impact (tree-shaking removes debug code)
- **When Enabled**:
  - Memory: ~5-10MB for history storage
  - CPU: <1% overhead for logging
  - Network: No impact (logs locally only)

## Troubleshooting

### Debug logs not appearing

1. Check debug mode is enabled:
   ```typescript
   import { getDebugMode } from './utils/debugConfig';
   console.log('Debug mode:', getDebugMode());
   ```

2. Check output channel exists:
   - VSCode Command Palette → "Output: Show Output Channels"
   - Look for "Git Context (Debug)"

3. Check logger is working:
   ```typescript
   import { logDebug } from './utils/logger';
   logDebug('Test message');
   ```

### Too much logging

Reduce noise by filtering in the output channel:
1. Open "Git Context (Debug)" output
2. Use Cmd+F to search for specific patterns
3. Filter by emoji: 🔄 (state), 🔬 (pipeline), 📤/📥 (messages)

### Logs missing context

Export full history for comprehensive view:
```typescript
// Extension host
const store = require('./state/store').getStore();
const history = store.debugger?.exportHistory();
require('fs').writeFileSync('/tmp/debug-state.json', history);

// Webview
const tracer = require('./utils/messageUtils').getMessageTracer();
console.log(JSON.stringify(tracer.exportHistory(), null, 2));
```

## Future Enhancements

Potential additions:
1. Visual timeline in debug panel
2. Interactive state inspector
3. Replay captured sequences
4. Automated anomaly detection
5. Performance profiling integration
