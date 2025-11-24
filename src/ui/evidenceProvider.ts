import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { getGitRoot } from '../utils/config';

export class EvidenceProvider implements vscode.TextDocumentContentProvider {
    // Event emitter for content changes
    private _onDidChange = new vscode.EventEmitter<vscode.Uri>();
    readonly onDidChange = this._onDidChange.event;

    provideTextDocumentContent(uri: vscode.Uri): string {
        try {
            const evidencePath = uri.path; // e.g., "bundle.shas"
            const gitRoot = getGitRoot();

            if (!gitRoot) {
                return JSON.stringify({ error: "Not in a git repository" }, null, 2);
            }

            const factsPath = path.join(gitRoot, '.git', 'commit-tracker', 'last-bundle-facts.json');

            if (!fs.existsSync(factsPath)) {
                return JSON.stringify({ error: "No facts file found. Generate a report first." }, null, 2);
            }

            const factsContent = fs.readFileSync(factsPath, 'utf8');
            const facts = JSON.parse(factsContent);

            // 1. Check if the path exists directly in the evidence object
            // This allows us to override simple counts (like scope.files) with detailed lists
            if (facts.evidence && facts.evidence[evidencePath]) {
                return JSON.stringify(facts.evidence[evidencePath], null, 2);
            }

            // 2. Fallback: Traverse the object using the path
            // Path might be dot-notation: "bundle.shas" or "findings.incompleteness"
            const parts = evidencePath.split('.');
            let current = facts;

            for (const part of parts) {
                if (current === undefined || current === null) break;
                current = current[part];
            }

            if (current === undefined) {
                return JSON.stringify({ error: `Evidence path not found: ${evidencePath}` }, null, 2);
            }

            // Return formatted JSON
            return JSON.stringify(current, null, 2);

        } catch (error) {
            return JSON.stringify({
                error: "Failed to load evidence",
                details: error instanceof Error ? error.message : String(error)
            }, null, 2);
        }
    }
}
