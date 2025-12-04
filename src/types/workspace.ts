export interface WorkspaceFacts {
  workspaceHash: string;
  headSha: string;
  symbolsAdded: number;
  symbolsModified: number;
  symbolsRemoved: number;
  edgesAdded: number;
  edgesRemoved: number;
  risks: string[];
  filesChanged: number;
  structuralChangeScore: number;
  blastRadius: number;
  incoming?: Map<string, string[]>;
  outgoing?: Map<string, string[]>;
}
