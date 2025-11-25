import * as crypto from 'crypto';
import { SymbolInfo } from '../types';
import { DatabaseManager } from '../storage/database';
import { logDebug, logInfo } from '../utils/logger';
import { getLLMClient } from '../llm/openrouter';

interface DnaFingerprint {
    signatureHash: string;
    bodyHash: string;
}

interface DnaMatchResult {
    dnaId: string;
    confidence: number;
    method: 'exact' | 'signature' | 'body' | 'llm' | 'new';
    reason?: string;
}

export class SymbolDnaEngine {
    private dbManager: DatabaseManager;

    constructor(dbManager: DatabaseManager) {
        this.dbManager = dbManager;
    }

    /**
     * Compute deterministic fingerprint for a symbol
     */
    public computeFingerprint(symbol: SymbolInfo, content: string): DnaFingerprint {
        // Extract signature and body content
        // This is a simplified extraction - in reality we'd use the AST location
        const lines = content.split('\n');
        const startLine = symbol.location.start.line - 1;
        const endLine = symbol.location.end.line - 1;
        const symbolContent = lines.slice(startLine, endLine + 1).join('\n');

        // Simple heuristic: First line is signature, rest is body
        // A real implementation would use the AST to separate these accurately
        const signature = lines[startLine].trim();
        const body = lines.slice(startLine + 1, endLine + 1).join('\n').trim();

        return {
            signatureHash: this.hash(signature),
            bodyHash: this.hash(body)
        };
    }

    private hash(text: string): string {
        return crypto.createHash('sha256').update(text).digest('hex');
    }

    /**
     * Resolve the DNA identity for a symbol in a specific commit/file
     */
    public async resolveSymbolIdentity(
        symbol: SymbolInfo,
        content: string,
        sha: string,
        path: string
    ): Promise<string> {
        const fingerprint = this.computeFingerprint(symbol, content);
        const db = this.dbManager.getDatabase();

        // 1. Check for existing DNA for this specific instance (idempotency)
        const existing = db.prepare(`
      SELECT dna_id FROM symbol_versions 
      WHERE sha = ? AND path = ? AND symbol_id = ?
    `).get(sha, path, symbol.id);

        if (existing) {
            return existing.dna_id;
        }

        // 2. Exact Match (Signature + Body)
        const exactMatch = db.prepare(`
      SELECT dna_id FROM symbol_versions 
      WHERE signature_hash = ? AND body_hash = ?
      ORDER BY id DESC LIMIT 1
    `).get(fingerprint.signatureHash, fingerprint.bodyHash);

        if (exactMatch) {
            await this.recordVersion(symbol, sha, path, exactMatch.dna_id, fingerprint);
            return exactMatch.dna_id;
        }

        // 3. Signature Match (Body Changed)
        const sigMatch = db.prepare(`
      SELECT dna_id, path, body_hash FROM symbol_versions 
      WHERE signature_hash = ? 
      ORDER BY (path = ?) DESC, id DESC LIMIT 1
    `).get(fingerprint.signatureHash, path);

        if (sigMatch) {
            // High confidence if signature matches
            await this.recordVersion(symbol, sha, path, sigMatch.dna_id, fingerprint);
            return sigMatch.dna_id;
        }

        // 4. Body Match (Rename/Move)
        const bodyMatch = db.prepare(`
      SELECT dna_id, path, name FROM symbol_versions 
      WHERE body_hash = ? 
      ORDER BY (path = ?) DESC, id DESC LIMIT 1
    `).get(fingerprint.bodyHash, path);

        if (bodyMatch) {
            // High confidence if body matches exactly
            await this.recordVersion(symbol, sha, path, bodyMatch.dna_id, fingerprint);
            return bodyMatch.dna_id;
        }

        // 5. LLM Tie-Breaker for Ambiguous Cases
        // Look for candidates: same name but different sig/body, or same file but different name
        const candidates = db.prepare(`
      SELECT dna_id, name, path, signature_hash, body_hash, kind 
      FROM symbol_versions 
      WHERE (name = ? OR path = ?)
      AND sha != ? -- Don't match against current commit (if we inserted partials)
      ORDER BY id DESC LIMIT 5
    `).all(symbol.name, path, sha);

        if (candidates.length > 0) {
            const bestMatch = await this.resolveAmbiguity(symbol, content, candidates);
            if (bestMatch) {
                await this.recordVersion(symbol, sha, path, bestMatch.dnaId, fingerprint);
                await this.logDecision(sha, symbol.id, bestMatch.dnaId, 'llm_tie_breaker', bestMatch.confidence, bestMatch.reason);
                return bestMatch.dnaId;
            }
        }

        // 6. Create new DNA
        const newDnaId = crypto.randomUUID();
        await this.createNewDna(newDnaId, sha, path);
        await this.recordVersion(symbol, sha, path, newDnaId, fingerprint);

        return newDnaId;
    }

    private async resolveAmbiguity(
        symbol: SymbolInfo,
        content: string,
        candidates: any[]
    ): Promise<{ dnaId: string; confidence: number; reason: string } | null> {
        try {
            const client = getLLMClient();

            // Construct prompt
            const prompt = `
You are a code analysis expert. Determine if the NEW_SYMBOL is a modification/rename of any CANDIDATE symbol.
Return JSON: { "match_index": number | -1, "confidence": number, "reason": string }
-1 means no match (it's a new symbol).

NEW_SYMBOL:
Name: ${symbol.name}
Path: ${symbol.id.split(':')[0]}
Kind: ${symbol.kind}
Signature: ${symbol.signature}

CANDIDATES:
${candidates.map((c, i) => `[${i}] ${c.name} (${c.kind}) in ${c.path}`).join('\n')}
`;

            const response = await client.complete([
                { role: 'system', content: 'You are a precise code analysis engine. Output JSON only.' },
                { role: 'user', content: prompt }
            ], { jsonMode: true, maxTokens: 200 });

            const result = JSON.parse(response);
            if (result.match_index >= 0 && result.match_index < candidates.length && result.confidence > 0.7) {
                return {
                    dnaId: candidates[result.match_index].dna_id,
                    confidence: result.confidence,
                    reason: result.reason
                };
            }
        } catch (error) {
            logDebug(`LLM tie-breaker failed: ${error instanceof Error ? error.message : String(error)}`);
        }
        return null;
    }

    private async logDecision(sha: string, symbolId: string, dnaId: string, type: string, confidence: number, reason: string) {
        const db = this.dbManager.getDatabase();
        db.prepare(`
      INSERT INTO dna_decision_log (sha, symbol_id, dna_id, decision_type, confidence, reasoning)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(sha, symbolId, dnaId, type, confidence, reason);
    }

    private async createNewDna(dnaId: string, sha: string, path: string) {
        const db = this.dbManager.getDatabase();
        db.prepare(`
      INSERT INTO symbol_dna (dna_id, first_seen_sha, first_seen_path)
      VALUES (?, ?, ?)
    `).run(dnaId, sha, path);
    }

    private async recordVersion(
        symbol: SymbolInfo,
        sha: string,
        path: string,
        dnaId: string,
        fp: DnaFingerprint
    ) {
        const db = this.dbManager.getDatabase();
        db.prepare(`
      INSERT INTO symbol_versions 
      (dna_id, sha, path, symbol_id, name, kind, signature_hash, body_hash)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
            dnaId,
            sha,
            path,
            symbol.id,
            symbol.name,
            symbol.kind,
            fp.signatureHash,
            fp.bodyHash
        );
    }
}
