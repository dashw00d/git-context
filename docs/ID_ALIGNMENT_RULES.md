# ID Alignment Rules

## Core Principles

1. **DNA Hash is the Source of Truth**: DNA hash (`dna_id`) is the stable identifier that survives renames/moves
2. **Consistent Naming**: Always use same field names for same concepts
3. **No Legacy Fields**: Remove or clearly document legacy fields

## Field Mapping

| Context            | DNA Hash Field                   | Semantic ID Field | Notes                         |
| ------------------ | -------------------------------- | ----------------- | ----------------------------- |
| `SymbolInfo`       | `id`                             | (removed)         | id IS the DNA hash            |
| `SymbolContext`    | `symbol_id`                      | (none)            | Use symbol_id, NOT dnaId      |
| Database `symbols` | `dna_id`                         | `symbol_id`       | Always use dna_id for lookups |
| Edges              | `from_symbol_id`, `to_symbol_id` | (none)            | Both are DNA hashes           |

## Legacy Fields (Do Not Use)

- `SymbolInfo.semanticId` - Legacy field, kept for backward compatibility only
- `SymbolContext.dnaId` - Use `symbol_id` instead (they are identical)

## Migration Status

Current legacy field usages (as of audit):

- `semanticId`: 11 usages in 7 files
- `dnaId`: 7 usages in 4 files

These are being kept for backward compatibility but new code should NOT use them.

## Rules for New Code

1. **SymbolInfo**: Always use `.id` to get the DNA hash
2. **SymbolContext**: Always use `.symbol_id` to get the DNA hash
3. **Database lookups**: Always use `dna_id` column for DNA hash lookups
4. **Edges**: Use `from_symbol_id` and `to_symbol_id` (both are DNA hashes)

## DNA Hash Format

DNA hashes follow the format: `dna:<64-hex-chars>`

Example: `dna:a1b2c3d4e5f6...`

This format is validated by `isValidDnaHash()` in `pipelineBrandedTypes.ts`.
