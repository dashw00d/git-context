"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FILE_COMPARISON_PROMPT = exports.SYMBOL_EXPLANATION_PROMPT = exports.STAGE_2_SUMMARY_PROMPT = exports.STAGE_1_COMPRESSION_PROMPT = void 0;
// Stage 1 prompt: Compress diff and symbol data for efficient processing
exports.STAGE_1_COMPRESSION_PROMPT = `You are analyzing a git commit to create a compact summary of changes.

INPUT DATA:
- Files changed: {file_count} files
- Raw diff stats: {diff_stats}
- Symbols added: {symbols_added}
- Symbols modified: {symbols_modified}
- Symbols removed: {symbols_removed}
- Edges added: {edges_added}
- Edges removed: {edges_removed}
- Difftastic morph highlights: {morph_highlights}

TASK: Create a compact JSON summary of the key semantic changes. Focus on:
- What functionality was added, changed, or removed
- Breaking changes or API modifications
- Significant structural changes
- Risk indicators

OUTPUT FORMAT (strict JSON):
{
  "summary_points": ["brief description of change 1", "brief description of change 2"],
  "breaking_changes": ["breaking change 1", "breaking change 2"],
  "key_symbols": ["important symbol 1", "important symbol 2"],
  "risk_indicators": ["risk 1", "risk 2"],
  "change_patterns": ["pattern 1", "pattern 2"]
}`;
// Stage 2 prompt: Generate final structured commit summary
exports.STAGE_2_SUMMARY_PROMPT = `You are a senior software engineer analyzing a git commit for a code review.

COMPRESSED ANALYSIS:
{stage_1_json}

RAW DIFF SAMPLE:
{diff_sample}

COMMIT MESSAGE: {commit_message}

TASK: Generate a comprehensive commit analysis with the following structure:

OUTPUT FORMAT (strict JSON):
{
  "summary_md": "5-10 bullet points describing what changed, written in Markdown",
  "breaking_changes": ["List of breaking API changes, public method signatures, removed exports"],
  "migration_notes": ["Database migrations, schema changes, data transformations needed"],
  "refactor_clusters": ["Groups of related changes, renames, moved code"],
  "tests_needed": ["New tests required, existing tests that might break"],
  "questions_for_author": ["Clarifying questions about the changes, potential issues"]
}

GUIDELINES:
- Focus on semantic changes, not line-by-line diffs
- Identify breaking changes that affect external consumers
- Note testing implications and migration requirements
- Be concise but comprehensive
- Use technical language appropriate for senior developers`;
// Symbol change explanation prompt
exports.SYMBOL_EXPLANATION_PROMPT = `You are explaining how a specific symbol changed between two commits.

SYMBOL: {symbol_name}
CHANGE TYPE: {change_type}
LOCATION: {file_path}:{line_number}

BEFORE:
{previous_code}

AFTER:
{current_code}

CONTEXT: This change is part of commit {commit_sha}: {commit_message}

TASK: Explain the semantic impact of this symbol change:
- What functionality changed?
- Is this a breaking change?
- What tests might need updating?
- Are there related changes in other files?

Provide a clear, technical explanation suitable for code review.`;
// File comparison prompt
exports.FILE_COMPARISON_PROMPT = `Compare these files between two commits and explain the semantic changes.

COMMIT A: {commit_a_sha} - {commit_a_message}
COMMIT B: {commit_b_sha} - {commit_b_message}

FILES TO COMPARE:
{file_list}

DIFF SUMMARY:
{diff_summary}

SYMBOL CHANGES:
{symbol_changes}

TASK: Provide a focused comparison explaining:
- What changed semantically (not just line-by-line)
- Breaking changes for external consumers
- Testing implications
- Related changes that might affect these files

Focus on the most important changes and their impact.`;
//# sourceMappingURL=prompts.js.map