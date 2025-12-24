import * as fs from 'fs';
import * as path from 'path';
import { getGitRoot } from '../utils/config';
import type { CommitFacts } from '../analysis/commitIndexer';
import type { PipelineState } from '../analysis/runner/pipelineTypes';

interface CodeSnippet {
  file: string;
  line?: number;
  endLine?: number;
  code: string;
  language: string;
}

/**
 * Generate a rich markdown report with context, code snippets, and links
 * No LLMs - just organized data from pipeline analysis
 */
export function generateMarkdownReport(state: PipelineState): string {
  const sections: string[] = [];

  // Header
  sections.push(`# Code Attention Report\n`);
  sections.push(`*Generated: ${new Date().toISOString()}*\n`);
  sections.push(
    `**Analysis scope:** ${state.selectedCommitShas.length} commits, ${state.scope?.allPaths.size || 0} files\n`
  );

  // Table of Contents
  sections.push(`## Table of Contents\n`);
  sections.push(`- [Executive Summary](#executive-summary)`);
  sections.push(`- [Critical Issues](#critical-issues)`);
  sections.push(`  - [High Churn Hotspots](#high-churn-hotspots)`);
  sections.push(`  - [Wide Blast Radius](#wide-blast-radius)`);
  sections.push(`- [High Priority Items](#high-priority-items)`);
  sections.push(`  - [Risky Changes](#risky-changes)`);
  sections.push(`  - [Missing Symbols](#missing-symbols)`);
  sections.push(`- [Code Quality Issues](#code-quality-issues)`);
  sections.push(`  - [Drift Detection](#drift-detection)`);
  sections.push(`  - [Legacy Code](#legacy-code)`);
  sections.push(`- [Appendix](#appendix)\n`);

  // Executive Summary
  sections.push(`## Executive Summary\n`);
  sections.push(generateExecutiveSummary(state));

  // Critical Issues
  sections.push(`## Critical Issues\n`);
  sections.push(generateHotspotsSection(state));
  sections.push(generateBlastRadiusSection(state));

  // High Priority
  sections.push(`## High Priority Items\n`);
  sections.push(generateRiskyChangesSection(state));
  sections.push(generateMissingSymbolsSection(state));

  // Code Quality
  sections.push(`## Code Quality Issues\n`);
  sections.push(generateDriftSection(state));
  sections.push(generateLegacySection(state));

  // Appendix
  sections.push(`## Appendix\n`);
  sections.push(generateCommitDetails(state));

  return sections.join('\n');
}

function generateExecutiveSummary(state: PipelineState): string {
  const lines: string[] = [];

  // Count issues by severity
  let criticalCount = 0;
  let highCount = 0;
  let mediumCount = 0;

  // Hotspots
  if (state.hotspots) {
    state.hotspots.forEach(h => {
      if (h.score >= 80) criticalCount++;
      else if (h.score >= 60) highCount++;
      else mediumCount++;
    });
  }

  // Risks
  if (state.commitFacts) {
    (state.commitFacts as CommitFacts[]).forEach(c => {
      if (c.risks && c.risks.length > 0) highCount += c.risks.length;
      if (c.blastRadius > 100) criticalCount++;
      else if (c.blastRadius > 50) highCount++;
    });
  }

  // Drift
  if (state.drift) {
    highCount += state.drift.missing_symbols?.length || 0;
    mediumCount += state.drift.zombie_symbols?.length || 0;
  }

  lines.push(`### Summary Statistics\n`);
  lines.push(`| Severity | Count | Description |`);
  lines.push(`|----------|-------|-------------|`);
  lines.push(
    `| 🔴 **Critical** | ${criticalCount} | Files/symbols requiring immediate attention |`
  );
  lines.push(`| 🟡 **High** | ${highCount} | Important issues to address soon |`);
  lines.push(`| 🔵 **Medium** | ${mediumCount} | Code quality improvements |`);
  lines.push(``);

  return lines.join('\n');
}

function generateHotspotsSection(state: PipelineState): string {
  if (!state.hotspots || state.hotspots.length === 0) {
    return `### High Churn Hotspots\n\n*No hotspots detected.*\n`;
  }

  const lines: string[] = [];
  lines.push(`### High Churn Hotspots\n`);
  lines.push(`Files and symbols that change frequently are prone to bugs and hard to maintain.\n`);

  const fileHotspots = state.hotspots.filter(h => !h.name).slice(0, 10);
  const symbolHotspots = state.hotspots.filter(h => h.name).slice(0, 10);

  if (fileHotspots.length > 0) {
    lines.push(`#### 📁 Top File Hotspots\n`);

    fileHotspots.forEach((h, idx) => {
      const priority = h.score >= 80 ? '🔴' : h.score >= 60 ? '🟡' : '🔵';
      lines.push(
        `${idx + 1}. ${priority} **[${h.path}](${h.path})** (Score: ${h.score.toFixed(1)})`
      );

      if (h.touchedInVersionsDescription) {
        lines.push(`   - Changed in ${h.touchedInVersionsDescription}`);
      }
      if (h.added || h.removed) {
        lines.push(`   - Churn: +${h.added || 0} / -${h.removed || 0} lines`);
      }

      // Try to get code snippet
      const snippet = getFileSnippet(h.path, 1, 10);
      if (snippet) {
        lines.push(`   <details><summary>Preview</summary>\n`);
        lines.push(`   \`\`\`${snippet.language}`);
        lines.push(`   ${snippet.code}`);
        lines.push(`   \`\`\``);
        lines.push(`   </details>\n`);
      } else {
        lines.push(``);
      }
    });
  }

  if (symbolHotspots.length > 0) {
    lines.push(`#### 🎯 Top Symbol Hotspots\n`);

    symbolHotspots.forEach((h, idx) => {
      const priority = h.score >= 80 ? '🔴' : h.score >= 60 ? '🟡' : '🔵';
      lines.push(
        `${idx + 1}. ${priority} **${h.name}** in [${h.path}](${h.path}) (Score: ${h.score.toFixed(1)})`
      );

      // Try to get symbol code
      const snippet = h.name ? getSymbolSnippet(h.path, h.name) : null;
      if (snippet) {
        lines.push(`   <details><summary>Code</summary>\n`);
        lines.push(`   \`\`\`${snippet.language}`);
        lines.push(`   ${snippet.code}`);
        lines.push(`   \`\`\``);
        lines.push(`   </details>\n`);
      } else {
        lines.push(``);
      }
    });
  }

  return lines.join('\n');
}

function generateBlastRadiusSection(state: PipelineState): string {
  if (!state.commitFacts) {
    return `### Wide Blast Radius\n\n*No commits with wide blast radius.*\n`;
  }

  const commits = (state.commitFacts as CommitFacts[]).filter(c => c.blastRadius > 50);

  if (commits.length === 0) {
    return `### Wide Blast Radius\n\n*No commits with wide blast radius.*\n`;
  }

  const lines: string[] = [];
  lines.push(`### Wide Blast Radius\n`);
  lines.push(
    `Commits that affect many symbols can have unintended consequences across the codebase.\n`
  );

  commits.slice(0, 5).forEach((commit, idx) => {
    const priority = commit.blastRadius > 100 ? '🔴' : '🟡';
    lines.push(`${idx + 1}. ${priority} **Commit ${commit.sha.substring(0, 8)}**\n`);
    lines.push(`   - **Blast Radius:** ${commit.blastRadius} symbols affected`);
    lines.push(`   - **Files Changed:** ${commit.filesChanged}`);
    lines.push(
      `   - **Symbol Changes:** ${commit.symbolsAdded} added, ${commit.symbolsModified} modified, ${commit.symbolsRemoved} removed`
    );
    lines.push(`   - **Structural Change:** ${(commit.structuralChangeScore * 100).toFixed(0)}%`);

    if (commit.risks && commit.risks.length > 0) {
      lines.push(`   - **Risks:** ${commit.risks.join(', ')}`);
    }

    lines.push(``);
  });

  return lines.join('\n');
}

function generateRiskyChangesSection(state: PipelineState): string {
  if (!state.commitFacts) {
    return `### Risky Changes\n\n*No risky changes detected.*\n`;
  }

  const riskyCommits = (state.commitFacts as CommitFacts[]).filter(
    c => c.risks && c.risks.length > 0
  );

  if (riskyCommits.length === 0) {
    return `### Risky Changes\n\n*No risky changes detected.*\n`;
  }

  const lines: string[] = [];
  lines.push(`### Risky Changes\n`);
  lines.push(`Commits flagged with specific risk patterns that require careful review.\n`);

  riskyCommits.slice(0, 10).forEach((commit, idx) => {
    lines.push(`#### ${idx + 1}. Commit ${commit.sha.substring(0, 8)}\n`);

    lines.push(`**Risk Flags:**`);
    commit.risks.forEach(risk => {
      const emoji = getRiskEmoji(risk);
      lines.push(`- ${emoji} \`${risk}\``);
    });

    lines.push(``);
    lines.push(`**Impact:**`);
    lines.push(
      `- ${commit.filesChanged} files, ${commit.symbolsAdded}A / ${commit.symbolsModified}M / ${commit.symbolsRemoved}D symbols`
    );
    lines.push(`- Structural change: ${(commit.structuralChangeScore * 100).toFixed(0)}%`);

    if (commit.hotspots && commit.hotspots.length > 0) {
      lines.push(``);
      lines.push(`**Affected Hotspots:**`);
      commit.hotspots.slice(0, 5).forEach(hs => {
        lines.push(`- ${hs.symbolId} (impact: ${hs.impactScore.toFixed(0)})`);
      });
    }

    lines.push(``);
  });

  return lines.join('\n');
}

function generateMissingSymbolsSection(state: PipelineState): string {
  if (!state.drift || !state.drift.missing_symbols || state.drift.missing_symbols.length === 0) {
    return `### Missing Symbols\n\n*No missing symbols detected.*\n`;
  }

  const lines: string[] = [];
  lines.push(`### Missing Symbols\n`);
  lines.push(
    `Symbols that were expected to be present but are not found in the current codebase.\n`
  );

  state.drift.missing_symbols.slice(0, 15).forEach((m, idx) => {
    lines.push(`${idx + 1}. 🟡 **${m.expected.lastName}** in \`${m.expected.lastPath}\``);

    if (m.versionDescription) {
      lines.push(`   - Missing since: ${m.versionDescription}`);
    }
    if (m.expected.lastSig) {
      lines.push(`   - Last signature: \`${m.expected.lastSig}\``);
    }

    lines.push(``);
  });

  return lines.join('\n');
}

function generateDriftSection(state: PipelineState): string {
  if (!state.drift) {
    return `### Drift Detection\n\n*No drift detected.*\n`;
  }

  const lines: string[] = [];
  lines.push(`### Drift Detection\n`);
  lines.push(`Code that has diverged from its expected state or naming conventions.\n`);

  // Zombie symbols
  if (state.drift.zombie_symbols && state.drift.zombie_symbols.length > 0) {
    lines.push(`#### Zombie Code\n`);
    lines.push(`Symbols that should have been removed but still exist:\n`);

    state.drift.zombie_symbols.slice(0, 10).forEach((z, idx) => {
      lines.push(
        `${idx + 1}. **${z.found.name}** in [${z.found.filePath}](${z.found.filePath || ''})`
      );
      if (z.versionDescription) {
        lines.push(`   - ${z.versionDescription}`);
      }
      lines.push(``);
    });
  }

  // Convention drift
  if (state.drift.conventionDrift && state.drift.conventionDrift.driftPercent > 10) {
    const cd = state.drift.conventionDrift;
    lines.push(`#### Convention Drift\n`);
    lines.push(
      `${cd.driftPercent.toFixed(0)}% of code doesn't follow dominant **${cd.dominantConvention}** convention.\n`
    );

    if (cd.driftSymbols && cd.driftSymbols.length > 0) {
      lines.push(`**Examples:**\n`);
      cd.driftSymbols.slice(0, 5).forEach(ds => {
        lines.push(`- \`${ds.name}\` → suggested: \`${ds.suggestedName}\` (${ds.path})`);
      });
      lines.push(``);
    }
  }

  // Unresolved callers
  if (state.drift.unresolved_callers && state.drift.unresolved_callers.length > 0) {
    lines.push(`#### Unresolved Calls\n`);
    lines.push(`Calls to functions that cannot be resolved:\n`);

    const topCallers = state.drift.unresolved_callers.slice(0, 10);
    topCallers.forEach((u, idx) => {
      lines.push(
        `${idx + 1}. Call to \`${u.callee_name}\` in ${u.caller_path || 'unknown'}${u.caller_line ? `:${u.caller_line}` : ''}`
      );
      lines.push(`   - Occurrences: ${u.occurrence_count}, Severity: ${u.severity}/10`);
      lines.push(``);
    });
  }

  return lines.join('\n');
}

function generateLegacySection(state: PipelineState): string {
  if (!state.legacy) {
    return `### Legacy Code\n\n*No legacy issues detected.*\n`;
  }

  const lines: string[] = [];
  lines.push(`### Legacy Code\n`);

  // Dead code
  if (state.legacy.dead && state.legacy.dead.length > 0) {
    lines.push(`#### Dead Code\n`);
    lines.push(`Unused symbols with no incoming references:\n`);

    state.legacy.dead.slice(0, 10).forEach((d, idx) => {
      lines.push(`${idx + 1}. **${d.name}** in [${d.filePath}](${d.filePath || ''})`);
    });
    lines.push(``);
  }

  // Legacy still in use
  if (state.legacy.legacyUsed && state.legacy.legacyUsed.length > 0) {
    lines.push(`#### Legacy Code Still In Use\n`);
    lines.push(`Deprecated symbols that are still being called:\n`);

    state.legacy.legacyUsed.slice(0, 10).forEach((l, idx) => {
      lines.push(`${idx + 1}. **${l.name}** in [${l.filePath}](${l.filePath || ''})`);
    });
    lines.push(``);
  }

  // Replaced leftovers
  if (state.legacy.replacedLeftovers && state.legacy.replacedLeftovers.length > 0) {
    lines.push(`#### Replacement Leftovers\n`);
    lines.push(`Old code that coexists with its replacement:\n`);

    state.legacy.replacedLeftovers.slice(0, 10).forEach((r, idx) => {
      lines.push(
        `${idx + 1}. **${r.old.name}** → **${r.new.name}** (confidence: ${(r.confidence * 100).toFixed(0)}%)`
      );
      lines.push(`   - Old: [${r.old.filePath}](${r.old.filePath || ''})`);
      lines.push(`   - New: [${r.new.filePath}](${r.new.filePath || ''})`);
      lines.push(``);
    });
  }

  // If no legacy issues found, add a message
  if (
    (!state.legacy.dead || state.legacy.dead.length === 0) &&
    (!state.legacy.legacyUsed || state.legacy.legacyUsed.length === 0) &&
    (!state.legacy.replacedLeftovers || state.legacy.replacedLeftovers.length === 0)
  ) {
    lines.push(`*No legacy code issues detected.*\n`);
  }

  return lines.join('\n');
}

function generateCommitDetails(state: PipelineState): string {
  if (!state.commitFacts) return '';

  const lines: string[] = [];
  lines.push(`### Analyzed Commits\n`);

  (state.commitFacts as CommitFacts[]).forEach(commit => {
    lines.push(`#### ${commit.sha}`);
    lines.push(`- Files changed: ${commit.filesChanged}`);
    lines.push(
      `- Symbols: ${commit.symbolsAdded}A / ${commit.symbolsModified}M / ${commit.symbolsRemoved}D`
    );
    lines.push(`- Edges: ${commit.edgesAdded}A / ${commit.edgesRemoved}D`);
    lines.push(`- Structural change: ${(commit.structuralChangeScore * 100).toFixed(0)}%`);
    lines.push(`- Blast radius: ${commit.blastRadius}`);
    if (commit.risks && commit.risks.length > 0) {
      lines.push(`- Risks: ${commit.risks.join(', ')}`);
    }
    lines.push(``);
  });

  return lines.join('\n');
}

// Helper functions

function getFileSnippet(filePath: string, startLine: number, endLine: number): CodeSnippet | null {
  try {
    const gitRoot = getGitRoot();
    if (!gitRoot) return null;

    const fullPath = path.join(gitRoot, filePath);
    if (!fs.existsSync(fullPath)) return null;

    const content = fs.readFileSync(fullPath, 'utf8');
    const lines = content.split('\n');
    const snippet = lines.slice(startLine - 1, endLine).join('\n');

    const ext = path.extname(filePath).slice(1);
    const language = getLanguageFromExtension(ext);

    return {
      file: filePath,
      line: startLine,
      endLine,
      code: snippet,
      language,
    };
  } catch (error) {
    return null;
  }
}

function getSymbolSnippet(filePath: string, symbolName: string): CodeSnippet | null {
  try {
    const gitRoot = getGitRoot();
    if (!gitRoot) return null;

    const fullPath = path.join(gitRoot, filePath);
    if (!fs.existsSync(fullPath)) return null;

    const content = fs.readFileSync(fullPath, 'utf8');
    const lines = content.split('\n');

    // Simple heuristic: find line with symbol name and grab surrounding context
    const symbolLineIndex = lines.findIndex(
      line =>
        line.includes(symbolName) &&
        (line.includes('function') ||
          line.includes('class') ||
          line.includes('const') ||
          line.includes('export'))
    );

    if (symbolLineIndex === -1) return null;

    const startLine = Math.max(0, symbolLineIndex);
    const endLine = Math.min(lines.length, symbolLineIndex + 15);
    const snippet = lines.slice(startLine, endLine).join('\n');

    const ext = path.extname(filePath).slice(1);
    const language = getLanguageFromExtension(ext);

    return {
      file: filePath,
      line: symbolLineIndex + 1,
      endLine,
      code: snippet,
      language,
    };
  } catch (error) {
    return null;
  }
}

function getLanguageFromExtension(ext: string): string {
  const languageMap: Record<string, string> = {
    ts: 'typescript',
    tsx: 'typescript',
    js: 'javascript',
    jsx: 'javascript',
    py: 'python',
    java: 'java',
    go: 'go',
    rs: 'rust',
    cpp: 'cpp',
    c: 'c',
    cs: 'csharp',
    rb: 'ruby',
    php: 'php',
    swift: 'swift',
    kt: 'kotlin',
  };

  return languageMap[ext] || ext;
}

function getRiskEmoji(risk: string): string {
  const emojiMap: Record<string, string> = {
    'schema-migration': '🗄️',
    security: '🔒',
    performance: '⚡',
    refactor: '♻️',
    auth: '🔐',
    payment: '💳',
    'api-change': '🔌',
  };

  return emojiMap[risk] || '⚠️';
}
