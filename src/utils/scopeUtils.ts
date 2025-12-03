/**
 * Centralized utilities for deriving analysis scope from UI modes and bundle config.
 * This ensures consistent scope determination across MessageController, Effects, and ReportService.
 */

export type AnalysisScope = 'full' | 'staged' | 'unstaged' | 'partial';
export type WorkspaceScope = 'workspace' | 'staged' | 'unstaged';
export type GenerateReportMode = 'selection' | 'lastN' | 'staged' | 'unstaged' | 'changes';
export type BundleConfigMode = 'repo' | 'module' | 'changes' | 'custom';

/**
 * Derive workspace scope from generateReport mode.
 * This is used in MessageController to set workspaceScope state.
 */
export function deriveWorkspaceScopeFromMode(mode: GenerateReportMode | undefined): WorkspaceScope {
  if (mode === 'staged') return 'staged';
  if (mode === 'unstaged') return 'unstaged';
  return 'workspace'; // Default for 'changes', 'selection', 'lastN', or undefined
}

/**
 * Derive analysis scope from workspace scope and bundle config mode.
 * This is used in Effects to determine the final scope passed to ReportService.
 */
export function deriveAnalysisScope(
  workspaceScope: WorkspaceScope,
  bundleConfigMode?: BundleConfigMode
): AnalysisScope {
  const isChangesMode = bundleConfigMode === 'changes';

  // Respect "changes" mode by forcing full workspace analysis
  const effectiveWorkspaceScope = isChangesMode ? 'workspace' : workspaceScope;

  if (effectiveWorkspaceScope === 'staged') return 'staged';
  if (effectiveWorkspaceScope === 'unstaged') return 'unstaged';
  return 'full'; // Default for 'workspace' or changes mode
}

/**
 * Check if we should force workspace-only analysis (no history backfill).
 */
export function shouldForceWorkspaceOnly(bundleConfigMode?: BundleConfigMode): boolean {
  return bundleConfigMode === 'changes';
}
