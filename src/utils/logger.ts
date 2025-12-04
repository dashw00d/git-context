/* eslint-disable no-console */

let vscode: any;
try {
  vscode = require('vscode');
} catch {
  vscode = null;
}

let infoChannel: any | undefined;
let debugChannel: any | undefined;

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
  let errorMsg = message;
  let stack: string | undefined;

  if (error) {
    if (error instanceof Error) {
      errorMsg = `${message}: ${error.message}`;
      stack = error.stack;

      if ('issues' in error && Array.isArray((error as any).issues)) {
        const issues = (error as any).issues;
        const formattedIssues = issues
          .map((i: any) => `  - [${i.path.join('.')}] ${i.message}`)
          .join('\n');
        errorMsg = `${message}: Validation Failed\n${formattedIssues}`;
        stack = undefined;
      }
    } else {
      errorMsg = `${message}: ${error}`;
    }
  }

  const infoCh = getInfoChannel();
  if (infoCh) infoCh.appendLine(`[ERROR] ${errorMsg}`);

  const debugCh = getDebugChannel();
  if (debugCh) {
    debugCh.appendLine(`[ERROR] ${errorMsg}`);
    if (stack) {
      debugCh.appendLine(stack);
    }
  }

  logDebug(errorMsg);
}
