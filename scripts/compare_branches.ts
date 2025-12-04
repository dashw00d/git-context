import * as fs from 'fs';
import * as path from 'path';
import { GitOperations } from '../src/analysis/git';
import { getDifftasticIntegration } from '../src/analysis/difftastic';
import { logInfo, logError } from '../src/utils/logger';

async function runComparison() {
  const git = new GitOperations();
  const difftastic = getDifftasticIntegration();

  // 1. Identify the comparison points
  const theirSha = 'origin/master'; 
  const ourSha = 'HEAD';

  console.log(`Comparing ${theirSha} (Theirs) -> ${ourSha} (Ours)...`);

  // 2. Get list of changed files
  const diffOutput = await git.spawnGit(['diff', '--name-only', theirSha, ourSha]);
  const files = diffOutput.stdout.split('\n').filter(f => f.trim() && (f.endsWith('.ts') || f.endsWith('.tsx')));

  console.log(`Found ${files.length} changed TypeScript files.`);

  const results: any[] = [];

  for (const filePath of files) {
    try {
      // Get content from 'Theirs' (origin/master)
      const theirContent = await git.safeGetFileContent(theirSha, filePath);
      
      // Get content from 'Ours' (HEAD)
      const ourContent = await git.safeGetFileContent(ourSha, filePath);

      if (!theirContent || !ourContent) {
        // This means the file was either added or deleted in one of the branches.
        // If theirContent is null/empty and ourContent exists, it was deleted in theirs.
        // If ourContent is null/empty and theirContent exists, it was deleted in ours.
        // Difftastic can't compare if one side is missing.
        // For this audit, we care about structural changes between existing files.
        // So, we'll log it and skip for Difftastic, but note this is a difference.
        if (!theirContent && ourContent) {
            console.log(`[!] File ${filePath} exists in Ours but not in Theirs (added in Ours)`);
        } else if (theirContent && !ourContent) {
            console.log(`[!] File ${filePath} exists in Theirs but not in Ours (deleted in Ours)`);
        } else {
            console.log(`[!] File ${filePath} could not be retrieved from one or both branches, skipping structural diff.`);
        }
        continue;
      }

      const result = await difftastic.runDifftastic(theirContent, ourContent, filePath, filePath);

      if (result.hasStructuralChanges) {
        results.push({
          file: filePath,
          highlights: result.highlights.length,
          details: result.highlights
        });
        console.log(`[!] Structural difference in ${filePath}`);
      } else {
        // console.log(`[OK] No structural difference in ${filePath}`);
      }

    } catch (error) {
      console.error(`Error processing ${filePath}:`, error);
    }
  }

  // 3. Write Report
  const reportPath = 'structural_diff_report.json';
  fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));
  console.log(`\nReport written to ${reportPath}`);
  console.log(`Found ${results.length} files with structural differences.`);
}

runComparison().catch(console.error);
