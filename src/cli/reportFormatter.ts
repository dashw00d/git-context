import chalk from 'chalk';
import type { CommitFacts } from '../analysis/commitIndexer';
import type { PipelineState } from '../analysis/runner/pipelineTypes';

interface AttentionItem {
  category: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  file: string;
  line?: number;
  symbol?: string;
  description: string;
  metric?: string;
}

/**
 * Generate a clean, concise report of code needing attention
 * No LLMs - just organized data from pipeline analysis
 */
export function formatAttentionReport(state: PipelineState): string {
  const items: AttentionItem[] = [];

  // 1. Hotspots - files/symbols that change frequently and need attention
  if (state.hotspots && state.hotspots.length > 0) {
    const fileHotspots = state.hotspots.filter(h => !h.name);
    const symbolHotspots = state.hotspots.filter(h => h.name);

    fileHotspots.slice(0, 10).forEach(h => {
      const priority = h.score >= 80 ? 'critical' : h.score >= 60 ? 'high' : 'medium';
      items.push({
        category: 'Hotspot File',
        priority,
        file: h.path,
        description: `High churn file (score: ${h.score.toFixed(1)})`,
        metric: h.touchedInVersionsDescription,
      });
    });

    symbolHotspots.slice(0, 10).forEach(h => {
      const priority = h.score >= 80 ? 'critical' : h.score >= 60 ? 'high' : 'medium';
      items.push({
        category: 'Hotspot Symbol',
        priority,
        file: h.path,
        symbol: h.name,
        description: `Frequently changed symbol (score: ${h.score.toFixed(1)})`,
      });
    });
  }

  // 2. High-risk commits
  if (state.commitFacts) {
    const commits = state.commitFacts as CommitFacts[];
    commits.forEach(commit => {
      if (commit.risks && commit.risks.length > 0) {
        const priority = commit.risks.some(r => r.includes('critical')) ? 'critical' : 'high';
        commit.risks.forEach(risk => {
          items.push({
            category: 'Risky Change',
            priority,
            file: commit.sha.substring(0, 8),
            description: risk,
            metric: `${commit.filesChanged} files, ${commit.symbolsAdded}A/${commit.symbolsModified}M/${commit.symbolsRemoved}D symbols`,
          });
        });
      }

      // High structural change
      if (commit.structuralChangeScore > 0.7) {
        items.push({
          category: 'Structural Change',
          priority: commit.structuralChangeScore > 0.9 ? 'critical' : 'high',
          file: commit.sha.substring(0, 8),
          description: `Major structural change (${(commit.structuralChangeScore * 100).toFixed(0)}%)`,
          metric: `${commit.filesChanged} files affected`,
        });
      }

      // High blast radius
      if (commit.blastRadius > 50) {
        items.push({
          category: 'Blast Radius',
          priority: commit.blastRadius > 100 ? 'critical' : 'high',
          file: commit.sha.substring(0, 8),
          description: `Wide-reaching changes (${commit.blastRadius} affected symbols)`,
        });
      }
    });
  }

  // 3. Drift - code that deviates from intended state
  if (state.drift) {
    // Missing symbols (expected but not found)
    state.drift.missing_symbols?.slice(0, 15).forEach(m => {
      items.push({
        category: 'Missing Symbol',
        priority: 'high',
        file: m.expected.lastPath || 'unknown',
        symbol: m.expected.lastName,
        description: 'Expected symbol not found in codebase',
        metric: m.versionDescription,
      });
    });

    // Zombie symbols (should be gone but still exist)
    state.drift.zombie_symbols?.slice(0, 15).forEach(z => {
      items.push({
        category: 'Zombie Code',
        priority: 'medium',
        file: z.found.filePath || 'unknown',
        symbol: z.found.name,
        description: 'Symbol should have been removed but still exists',
        metric: z.versionDescription,
      });
    });

    // Divergent symbols (changed unexpectedly)
    state.drift.divergent_symbols?.slice(0, 10).forEach(d => {
      items.push({
        category: 'Divergent Symbol',
        priority: 'medium',
        file: d.found.filePath || 'unknown',
        symbol: d.found.name,
        description: 'Symbol changed in unexpected way',
        metric: d.versionDescription,
      });
    });

    // Convention drift
    if (state.drift.conventionDrift && state.drift.conventionDrift.driftPercent > 10) {
      const cd = state.drift.conventionDrift;
      items.push({
        category: 'Convention Drift',
        priority: cd.driftPercent > 25 ? 'high' : 'medium',
        file: 'codebase-wide',
        description: `${cd.driftPercent.toFixed(0)}% of code doesn't follow dominant ${cd.dominantConvention} convention`,
        metric: `${cd.driftSymbols?.length || 0} symbols affected`,
      });
    }

    // Unresolved callers (calls to unknown functions)
    state.drift.unresolved_callers?.slice(0, 10).forEach(u => {
      const priority = u.severity > 8 ? 'high' : u.severity > 5 ? 'medium' : 'low';
      items.push({
        category: 'Unresolved Call',
        priority,
        file: u.caller_path || 'unknown',
        line: u.caller_line,
        symbol: u.caller_name,
        description: `Calls unknown function '${u.callee_name}'`,
        metric: `${u.occurrence_count} occurrences`,
      });
    });
  }

  // 4. Legacy code audit
  if (state.legacy) {
    // Dead code (not used anywhere)
    state.legacy.dead?.slice(0, 15).forEach(d => {
      items.push({
        category: 'Dead Code',
        priority: 'low',
        file: d.filePath || 'unknown',
        symbol: d.name,
        description: 'Unused symbol with no incoming references',
      });
    });

    // Legacy code still in use
    state.legacy.legacyUsed?.slice(0, 10).forEach(l => {
      items.push({
        category: 'Legacy In Use',
        priority: 'medium',
        file: l.filePath || 'unknown',
        symbol: l.name,
        description: 'Deprecated symbol still being called',
      });
    });

    // Replaced but old code remains
    state.legacy.replacedLeftovers?.slice(0, 10).forEach(r => {
      items.push({
        category: 'Leftover After Replacement',
        priority: 'medium',
        file: r.old.filePath || 'unknown',
        symbol: r.old.name,
        description: `Old version coexists with new (${r.new.name}), confidence: ${(r.confidence * 100).toFixed(0)}%`,
      });
    });
  }

  // 5. Moved/renamed symbols
  if (state.movedLineage && state.movedLineage.length > 0) {
    state.movedLineage.slice(0, 15).forEach(m => {
      items.push({
        category: `Symbol ${m.moveType}`,
        priority: 'low',
        file: m.versionDescription || 'unknown',
        description: `Symbol moved/renamed across versions`,
      });
    });
  }

  // Sort by priority
  const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
  items.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

  // Format output
  return formatReport(items, state);
}

function formatReport(items: AttentionItem[], state: PipelineState): string {
  const lines: string[] = [];

  lines.push(chalk.bold.cyan('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
  lines.push(chalk.bold.cyan('  CODE ATTENTION REPORT'));
  lines.push(chalk.bold.cyan('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n'));

  // Summary stats
  const criticalCount = items.filter(i => i.priority === 'critical').length;
  const highCount = items.filter(i => i.priority === 'high').length;
  const mediumCount = items.filter(i => i.priority === 'medium').length;
  const lowCount = items.filter(i => i.priority === 'low').length;

  lines.push(chalk.bold('Summary:'));
  if (criticalCount > 0) {
    lines.push(chalk.red(`  🔴 ${criticalCount} Critical issues`));
  }
  if (highCount > 0) {
    lines.push(chalk.yellow(`  🟡 ${highCount} High priority items`));
  }
  if (mediumCount > 0) {
    lines.push(chalk.blue(`  🔵 ${mediumCount} Medium priority items`));
  }
  if (lowCount > 0) {
    lines.push(chalk.gray(`  ⚪ ${lowCount} Low priority items`));
  }

  lines.push('');

  // Group by category
  const byCategory = new Map<string, AttentionItem[]>();
  items.forEach(item => {
    if (!byCategory.has(item.category)) {
      byCategory.set(item.category, []);
    }
    byCategory.get(item.category)!.push(item);
  });

  // Output each category
  for (const [category, categoryItems] of byCategory) {
    if (categoryItems.length === 0) continue;

    lines.push(chalk.bold.underline(`\n${category} (${categoryItems.length}):`));

    categoryItems.slice(0, 20).forEach(item => {
      const priorityIcon = {
        critical: chalk.red('🔴'),
        high: chalk.yellow('🟡'),
        medium: chalk.blue('🔵'),
        low: chalk.gray('⚪'),
      }[item.priority];

      let location = item.file;
      if (item.line) location += `:${item.line}`;
      if (item.symbol) location += ` [${item.symbol}]`;

      lines.push(`  ${priorityIcon} ${chalk.dim(location)}`);
      lines.push(`     ${item.description}`);
      if (item.metric) {
        lines.push(`     ${chalk.dim(item.metric)}`);
      }
    });

    if (categoryItems.length > 20) {
      lines.push(chalk.dim(`     ... and ${categoryItems.length - 20} more`));
    }
  }

  // Footer
  lines.push(chalk.bold.cyan('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
  lines.push(
    chalk.dim(
      `Analyzed: ${state.selectedCommitShas.length} commits, ${state.scope?.allPaths.size || 0} files`
    )
  );
  lines.push(chalk.bold.cyan('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n'));

  return lines.join('\n');
}
