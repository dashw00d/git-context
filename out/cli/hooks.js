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
exports.uninstallHooks = exports.installHooks = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const config_1 = require("../utils/config");
async function installHooks() {
    const gitRoot = (0, config_1.getGitRoot)();
    if (!gitRoot) {
        throw new Error('Not in a git repository');
    }
    const hooksDir = path.join(gitRoot, '.git', 'hooks');
    const postCommitHook = path.join(hooksDir, 'post-commit');
    // Create post-commit hook
    const hookContent = `#!/bin/sh
# Git Context post-commit hook
# Automatically analyze new commits

# Get the path to the CLI tool
CLI_PATH="$(dirname "$0")/../../node_modules/.bin/ct"

if [ -x "$CLI_PATH" ]; then
  "$CLI_PATH" analyze --count 1 >/dev/null 2>&1 &
fi
`;
    // Write hook file
    fs.writeFileSync(postCommitHook, hookContent, { mode: 0o755 });
    console.log(`Installed post-commit hook at: ${postCommitHook}`);
    // TODO: Optionally install post-checkout and post-merge hooks
}
exports.installHooks = installHooks;
async function uninstallHooks() {
    const gitRoot = (0, config_1.getGitRoot)();
    if (!gitRoot) {
        throw new Error('Not in a git repository');
    }
    const hooksDir = path.join(gitRoot, '.git', 'hooks');
    const postCommitHook = path.join(hooksDir, 'post-commit');
    if (fs.existsSync(postCommitHook)) {
        fs.unlinkSync(postCommitHook);
        console.log('Uninstalled post-commit hook');
    }
}
exports.uninstallHooks = uninstallHooks;
//# sourceMappingURL=hooks.js.map