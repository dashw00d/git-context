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
    /**
     * Execute a git command and return the output
     */
    execGit(args) {
        try {
            return (0, child_process_1.execSync)(`git ${args.join(' ')}`, {
                cwd: this.gitRoot,
                encoding: 'utf8',
                maxBuffer: 1024 * 1024 * 10 // 10MB buffer
            }).trim();
        }
        catch (error) {
            throw new Error(`Git command failed: git ${args.join(' ')}\n${error.message}`);
        }
    }
    /**
     * Get basic commit information
     */
    getCommitInfo(sha) {
        const format = '--pretty=format:%H%n%an%n%ad%n%s%n%p';
        const output = this.execGit(['show', '--no-patch', '--date=iso', format, sha]);
        const lines = output.split('\n');
        if (lines.length < 4) {
            throw new Error(`Invalid commit format for SHA: ${sha}`);
        }
        return {
            sha: lines[0],
            author: lines[1],
            date: lines[2],
            message: lines[3],
            parent: lines[4] || undefined
        };
    }
    /**
     * Get list of commits (newest first)
     */
    getRecentCommits(count = 5) {
        const format = '--pretty=format:%H%n%an%n%ad%n%s%n%p';
        const output = this.execGit(['log', '--no-merges', `-${count}`, '--date=iso', format]);
        const commits = [];
        const lines = output.split('\n');
        for (let i = 0; i < lines.length; i += 5) {
            if (lines[i]) {
                commits.push({
                    sha: lines[i],
                    author: lines[i + 1],
                    date: lines[i + 2],
                    message: lines[i + 3],
                    parent: lines[i + 4] || undefined
                });
            }
        }
        return commits;
    }
    /**
     * Get file changes for a commit
     */
    getFileChanges(sha) {
        const output = this.execGit(['show', '--name-status', '--pretty=format:', sha]);
        const changes = [];
        const lines = output.split('\n').filter(line => line.trim());
        for (const line of lines) {
            const parts = line.split('\t');
            if (parts.length >= 2) {
                const status = parts[0];
                const filePath = parts[1];
                let oldPath;
                // Handle renamed files
                if (status.startsWith('R')) {
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
     * Get current HEAD SHA
     */
    getHeadSha() {
        return this.execGit(['rev-parse', 'HEAD']);
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
    getWorkingDirectoryChanges() {
        const output = this.execGit(['status', '--porcelain']);
        const changes = [];
        const lines = output.split('\n').filter(line => line.trim());
        for (const line of lines) {
            const status = line.substring(0, 2).trim();
            const filePath = line.substring(3);
            // Map git status codes to our status types
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
//# sourceMappingURL=git.js.map