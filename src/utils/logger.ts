import * as vscode from 'vscode';

let infoChannel: vscode.OutputChannel | undefined;
let debugChannel: vscode.OutputChannel | undefined;

export function getInfoChannel(): vscode.OutputChannel {
    if (!infoChannel) {
        infoChannel = vscode.window.createOutputChannel('Git Context');
    }
    return infoChannel;
}

export function getDebugChannel(): vscode.OutputChannel {
    if (!debugChannel) {
        debugChannel = vscode.window.createOutputChannel('Git Context (Debug)');
    }
    return debugChannel;
}

/**
 * Log info message (user-facing, high-level operations)
 */
export function logInfo(message: string): void {
    getInfoChannel().appendLine(message);
    console.log(message);
}

/**
 * Log debug message (detailed trace, goes to debug channel)
 */
export function logDebug(message: string): void {
    getDebugChannel().appendLine(message);
    console.log(message);
}

/**
 * Log error message (goes to both channels)
 */
export function logError(message: string, error?: any): void {
    const errorMsg = error ? `${message}: ${error}` : message;
    getInfoChannel().appendLine(`[ERROR] ${errorMsg}`);
    getDebugChannel().appendLine(`[ERROR] ${errorMsg}`);
    if (error instanceof Error && error.stack) {
        getDebugChannel().appendLine(error.stack);
    }
    console.error(errorMsg, error);
}
