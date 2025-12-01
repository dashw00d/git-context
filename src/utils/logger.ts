/* eslint-disable no-console */

let vscode: any;
try {
  vscode = require('vscode');
} catch {
  // Not in VS Code environment
  vscode = null;
}

let infoChannel: any | undefined;
let debugChannel: any | undefined;

// Check if we are in VS Code environment
const isVsCode = vscode && vscode.window;

export function getInfoChannel(): any | undefined {
  if (!isVsCode) return undefined;
  if (!infoChannel) {
    infoChannel = vscode.window.createOutputChannel('Git Context');
  }
  return infoChannel;
}

export function getDebugChannel(): any | undefined {
  if (!isVsCode) return undefined;
  if (!debugChannel) {
    debugChannel = vscode.window.createOutputChannel('Git Context (Debug)');
  }
  return debugChannel;
}

/**
 * Log info message (user-facing, high-level operations)
 */
export function logInfo(message: string): void {
  const channel = getInfoChannel();
  if (channel) {
    channel.appendLine(message);
  }
  console.log(message);
}

/**
 * Log debug message (detailed trace, goes to debug channel)
 */
export function logDebug(message: string): void {
  const channel = getDebugChannel();
  if (channel) {
    channel.appendLine(message);
  }
  console.log(message);
}

/**
 * Log warning message (goes to both channels)
 */
export function logWarn(message: string): void {
  const infoCh = getInfoChannel();
  if (infoCh) infoCh.appendLine(`[WARN] ${message}`);

  const debugCh = getDebugChannel();
  if (debugCh) debugCh.appendLine(`[WARN] ${message}`);

  console.warn(`[WARN] ${message}`);
}

/**
 * Log error message (goes to both channels)
 */
export function logError(message: string, error?: any): void {
  const errorMsg = error ? `${message}: ${error}` : message;

  const infoCh = getInfoChannel();
  if (infoCh) infoCh.appendLine(`[ERROR] ${errorMsg}`);

  const debugCh = getDebugChannel();
  if (debugCh) {
    debugCh.appendLine(`[ERROR] ${errorMsg}`);
    if (error instanceof Error && error.stack) {
      debugCh.appendLine(error.stack);
    }
  }

  console.error(errorMsg, error);
}
