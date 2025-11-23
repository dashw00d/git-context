import { LegacyAuditReport } from '../contracts/llmContext';
export declare class LegacyAuditService {
    private git;
    private symbolExtractor;
    private dependencyExtractor;
    constructor();
    /**
     * Audit drift between intended state (commits) and working tree
     */
    auditDrift(shas: string[]): Promise<LegacyAuditReport>;
    private computeScopePaths;
    private snapshotWorkingTree;
    private buildIntendedMap;
    private compareIntendedVsWorking;
}
//# sourceMappingURL=legacyAudit.d.ts.map