import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { getGitRoot } from '../../utils/config';
import { RefactorBundleFacts } from '../../facts/types';

/**
 * Status bar item showing refactor debt meter
 */
export class RefactorDebtMeter {
  private statusBarItem: vscode.StatusBarItem;
  private factsPath: string | null = null;
  private refreshTimer: NodeJS.Timeout | null = null;
  private commitTrackerProvider: any = null; // Will be set via setCommitTracker

  constructor() {
    this.statusBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Left,
      100
    );
    this.statusBarItem.command = 'git-context.refreshDebtMeterAndReveal';

    // Don't update immediately - just show placeholder to avoid file I/O on activation
    this.statusBarItem.text = '$(git-commit) Refactor';
    this.statusBarItem.tooltip = 'Click to view refactor bundle report';
    this.statusBarItem.show();

    // Don't start auto-refresh immediately - only start when facts file exists
    // Will be started in update() when facts are found
  }

  /**
   * Update the debt meter display
   */
  public async update(): Promise<void> {
    try {
      const data = await this.loadFacts();
      if (!data) {
        this.statusBarItem.text = '$(git-commit) No refactor data';
        this.statusBarItem.tooltip = 'Run "Generate Refactor Bundle Report" to see debt metrics';
        this.statusBarItem.color = undefined;
        // Stop auto-refresh if no facts file exists
        if (this.refreshTimer) {
          clearInterval(this.refreshTimer);
          this.refreshTimer = null;
        }
        return;
      }

      const { facts, analysis } = data;

      // Start auto-refresh if facts exist and timer not running
      if (!this.refreshTimer) {
        this.startAutoRefresh();
      }

      const debt = this.calculateDebt(facts);
      this.updateDisplay(debt, facts, analysis);
    } catch (error) {
      console.error('Failed to update debt meter:', error);
      this.statusBarItem.text = '$(error) Debt meter error';
      this.statusBarItem.tooltip = `Error: ${error}`;
      this.statusBarItem.color = new vscode.ThemeColor('errorForeground');
    }
  }

  /**
   * Calculate debt metrics from facts
   */
  private calculateDebt(facts: RefactorBundleFacts): {
    percentage: number;
    issues: number;
    breakdown: { missing: number; zombies: number; dead: number; replaced: number };
  } {
    const { formatStats } = require('../../utils/statsFormatter');
    const { missing, zombies, dead, replaced } = formatStats(facts);

    const totalIssues = missing + zombies + dead + replaced;
    const totalSymbols = facts.working.symbols + facts.intended.present + facts.intended.absent;
    const percentage = totalSymbols > 0 ? (totalIssues / totalSymbols) * 100 : 0;

    return {
      percentage: Math.min(percentage, 100), // Cap at 100%
      issues: totalIssues,
      breakdown: { missing, zombies, dead, replaced }
    };
  }

  /**
   * Update the status bar display
   */
  private updateDisplay(debt: ReturnType<typeof this.calculateDebt>, facts: RefactorBundleFacts, analysis: any): void {
    const { percentage, issues, breakdown } = debt;

    // Extract coverage from analysis if available
    let coverageText = '';
    let coverageVal = 0;

    if (analysis && analysis.blocks) {
      const discoveryBlock = analysis.blocks.find((b: any) => b.type === 'discovery');
      if (discoveryBlock && discoveryBlock.claims) {
        // Try to find coverage info in claims
        // Format: "Pattern: Desc (Impact: X, Coverage: Y%)"
        let totalCoverage = 0;
        let count = 0;

        for (const claim of discoveryBlock.claims) {
          const match = claim.text.match(/Coverage: (\d+)%/);
          if (match) {
            totalCoverage += parseInt(match[1]);
            count++;
          }
        }

        if (count > 0) {
          coverageVal = Math.round(totalCoverage / count);
          coverageText = ` | ${coverageVal}% coverage`;
        }
      }
    }

    // Determine color based on debt level
    let color: vscode.ThemeColor | undefined;
    if (percentage >= 50) {
      color = new vscode.ThemeColor('errorForeground');
    } else if (percentage >= 25) {
      color = new vscode.ThemeColor('notificationsWarningIcon.foreground');
    } else if (issues > 0) {
      color = new vscode.ThemeColor('notificationsInfoIcon.foreground');
    }

    // Format the display text with detailed breakdown
    const percentText = percentage.toFixed(0);
    const text = issues === 0
      ? `$(check) Refactor: Complete${coverageText}`
      : `Refactor: ${percentText}%${coverageText} | ${breakdown.zombies} zombies | ${breakdown.missing + breakdown.replaced} drift | ${breakdown.dead} dead`;

    // Create detailed tooltip
    let tooltip = `Refactor Bundle: ${facts.bundle.shas.length} commits\n`;
    tooltip += `Debt Level: ${percentText}% (${issues} total issues)\n`;
    if (coverageVal > 0) {
      tooltip += `Pattern Coverage: ${coverageVal}% (avg of discovered patterns)\n`;
    }
    tooltip += `\n`;

    if (issues > 0) {
      tooltip += 'Breakdown:\n';
      tooltip += `• ${breakdown.zombies} zombie removals\n`;
      tooltip += `• ${breakdown.missing} missing additions\n`;
      tooltip += `• ${breakdown.replaced} replaced leftovers\n`;
      tooltip += `• ${breakdown.dead} dead code\n\n`;
    }

    tooltip += `Generated: ${new Date(facts.generated_at).toLocaleString()}\n`;
    tooltip += 'Click to open Refactor Intelligence Report';

    this.statusBarItem.text = text;
    this.statusBarItem.tooltip = tooltip;
    this.statusBarItem.color = color;
  }

  /**
   * Load facts from the last bundle file
   */
  private async loadFacts(): Promise<{ facts: RefactorBundleFacts, analysis: any } | null> {
    try {
      const gitRoot = getGitRoot();
      if (!gitRoot) return null;

      const factsPath = path.join(gitRoot, '.git', 'commit-tracker', 'last-bundle-facts.json');
      if (!fs.existsSync(factsPath)) return null;

      const content = fs.readFileSync(factsPath, 'utf8');
      const facts: RefactorBundleFacts = JSON.parse(content);

      // Cache the path for file watching
      this.factsPath = factsPath;

      // Try to load analysis for coverage metrics
      let analysis = null;
      const analysisPath = path.join(gitRoot, '.git', 'commit-tracker', 'last-bundle-analysis.json');
      if (fs.existsSync(analysisPath)) {
        try {
          analysis = JSON.parse(fs.readFileSync(analysisPath, 'utf8'));
        } catch (e) {
          // Ignore analysis load errors
        }
      }

      return { facts, analysis };
    } catch (error) {
      console.warn('Failed to load facts for debt meter:', error);
      return null;
    }
  }

  /**
   * Start auto-refresh timer
   */
  private startAutoRefresh(): void {
    // Refresh every 30 seconds
    this.refreshTimer = setInterval(() => {
      this.update();
    }, 30000);
  }

  /**
   * Stop auto-refresh
   */
  public dispose(): void {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
    this.statusBarItem.dispose();
  }

  /**
   * Force refresh the debt meter
   */
  public refresh(): void {
    this.update();
  }

  /**
   * Get the current facts path for file watching
   */
  public getFactsPath(): string | null {
    return this.factsPath;
  }

  /**
   * Set the commit tracker provider for tree refresh/reveal
   */
  public setCommitTracker(commitTracker: any): void {
    this.commitTrackerProvider = commitTracker;
  }

  /**
   * Refresh tree and reveal bundle (called when debt meter is clicked)
   */
  public async refreshTreeAndRevealBundle(): Promise<void> {
    if (this.commitTrackerProvider) {
      // Refresh the tree to pick up latest facts
      this.commitTrackerProvider.refresh();
      
      // Show info toast
      vscode.window.showInformationMessage('Sidebar updated with latest refactor bundle data');
      
      // Try to reveal the bundle node
      try {
        // The bundle node will be revealed when tree refreshes if it exists
        // VS Code will automatically expand it if it was previously expanded
        await vscode.commands.executeCommand('commitTracker.focus');
      } catch (error) {
        // Ignore if command doesn't exist or fails
        console.debug('Could not focus commit tracker:', error);
      }
    }
  }
}

/**
 * Global debt meter instance
 */
let globalDebtMeter: RefactorDebtMeter | undefined;

/**
 * Get or create the global debt meter
 */
export function getDebtMeter(): RefactorDebtMeter {
  if (!globalDebtMeter) {
    globalDebtMeter = new RefactorDebtMeter();
  }
  return globalDebtMeter;
}

/**
 * Refresh the debt meter (called after report generation)
 */
export function refreshDebtMeter(): void {
  if (globalDebtMeter) {
    globalDebtMeter.refresh();
  }
}

/**
 * Dispose the global debt meter
 */
export function disposeDebtMeter(): void {
  if (globalDebtMeter) {
    globalDebtMeter.dispose();
    globalDebtMeter = undefined;
  }
}
