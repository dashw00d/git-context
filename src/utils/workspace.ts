export function makeWorkspaceSha(
  mode: 'staged' | 'unstaged',
  branch: string | null | undefined
): string {
  const normalizedBranch = branch || 'detached';
  return `workspace-${mode}@${normalizedBranch}`;
}

export function parseWorkspaceSha(
  sha: string
): { mode: 'staged' | 'unstaged'; branch: string } | null {
  const match = sha.match(/^workspace-(staged|unstaged)(?:@(.+))?$/);
  if (!match) {
    return null;
  }
  return {
    mode: match[1] as 'staged' | 'unstaged',
    branch: match[2] || 'detached',
  };
}

export function isWorkspaceSha(sha: string): boolean {
  return /^workspace-(staged|unstaged)(@.+)?$/.test(sha);
}
