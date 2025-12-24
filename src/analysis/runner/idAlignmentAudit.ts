/**
 * ID Alignment Audit Tool
 * Scans codebase for ID field usage and reports misalignments
 *
 * ID Field Standards:
 * - SymbolInfo.id = DNA hash (stable identifier across renames/moves)
 * - SymbolInfo.semanticId = LEGACY - should not be used
 * - SymbolContext.id = numeric ID (different from SymbolInfo!)
 * - SymbolContext.symbol_id = DNA hash (stable identifier)
 * - SymbolContext.dnaId = LEGACY - use symbol_id instead
 * - Database: symbols.dna_id = DNA hash, symbols.symbol_id = semantic ID
 */

import * as fs from 'fs';
import * as path from 'path';

export interface IdUsage {
  file: string;
  line: number;
  context: string;
  field: string;
  pattern: string;
  issue?: string;
}

export interface AlignmentReport {
  symbolInfoUsage: IdUsage[];
  symbolContextUsage: IdUsage[];
  databaseUsage: IdUsage[];
  misalignments: Array<{
    file: string;
    line: number;
    issue: string;
    suggestion: string;
  }>;
}

/**
 * Audit ID field usage across codebase
 */
export async function auditIdAlignment(srcDir: string = 'src'): Promise<AlignmentReport> {
  const report: AlignmentReport = {
    symbolInfoUsage: [],
    symbolContextUsage: [],
    databaseUsage: [],
    misalignments: [],
  };

  const srcFiles = findTsFiles(srcDir);

  for (const file of srcFiles) {
    const content = fs.readFileSync(file, 'utf-8');
    const lines = content.split('\n');

    lines.forEach((line, index) => {
      const lineNum = index + 1;
      const trimmedLine = line.trim();

      // Check for semanticId usage (legacy field in SymbolInfo)
      if (line.includes('semanticId')) {
        report.symbolInfoUsage.push({
          file,
          line: lineNum,
          context: trimmedLine.slice(0, 100),
          field: 'semanticId',
          pattern: 'semanticId',
          issue: 'Legacy field - should verify if still needed',
        });
      }

      // Check for dnaId usage (legacy field in SymbolContext)
      if (line.includes('.dnaId') || line.includes('dnaId:')) {
        report.symbolContextUsage.push({
          file,
          line: lineNum,
          context: trimmedLine.slice(0, 100),
          field: 'dnaId',
          pattern: 'dnaId',
          issue: 'Legacy field in SymbolContext - use symbol_id instead',
        });
      }

      // Check for database symbol_id vs dna_id confusion
      if (
        line.includes('symbol_id') &&
        (line.includes('SELECT') || line.includes('INSERT') || line.includes('WHERE'))
      ) {
        if (!line.includes('dna_id') && line.includes('FROM symbols')) {
          report.databaseUsage.push({
            file,
            line: lineNum,
            context: trimmedLine.slice(0, 100),
            field: 'symbol_id',
            pattern: 'symbol_id in SQL',
            issue: 'Verify: should this be dna_id?',
          });
        }
      }
    });
  }

  return report;
}

/**
 * Generate alignment fix suggestions
 */
export function generateAlignmentFixes(report: AlignmentReport): string[] {
  const fixes: string[] = [];

  // Standardize SymbolInfo
  fixes.push('✅ SymbolInfo.id is DNA hash - CORRECT');

  if (report.symbolInfoUsage.some(u => u.field === 'semanticId')) {
    fixes.push(
      `⚠️  Found ${report.symbolInfoUsage.filter(u => u.field === 'semanticId').length} semanticId usages - audit each and remove if not needed`
    );
  }

  // Standardize SymbolContext
  if (report.symbolContextUsage.some(u => u.field === 'dnaId')) {
    fixes.push(
      `⚠️  Found ${report.symbolContextUsage.filter(u => u.field === 'dnaId').length} dnaId usages - replace with symbol_id`
    );
  }

  // Database standardization
  if (report.databaseUsage.length > 0) {
    fixes.push(`⚠️  Found ${report.databaseUsage.length} database queries to verify`);
  }

  return fixes;
}

/* eslint-disable no-console */
/**
 * Print alignment report to console
 */
export function printAlignmentReport(report: AlignmentReport): void {
  console.log('\n=== ID Alignment Audit Report ===\n');

  console.log(
    `semanticId usages: ${report.symbolInfoUsage.filter(u => u.field === 'semanticId').length}`
  );
  console.log(`dnaId usages: ${report.symbolContextUsage.filter(u => u.field === 'dnaId').length}`);
  console.log(`Database queries to verify: ${report.databaseUsage.length}`);

  if (report.symbolInfoUsage.length > 0) {
    console.log('\n--- semanticId Usages ---');
    for (const usage of report.symbolInfoUsage.filter(u => u.field === 'semanticId')) {
      console.log(`  ${usage.file}:${usage.line}`);
      console.log(`    ${usage.context}`);
    }
  }

  if (report.symbolContextUsage.length > 0) {
    console.log('\n--- dnaId Usages ---');
    for (const usage of report.symbolContextUsage.filter(u => u.field === 'dnaId')) {
      console.log(`  ${usage.file}:${usage.line}`);
      console.log(`    ${usage.context}`);
    }
  }

  console.log('\n--- Recommendations ---');
  const fixes = generateAlignmentFixes(report);
  for (const fix of fixes) {
    console.log(`  ${fix}`);
  }
}
/* eslint-enable no-console */

/**
 * Find all TypeScript files in directory
 */
function findTsFiles(dir: string, files: string[] = []): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      if (!entry.name.includes('node_modules') && !entry.name.startsWith('.')) {
        findTsFiles(fullPath, files);
      }
    } else if (entry.isFile() && entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts')) {
      files.push(fullPath);
    }
  }

  return files;
}
