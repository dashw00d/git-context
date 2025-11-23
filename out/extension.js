"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deactivate = exports.activate = void 0;
const vscode = __importStar(require("vscode"));
let commitTrackerProvider;
let symbolHistoryProvider;
async function activate(context) {
    try {
        console.log('Git Context extension is activating...');
        // Dynamically import providers and commands to prevent load-time errors
        // from native dependencies or ESM issues
        const { CommitTrackerProvider } = await Promise.resolve().then(() => __importStar(require('./ui/commitTracker')));
        const { SymbolHistoryProvider } = await Promise.resolve().then(() => __importStar(require('./ui/symbolHistory')));
        const { registerCommands } = await Promise.resolve().then(() => __importStar(require('./ui/commands')));
        console.log('Modules loaded successfully');
        // Initialize providers
        commitTrackerProvider = new CommitTrackerProvider(context);
        symbolHistoryProvider = new SymbolHistoryProvider(context);
        // Register tree data providers
        vscode.window.registerTreeDataProvider('commitTracker', commitTrackerProvider);
        vscode.window.registerTreeDataProvider('symbolHistory', symbolHistoryProvider);
        // Register commands
        registerCommands(context, commitTrackerProvider, symbolHistoryProvider);
        // Refresh providers when workspace changes
        context.subscriptions.push(vscode.workspace.onDidChangeWorkspaceFolders(() => {
            if (commitTrackerProvider) {
                commitTrackerProvider.refresh();
            }
            if (symbolHistoryProvider) {
                symbolHistoryProvider.refresh();
            }
        }));
        console.log('Git Context extension activated successfully');
    }
    catch (error) {
        console.error('Failed to activate Git Context extension:', error);
        // This is the critical part: show the error to the user!
        vscode.window.showErrorMessage(`Git Context extension failed to activate. Error: ${error instanceof Error ? error.message : String(error)}`);
    }
}
exports.activate = activate;
function deactivate() {
    console.log('Git Context extension is now deactivated!');
    // Cleanup: Close database connection
    try {
        const { closeDatabase } = require('./storage/database');
        closeDatabase();
    }
    catch (error) {
        console.error('Error closing database:', error);
    }
}
exports.deactivate = deactivate;
//# sourceMappingURL=extension.js.map