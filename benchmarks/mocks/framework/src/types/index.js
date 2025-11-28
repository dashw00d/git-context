"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isSymbolInfo = exports.isCstFact = exports.ContextValues = void 0;
// Context values for tree items (used in package.json menus and tree item identification)
exports.ContextValues = {
    // Workspace and bundle related
    WORKSPACE_GROUP: 'workspace-group',
    WORKSPACE_FULL: 'workspace-full',
    WORKSPACE_STAGED: 'workspace-staged',
    WORKSPACE_UNSTAGED: 'workspace-unstaged',
    WORKSPACE_FILE: 'workspace-file',
    // Bundle and refactor related
    REFACTOR_BUNDLE_PROGRESS: 'refactor-bundle-progress',
    REFACTOR_BUNDLE_GROUPING: 'refactor-bundle-grouping',
    REFACTOR_BUNDLE_GROUPING_ITEM: 'refactor-bundle-grouping-item',
    REFACTOR_BUNDLE_ITEM: 'refactor-bundle-item',
    REFACTOR_FINDING: 'refactor-finding',
    BUNDLE_FILE: 'bundle-file',
    BUNDLE_SYMBOL: 'bundle-symbol',
    BUNDLE_HOTSPOT_FILE: 'bundle-hotspot-file',
    // Commit related
    COMMIT: 'commit',
    COMMIT_HEAD: 'commit head',
    COMMIT_IN_BUNDLE: 'commit inRefactorBundle',
    COMMIT_IN_BUNDLE_HEAD: 'commit inRefactorBundle head',
    // Timeline and navigation
    TIMELINE_ITEM: 'timeline-item',
    LOAD_MORE: 'load-more',
    // Selection section
    SELECTION_HEADER: 'selection-header',
    SELECTION_ITEM: 'selection-item',
    SELECTION_FILE: 'selection-file',
    SELECTION_COMMIT: 'selection-commit',
    ACTION_ADD_COMMIT: 'action-add-commit',
    // Report section
    SAVED_REPORT: 'saved-report',
    REPORT_WORKSPACE_SUMMARY: 'report-workspace-summary',
    REPORT_COMMIT_SUMMARY: 'report-commit-summary',
    REPORT_FILE: 'report-file',
    REPORT_FINDING: 'report-finding',
    // State indicators
    EMPTY_STATE: 'empty-state',
    NO_DATA_PLACEHOLDER: 'no-data-placeholder',
    SEPARATOR: 'separator',
    INITIALIZE_PLACEHOLDER: 'initialize-placeholder',
    ACTIVE_BUNDLE: 'activeBundle',
    SELECTED_COMMITS_GROUP: 'selected-commits-group',
    RECENT_COMMITS_GROUP: 'recent-commits-group'
};
var cstFacts_1 = require("./cstFacts");
Object.defineProperty(exports, "isCstFact", { enumerable: true, get: function () { return cstFacts_1.isCstFact; } });
Object.defineProperty(exports, "isSymbolInfo", { enumerable: true, get: function () { return cstFacts_1.isSymbolInfo; } });
