File Mappings


core/:

tree-sitter.ts (parser)
symbols.ts (extraction)
symbolDna.ts (DNA computation)
git.ts (Git ops)


indexing/:

commitIndexer.ts
workspaceIndexer.ts
snapshotManager.ts


diff/:

difftastic.ts
structuralDiffManager.ts
cstDiff.ts


cst/:

cstExtractor.ts
cstTimeline.ts
hybridDriftDetector.ts


detectors/ (expand existing):

hotspotDetector.ts
movedBlockDetector.ts
heuristics.ts (risk detection)


analysis/:

bundleStoryEngine.ts
liveAnalysis.ts
semanticChanges.ts


utils/:

astSerializer.ts
mermaidGenerator.ts
contextExporter.ts
embeddingIndexer.ts


conventions/:

namingConventions.ts
conventionEnhancements.ts


pipeline/ (expand runner/):

refactorPipeline.ts
Mermaid Diagram: New Structure