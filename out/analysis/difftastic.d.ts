export interface DifftasticResult {
    highlights: string[];
    morphs: MorphHighlight[];
    hasStructuralChanges: boolean;
}
export interface MorphHighlight {
    type: 'signature_change' | 'moved_block' | 'refactor' | 'rename';
    description: string;
    location?: {
        file: string;
        line: number;
    };
}
export declare class DifftasticIntegration {
    private difftasticPath;
    constructor();
    /**
     * Find difftastic binary path
     */
    private findDifftasticPath;
    /**
     * Check if a path points to a valid difftastic binary
     */
    private isValidDifftasticPath;
    /**
     * Run difftastic on two file versions
     */
    runDifftastic(oldContent: string, newContent: string, oldFilePath: string, newFilePath: string): Promise<DifftasticResult>;
    /**
     * Parse difftastic output to extract structural highlights
     */
    private parseDifftasticOutput;
    /**
     * Extract location information from a difftastic output line
     */
    private extractLocationFromLine;
    /**
     * Run difftastic on a git commit to get structural highlights
     */
    getCommitStructuralHighlights(sha: string, filePath: string): Promise<DifftasticResult>;
    /**
     * Check if difftastic is available
     */
    isAvailable(): boolean;
}
export declare function getDifftasticIntegration(): DifftasticIntegration;
//# sourceMappingURL=difftastic.d.ts.map