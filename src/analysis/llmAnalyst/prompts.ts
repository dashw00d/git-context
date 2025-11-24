/**
 * Fixed prompts for LLM analyst that processes refactor bundle facts
 * Each prompt is designed to extract specific insights from the facts JSON
 */

/**
 * Prompt 1: Intent & Story
 * Analyzes the refactor bundle to understand what was being attempted
 */
export const PROMPT_INTENT_AND_STORY = `
You are a senior engineer reviewing a refactor bundle. Using only the attached facts JSON, describe in 2–3 paragraphs what refactor this series of commits was attempting and what the intended end-state is.

Focus on:
- What problem was this refactor trying to solve?
- What architectural changes were intended?
- What was the scope and scale of the intended transformation?

**Output Format:** Return ONLY valid JSON:
{
  "summary": "2-3 paragraph description of the refactor intent and end-state...",
  "claims": [
    {
      "text": "Specific claim about the refactor",
      "confidence": 0.9,
      "severity": "high",
      "evidence": ["bundle.shas", "intended.present"]
    }
  ]
}

Do not make assumptions beyond what's in the facts. Cite specific evidence paths from the JSON.
`;

/**
 * Prompt 2: Drift Verification
 * Validates every incompleteness and drift flag in the facts
 */
export const PROMPT_DRIFT_VERIFICATION = `
You are a senior engineer validating refactor completeness. Review every incompleteness and drift flag in the attached facts JSON.

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

List confirmed issues with specific evidence paths. Explain why each is a real problem.
`;

/**
 * Prompt 3: Cleanup Plan
 * Produces an ordered checklist of exact deletions/migrations needed
 */
export const PROMPT_CLEANUP_PLAN = `
You are a senior engineer creating a cleanup plan for an incomplete refactor. Using the attached facts JSON, produce an ordered checklist of exact deletions, migrations, and completions needed to reach zero legacy in the scoped area.

Requirements:
- Every item must cite a JSON evidence path (e.g., findings.legacyAudit.dead[2])
- Items must be actionable with specific file paths and symbol names
- Order should minimize breaking changes (deletions last)
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

Every item MUST cite a JSON evidence path. Order should minimize breaking changes.
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

Examples (self-generate):
- "String lit 'red' repeated 12x → const candidate"
- "Class fan-out +20 post-diff → missed abstraction"

Output ONLY JSON: {patterns: [{name:"naming_drift", desc:"...", examples:["AST[Widget.php].method_names"], count:15, pct:12}]}
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
JSON: {quantified: [{...pattern, coverage_pct:30, impact: "high"}]} 
`;

/**
 * Prompt 6: Fix Planning
 * Generates concrete fixes for top patterns
 */
export const PROMPT_PLAN = `
Weave top patterns → fixes. Gen code snippets/diffs for each.
JSON: {plan: [{pattern:"naming_drift", fixes:[{before:"oldFunc()", after:"new_func()"}]}]}
`;
