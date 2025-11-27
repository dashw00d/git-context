import { ensureDatabaseInitialized, getDatabaseManager } from './src/storage/database';
import { GitOperations } from './src/analysis/git';
import { DependencyExtractor } from './src/analysis/dependencies';

// Simple debug test to isolate the hanging issue
async function debugTest() {
  console.log('=== DEBUG TEST START ===');

  try {
    console.log('Initializing database...');
    await ensureDatabaseInitialized();
    const dbManager = getDatabaseManager();
    const db = dbManager.getDatabase();
    console.log('Database initialized');

    const git = new GitOperations();
    console.log('Git operations initialized');

    console.log('Getting unstaged files...');
    const unstagedFiles = await git.getUnstagedFiles();
    console.log(`Found ${unstagedFiles.length} unstaged files:`);
    unstagedFiles.slice(0, 5).forEach(f => console.log(`  ${f.status} ${f.path}`));

    console.log('Testing workspace hash computation...');
    // Import WorkspaceIndexer to test the computeWorkspaceHash method
    const { SymbolExtractor } = await import('./src/analysis/symbols');
    const symbolExtractor = new SymbolExtractor(git);
    console.log('SymbolExtractor initialized');

    const { SnapshotManager } = await import('./src/analysis/snapshotManager');
    const dependencyExtractor = new DependencyExtractor();
    const snapshotManager = new SnapshotManager(db, symbolExtractor, dependencyExtractor);
    console.log('SnapshotManager initialized');

    const { StructuralDiffManager } = await import('./src/analysis/structuralDiffManager');
    const structuralDiffManager = new StructuralDiffManager(db);
    console.log('StructuralDiffManager initialized');

    const { WorkspaceIndexer } = await import('./src/analysis/workspaceIndexer');
    const workspaceIndexer = new WorkspaceIndexer(db, git, snapshotManager, structuralDiffManager);
    console.log('WorkspaceIndexer initialized');

    console.log('Starting workspace analysis...');
    const startTime = Date.now();
    const result = await workspaceIndexer.analyzeWorkspace('unstaged');
    const endTime = Date.now();

    console.log(`✓ Workspace analysis completed in ${(endTime - startTime)/1000}s`);
    if (result) {
      console.log(`Result: ${result.symbolsAdded}+ ${result.symbolsModified}~ ${result.symbolsRemoved}- symbols`);
    } else {
      console.log('No changes found');
    }

  } catch (error) {
    console.error('Error:', error);
  }

  console.log('=== DEBUG TEST END ===');
}

debugTest().catch(console.error);
