/**
 * Debug Configuration
 *
 * Controls debug logging throughout the application.
 * Enable in VSCode settings: git-context.debugMode (default: true)
 */

let debugMode = true;

let vscode: any;
try {
  vscode = require('vscode');
} catch {
  vscode = null;
}

export function getDebugMode(): boolean {
  if (vscode && vscode.workspace) {
    const config = vscode.workspace.getConfiguration('git-context');
    const setting = config.get('debugMode');
    if (typeof setting === 'boolean') {
      return setting;
    }
  }
  return debugMode;
}

export function setDebugMode(enabled: boolean): void {
  debugMode = enabled;

  console.log(`[DebugConfig] Debug mode ${enabled ? 'ENABLED' : 'DISABLED'}`);
}
