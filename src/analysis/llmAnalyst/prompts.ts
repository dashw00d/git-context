/**
 * Fixed prompts for LLM analyst that processes refactor bundle facts
 * Each prompt is designed to extract specific insights from the facts JSON
 */

/**
 * Prompt 1: Intent & Story
 * Analyzes the refactor bundle to understand what was being attempted
 * Focuses on VALUE: what matters most, what should be done first
 */
export const PROMPT_INTENT_AND_STORY = `
You are a senior engineer reviewing a refactor bundle. Using only the attached facts JSON:

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

/**
 * Prompt 2: Drift Verification
 * Validates every incompleteness and drift flag in the facts
 * Emphasizes REAL ISSUES vs false positives, prioritizes high-severity findings
 */
export const PROMPT_DRIFT_VERIFICATION = `
You are a senior engineer validating refactor completeness. Review every incompleteness and drift flag in the attached facts JSON.

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

/**
 * Prompt 3: Cleanup Plan
 * Produces an ordered checklist of exact deletions/migrations needed
 * Orders by VALUE: priority/effort ratio, groups high-value actions first
 */
export const PROMPT_CLEANUP_PLAN = `
You are a senior engineer creating a cleanup plan for an incomplete refactor. Using the attached facts JSON, produce an ordered checklist of exact deletions, migrations, and completions needed to reach zero legacy in the scoped area.

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

/**
 * System prompt for all LLM analyst interactions
 */
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

/**
 * Prompt 4: Generic Pattern Discovery
 * Scans raw AST, diffs, and graph for emergent anomalies
 */
export const PROMPT_DISCOVER = `
From AST JSON (tree structure), diff hunks (old/new code), graph (nodes/edges):

DISCOVER emergent patterns generically:
- STRUCTURAL: Cycles, fan-in/out spikes, orphan nodes post-diff.
- SEMANTIC: Repeat strings/lits (missed const), naming clusters (old_style vs new), token mismatches (colors/classes).
- DRIFT: Diff-applied files w/ lingering old code; intended symbols w/o edges.
- HOOKS: New symbols w/o callers; edge drops.

**IMPORTANT:** For examples, provide DESCRIPTIVE paths that explain what the evidence shows:
- Good: "diff[UserService.php] shows renamed getUser() to fetchUser()"
- Good: "ast[PaymentController.php].method_processPayment - new payment flow"
- Bad: "diff[file.php] (truncated)"
- Bad: "Example"

Output ONLY JSON: {patterns: [{name:"naming_drift", desc:"...", examples:["diff[Widget.php] shows old camelCase method names"], count:15, pct:12}]}
`;

/**
 * Prompt 5: Pattern Quantification
 * Quantifies impact and coverage of discovered patterns
 */
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

/**
 * Prompt 6: Fix Planning
 * Generates concrete fixes for top patterns
 */
export const PROMPT_PLAN = `
Weave top patterns → fixes. Gen code snippets/diffs for each.

For each fix, include:
- file: The target file path
- before: The current code snippet
- after: The suggested replacement
- description: Brief explanation of the change

JSON: {plan: [{pattern:"naming_drift", fixes:[{file:"UserService.php", before:"oldFunc()", after:"newFunc()", description:"Rename to match new convention"}]}]}
`;
