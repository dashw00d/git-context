export const STAGE_1_COMPRESSION_PROMPT = `You are analyzing a git commit to create a compact summary of changes.

INPUT DATA:
- Files changed: {file_count} files
- Raw diff stats: {diff_stats}
- Symbols added: {symbols_added}
- Symbols modified: {symbols_modified}
- Symbols removed: {symbols_removed}
- Edges added: {edges_added}
- Edges removed: {edges_removed}
- Difftastic morph highlights: {morph_highlights}
- Code evidence (breaking changes): {snippets_json}

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

export const STAGE_2_SUMMARY_PROMPT = `You are a senior software engineer analyzing a git commit for a code review.

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

export const SYMBOL_EXPLANATION_PROMPT = `You are explaining how a specific symbol changed between two commits.

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

export const FILE_COMPARISON_PROMPT = `Compare these files between two commits and explain the semantic changes.

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

/**
 * Build concise timeline summary for LLM prompts
 */
export function buildTimelineSummary(timeline?: string[]): { summary: string; count: number } {
  if (!timeline || timeline.length === 0) {
    return { summary: 'Single version analysis', count: 1 };
  }

  const shortVersions = timeline.map(v => {
    if (v === 'workspace-unstaged') return 'unstaged';
    if (v === 'workspace-staged') return 'staged';
    if (v === 'HEAD') return 'HEAD';
    return v.substring(0, 12);
  });

  const summary = `Timeline: ${shortVersions.join(' → ')} (${timeline.length} versions)`;
  return { summary, count: timeline.length };
}

/**
 * Prompt 1: Intent & Story
 * Analyzes the refactor bundle to understand what was being attempted
 * Focuses on VALUE: what matters most, what should be done first
 */
export const PROMPT_INTENT_AND_STORY = `
You are a senior engineer reviewing a refactor bundle. Using only the attached facts JSON:

Timeline context: {timelineSummary} ({versionCount} versions)
Trace changes sequentially through the timeline to understand evolution.

**PRIMARY TASK:** Identify the SINGLE most important insight about this refactor.

Then provide:
1. One-sentence summary of what this refactor was attempting
2. The most critical finding (if any) that needs immediate attention
3. The highest-value action (if any) that should be done first

**Output Format:** Return ONLY valid JSON:
{
  "summary": "One-sentence description of the refactor intent and end-state...",
  "criticalFinding": {
    "text": "The single most important issue (or null if none)",
    "confidence": 0.9,
    "severity": "high",
    "evidence": ["findings.incompleteness.missing[0]"]
  },
  "topAction": {
    "description": "The highest-value action to take first (or null if none)",
    "priority": "urgent",
    "effort": "low",
    "risk": "low",
    "evidence": ["findings.legacyAudit.dead[2]"]
  },
  "claims": [
    {
      "text": "Specific claim about the refactor",
      "confidence": 0.9,
      "severity": "high",
      "evidence": ["bundle.shas", "intended.present"]
    }
  ]
}

**IMPORTANT:**
- Only include claims with severity >= "medium" OR confidence >= 0.8
- Focus on VALUE: What matters most? What should be done first? What's actionable?
- Do not make assumptions beyond what's in the facts. Cite specific evidence paths from the JSON.
`;

export const PROMPT_DRIFT_VERIFICATION = `
You are a senior engineer validating refactor completeness. Review every incompleteness and drift flag in the attached facts JSON.

Timeline context: {timelineSummary} ({versionCount} versions)
Trace sequential changes through timeline for evolution context.

**CONTEXTUAL AIDS:**
- Check 'drift.examplesSummary' for high-signal missing/zombie items.
- Review 'hybridSummary.hybridDriftSamples' for concrete CST drift examples.
- Use 'evidenceSnippets' to ground verification in real code.

**CRITICAL:** Focus on REAL ISSUES vs false positives. Prioritize high-severity findings that require immediate action.

For each finding, determine if it's a real issue or a false positive:

**Incompleteness Analysis:**
- Missing symbols: Are these truly missing or explained by scoping?
- Zombie symbols: Should these be removed or are they still needed?
- Divergent symbols: Are name changes intentional or accidental?

**Pattern Drift Analysis:**
- Mixed targets: Are inconsistent patterns problematic?
- Old namespaces: Should these be updated?

**Legacy Audit Analysis:**
- Dead symbols: Are these truly unreachable or called indirectly?
- Legacy used symbols: Are these acceptable technical debt?
- Replaced leftovers: Are these old implementations that should be cleaned up?

**Output Format:** Return ONLY valid JSON:
{
  "claims": [
    {
      "text": "Description of confirmed issue",
      "confidence": 0.85,
      "severity": "high",
      "evidence": ["findings.incompleteness.missing[0]"]
    }
  ],
  "actions": [
    {
      "description": "Specific action to fix issue",
      "priority": "high",
      "effort": "medium",
      "risk": "low",
      "evidence": ["findings.incompleteness.missing[0]"]
    }
  ]
}

**PRIORITIZATION:**
- List HIGH-SEVERITY issues first (critical, high)
- Focus on ACTIONABLE items (has specific evidence paths)
- Skip or mark as low-severity any false positives or acceptable technical debt
- Explain why each confirmed issue is a real problem that needs attention
`;

export const PROMPT_CLEANUP_PLAN = `
You are a senior engineer creating a cleanup plan for an incomplete refactor. Using the attached facts JSON, produce an ordered checklist of exact deletions, migrations, and completions needed to reach zero legacy in the scoped area.

Timeline context: {timelineSummary} ({versionCount} versions)
Consider the evolution sequence when prioritizing cleanup actions.

**CONTEXTUAL AIDS:**
- Use 'evidenceSnippets.legacy' and 'evidenceSnippets.hotspots' to identify high-value targets.
- specific 'drift.examplesSummary' items should be top priority if critical.

**VALUE PRIORITIZATION:**
- Order by VALUE: priority/effort ratio (urgent + low effort = highest value)
- Group HIGH-VALUE actions first (urgent/high priority with low effort)
- Emphasize LOW-RISK, HIGH-IMPACT items
- Minimize breaking changes (deletions last)

Requirements:
- Every item must cite a JSON evidence path (e.g., findings.legacyAudit.dead[2])
- Items must be actionable with specific file paths and symbol names
- Include confidence levels for each recommendation
- Group related changes together

**Output Format:** Return ONLY valid JSON:
{
  "actions": [
    {
      "description": "Delete zombie symbol X in file Y",
      "priority": "urgent",
      "effort": "low",
      "risk": "low",
      "evidence": ["findings.legacyAudit.dead[2]"],
      "dependsOn": []
    }
  ]
}

**ORDERING:**
1. High-value actions first (urgent/high priority + low effort + low risk)
2. Medium-value actions (high priority + medium effort OR medium priority + low effort)
3. Lower-value actions (deletions, high-risk items, high-effort items)

Every item MUST cite a JSON evidence path. Prioritize actions that provide maximum value with minimum risk.
`;

export const SYSTEM_PROMPT = `
You are an expert software engineering analyst specializing in code refactoring and technical debt assessment.

Guidelines:
- Base all analysis strictly on the provided facts JSON - no external assumptions
- Be precise about evidence paths and symbol identifiers
- Distinguish between technical debt that's acceptable vs. problematic
- Consider the broader architectural impact of recommendations
- Prioritize safety and minimal disruption in cleanup plans
- Acknowledge uncertainty when facts are ambiguous
`;

export const PROMPT_DISCOVER = `
Analyze the provided FEED JSON to DISCOVER emergent patterns.

If analyzing DISCOVERY FEED (curated items):
- Look for clusters of missing/zombie/divergent items (use 'drift.examplesSummary').
- Check hotspots for architectural instability.
- Use provided snippets (from 'evidenceSnippets' or feed items) to identify semantic drifts (naming, logic).

If analyzing RAW FEED (AST/Diff/Graph):
- STRUCTURAL: Cycles, fan-in/out spikes, orphan nodes post-diff.
- SEMANTIC: Repeat strings/lits (missed const), naming clusters (old_style vs new).
- DRIFT: Diff-applied files w/ lingering old code; intended symbols w/o edges.

**CRITICAL RULE:** ONLY use file names/symbols present in the feed. Do NOT invent files.
- Format: "file.ts shows <pattern>"
- Use snippets if available to prove the pattern.
- NEVER invent file names like "PaymentService.php" unless it exists in the provided files list

**IMPORTANT:** For examples, provide DESCRIPTIVE paths that explain what the evidence shows:
- Good: "User.ts shows renamed getUser() to fetchUser()" (only if file exists)
- Good: "Hotspot in auth.ts shows frequent churn"
- Bad: "Example" or generic file names

Output ONLY JSON: {patterns: [{name:"naming_drift", desc:"...", examples:["User.ts shows old camelCase methods"], count:15, pct:12}]}
`;

export const PROMPT_QUANTIFY = `
From discovered patterns, compute:
- %COVERAGE: matches/total_symbols
- IMPACT: edge_weight * count
- SILENT: No errors but inconsistency (e.g., 80% new naming, 20% old)

Prioritize top-5 by impact.

**IMPORTANT:** For examples array, provide DESCRIPTIVE evidence paths:
- Include file name and what the evidence shows
- Format: "diff[FileName.php] shows <specific change>"
- Format: "ast[FileName.php].method_name - <what it demonstrates>"

JSON: {quantified: [{...pattern, coverage_pct:30, impact: "high", examples:["diff[PaymentService.php] shows consistent defaultSort() additions"]}]}
`;

export const PROMPT_PLAN = `
Weave top patterns → fixes. Gen code snippets/diffs for each.

For each fix, include:
- file: The target file path
- before: The current code snippet
- after: The suggested replacement
- description: Brief explanation of the change

JSON: {plan: [{pattern:"naming_drift", fixes:[{file:"UserService.php", before:"oldFunc()", after:"newFunc()", description:"Rename to match new convention"}]}]}
`;
