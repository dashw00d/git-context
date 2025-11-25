import * as fs from 'fs';
import * as path from 'path';
import { getGitRoot } from '../utils/config';
import { logInfo } from '../utils/logger';

export async function installHooks(): Promise<void> {
  const gitRoot = getGitRoot();
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
  # Analyze the current HEAD commit
  "$CLI_PATH" analyze-commit HEAD >/dev/null 2>&1 &
fi
`;

  // Write hook file
  fs.writeFileSync(postCommitHook, hookContent, { mode: 0o755 });
  logInfo(`Installed post-commit hook at: ${postCommitHook}`);

  // Install post-checkout hook (optional - for branch switching)
  const postCheckoutHook = path.join(hooksDir, 'post-checkout');
  const postCheckoutContent = `#!/bin/sh
# Git Context post-checkout hook
# Refresh analysis when switching branches

# Get the path to the CLI tool
CLI_PATH="$(dirname "$0")/../../node_modules/.bin/ct"

if [ -x "$CLI_PATH" ]; then
  # Refresh metadata for current branch (non-blocking)
  "$CLI_PATH" analyze -c 1 >/dev/null 2>&1 &
fi
`;
  fs.writeFileSync(postCheckoutHook, postCheckoutContent, { mode: 0o755 });
  logInfo(`Installed post-checkout hook at: ${postCheckoutHook}`);

  // Install post-merge hook (optional - for pulling updates)
  const postMergeHook = path.join(hooksDir, 'post-merge');
  const postMergeContent = `#!/bin/sh
# Git Context post-merge hook
# Analyze new commits after merge/pull

# Get the path to the CLI tool
CLI_PATH="$(dirname "$0")/../../node_modules/.bin/ct"

if [ -x "$CLI_PATH" ]; then
  # Analyze new commits (non-blocking)
  "$CLI_PATH" analyze -c 5 >/dev/null 2>&1 &
fi
`;
  fs.writeFileSync(postMergeHook, postMergeContent, { mode: 0o755 });
  logInfo(`Installed post-merge hook at: ${postMergeHook}`);
}

export async function uninstallHooks(): Promise<void> {
  const gitRoot = getGitRoot();
  if (!gitRoot) {
    throw new Error('Not in a git repository');
  }

  const hooksDir = path.join(gitRoot, '.git', 'hooks');
  const postCommitHook = path.join(hooksDir, 'post-commit');
  const postCheckoutHook = path.join(hooksDir, 'post-checkout');
  const postMergeHook = path.join(hooksDir, 'post-merge');

  if (fs.existsSync(postCommitHook)) {
    fs.unlinkSync(postCommitHook);
    logInfo('Uninstalled post-commit hook');
  }

  if (fs.existsSync(postCheckoutHook)) {
    fs.unlinkSync(postCheckoutHook);
    logInfo('Uninstalled post-checkout hook');
  }

  if (fs.existsSync(postMergeHook)) {
    fs.unlinkSync(postMergeHook);
    logInfo('Uninstalled post-merge hook');
  }
}
