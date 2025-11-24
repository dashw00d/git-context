import * as fs from 'fs';
import * as path from 'path';
import { getGitRoot } from '../utils/config';

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
  console.log(`Installed post-commit hook at: ${postCommitHook}`);

  // TODO: Optionally install post-checkout and post-merge hooks
}

export async function uninstallHooks(): Promise<void> {
  const gitRoot = getGitRoot();
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
