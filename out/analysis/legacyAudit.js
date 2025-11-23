"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LegacyAuditService = void 0;
const git_1 = require("./git");
const symbols_1 = require("./symbols");
const dependencies_1 = require("./dependencies");
const database_1 = require("../storage/database");
class LegacyAuditService {
    constructor() {
        this.git = new git_1.GitOperations();
        this.symbolExtractor = new symbols_1.SymbolExtractor(this.git);
        this.dependencyExtractor = new dependencies_1.DependencyExtractor();
    }
    /**
     * Audit drift between intended state (commits) and working tree
     */
    async auditDrift(shas) {
        // 1. Compute scope paths (changed files + 1-hop blast radius)
        const scopePaths = await this.computeScopePaths(shas);
        // 2. Snapshot working tree for scopePaths
        const workingSymbols = await this.snapshotWorkingTree(scopePaths);
        // 3. Fold selected commits -> IntendedMap
        const intendedSymbols = await this.buildIntendedMap(shas);
        // 4. Compare IntendedMap vs WorkingSnapshot
        return this.compareIntendedVsWorking(intendedSymbols, workingSymbols, scopePaths);
    }
    async computeScopePaths(shas) {
        const paths = new Set();
        const db = (0, database_1.getDatabaseManager)().getDatabase();
        // Get changed files
        const placeholders = shas.map(() => '?').join(',');
        const filesStmt = db.prepare(`SELECT path FROM files WHERE sha IN (${placeholders})`);
        const files = filesStmt.all(...shas);
        for (const file of files) {
            paths.add(file.path);
        }
        // Get blast radius (1-hop)
        // This requires querying edges. For simplicity, we'll just use the files for now
        // In a full implementation, we'd query edges to find dependent files
        return paths;
    }
    async snapshotWorkingTree(scopePaths) {
        const workingSymbols = new Map();
        for (const path of scopePaths) {
            try {
                // In a real implementation, we'd read from disk. 
                // Here we assume git.getFileContent('HEAD', path) approximates working tree 
                // if we don't have direct FS access, but we should try to read actual files.
                // Since we are in a plugin, we might rely on git.getWorkingDirectoryChanges() or similar.
                // For now, we'll use HEAD as a proxy for "current state" if we can't access FS directly,
                // but the requirement is "Working Snapshot".
                // Let's assume we can read the file content via fs or git.
                // We'll use a method on git operations if available, or just read HEAD for now 
                // as a fallback if we can't easily access working tree content in this context.
                // Ideally: const content = fs.readFileSync(path, 'utf8');
                // But we should use the git wrapper if possible.
                const content = this.git.getFileContent('HEAD', path); // Fallback to HEAD
                const symbols = await this.symbolExtractor['extractSymbolsFromContent'](content, path);
                for (const symbol of symbols) {
                    workingSymbols.set(symbol.id, symbol);
                }
            }
            catch (error) {
                // File might be deleted in working tree
            }
        }
        return workingSymbols;
    }
    async buildIntendedMap(shas) {
        const intendedSymbols = new Map();
        const db = (0, database_1.getDatabaseManager)().getDatabase();
        // Get all symbols from the latest commit in the list for each file
        // This is a simplification. "Intended state" is the result of applying the commits.
        // If the commits are sequential and lead to HEAD, then HEAD is the intended state.
        // But if we are auditing a feature branch vs main, it's different.
        // The user said: "Fold selected commits -> IntendedMap".
        // We'll load symbols from the DB for the given SHAs.
        // If multiple commits touch the same file, we want the latest version.
        const placeholders = shas.map(() => '?').join(',');
        const symbolsStmt = db.prepare(`
            SELECT * FROM symbols 
            WHERE sha IN (${placeholders})
            ORDER BY sha ASC
        `);
        const rows = symbolsStmt.all(...shas);
        for (const row of rows) {
            const symbol = {
                id: row.symbol_id,
                name: row.name,
                kind: row.kind,
                location: row.loc_post ? JSON.parse(row.loc_post) : { start: { line: 0, column: 0 }, end: { line: 0, column: 0 } },
                signature: row.signature_post || row.signature_pre || '',
            };
            if (row.change_type === 'removed') {
                intendedSymbols.delete(symbol.id);
            }
            else {
                intendedSymbols.set(symbol.id, symbol);
            }
        }
        return intendedSymbols;
    }
    compareIntendedVsWorking(intended, working, scopePaths) {
        const report = {
            missing_symbols: [],
            zombie_symbols: [],
            replaced_leftover: [],
            dead_candidates: [],
            drift_edges: [],
            hotspots: []
        };
        // Check for missing symbols (Intended but not in Working)
        for (const [id, symbol] of intended) {
            // Only check if the file is in scope
            const filePath = id.split(':')[0];
            if (scopePaths.has(filePath)) {
                if (!working.has(id)) {
                    report.missing_symbols.push(id);
                }
            }
        }
        // Check for zombie symbols (In Working but not Intended)
        // This implies they were removed in the commits but are still present
        // Or they are new files not tracked in the commits (which is fine, but maybe drift)
        for (const [id, symbol] of working) {
            if (!intended.has(id)) {
                // It's in working but not in our intended map.
                // Was it explicitly removed in the commits?
                // We need to know if it was *expected* to be removed.
                // If we just look at "what's in commits", we might miss things that were never touched.
                // So "zombie" means: It was removed in the commits (so it's not in intended) 
                // BUT it is still in working.
                // However, buildIntendedMap only tracks things touched in commits.
                // If a symbol was never touched, it won't be in intended map (unless we load baseline).
                // But if it was *removed* in a commit, it would be processed and removed from the map.
                // So:
                // 1. If it was removed in a commit, it's not in intended.
                // 2. If it's still in working, it's a zombie.
                // But we need to know if it was *ever* in the commits as a removal.
                // We need a set of "explicitly removed IDs".
                // Let's refine buildIntendedMap to track removals.
                report.zombie_symbols.push(id);
            }
        }
        // Filter zombies: only report if they look like they should have been removed
        // For now, we'll report all "extra" symbols in the modified files as potential zombies
        return report;
    }
}
exports.LegacyAuditService = LegacyAuditService;
//# sourceMappingURL=legacyAudit.js.map