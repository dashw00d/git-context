"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GitOperations = void 0;
const child_process_1 = require("child_process");
const config_1 = require("../utils/config");
class GitOperations {
    constructor() {
        const root = (0, config_1.getGitRoot)();
        if (!root) {
            throw new Error('Not in a git repository');
        }
        this.gitRoot = root;
    }
    getRoot() {
        return this.gitRoot;
    }
    /**
     * Execute a git command and return the output
     */
    /**
     * Execute a git command and return the output
     */
    execGit(args, options = {}) {
        const start = Date.now();
        const cmd = `git ${args.join(' ')}`;
        try {
            const out = (0, child_process_1.execSync)(cmd, {
                cwd: this.gitRoot,
                encoding: 'utf8',
                maxBuffer: 1024 * 1024 * 10 // 10MB buffer
            }).trim();
            const duration = Date.now() - start;
            // Log slow commands or errors (optional: could be verbose logging)
            if (duration > 1000 && !options.suppressLog) {
                console.log(`[Git] Slow command: ${cmd} (${duration}ms)`);
            }
            return out;
        }
        catch (error) {
            const duration = Date.now() - start;
            if (!options.suppressLog) {
                console.error(`[Git] Command failed: ${cmd} (${duration}ms)`);
            }
            throw new Error(`Git command failed: ${cmd}\n${error.message}`);
        }
    }
    /**
     * Get basic commit information
     */
    getCommitInfo(sha) {
        const format = '--pretty=format:%H%n%an%n%ad%n%s%n%p';
        const output = this.execGit(['show', '--no-patch', '--date=iso', format, sha]);
        const result = this.parseLogCommits(output, 'single');
        if (!result) {
            throw new Error(`Invalid commit format for SHA: ${sha}`);
        }
        return result;
    }
    /**
     * Get list of commits (newest first)
     */
    getRecentCommits(count = 5) {
        const format = '--pretty=format:%H%n%an%n%ad%n%s%n%p';
        const output = this.execGit(['log', '--no-merges', `-${count}`, '--date=iso', format]);
        return this.parseLogCommits(output, 'multi');
    }
    /**
     * Get file changes for a commit
     */
    getFileChanges(sha) {
        // git diff-tree -r --no-commit-id --name-status sha : changes vs parent(s)
        let output;
        try {
            output = this.execGit(['diff-tree', '-r', '--no-commit-id', '--name-status', sha]);
        }
        catch (e) {
            // Fallback for root commits - compare with empty tree
            try {
                // 4b825dc642cb6eb9a060e54bf8d69288fbee4904 is the hash of an empty tree in git
                output = this.execGit(['diff-tree', '-r', '--no-commit-id', '--name-status', '4b825dc642cb6eb9a060e54bf8d69288fbee4904', sha]);
            }
            catch (innerError) {
                console.warn(`Failed to get file changes for ${sha} (even with empty tree fallback):`, innerError);
                return [];
            }
        }
        const changes = [];
        const lines = output.split('\n').filter(line => line.trim());
        for (const line of lines) {
            const parts = line.split('\t');
            if (parts.length >= 2) {
                const status = parts[0];
                const filePath = parts[1];
                let oldPath;
                // Handle renamed and copied files
                if (status.startsWith('R') || status.startsWith('C')) {
                    oldPath = parts[2];
                }
                changes.push({
                    path: filePath,
                    status: status.charAt(0),
                    oldPath
                });
            }
        }
        return changes;
    }
    /**
     * Get raw diff for a commit
     */
    getCommitDiff(sha) {
        return this.execGit(['show', '--pretty=format:', sha]);
    }
    /**
     * Get diff for a specific file in a commit
     */
    getFileDiff(sha, filePath) {
        // Use show with patch format for specific file
        return this.execGit(['show', '--pretty=format:', '--patch', sha, '--', filePath]);
    }
    /**
     * Get diff for a file across a range of commits (bundle)
     */
    getBundleDiff(startSha, endSha, filePath) {
        // Diff from parent of start to end
        // If startSha has no parent (root), just diff startSha..endSha (which misses startSha changes if using ..)
        // Safest is startSha~1..endSha
        try {
            return this.execGit(['diff', `${startSha}~1..${endSha}`, '--', filePath]);
        }
        catch (e) {
            // Fallback if no parent (e.g. shallow clone or root)
            return this.execGit(['diff', `${startSha}..${endSha}`, '--', filePath]);
        }
    }
    /**
     * Get staged changes diff
     */
    getStagedDiff() {
        return this.execGit(['diff', '--cached']);
    }
    /**
     * Get file content at specific commit
     */
    getFileContent(sha, filePath) {
        return this.execGit(['show', `${sha}:${filePath}`]);
    }
    /**
     * Safely get file content, returning empty string if file doesn't exist
     */
    safeGetFileContent(sha, filePath) {
        try {
            return this.execGit(['show', `${sha}:${filePath}`], { suppressLog: true });
        }
        catch (error) {
            if (this.isGitPathMissing(error)) {
                return '';
            }
            throw error;
        }
    }
    /**
     * Get staged file content (from index)
     */
    getStagedContent(filePath) {
        return this.execGit(['show', `:${filePath}`]);
    }
    /**
     * Safely get staged file content, returning empty string if file doesn't exist in index
     */
    safeGetStagedContent(filePath) {
        try {
            return this.getStagedContent(filePath);
        }
        catch (error) {
            if (this.isGitPathMissing(error)) {
                return '';
            }
            throw error;
        }
    }
    /**
     * Get working directory file content
     */
    getWorkingContent(filePath) {
        const fs = require('fs');
        const path = require('path');
        const fullPath = path.join(this.gitRoot, filePath);
        return fs.readFileSync(fullPath, 'utf8');
    }
    /**
     * Safely get working directory file content, returning empty string if file doesn't exist
     */
    safeGetWorkingContent(filePath) {
        try {
            return this.getWorkingContent(filePath);
        }
        catch (error) {
            // File doesn't exist in working directory
            return '';
        }
    }
    /**
     * Check if a file is ignored by git
     */
    isIgnored(filePath) {
        try {
            // git check-ignore returns exit code 0 if ignored, 1 if not ignored
            this.execGit(['check-ignore', '-q', filePath], { suppressLog: true });
            return true;
        }
        catch (error) {
            return false;
        }
    }
    /**
     * Get current HEAD SHA
     */
    getHeadSha() {
        return this.execGit(['rev-parse', 'HEAD']);
    }
    /**
     * Get blob SHA for a file at a specific commit
     * @throws Error if file doesn't exist at the given commit
     */
    getBlobSha(sha, filePath) {
        try {
            const output = this.execGit(['ls-tree', '-r', sha, '--', filePath]);
            const lines = output.trim().split('\n').filter(l => l.trim());
            for (const line of lines) {
                const parsed = this.parseLsTreeLine(line);
                if (parsed && parsed.path === filePath) {
                    return parsed.sha;
                }
            }
            console.warn(`No matching ls-tree entry for ${filePath} at ${sha}`);
            throw new Error(`File ${filePath} not found at commit ${sha}`);
        }
        catch (error) {
            throw new Error(`Failed to get blob SHA for ${filePath} at ${sha}: ${error}`);
        }
    }
    /**
     * Get size of a blob in bytes
     */
    getBlobSize(sha, filePath) {
        try {
            // git cat-file -s <sha>:<path>
            const output = this.execGit(['cat-file', '-s', `${sha}:${filePath}`]);
            return parseInt(output.trim(), 10) || 0;
        }
        catch (error) {
            // If file doesn't exist or other error, return 0 (safe fallback)
            return 0;
        }
    }
    /**
     * Get current branch name (null when detached)
     */
    getCurrentBranch() {
        try {
            const branch = this.execGit(['branch', '--show-current']);
            if (!branch || branch === 'HEAD') {
                return null;
            }
            return branch;
        }
        catch {
            return null;
        }
    }
    /**
     * Get commits reachable from a branch (newest first)
     */
    getBranchCommits(branch, limit = 100) {
        try {
            const output = this.execGit(['log', branch, `--max-count=${limit}`, '--format=%H']);
            return this.parseFileList(output);
        }
        catch {
            return [];
        }
    }
    /**
     * Check if repository is clean (no uncommitted changes)
     */
    isClean() {
        try {
            this.execGit(['diff', '--quiet']);
            this.execGit(['diff', '--cached', '--quiet']);
            return true;
        }
        catch {
            return false;
        }
    }
    /**
     * Get list of changed files in working directory
     */
    /**
     * Execute a git command and return the output via stream (for large outputs)
     */
    async execGitStream(args) {
        return new Promise((resolve, reject) => {
            const git = (0, child_process_1.spawn)('git', args, {
                cwd: this.gitRoot,
                stdio: ['ignore', 'pipe', 'pipe']
            });
            let stdout = '';
            let stderr = '';
            git.stdout.on('data', (data) => {
                stdout += data.toString();
            });
            git.stderr.on('data', (data) => {
                stderr += data.toString();
            });
            git.on('close', (code) => {
                if (code === 0) {
                    // Don't trim() here as it removes leading spaces from first line
                    // which are significant in git status --porcelain output
                    resolve(stdout);
                }
                else {
                    reject(new Error(`Git command failed: git ${args.join(' ')}\n${stderr}`));
                }
            });
            git.on('error', (error) => {
                reject(error);
            });
        });
    }
    /**
     * Get list of changed files in working directory
     */
    async getWorkingDirectoryChanges() {
        try {
            const output = await this.execGitStream(['status', '--porcelain']);
            const changes = [];
            const lines = output.split('\n').filter(line => line.trim());
            for (const line of lines) {
                const status = line.substring(0, 2).trim();
                const filePath = this.parseGitPath(line.substring(3)); // Now consistently parsed like staged/unstaged
                // Map git status codes to our status types
                // Note: checks full 2-char XY for staged+unstaged presence vs charAt(0/1) in split methods
                let changeStatus;
                if (status.includes('A')) {
                    changeStatus = 'A';
                }
                else if (status.includes('M')) {
                    changeStatus = 'M';
                }
                else if (status.includes('D')) {
                    changeStatus = 'D';
                }
                else if (status.includes('R')) {
                    changeStatus = 'R';
                }
                else if (status.includes('C')) {
                    changeStatus = 'C';
                }
                else if (status.includes('U')) {
                    changeStatus = 'U';
                }
                else {
                    changeStatus = 'M'; // Default to modified
                }
                changes.push({
                    path: filePath,
                    status: changeStatus
                });
            }
            return changes;
        }
        catch (error) {
            console.error('Failed to get working directory changes:', error);
            return [];
        }
    }
    /**
     * Parse file path from git status output, handling quoted paths and octal escapes.
     * Call on all line.substring(3) from porcelain output.
     */
    parseGitPath(rawPath) {
        // Git quotes paths with special characters and uses octal escapes
        if (rawPath.startsWith('"') && rawPath.endsWith('"')) {
            // Remove quotes and decode escape sequences
            const unquoted = rawPath.slice(1, -1);
            // Replace octal escapes (e.g., \141 -> 'a')
            return unquoted.replace(/\\(\d{3})/g, (_, oct) => String.fromCharCode(parseInt(oct, 8))).replace(/\\\\/g, '\\'); // Replace \\\\ with \\
        }
        return rawPath;
    }
    /**
     * Parse a single line from git ls-tree output (mode<TAB>type<TAB>sha<TAB>path)
     * Handles paths with spaces correctly using TAB separation.
     */
    parseLsTreeLine(rawLine) {
        const tabIdx = rawLine.lastIndexOf('\t');
        if (tabIdx === -1 || tabIdx < 1)
            return null;
        const path = rawLine.slice(tabIdx + 1);
        const preSha = rawLine.slice(0, tabIdx).trim();
        const preParts = preSha.split(/\s+/); // split on whitespace
        if (preParts.length < 3)
            return null;
        return { mode: preParts[0], type: preParts[1], sha: preParts[2], path };
    }
    /**
     * Check if a git error indicates a missing file path
     * Handles various git error message formats for missing files.
     */
    isGitPathMissing(error) {
        const msg = (error.message || String(error)).toLowerCase();
        return (msg.includes('does not exist') ||
            msg.includes('did not match any file') ||
            msg.includes('exists on disk, but not in') ||
            msg.includes('neither on disk nor in'));
    }
    /**
     * Parse git log output into CommitInfo objects
     * Handles multi-commit and single-commit formats.
     */
    parseLogCommits(rawOutput, mode) {
        const lines = rawOutput.split('\n');
        const blockSize = mode === 'single' ? 4 : 5; // single mode doesn't include parent
        const commits = [];
        for (let i = 0; i < lines.length; i += blockSize) {
            if (!lines[i] || !lines[i].trim())
                continue;
            commits.push({
                sha: lines[i],
                author: lines[i + 1] || '',
                date: lines[i + 2] || '',
                message: lines[i + 3] || '',
                parent: mode === 'multi' ? lines[i + 4] || undefined : undefined
            });
        }
        return mode === 'single' ? commits[0] || null : commits;
    }
    /**
     * Parse git file list output (one file per line)
     * Normalizes whitespace and filters empty lines.
     */
    parseFileList(raw) {
        return raw.trim().split('\n').map(l => l.trim()).filter(Boolean);
    }
    /**
     * Get staged files only
     */
    async getStagedFiles() {
        try {
            const output = await this.execGitStream(['status', '--porcelain']);
            const staged = [];
            const lines = output.split('\n').filter(line => line.trim());
            for (const line of lines) {
                const status = line.substring(0, 2);
                const filePath = this.parseGitPath(line.substring(3));
                // First character indicates staged status (not space, not ?)
                if (status.charAt(0) !== ' ' && status.charAt(0) !== '?') {
                    let changeStatus;
                    if (status.charAt(0) === 'A') {
                        changeStatus = 'A';
                    }
                    else if (status.charAt(0) === 'M') {
                        changeStatus = 'M';
                    }
                    else if (status.charAt(0) === 'D') {
                        changeStatus = 'D';
                    }
                    else if (status.charAt(0) === 'R') {
                        changeStatus = 'R';
                    }
                    else {
                        changeStatus = 'M';
                    }
                    staged.push({
                        path: filePath,
                        status: changeStatus
                    });
                }
            }
            return staged;
        }
        catch (error) {
            console.error('Failed to get staged files:', error);
            return [];
        }
    }
    /**
     * Get unstaged files only (including untracked files)
     */
    async getUnstagedFiles() {
        try {
            const output = await this.execGitStream(['status', '--porcelain']);
            const unstaged = [];
            const lines = output.split('\n').filter(line => line.trim());
            for (const line of lines) {
                const status = line.substring(0, 2);
                const filePath = this.parseGitPath(line.substring(3));
                // Second character indicates unstaged status (not space)
                // Include untracked files (?) as unstaged
                if (status.charAt(1) !== ' ') {
                    let changeStatus;
                    if (status.charAt(1) === 'A') {
                        changeStatus = 'A';
                    }
                    else if (status.charAt(1) === 'M') {
                        changeStatus = 'M';
                    }
                    else if (status.charAt(1) === 'D') {
                        changeStatus = 'D';
                    }
                    else if (status.charAt(1) === 'R') {
                        changeStatus = 'R';
                    }
                    else if (status.charAt(1) === '?') {
                        // Untracked files are considered unstaged
                        changeStatus = 'U';
                    }
                    else {
                        changeStatus = 'M';
                    }
                    unstaged.push({
                        path: filePath,
                        status: changeStatus
                    });
                }
            }
            // Also include untracked files from ls-files
            try {
                const untrackedOutput = await this.execGitStream(['ls-files', '--others', '--exclude-standard']);
                const untrackedFiles = this.parseFileList(untrackedOutput);
                for (const filePath of untrackedFiles) {
                    // Only add if not already in unstaged (avoid duplicates)
                    if (!unstaged.some(f => f.path === filePath)) {
                        unstaged.push({
                            path: filePath,
                            status: 'U' // U = untracked
                        });
                    }
                }
            }
            catch (error) {
                // Silently ignore if ls-files fails (e.g., no untracked files)
            }
            return unstaged;
        }
        catch (error) {
            console.error('Failed to get unstaged files:', error);
            return [];
        }
    }
    /**
     * Get diff stats for a specific file (added/removed lines)
     */
    getFileDiffStats(filePath, staged = false) {
        try {
            const args = staged ? ['diff', '--cached', '--numstat', '--', filePath] : ['diff', '--numstat', '--', filePath];
            const output = this.execGit(args);
            if (!output.trim()) {
                return { added: 0, removed: 0 };
            }
            // --numstat output format: "added<TAB>removed<TAB>file"
            const parts = output.trim().split('\t');
            if (parts.length >= 2) {
                const added = parseInt(parts[0], 10) || 0;
                const removed = parseInt(parts[1], 10) || 0;
                return { added, removed };
            }
            return { added: 0, removed: 0 };
        }
        catch (error) {
            // If git diff fails (e.g., file not tracked), return zero stats
            return { added: 0, removed: 0 };
        }
    }
    /**
     * Spawn a git command asynchronously
     */
    async spawnGit(args) {
        return new Promise((resolve, reject) => {
            const git = (0, child_process_1.spawn)('git', args, {
                cwd: this.gitRoot,
                stdio: ['pipe', 'pipe', 'pipe']
            });
            let stdout = '';
            let stderr = '';
            git.stdout.on('data', (data) => {
                stdout += data.toString();
            });
            git.stderr.on('data', (data) => {
                stderr += data.toString();
            });
            git.on('close', (code) => {
                if (code === 0) {
                    resolve({ stdout, stderr });
                }
                else {
                    reject(new Error(`Git command failed with code ${code}: ${stderr}`));
                }
            });
            git.on('error', (error) => {
                reject(error);
            });
        });
    }
}
exports.GitOperations = GitOperations;
