"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logError = exports.logWarn = exports.logDebug = exports.logInfo = exports.getDebugChannel = exports.getInfoChannel = void 0;
let vscode;
try {
    vscode = require('vscode');
}
catch {
    // Not in VS Code environment
    vscode = null;
}
let infoChannel;
let debugChannel;
// Check if we are in VS Code environment
const isVsCode = vscode && vscode.window;
function getInfoChannel() {
    if (!isVsCode)
        return undefined;
    if (!infoChannel) {
        infoChannel = vscode.window.createOutputChannel('Git Context');
    }
    return infoChannel;
}
exports.getInfoChannel = getInfoChannel;
function getDebugChannel() {
    if (!isVsCode)
        return undefined;
    if (!debugChannel) {
        debugChannel = vscode.window.createOutputChannel('Git Context (Debug)');
    }
    return debugChannel;
}
exports.getDebugChannel = getDebugChannel;
/**
 * Log info message (user-facing, high-level operations)
 */
function logInfo(message) {
    const channel = getInfoChannel();
    if (channel) {
        channel.appendLine(message);
    }
    console.log(message);
}
exports.logInfo = logInfo;
/**
 * Log debug message (detailed trace, goes to debug channel)
 */
function logDebug(message) {
    const channel = getDebugChannel();
    if (channel) {
        channel.appendLine(message);
    }
    console.log(message);
}
exports.logDebug = logDebug;
/**
 * Log warning message (goes to both channels)
 */
function logWarn(message) {
    const infoCh = getInfoChannel();
    if (infoCh)
        infoCh.appendLine(`[WARN] ${message}`);
    const debugCh = getDebugChannel();
    if (debugCh)
        debugCh.appendLine(`[WARN] ${message}`);
    console.warn(`[WARN] ${message}`);
}
exports.logWarn = logWarn;
/**
 * Log error message (goes to both channels)
 */
function logError(message, error) {
    const errorMsg = error ? `${message}: ${error}` : message;
    const infoCh = getInfoChannel();
    if (infoCh)
        infoCh.appendLine(`[ERROR] ${errorMsg}`);
    const debugCh = getDebugChannel();
    if (debugCh) {
        debugCh.appendLine(`[ERROR] ${errorMsg}`);
        if (error instanceof Error && error.stack) {
            debugCh.appendLine(error.stack);
        }
    }
    console.error(errorMsg, error);
}
exports.logError = logError;
