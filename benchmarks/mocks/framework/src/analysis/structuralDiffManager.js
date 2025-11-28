"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StructuralDiffManager = void 0;
const difftastic_1 = require("./difftastic");
const cstDiff_1 = require("./cstDiff");
const logger_1 = require("../utils/logger");
class StructuralDiffManager {
    constructor(db) {
        this.db = db;
        this.difftastic = (0, difftastic_1.getDifftasticIntegration)();
        this.cstDiff = (0, cstDiff_1.getCstDiffManager)();
    }
    /**
     * Get or create structural diff (content-addressed caching)
     */
    async getOrCreateStructuralDiff(parentBlobSha, currentBlobSha, filePath, parentContent, currentContent) {
        // Check cache
        const cached = this.getCachedDiff(parentBlobSha, currentBlobSha, filePath);
        if (cached) {
            (0, logger_1.logDebug)(`[StructDiff] Cache hit for ${filePath} ${parentBlobSha.substring(0, 8)}→${currentBlobSha.substring(0, 8)}`);
            return cached;
        }
        // Run difftastic
        (0, logger_1.logDebug)(`[StructDiff] Computing diff for ${filePath}`);
        const difftasticResult = await this.difftastic.runDifftastic(parentContent, currentContent, filePath, filePath);
        const metrics = this.extractMetrics(difftasticResult);
        // Store to cache
        this.storeDiff(parentBlobSha, currentBlobSha, filePath, metrics);
        return metrics;
    }
    getCachedDiff(parentBlobSha, currentBlobSha, filePath) {
        const stmt = this.db.prepare(`
      SELECT * FROM structural_diffs
      WHERE parent_blob_sha = ? AND current_blob_sha = ? AND file_path = ?
    `);
        const row = stmt.get([parentBlobSha, currentBlobSha, filePath]);
        if (!row)
            return null;
        return {
            structuralChangeScore: row.structural_change_score,
            controlFlowChanged: row.control_flow_changed === 1,
            interfaceChanged: row.interface_changed === 1,
            movedBlocks: row.moved_blocks,
            linesAdded: row.lines_added,
            linesRemoved: row.lines_removed,
            rawData: row.data_json ? JSON.parse(row.data_json) : undefined
        };
    }
    storeDiff(parentBlobSha, currentBlobSha, filePath, metrics) {
        const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO structural_diffs
      (parent_blob_sha, current_blob_sha, file_path, structural_change_score,
       control_flow_changed, interface_changed, moved_blocks, lines_added,
       lines_removed, data_json, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
        stmt.run([
            parentBlobSha,
            currentBlobSha,
            filePath,
            metrics.structuralChangeScore,
            metrics.controlFlowChanged ? 1 : 0,
            metrics.interfaceChanged ? 1 : 0,
            metrics.movedBlocks,
            metrics.linesAdded,
            metrics.linesRemoved,
            metrics.rawData ? JSON.stringify(metrics.rawData) : null,
            new Date().toISOString()
        ]);
    }
    extractMetrics(difftasticOutput) {
        // Use parsed hunks and tags from enhanced difftastic output
        const hunks = difftasticOutput.hunks || [];
        const tags = difftasticOutput.tags || new Map();
        const highlights = difftasticOutput.highlights || [];
        const morphs = difftasticOutput.morphs || [];
        // Calculate lines added/removed from hunks
        let linesAdded = 0;
        let linesRemoved = 0;
        for (const hunk of hunks) {
            linesAdded += hunk.linesAdded || 0;
            linesRemoved += hunk.linesRemoved || 0;
        }
        // Fallback: if hunks not available, parse raw difftastic output text
        if (hunks.length === 0 && difftasticOutput.rawData) {
            const rawOutput = typeof difftasticOutput.rawData === 'string'
                ? difftasticOutput.rawData
                : JSON.stringify(difftasticOutput.rawData);
            // Parse @@ hunk headers with regex
            const hunkRegex = /^@@ -(\d+),?(\d*) \+(\d+),?(\d*) @@/gm;
            const hunkLines = rawOutput.split('\n');
            for (let i = 0; i < hunkLines.length; i++) {
                const line = hunkLines[i];
                if (line.startsWith('+') && !line.startsWith('+++')) {
                    linesAdded++;
                }
                else if (line.startsWith('-') && !line.startsWith('---')) {
                    linesRemoved++;
                }
            }
        }
        // Detect control-flow changes from tagged lines
        let controlFlowChanged = false;
        for (const [, lineTags] of tags) {
            if (lineTags.includes('control-flow')) {
                controlFlowChanged = true;
                break;
            }
        }
        // Detect interface changes from tagged lines or morphs
        let interfaceChanged = false;
        for (const [, lineTags] of tags) {
            if (lineTags.includes('interface')) {
                interfaceChanged = true;
                break;
            }
        }
        // Count moved blocks from morphs or heuristics
        const movedBlocks = morphs.filter((m) => m.type === 'moved_block').length;
        // Calculate structural change score: min(linesChanged / 10, 1.0)
        const linesChanged = linesAdded + linesRemoved;
        const structuralChangeScore = Math.min(linesChanged / 10, 1.0);
        return {
            structuralChangeScore,
            controlFlowChanged,
            interfaceChanged,
            movedBlocks,
            linesAdded,
            linesRemoved,
            rawData: difftasticOutput
        };
    }
    /**
     * Compute CST delta for hybrid facts (CST-only or hybrid augmentation)
     */
    async computeCstDelta(oldSerialized, newSerialized, filePath) {
        return this.cstDiff.computeCstDelta(oldSerialized, newSerialized, filePath);
    }
}
exports.StructuralDiffManager = StructuralDiffManager;
