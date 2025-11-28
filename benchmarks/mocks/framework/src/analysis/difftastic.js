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
exports.getDifftasticIntegration = exports.DifftasticIntegration = void 0;
const child_process_1 = require("child_process");
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const config_1 = require("../utils/config");
class DifftasticIntegration {
    constructor() {
        this.difftasticPath = this.findDifftasticPath();
    }
    /**
     * Find difftastic binary path
     */
    findDifftasticPath() {
        const config = (0, config_1.getExtensionConfig)();
        // Check configured path first
        if (config.difftasticPath && fs.existsSync(config.difftasticPath)) {
            return config.difftasticPath;
        }
        // Check common installation paths
        const homeDir = process.env.HOME || process.env.USERPROFILE || '';
        const workspaceRoot = path.join(__dirname, '..', '..');
        const commonPaths = [
            // User-specific paths (for testing)
            path.join(homeDir, 'bin', 'difftastic'),
            // Extension resources folder (bundled or for tests)
            path.join(workspaceRoot, 'resources', 'difftastic'),
            // System paths
            '/usr/local/bin/difftastic',
            '/usr/bin/difftastic',
            '/opt/homebrew/bin/difftastic',
            '/home/linuxbrew/.linuxbrew/bin/difftastic',
            'difftastic' // In PATH
        ];
        for (const binPath of commonPaths) {
            if (this.isValidDifftasticPath(binPath)) {
                return binPath;
            }
        }
        // Return empty string if not found (optional dependency)
        console.warn('[DIFFTASTIC] Binary not found. Structural diff analysis will be disabled.');
        console.warn('[DIFFTASTIC] Searched paths:', commonPaths.slice(0, 3).join(', '));
        return '';
    }
    /**
     * Check if a path points to a valid difftastic binary
     */
    isValidDifftasticPath(binPath) {
        try {
            const result = (0, child_process_1.spawn)(binPath, ['--version'], { stdio: 'pipe' });
            return result.pid !== undefined;
        }
        catch {
            return false;
        }
    }
    /**
     * Run difftastic on two file versions
     */
    async runDifftastic(oldContent, newContent, oldFilePath, newFilePath) {
        return new Promise((resolve, reject) => {
            // Create temporary files
            const tempDir = require('os').tmpdir();
            const oldFile = path.join(tempDir, `old_${Date.now()}_${path.basename(oldFilePath)}`);
            const newFile = path.join(tempDir, `new_${Date.now()}_${path.basename(newFilePath)}`);
            try {
                fs.writeFileSync(oldFile, oldContent);
                fs.writeFileSync(newFile, newContent);
                // Run difftastic with fixed width to prevent side-by-side overflow panics
                const width = '200'; // Fixed wide terminal
                const difft = (0, child_process_1.spawn)(this.difftasticPath, [
                    '--color=never',
                    '--exit-code',
                    '--width', width,
                    oldFile,
                    newFile
                ], {
                    stdio: ['pipe', 'pipe', 'pipe'],
                    env: { ...process.env, COLUMNS: width, DIFT_WIDTH: width }
                });
                let stdout = '';
                let stderr = '';
                difft.stdout.on('data', (data) => {
                    stdout += data.toString();
                });
                difft.stderr.on('data', (data) => {
                    stderr += data.toString();
                });
                difft.on('close', (code) => {
                    // Clean up temp files
                    try {
                        fs.unlinkSync(oldFile);
                        fs.unlinkSync(newFile);
                    }
                    catch {
                        // Ignore cleanup errors
                    }
                    if (code !== null && code > 1) { // 1 is success with differences, >1 is error
                        reject(new Error(`Difftastic failed: ${stderr}`));
                        return;
                    }
                    const result = this.parseDifftasticOutput(stdout, code === 1);
                    resolve(result);
                });
                difft.on('error', (error) => {
                    // Clean up temp files
                    try {
                        fs.unlinkSync(oldFile);
                        fs.unlinkSync(newFile);
                    }
                    catch {
                        // Ignore cleanup errors
                    }
                    reject(error);
                });
            }
            catch (error) {
                // Clean up temp files
                try {
                    fs.unlinkSync(oldFile);
                    fs.unlinkSync(newFile);
                }
                catch {
                    // Ignore cleanup errors
                }
                reject(error);
            }
        });
    }
    /**
     * Parse difftastic output to extract structural highlights, hunks, and tagged tokens
     */
    parseDifftasticOutput(output, hasDifferences) {
        const highlights = [];
        const morphs = [];
        const hunks = [];
        const tags = new Map();
        if (!hasDifferences) {
            return {
                highlights: [],
                morphs: [],
                hasStructuralChanges: false,
                hunks: [],
                tags
            };
        }
        const lines = output.split('\n');
        let currentHunk = null;
        let inHunkContext = false;
        // Control-flow and interface keywords to tag
        const controlFlowKeywords = /\b(if|while|for|switch|return|throw|catch|try|else|do|break|continue)\b/;
        const interfaceKeywords = /\b(function|class|interface|type|export|import|const\s+\w+\s*=|let\s+\w+\s*=|var\s+\w+\s*=)\b/;
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const trimmed = line.trim();
            // Skip file headers
            if (trimmed.startsWith('File ')) {
                continue;
            }
            // Parse hunk headers: @@ -oldStart,oldCount +newStart,newCount @@
            const hunkMatch = trimmed.match(/^@@ -(\d+),?(\d*) \+(\d+),?(\d*) @@/);
            if (hunkMatch) {
                // Save previous hunk if exists
                if (currentHunk && currentHunk.lines) {
                    hunks.push(currentHunk);
                }
                // Start new hunk
                const [, oldStart, oldCount, newStart, newCount] = hunkMatch;
                currentHunk = {
                    oldStart: parseInt(oldStart),
                    oldCount: parseInt(oldCount || '1'),
                    newStart: parseInt(newStart),
                    newCount: parseInt(newCount || '1'),
                    lines: [],
                    linesAdded: 0,
                    linesRemoved: 0
                };
                inHunkContext = true;
                // Add hunk header as highlight
                highlights.push(trimmed);
                continue;
            }
            // Process lines within hunk context
            if (inHunkContext && currentHunk) {
                currentHunk.lines.push(line);
                // Count added/removed lines
                if (line.startsWith('+') && !line.startsWith('+++')) {
                    currentHunk.linesAdded++;
                }
                else if (line.startsWith('-') && !line.startsWith('---')) {
                    currentHunk.linesRemoved++;
                }
                // Tag control-flow keywords
                if (controlFlowKeywords.test(line)) {
                    const lineTags = tags.get(i + 1) || [];
                    lineTags.push('control-flow');
                    tags.set(i + 1, lineTags);
                }
                // Tag interface keywords
                if (interfaceKeywords.test(line)) {
                    const lineTags = tags.get(i + 1) || [];
                    lineTags.push('interface');
                    tags.set(i + 1, lineTags);
                }
            }
            // Add non-empty lines as highlights
            if (trimmed) {
                highlights.push(trimmed);
            }
        }
        // Save final hunk
        if (currentHunk && currentHunk.lines) {
            hunks.push(currentHunk);
        }
        return {
            highlights,
            morphs,
            hasStructuralChanges: true,
            hunks,
            tags
        };
    }
    /**
     * Extract location information from a difftastic output line
     */
    extractLocationFromLine(line) {
        // Difftastic doesn't always include location info in basic output
        // This would need enhancement based on actual difftastic output format
        return undefined;
    }
    /**
     * Run difftastic on a git commit to get structural highlights
     */
    /**
     * Run difftastic on a git commit to get structural highlights
     */
    async getCommitStructuralHighlights(sha, filePath, oldPath) {
        try {
            // Get file content at commit and its parent
            const git = new (require('./git').GitOperations)();
            const commitInfo = git.getCommitInfo(sha);
            if (!commitInfo.parent) {
                // First commit, no parent to compare
                return {
                    highlights: [],
                    morphs: [],
                    hasStructuralChanges: false
                };
            }
            const newContent = git.safeGetFileContent(sha, filePath);
            const parentPath = oldPath || filePath;
            const oldContent = git.safeGetFileContent(commitInfo.parent, parentPath);
            if (!newContent && !oldContent) {
                return {
                    highlights: [],
                    morphs: [],
                    hasStructuralChanges: false
                };
            }
            return await this.runDifftastic(oldContent, newContent, parentPath, filePath);
        }
        catch (error) {
            const errorMsg = error.message || String(error);
            const widthRelated = errorMsg.includes('width') || errorMsg.includes('overflow') || errorMsg.includes('panic');
            const diagMsg = widthRelated ? 'width overflow - consider adjusting --width flag' : errorMsg;
            console.warn(`[DIFFTASTIC] Skipped ${filePath} (${diagMsg})`);
            return {
                highlights: [],
                morphs: [],
                hasStructuralChanges: false
            };
        }
    }
    /**
     * Check if difftastic is available
     */
    isAvailable() {
        if (!this.difftasticPath) {
            return false;
        }
        try {
            return this.isValidDifftasticPath(this.difftasticPath);
        }
        catch {
            return false;
        }
    }
}
exports.DifftasticIntegration = DifftasticIntegration;
// Singleton instance
let difftasticInstance = null;
function getDifftasticIntegration() {
    if (!difftasticInstance) {
        difftasticInstance = new DifftasticIntegration();
    }
    return difftasticInstance;
}
exports.getDifftasticIntegration = getDifftasticIntegration;
