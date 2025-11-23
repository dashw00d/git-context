#!/usr/bin/env node
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const commander_1 = require("commander");
const analyze_1 = require("./analyze");
const queries_1 = require("./queries");
const hooks_1 = require("./hooks");
const chalk_1 = __importDefault(require("chalk"));
const program = new commander_1.Command();
program
    .name('ct')
    .description('Commit Tracker CLI')
    .version('0.1.0');
program
    .command('analyze')
    .description('Analyze commits')
    .option('-c, --count <number>', 'number of commits to analyze', '5')
    .action(async (options) => {
    const count = parseInt(options.count);
    console.log(chalk_1.default.blue(`Analyzing last ${count} commits...`));
    try {
        await (0, analyze_1.analyzeLastCommits)(count);
        console.log(chalk_1.default.green('Analysis complete!'));
    }
    catch (error) {
        console.error(chalk_1.default.red(`Analysis failed: ${error}`));
        process.exit(1);
    }
});
program
    .command('staged')
    .description('Analyze staged changes')
    .action(async () => {
    console.log(chalk_1.default.blue('Analyzing staged changes...'));
    try {
        await (0, analyze_1.analyzeStagedChanges)();
        console.log(chalk_1.default.green('Staged analysis complete!'));
    }
    catch (error) {
        console.error(chalk_1.default.red(`Staged analysis failed: ${error}`));
        process.exit(1);
    }
});
program
    .command('show <sha>')
    .description('Show commit analysis')
    .action(async (sha) => {
    try {
        await (0, queries_1.showCommit)(sha);
    }
    catch (error) {
        console.error(chalk_1.default.red(`Failed to show commit: ${error}`));
        process.exit(1);
    }
});
program
    .command('symbol <name>')
    .description('Search symbol history')
    .action(async (name) => {
    try {
        await (0, queries_1.searchSymbol)(name);
    }
    catch (error) {
        console.error(chalk_1.default.red(`Symbol search failed: ${error}`));
        process.exit(1);
    }
});
program
    .command('last [count]')
    .description('Show last analyzed commits')
    .option('-n, --count <number>', 'number of commits to show', '5')
    .action(async (options) => {
    try {
        await (0, queries_1.showLastCommits)(parseInt(options.count));
    }
    catch (error) {
        console.error(chalk_1.default.red(`Failed to show commits: ${error}`));
        process.exit(1);
    }
});
program
    .command('install-hooks')
    .description('Install git hooks')
    .action(async () => {
    console.log(chalk_1.default.blue('Installing git hooks...'));
    try {
        await (0, hooks_1.installHooks)();
        console.log(chalk_1.default.green('Hooks installed successfully!'));
    }
    catch (error) {
        console.error(chalk_1.default.red(`Failed to install hooks: ${error}`));
        process.exit(1);
    }
});
program.parse();
//# sourceMappingURL=index.js.map