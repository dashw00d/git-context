import { promises as fs } from 'fs';
import * as path from 'path';
import { getGitCacheService } from '../../../services/gitCacheService';
import { getGitRoot } from '../../../utils/config';
import { logDebug, logInfo, logWarn } from '../../../utils/logger';
import { PipelineState, PipelineStep } from '../pipelineTypes';
import { updateState } from './utils';

const MAX_FILE_SIZE_BYTES = 1024 * 1024; // 1MB

export function createSizeStep(): PipelineStep {
  return {
    id: 'size',
    label: 'Filter large files',
    deps: ['scope'],

    async run(state: PipelineState) {
      if (!state.scope?.allPaths) {
        logWarn('[SizeStep] No scope paths to check');
        return;
      }

      logDebug('⚖️ [SizeStep] Starting size check');
      const startTime = Date.now();
      const cacheService = getGitCacheService();

      const allPaths = Array.from(state.scope.allPaths);
      const itemsToWarm: { sha: string; path: string }[] = [];
      const workingFiles: string[] = [];

      // 1. Identify which files need git size check vs fs.stat
      for (const filePath of allPaths) {
        const version = state.scope.fileVersionMap?.get(filePath);

        if (version && version !== 'workspace-unstaged' && version !== 'workspace-staged') {
          itemsToWarm.push({ sha: version, path: filePath });
        } else {
          workingFiles.push(filePath);
        }
      }

      // 2. Warm git sizes
      if (itemsToWarm.length > 0) {
        await cacheService.warmSizeCacheForItems(itemsToWarm);
      }

      // 3. Check sizes and filter
      const validPaths = new Set<string>();
      let filteredCount = 0;
      const gitRoot = getGitRoot();

      // Check git files
      for (const item of itemsToWarm) {
        const size = cacheService.getSize(item.sha, item.path);
        if (size !== undefined && size <= MAX_FILE_SIZE_BYTES) {
          validPaths.add(item.path);
        } else {
          if (size !== undefined) {
            logDebug(`[SizeStep] Filtering large file: ${item.path} (${size} bytes)`);
            filteredCount++;
          } else {
            logDebug(`[SizeStep] Filtering missing size: ${item.path}`);
            filteredCount++;
          }
        }
      }

      // Check working files
      if (workingFiles.length > 0 && !gitRoot) {
        logWarn('[SizeStep] Cannot check working files: git root not found');
      }

      for (const filePath of workingFiles) {
        try {
          const fullPath = path.join(gitRoot || process.cwd(), filePath);
          const stats = await fs.stat(fullPath);
          if (stats.size <= MAX_FILE_SIZE_BYTES) {
            validPaths.add(filePath);
          } else {
            logDebug(`[SizeStep] Filtering large working file: ${filePath} (${stats.size} bytes)`);
            filteredCount++;
          }
        } catch (error) {
          logDebug(`[SizeStep] Failed to stat working file: ${filePath}`);
          filteredCount++;
        }
      }

      // 4. Update scope
      if (filteredCount > 0) {
        logInfo(`[SizeStep] Filtered ${filteredCount} large files (>1MB)`);

        const newScope = { ...state.scope };
        newScope.allPaths = validPaths;
        newScope.commitFiles = new Set([...newScope.commitFiles].filter(p => validPaths.has(p)));
        newScope.workingChanged = new Set(
          [...newScope.workingChanged].filter(p => validPaths.has(p))
        );
        newScope.stagedFiles = new Set([...newScope.stagedFiles].filter(p => validPaths.has(p)));
        newScope.unstagedFiles = new Set(
          [...newScope.unstagedFiles].filter(p => validPaths.has(p))
        );
        newScope.blastRadius = new Set([...newScope.blastRadius].filter(p => validPaths.has(p)));

        updateState(state, 'scope', newScope);
      } else {
        logDebug('[SizeStep] No files filtered');
      }

      logInfo(`⚖️ [SizeStep] Completed in ${Date.now() - startTime}ms`);
    },
  };
}
