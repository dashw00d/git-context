import { BundleConfig } from '../types/cockpit';

/**
 * Normalize bundle config loaded from workspace settings or webview to match schema.
 */
export function normalizeBundleConfig(config: any): BundleConfig {
  const mode: BundleConfig['mode'] = ['repo', 'module', 'changes', 'custom'].includes(config?.mode)
    ? config.mode
    : 'repo';

  const roots =
    Array.isArray(config?.roots) && config.roots.every((r: any) => typeof r === 'string')
      ? (config.roots as string[])
      : typeof config?.roots === 'string'
        ? [config.roots]
        : [];

  const exclusions =
    Array.isArray(config?.exclusions) && config.exclusions.every((e: any) => typeof e === 'string')
      ? (config.exclusions as string[])
      : typeof config?.exclusions === 'string'
        ? [config.exclusions]
        : [];

  const includeConnected =
    typeof config?.includeConnected === 'boolean' ? config.includeConnected : false;

  return {
    mode,
    roots,
    includeConnected,
    exclusions,
  };
}
