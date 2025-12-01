/**
 * Convert version string to human-readable position in timeline
 */
export function describeVersionPosition(version: string, timeline: string[]): string {
  const index = timeline.findIndex(v => v === version);
  if (index === -1) return version;

  if (index === 0) return 'newest (unstaged)';
  if (version === 'workspace-staged') return 'staged changes';
  if (version === 'HEAD') return 'current commit';

  const distance = timeline.length - index - 1;
  return `${distance} version${distance === 1 ? '' : 's'} ago (${version.substring(0, 7)})`;
}
