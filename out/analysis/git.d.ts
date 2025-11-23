import { CommitInfo, FileChange } from '../types';
export declare class GitOperations {
    private gitRoot;
    constructor();
    /**
     * Execute a git command and return the output
     */
    private execGit;
    /**
     * Get basic commit information
     */
    getCommitInfo(sha: string): CommitInfo;
    /**
     * Get list of commits (newest first)
     */
    getRecentCommits(count?: number): CommitInfo[];
    /**
     * Get file changes for a commit
     */
    getFileChanges(sha: string): FileChange[];
    /**
     * Get raw diff for a commit
     */
    getCommitDiff(sha: string): string;
    /**
     * Get staged changes diff
     */
    getStagedDiff(): string;
    /**
     * Get file content at specific commit
     */
    getFileContent(sha: string, filePath: string): string;
    /**
     * Get current HEAD SHA
     */
    getHeadSha(): string;
    /**
     * Check if repository is clean (no uncommitted changes)
     */
    isClean(): boolean;
    /**
     * Get list of changed files in working directory
     */
    getWorkingDirectoryChanges(): FileChange[];
    /**
     * Spawn a git command asynchronously
     */
    spawnGit(args: string[]): Promise<{
        stdout: string;
        stderr: string;
    }>;
}
//# sourceMappingURL=git.d.ts.map