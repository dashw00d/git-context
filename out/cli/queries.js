"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.showLastCommits = exports.searchSymbol = exports.showCommit = void 0;
const chalk_1 = __importDefault(require("chalk"));
const database_1 = require("../storage/database");
const index_1 = require("../storage/index");
async function showCommit(sha) {
    await (0, database_1.ensureDatabaseInitialized)();
    const db = (0, database_1.getDatabaseManager)().getDatabase();
    // Get commit data
    const commitStmt = db.prepare(`
    SELECT * FROM commits WHERE sha = ?
  `);
    const commit = commitStmt.get(sha);
    if (!commit) {
        console.log(chalk_1.default.red(`Commit ${sha} not found in database. Run 'ct analyze' first.`));
        return;
    }
    console.log(chalk_1.default.blue(`Commit: ${commit.sha}`));
    console.log(chalk_1.default.gray(`Author: ${commit.author}`));
    console.log(chalk_1.default.gray(`Date: ${commit.date}`));
    console.log(chalk_1.default.yellow(`Message: ${commit.message}`));
    console.log('');
    // Display summary
    if (commit.summary_md) {
        console.log(chalk_1.default.green('Summary:'));
        console.log(commit.summary_md);
        console.log('');
    }
    // Display stats
    console.log(chalk_1.default.cyan('Statistics:'));
    console.log(`Files changed: ${commit.files_changed}`);
    console.log(`Symbols: +${commit.symbols_added} -${commit.symbols_removed} ~${commit.symbols_modified}`);
    console.log(`Edges: +${commit.edges_added} -${commit.edges_removed}`);
    // Display risks
    if (commit.risks) {
        const risks = JSON.parse(commit.risks);
        if (risks.length > 0) {
            console.log('');
            console.log(chalk_1.default.red('Risk flags:'));
            risks.forEach((risk) => console.log(`• ${risk}`));
        }
    }
    // Display symbol changes
    const symbolsStmt = db.prepare(`
    SELECT name, kind, change_type FROM symbols
    WHERE sha = ? ORDER BY kind, name
  `);
    const symbols = symbolsStmt.all(sha);
    if (symbols.length > 0) {
        console.log('');
        console.log(chalk_1.default.cyan('Symbol changes:'));
        const added = symbols.filter(s => s.change_type === 'added');
        const removed = symbols.filter(s => s.change_type === 'removed');
        const modified = symbols.filter(s => s.change_type !== 'added' && s.change_type !== 'removed');
        if (added.length > 0) {
            console.log(chalk_1.default.green('Added:'));
            added.forEach(s => console.log(`  + ${s.kind} ${s.name}`));
        }
        if (removed.length > 0) {
            console.log(chalk_1.default.red('Removed:'));
            removed.forEach(s => console.log(`  - ${s.kind} ${s.name}`));
        }
        if (modified.length > 0) {
            console.log(chalk_1.default.yellow('Modified:'));
            modified.forEach(s => console.log(`  ~ ${s.kind} ${s.name} (${s.change_type})`));
        }
    }
}
exports.showCommit = showCommit;
async function searchSymbol(name) {
    const searchIndex = (0, index_1.getSearchIndex)();
    console.log(chalk_1.default.blue(`Searching for symbol: ${name}`));
    const results = searchIndex.searchSymbolsByName(name, 20);
    if (results.length === 0) {
        console.log('No symbols found matching that name.');
        return;
    }
    console.log(chalk_1.default.cyan(`Found ${results.length} matches:`));
    console.log('');
    for (const result of results) {
        console.log(chalk_1.default.yellow(`${result.name}`));
        console.log(`  Path: ${result.path}`);
        console.log(`  Commit: ${result.sha}`);
        if (result.summary_snippet) {
            console.log(`  Context: ${result.summary_snippet}`);
        }
        console.log('');
    }
}
exports.searchSymbol = searchSymbol;
async function showLastCommits(count) {
    await (0, database_1.ensureDatabaseInitialized)();
    const db = (0, database_1.getDatabaseManager)().getDatabase();
    const commitsStmt = db.prepare(`
    SELECT sha, author, date, message, files_changed, symbols_added, symbols_modified, symbols_removed
    FROM commits
    ORDER BY date DESC
    LIMIT ?
  `);
    const commits = commitsStmt.all(count);
    if (commits.length === 0) {
        console.log(chalk_1.default.yellow('No analyzed commits found. Run "ct analyze" first.'));
        return;
    }
    console.log(chalk_1.default.blue(`Last ${commits.length} analyzed commits:`));
    console.log('');
    for (const commit of commits) {
        console.log(chalk_1.default.green(commit.sha.substring(0, 8)));
        console.log(`  ${commit.message.split('\n')[0]}`);
        console.log(chalk_1.default.gray(`  ${commit.author} on ${commit.date}`));
        console.log(`  ${commit.files_changed} files, +${commit.symbols_added} -${commit.symbols_removed} ~${commit.symbols_modified} symbols`);
        console.log('');
    }
}
exports.showLastCommits = showLastCommits;
//# sourceMappingURL=queries.js.map