# Sandbox Repository Expected Metrics

This document records the manually calculated expectations for the `sandbox-repo` fixture used in integration tests.

## Repository Overview (6 Commits)
1. **Initial**: TS math, JS utils, PHP User class
2. **Add**: TS Calculator, JS logger, PHP UserService
3. **Modify**: Math signatures, User methods
4. **Rename**: JS `formatNumber` -> `formatCurrency`, add `throttle`
5. **Delete**: TS `divide` removed, add `safeDivide`
6. **Cross-file**: TS `index.ts`, JS `api.js`, PHP `UserController`

## Symbol Counts (Initial - Commit 1)
- `src/ts/math.ts`: 5 symbols (MathResult, add, subtract, multiply, divide)
- `src/ts/types.ts`: 4 symbols (User, Post, UserRole, Status)
- `src/js/utils.js`: 4 symbols (formatDate, formatNumber, parseNumber, debounce)
- `src/php/User.php`: 9 symbols (User class + 8 methods)
- `src/php/helpers.php`: 3 symbols (sanitize_input, generate_uuid, array_get)
- **Total**: 25 symbols

## Hotspot Analysis (After 6 Commits)
Calculated using `HotspotDetector` logic:
- weights: frequency(0.35), recency(0.2), diversity(0.15), intensity(0.2), clustering(0.1)
- `recency` assumed ~1.0 for fresh test runs.
- `authorDiversity` = 0.2 (1 author).

### `src/ts/math.ts`
- **Commits**: 3/6 (1, 3, 5)
- **Frequency**: min(1, 3/sqrt(6)) = 1.0
- **Intensity**: ~12 changes / 3 commits = 4.0 -> intensity = 0.4
- **Raw Score**: (1.0 * 0.35) + (1.0 * 0.2) + (0.2 * 0.15) + (0.4 * 0.2) = 0.35 + 0.2 + 0.03 + 0.08 = 0.66
- **Hotspot Score**: log10(1 + 0.66*9) * 100 = log10(6.94) * 100 = **84.1**
- **Risk**: Critical (>= 80)

### `src/js/utils.js`
- **Commits**: 2/6 (1, 4)
- **Frequency**: min(1, 2/sqrt(6)) = 0.816
- **Intensity**: ~6 changes / 2 commits = 3.0 -> intensity = 0.3
- **Raw Score**: (0.816 * 0.35) + (1.0 * 0.2) + (0.2 * 0.15) + (0.3 * 0.2) = 0.2856 + 0.2 + 0.03 + 0.06 = 0.5756
- **Hotspot Score**: log10(1 + 0.5756*9) * 100 = log10(6.18) * 100 = **79.1**
- **Risk**: High (60-80)

## Drift Detection
When comparing **Intended** (Commits 1-2) with **Working** (Commit 6):

### Missing Symbols (Expected in 1-2, gone in 6)
- `src/ts/math.ts`: `divide` (removed in commit 5)
- `src/js/utils.js`: `formatNumber` (renamed in commit 4)

### Zombie Symbols (Found in 6, not in 1-2)
- `src/ts/math.ts`: `modulo`, `safeDivide`
- `src/js/utils.js`: `formatCurrency`, `throttle`
- `src/php/User.php`: `updateLastLogin`, `getLastLogin`, `toArray`
- `src/ts/index.ts`: All symbols (added in commit 6)
- `src/js/api.js`: All symbols (added in commit 6)
- `src/php/UserController.php`: All symbols (added in commit 6)

### Divergent Symbols
- `src/js/utils.js`: `formatNumber` -> `formatCurrency` (detected as rename/divergent)
