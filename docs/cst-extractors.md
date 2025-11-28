# CST Extraction Research and Prototype Notes

This document contains research notes and prototypes for CST (Concrete Syntax Tree) extraction for both CST-only languages and hybrid augmentation.

## Overview

CST extraction enables tracking of structural elements that don't map to semantic symbols:
- **CST-only languages**: Markdown, JSON, YAML, CSS (no semantic symbols, only structural tracking)
- **Hybrid augmentation**: PHP, JS/TS (layer structural facts like comments/docstrings on top of semantic symbols)

## Tree-sitter Node Types

### Markdown

Key nodes to extract:
- `heading` - Headings with depth (1-6)
  - Child: `heading_content` contains the text
  - Depth determined by number of `#` characters
  - Example: `# Main` → `{ kind: 'heading', level: 1, name: 'Main' }`
- `fenced_code_block` - Code blocks (optional, for structure tracking)
- `list` - Lists (optional, for structure tracking)

**Extraction Strategy:**
```typescript
// For heading nodes:
if (node.type === 'atx_heading' || node.type === 'setext_heading') {
  const level = extractHeadingLevel(node); // Count # or match setext
  const content = node.namedChildren.find(c => c.type === 'heading_content');
  const name = content?.text || '';
  return { kind: 'heading', level, name, nodeType: node.type };
}
```

### JSON

Key nodes to extract:
- `pair` - Key-value pairs in objects
  - Child: `string` (key) and value node
  - Example: `"name": "value"` → `{ kind: 'property', name: 'name' }`
- `array` - Arrays (optional, for structure tracking)

**Extraction Strategy:**
```typescript
// For object property nodes:
if (node.type === 'pair') {
  const keyNode = node.namedChildren.find(c => c.type === 'string');
  const key = keyNode?.text?.replace(/^"|"$/g, '') || '';
  const valueNode = node.namedChildren.find(c => c.type !== 'string');
  return { kind: 'property', name: key, nodeType: 'pair' };
}
```

### YAML

Key nodes to extract:
- `block_mapping_pair` - Key-value pairs
  - Similar to JSON but with YAML syntax
  - Example: `name: value` → `{ kind: 'property', name: 'name' }`

**Extraction Strategy:**
```typescript
// Similar to JSON but with YAML node types
if (node.type === 'block_mapping_pair') {
  const keyNode = node.namedChildren.find(c => c.type === 'block_mapping_key');
  const key = keyNode?.text || '';
  return { kind: 'property', name: key, nodeType: 'block_mapping_pair' };
}
```

### CSS

Key nodes to extract:
- `rule_set` - CSS rules
  - Child: `selectors` and `declaration_list`
  - Example: `.class { color: red; }` → `{ kind: 'cst_node', name: '.class', nodeType: 'rule_set' }`

**Extraction Strategy:**
```typescript
if (node.type === 'rule_set') {
  const selectorNode = node.namedChildren.find(c => c.type === 'selectors');
  const selector = selectorNode?.text || '';
  return { kind: 'cst_node', name: selector, nodeType: 'rule_set' };
}
```

## Hybrid Augmentation (JS/TS/PHP)

For supported languages, extract auxiliary nodes that complement semantic symbols:

### JavaScript/TypeScript

Key auxiliary nodes:
- `comment` - Single-line (`//`) or multi-line (`/* */`) comments
  - Extract as `{ kind: 'doc_comment', name: 'comment', nodeType: 'comment' }`
  - Filter: Only extract if not overlapping with semantic symbols
- `jsx_text` - Text content in JSX (optional)

**Extraction Strategy:**
```typescript
// For comment nodes (hybrid augmentation):
if (node.type === 'comment') {
  const text = node.text;
  // Check if this comment is associated with a symbol (heuristic: preceding/following)
  // Filter overlaps: don't extract if symbol with same location exists
  return { kind: 'doc_comment', name: 'comment', nodeType: 'comment' };
}
```

### PHP

Key auxiliary nodes:
- `comment` - PHP comments (`//`, `/* */`, `#`)
  - Similar to JS/TS extraction
- `heredoc` / `nowdoc` - Heredoc strings (optional)

## Body Shape Hashing

For CST facts, compute a stable hash of the structural shape:

```typescript
function hashCstSubset(node: Node, includeChildren: boolean = true): string {
  // Serialize node structure (AST serializer)
  // Exclude trivia (whitespace, comments in some cases)
  // Hash with SHA-256
  const serialized = serializeNode(node, { includeChildren, excludeTrivia: true });
  return crypto.createHash('sha256').update(serialized).digest('hex').substring(0, 16);
}
```

## Timeline and Delta Tracking

Each CST fact maintains a timeline of changes:
```typescript
timeline: Array<{
  version: string;  // Commit SHA or 'workspace'
  dna: string;      // DNA hash for this version
  delta: DeltaChange; // Change type and details
}>
```

Delta types:
- `added` - New CST fact
- `modified` - Existing fact changed (location, content, structure)
- `removed` - Fact deleted

## Overlap Filtering (Hybrid Mode)

When augmenting semantic symbols with CST facts:
1. Extract semantic symbols first
2. Extract CST facts
3. Filter overlaps: `cstFacts.filter(f => !symbols.some(s => s.id === f.id || s.name === f.name || locationsOverlap(s.location, f.location)))`

## Depth Limits

For performance, limit traversal depth:
- Default: 3 levels deep
- Configurable via config
- Prevents deep traversal of large files

## Sample Files

See `benchmarks/fixtures/`:
- `sample.md` - Markdown with headings
- `sample.json` - JSON with properties
- `sample.js` - JavaScript with functions + comments (hybrid)

## Next Steps

1. Implement `extractCstFacts()` in `tree-sitter.ts`
2. Add language-specific extractors
3. Integrate with existing symbol extraction
4. Test with sample files

