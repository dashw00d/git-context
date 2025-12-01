import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { GitOperations } from '../analysis/git';
import { AppShell } from '../core/appShell';
import { refreshCockpitState, updateContexts } from '../core/stateUpdaters';
import { ActiveBundleProvider } from '../providers/activeBundleProvider';
import { CommitsProvider } from '../providers/commitsProvider';
import { SymbolHistoryProvider } from '../providers/symbolHistoryProvider';
import { getStore } from '../state/store';
import { prepare } from '../storage/statement-wrapper';
import { getExtensionConfig } from '../utils/config';
import { logError, logInfo } from '../utils/logger';
import { RefactorReportProvider } from '../webview/reports/refactorReportProvider';

export async function registerCoreFeatures(
  shell: AppShell,
  providers: {
    commitsProvider: CommitsProvider;
    activeBundleProvider: ActiveBundleProvider;
    symbolHistoryProvider: SymbolHistoryProvider;
    cockpitProvider?: any;
    refactorReportProvider?: RefactorReportProvider;
  }
): Promise<void> {
  const orchestrator = shell.getOrchestrator();
  const store = getStore();

  // Analyze last N commits
  shell.registerCommand('git-context.analyzeLastCommits', async (context, countArg) => {
    const config = getExtensionConfig();
    const count =
      countArg ||
      (await vscode.window.showInputBox({
        prompt: 'Number of commits to analyze',
        value: config.defaultCommitCount.toString(),
        validateInput: value => {
          const num = parseInt(value);
          if (isNaN(num) || num <= 0) {
            return 'Please enter a positive number';
          }
          return undefined;
        },
      }));

    if (count) {
      try {
        await providers.commitsProvider.initializeDatabase();
        const git = new GitOperations();
        const commits = await git.getRecentCommits(parseInt(count));
        const shas = commits.map(c => c.sha);

        if (shas.length === 0) {
          vscode.window.showInformationMessage('No commits found to analyze');
          return;
        }

        // Update selection so Cockpit reflects the chosen commits
        store.dispatch({ type: 'SELECTION_SET', payload: { shas } });

        // Run full pipeline (index + analyze bundle)
        await vscode.commands.executeCommand('git-context.analyze');
      } catch (error) {
        vscode.window.showErrorMessage(`Failed to analyze commits: ${error}`);
      }
    }
  });

  // Open symbol in file
  shell.registerCommand('git-context.openSymbol', async (context, sha, filePath, range) => {
    try {
      const { getGitRoot } = await import('../utils/config');
      const gitRoot = getGitRoot();
      if (!gitRoot) {
        vscode.window.showErrorMessage('Not in a git repository');
        return;
      }
      const fullPath = vscode.Uri.file(`${gitRoot}/${filePath}`);
      const doc = await vscode.workspace.openTextDocument(fullPath);
      const editor = await vscode.window.showTextDocument(doc);
      if (range) {
        editor.selection = new vscode.Selection(range.start, range.end);
        editor.revealRange(range, vscode.TextEditorRevealType.InCenter);
      }
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to open file: ${error}`);
    }
  });

  // Toggle commit selection
  shell.registerCommand('git-context.toggleCommitSelection', async (context, shaOrItem) => {
    const sha = typeof shaOrItem === 'string' ? shaOrItem : shaOrItem?.id || shaOrItem?.sha;
    if (sha) {
      // Update orchestrator state instead of provider
      const state = store.getState();
      const selected = new Set(state.selectedCommitShas);
      if (selected.has(sha)) {
        selected.delete(sha);
      } else {
        selected.add(sha);
      }
      store.dispatch({
        type: 'SELECTION_SET',
        payload: { shas: Array.from(selected) },
      });
      await updateContexts();
    }
  });

  // Clear selection
  shell.registerCommand('git-context.clearSelection', async _context => {
    store.dispatch({ type: 'SELECTION_CLEARED' });
    await updateContexts();
  });

  // Copy SHA
  shell.registerCommand('git-context.copySha', async (context, sha) => {
    await vscode.env.clipboard.writeText(sha);
    vscode.window.showInformationMessage(`Copied SHA: ${sha.substring(0, 8)}`);
  });

  // Add commit by SHA
  shell.registerCommand('git-context.addCommitBySha', async (context, shaOrRef) => {
    try {
      let sha = shaOrRef;
      // Simple validation - if it looks like a SHA, use it
      if (!/^[0-9a-f]{7,40}$/i.test(shaOrRef)) {
        // Try to resolve as a ref using git command
        const { GitOperations } = await import('../analysis/git');
        try {
          const git = new GitOperations();
          const simpleGit = require('simple-git');
          const gitRoot = git.getRoot();
          const gitInstance = simpleGit(gitRoot);
          sha = await gitInstance.revparse([shaOrRef]);
        } catch {
          vscode.window.showErrorMessage(`Could not resolve ref: ${shaOrRef}`);
          return;
        }
      }
      if (sha) {
        const state = store.getState();
        const selected = new Set(state.selectedCommitShas);
        selected.add(sha);
        store.dispatch({
          type: 'SELECTION_SET',
          payload: { shas: Array.from(selected) },
        });
        await updateContexts();
      }
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to add commit: ${error}`);
    }
  });

  // Select all staged
  shell.registerCommand('git-context.selectAllStaged', async _context => {
    const state = store.getState();
    const stagedPaths = state.stagedFiles.map(f => f.path);
    store.dispatch({
      type: 'STAGED_SELECTION_UPDATED',
      payload: { paths: stagedPaths },
    });
  });

  // Select all unstaged
  shell.registerCommand('git-context.selectAllUnstaged', async _context => {
    const state = store.getState();
    const unstagedPaths = state.unstagedFiles.map(f => f.path);
    store.dispatch({
      type: 'UNSTAGED_SELECTION_UPDATED',
      payload: { paths: unstagedPaths },
    });
  });

  // Add more commits
  shell.registerCommand('git-context.addMoreCommits', async _context => {
    try {
      providers.commitsProvider.loadMoreOffset += 20;
      await providers.commitsProvider.refresh();
      await refreshCockpitState(orchestrator, providers, 'command:addMoreCommits');
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to load more commits: ${error}`);
    }
  });

  // Reset all
  shell.registerCommand('git-context.resetAll', async _context => {
    // If cockpit features already registered this command, prefer a single path.
    // This registration provides the full reset (vectors + DB + orchestrator).
    const answer = await vscode.window.showWarningMessage(
      'Are you sure you want to reset all data? This will clear the database, vector index, and cache.',
      { modal: true },
      'Yes',
      'No'
    );

    if (answer !== 'Yes') {
      return;
    }

    try {
      // Clear vectors
      try {
        const { getQdrantClient } = await import('../storage/qdrantClient');
        const qdrant = getQdrantClient();
        if (await qdrant.isEnabled()) {
          const client = await qdrant.getClient();
          if (client) {
            const collections = await client.getCollections();
            for (const collection of collections.collections) {
              await client.deleteCollection(collection.name);
              logInfo(`[Reset] Deleted vector collection: ${collection.name}`);
            }
          }
        }
      } catch (e) {
        logError('Failed to clear vectors', e);
      }

      // Clear database tables (except migration log)
      const { getDatabaseManager: _getDatabaseManager } = await import('../storage/database');
      const dbManager = _getDatabaseManager();
      const db = dbManager.getDatabase();
      const tablesToTruncate = [
        'commits_metadata',
        'branches',
        'squash_mappings',
        'symbol_dna',
        'symbol_history',
        'dna_decision_log',
        'file_snapshots',
        'structural_diffs',
        'workspace_analysis',
        'hybrid_facts',
        'reports',
        'file_hotspots',
        'symbol_hotspots',
        'hotspot_snapshots',
        'moved_blocks',
        'symbol_lineage',
      ];

      db.transaction(() => {
        for (const table of tablesToTruncate) {
          try {
            const exists = prepare(
              `SELECT name FROM sqlite_master WHERE type='table' AND name=?`
            ).get(table);
            if (exists) {
              // eslint-disable-next-line no-restricted-properties
              db.exec(`DELETE FROM ${table}`);
              // eslint-disable-next-line no-restricted-properties
              db.exec(`DELETE FROM sqlite_sequence WHERE name='${table}'`);
            }
          } catch (err) {
            logError(`[Reset] Failed to truncate table ${table}`, err);
          }
        }
      })();

      orchestrator.reset(undefined, 'command:resetAll');
      providers.commitsProvider.loadMoreOffset = 0;
      await providers.commitsProvider.refresh();
      if (providers.activeBundleProvider) {
        providers.activeBundleProvider.refresh();
      }
      if (providers.symbolHistoryProvider) {
        providers.symbolHistoryProvider.refresh();
      }
      await updateContexts();
      await refreshCockpitState(orchestrator, providers, 'command:resetAll');

      vscode.window.showInformationMessage('System reset successfully');
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to reset system: ${error}`);
      logError('System reset failed', error);
    }
  });

  // Bundle clear
  shell.registerCommand('git-context.bundle.clear', async _context => {
    store.dispatch({ type: 'BUNDLE_CLEARED' });
    // Clear bundle state (provider method may not exist, that's ok)
    await updateContexts();
  });

  // Bundle cancel
  shell.registerCommand('git-context.bundle.cancel', async _context => {
    // Cancel any running analysis
    store.dispatch({ type: 'ANALYSIS_CANCELLED' });
  });

  // Bundle export
  shell.registerCommand('git-context.bundle.export', async _context => {
    const state = orchestrator.getState();
    if (!state.bundleFacts) {
      vscode.window.showWarningMessage('No active bundle to export');
      return;
    }
    try {
      const filePath = await vscode.window.showSaveDialog({
        defaultUri: vscode.Uri.file('bundle-facts.json'),
        filters: { 'JSON files': ['json'], 'All files': ['*'] },
      });
      if (filePath) {
        const fs = await import('fs');
        fs.writeFileSync(filePath.fsPath, JSON.stringify(state.bundleFacts, null, 2));
        vscode.window.showInformationMessage(`Bundle exported to ${filePath.fsPath}`);
      }
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to export bundle: ${error}`);
    }
  });

  // Scroll to report section
  shell.registerCommand('git-context.scrollToReportSection', async (_context, sectionId) => {
    // Forward to report webview
    logInfo(`Scroll to section: ${sectionId}`);
  });

  // Open symbol history
  shell.registerCommand('git-context.openSymbolHistory', async (_context, symbolId) => {
    try {
      // Show symbol history in a new document
      const { getDatabaseManager: _getDatabaseManager } = await import('../storage/database');
      const history = prepare(`
        SELECT sha, name, path, change_type, diff_snippet_post
        FROM symbols
        WHERE symbol_id = ?
        ORDER BY id DESC
        LIMIT 20
      `).all(symbolId);

      const content = `# Symbol History: ${symbolId}\n\n${history
        .map(
          (h: any) =>
            `## ${h.sha.substring(0, 8)} - ${h.change_type}\n\`\`\`\n${
              h.diff_snippet_post || 'N/A'
            }\n\`\`\`\n`
        )
        .join('\n')}`;

      const doc = await vscode.workspace.openTextDocument({
        content,
        language: 'markdown',
      });
      await vscode.window.showTextDocument(doc);
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to show symbol history: ${error}`);
    }
  });

  // Download WASM files
  shell.registerCommand('git-context.downloadWasmFiles', async _context => {
    try {
      const { spawn } = require('child_process');
      const path = require('path');

      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: 'Downloading required WASM files...',
          cancellable: false,
        },
        async progress => {
          return new Promise<void>((resolve, reject) => {
            const scriptPath = path.join(__dirname, '..', '..', 'scripts', 'download-wasm.js');
            const nodeProcess = spawn('node', [scriptPath], {
              cwd: path.join(__dirname, '..', '..'),
              stdio: 'pipe',
            });

            let output = '';
            nodeProcess.stdout.on('data', (data: Buffer) => {
              output += data.toString();
              const lines = data
                .toString()
                .split('\n')
                .filter((l: string) => l.trim());
              lines.forEach((line: string) => {
                if (
                  line.includes('Downloading') ||
                  line.includes('Downloaded') ||
                  line.includes('%')
                ) {
                  progress.report({ message: line });
                }
              });
            });

            nodeProcess.stderr.on('data', (data: Buffer) => {
              output += data.toString();
            });

            nodeProcess.on('close', (code: number) => {
              if (code === 0) {
                vscode.window.showInformationMessage('WASM files downloaded successfully!');
                resolve();
              } else {
                vscode.window.showErrorMessage(`Failed to download WASM files: ${output}`);
                reject(new Error(`Process exited with code ${code}`));
              }
            });
          });
        }
      );
    } catch (error) {
      logError('Failed to download WASM files:', error);
      vscode.window.showErrorMessage(`Failed to download WASM files: ${error}`);
    }
  });

  // Super Report (facts-first, zoomable prototype)
  shell.registerCommand('git-context.superReport', async () => {
    try {
      // Try to get facts from orchestrator first
      const state = orchestrator.getState();
      let facts: any = state.bundleFacts;

      // Fallback: load last-bundle-facts.json from .git/commit-tracker
      if (!facts) {
        try {
          const gitRoot = (await import('../utils/config')).getGitRoot();
          if (gitRoot) {
            const factsPath = path.join(
              gitRoot,
              '.git',
              'commit-tracker',
              'last-bundle-facts.json'
            );
            if (fs.existsSync(factsPath)) {
              const content = fs.readFileSync(factsPath, 'utf8');
              facts = JSON.parse(content);
            }
          }
        } catch (error) {
          logError('[SuperReport] Failed to load last-bundle-facts.json', error);
        }
      }

      if (!facts) {
        vscode.window.showInformationMessage('No bundle facts available. Run an analysis first.');
        return;
      }

      const panel = vscode.window.createWebviewPanel(
        'gitContextSuperReport',
        'Git Context: Super Report',
        vscode.ViewColumn.Active,
        { enableScripts: true }
      );

      const files: string[] = (facts.evidence?.['scope.files'] as string[]) || [];
      const factsJson = JSON.stringify(facts);
      const filesJson = JSON.stringify(files);

      panel.webview.html = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: #e8e8e8; background: #0f1115; padding: 12px; }
            .layout { display: grid; grid-template-columns: 260px 1fr; gap: 12px; height: 90vh; }
            .panel { background: #14171c; border: 1px solid #1e232b; border-radius: 6px; padding: 10px; overflow: auto; }
            h2, h3 { margin: 6px 0; }
            select { background: #0f1115; color: #e8e8e8; border: 1px solid #1e232b; border-radius: 4px; padding: 6px 8px; width: 100%; }
            .section { margin-bottom: 12px; }
            .table { width: 100%; border-collapse: collapse; font-size: 12px; }
            .table th, .table td { padding: 6px 8px; border-bottom: 1px solid #1e232b; text-align: left; }
            .muted { color: #8a8f98; font-size: 11px; }
          </style>
        </head>
        <body>
          <div class="layout">
            <div class="panel">
              <h3>Scope</h3>
              <div class="section">
                <div class="muted">Files</div>
                <select id="fileSelect">
                  <option value="__all">All files</option>
                </select>
              </div>
              <div class="section">
                <div class="muted">Summary</div>
                <div id="summary"></div>
              </div>
            </div>
            <div class="panel" id="content">
              <h2>Super Report</h2>
              <div id="timeline" class="section"></div>
              <div id="incompleteness" class="section"></div>
              <div id="drift" class="section"></div>
              <div id="legacy" class="section"></div>
              <div id="unresolved" class="section"></div>
              <div id="hotspots" class="section"></div>
            </div>
          </div>
          <script>
            const facts = ${factsJson};
            const files = ${filesJson};

            const fileSelect = document.getElementById('fileSelect');
            files.forEach(f => {
              const opt = document.createElement('option');
              opt.value = f;
              opt.textContent = f;
              fileSelect.appendChild(opt);
            });

            const summaryEl = document.getElementById('summary');
            summaryEl.innerHTML = [
              'Commits: ' + facts.bundle.shas.length,
              'Files: ' + facts.scope.files,
              'Symbols: ' + facts.working.symbols,
              'Edges: ' + facts.working.edges
            ].join('<br>');

            function filterByFile(list, filePath) {
              if (!filePath || filePath === '__all') return list || [];
              return (list || []).filter(item => {
                const sid = item.symbol_id || item.path || '';
                return typeof sid === 'string' && sid.startsWith(filePath);
              });
            }

            function renderTimeline() {
              const el = document.getElementById('timeline');
              el.innerHTML = '<h3>Timeline</h3>' + facts.bundle.shas.map((sha, idx) => {
                return '<div>' + (idx + 1) + '. <code>' + sha.substring(0, 8) + '</code></div>';
              }).join('');
            }

            function renderIncompleteness(filePath) {
              const el = document.getElementById('incompleteness');
              const missing = filterByFile(facts.evidence?.['findings.incompleteness.missing'], filePath);
              const zombies = filterByFile(facts.evidence?.['findings.incompleteness.zombies'], filePath);
              el.innerHTML = '<h3>Incompleteness</h3>' +
                '<div>Missing: ' + missing.length + '</div>' +
                '<div>Zombies: ' + zombies.length + '</div>' +
                renderTable('Missing', missing, ['symbol_id','expected']) +
                renderTable('Zombies', zombies, ['symbol_id','found']);
            }

            function renderDrift(filePath) {
              const el = document.getElementById('drift');
              const driftSymbols = filterByFile(facts.evidence?.['findings.patternDrift.conventionDrift']?.driftSymbols, filePath);
              const mixedFiles = facts.evidence?.['findings.patternDrift.mixedConventionFiles'] || [];
              el.innerHTML = '<h3>Drift</h3>' +
                '<div>Drift symbols: ' + driftSymbols.length + '</div>' +
                renderTable('Convention Drift', driftSymbols, ['name','suggestedName','path','convention']) +
                '<div class="muted" style="margin-top:6px;">Mixed files: ' + mixedFiles.length + '</div>';
            }

            function renderLegacy(filePath) {
              const el = document.getElementById('legacy');
              const dead = filterByFile(facts.evidence?.['findings.legacyAudit.dead'], filePath);
              const legacyUsed = filterByFile(facts.evidence?.['findings.legacyAudit.legacyUsed'], filePath);
              const leftovers = filterByFile(facts.findings.legacyAudit.replacedLeftovers, filePath);
              el.innerHTML = '<h3>Legacy</h3>' +
                '<div>Dead: ' + dead.length + '</div>' +
                '<div>Legacy used: ' + legacyUsed.length + '</div>' +
                '<div>Replaced leftovers: ' + leftovers.length + '</div>' +
                renderTable('Dead', dead, ['symbol_id','kind','name']) +
                renderTable('Legacy Used', legacyUsed, ['symbol_id','kind','name']) +
                renderTable('Replaced', leftovers, ['old','new','confidence']);
            }

            function renderUnresolved() {
              const el = document.getElementById('unresolved');
              const unresolved = facts.evidence?.['findings.unresolvedCallers'] || [];
              el.innerHTML = '<h3>Unresolved Callers</h3>' +
                '<div>Total: ' + unresolved.length + '</div>' +
                renderTable('Unresolved', unresolved, ['caller_symbol_id','callee_name','guessed_target_dna_id','severity']);
            }

            function renderHotspots(filePath) {
              const el = document.getElementById('hotspots');
              const hotspots = facts.evidence?.hotspots || facts.findings.hotspots || [];
              const filtered = filePath && filePath !== '__all' ? hotspots.filter(h => (h.path || '').startsWith(filePath)) : hotspots;
              el.innerHTML = '<h3>Hotspots</h3>' +
                renderTable('Hotspots', filtered, ['path','drift_count']);
            }

            function renderTable(title, rows, cols) {
              if (!rows || rows.length === 0) return '';
              const head = cols.map(c => '<th>' + c + '</th>').join('');
              const body = rows.map(r => '<tr>' + cols.map(c => {
                const val = r && r[c] !== undefined ? r[c] : '';
                if (typeof val === 'object') {
                  return '<td>' + escapeHtml(JSON.stringify(val)) + '</td>';
                }
                return '<td>' + escapeHtml(String(val)) + '</td>';
              }).join('') + '</tr>').join('');
              return '<div class="section"><div class="muted">' + title + '</div><table class="table"><thead><tr>' + head + '</tr></thead><tbody>' + body + '</tbody></table></div>';
            }

            function escapeHtml(str) {
              return str.replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
            }

            function render(filePath) {
              renderTimeline();
              renderIncompleteness(filePath);
              renderDrift(filePath);
              renderLegacy(filePath);
              renderUnresolved();
              renderHotspots(filePath);
            }

            fileSelect.addEventListener('change', () => render(fileSelect.value));
            render('__all');
          </script>
        </body>
        </html>
      `;
    } catch (error) {
      vscode.window.showErrorMessage(
        'Failed to open super report: ' + (error instanceof Error ? error.message : String(error))
      );
      logError('[SuperReport] Failed', error);
    }
  });

  logInfo('Core features registered successfully');
}
