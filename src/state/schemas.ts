import { z } from 'zod';

export const HotspotSchema = z.object({
  path: z.string(),
  score: z.number(),
  name: z.string().optional(),
  count: z.number().optional(),
  status: z.string().optional(),
  added: z.number().optional(),
  removed: z.number().optional(),
  size: z.number().optional(),
  touchedInVersions: z.array(z.string()).optional(),
  touchedInVersionsDescription: z.string().optional(),
});

export type TreemapNode = {
  name: string;
  value: number;
  children?: TreemapNode[];
  path?: string;
  score?: number;
  weight?: number;
  added?: number;
  removed?: number;
};

export const TreemapNodeSchema: z.ZodType<TreemapNode> = z.object({
  name: z.string(),
  value: z.number(),
  children: z.lazy(() => z.array(TreemapNodeSchema)).optional(),
  path: z.string().optional(),
  score: z.number().optional(),
  weight: z.number().optional(),
  added: z.number().optional(),
  removed: z.number().optional(),
});

export const BundleFactsSchema = z
  .object({
    version: z.string(),
    generated_at: z.string(),
    confidence: z.number(),
    partial: z.boolean().optional(),
    partialReasons: z.array(z.string()).optional(),
    bundle: z.object({
      oldestSha: z.string(),
      newestSha: z.string(),
      shas: z.array(z.string()),
      timeline: z.array(z.string()).optional(),
      movedLineage: z.array(z.any()).optional(),
      totalCommits: z.number().optional(),
    }),
    scope: z.object({
      files: z.number(),
      blastRadius: z.number(),
    }),
    intended: z.object({
      present: z.number(),
      absent: z.number(),
      renamed: z.number(),
    }),
    working: z.object({
      symbols: z.number(),
      edges: z.number(),
    }),
    evidence: z
      .object({
        hotspots: z.array(HotspotSchema).optional(),
        'scope.files': z.array(z.string()).optional(),
        'working.symbols': z.array(z.any()).optional(),
      })
      .passthrough(),
    findings: z
      .object({
        hotspots: z.array(HotspotSchema).optional(),
        incompleteness: z
          .object({
            missing: z.number(),
            zombies: z.number(),
            divergent: z.number(),
            missing_edges: z.number().optional(),
            zombie_edges: z.number().optional(),
          })
          .passthrough()
          .optional(),
        patternDrift: z
          .object({
            mixedTargets: z.number(),
            oldNamespaces: z.number(),
            conventionDrift: z.any().optional(),
            mixedConventionFiles: z.number().optional(),
          })
          .optional(),
        legacyAudit: z
          .object({
            dead: z.number(),
            legacyUsed: z.number(),
            replacedLeftovers: z.array(z.any()),
          })
          .optional(),
        unresolvedCallers: z
          .object({
            total: z.number(),
          })
          .optional(),
      })
      .passthrough()
      .optional(),
  })
  .passthrough();

export const BundleViewSchema = z
  .object({
    tier: z.enum(['hybrid', 'structure', 'semantics']),
    hotspots: z.array(HotspotSchema),
    treemap: z.array(TreemapNodeSchema).optional(),
    summary: z
      .object({
        commits: z.number(),
        files: z.number(),
        symbols: z.number(),
      })
      .passthrough(),
    skeleton: z.any().optional(),
    virtualCommits: z.any().optional(),
    risks: z.array(z.any()).optional(),
  })
  .passthrough();

export const CommitDTOSchema = z.object({
  sha: z.string(),
  shortSha: z.string(),
  message: z.string(),
  author: z.string(),
  authoredAt: z.string(),
  changes: z.number(),
  inBundle: z.boolean(),
  scope: z.enum(['staged', 'unstaged', 'history']),
  analyzed: z.boolean().optional(),
  files: z.array(z.object({ path: z.string(), status: z.string() })).optional(),
});

export const FileDTOSchema = z.object({
  path: z.string(),
  status: z.string(),
});

export const SymbolDTOSchema = z.object({
  id: z.string(),
  name: z.string(),
  path: z.string(),
  kind: z.string(),
  language: z.string(),
  changeType: z.enum(['added', 'modified', 'removed']).optional(),
  commitCount: z.number(),
  lastChangedAt: z.string(),
});

export const ReportDTOSchema = z.object({
  id: z.string(),
  title: z.string(),
  summary: z.string(),
  createdAt: z.string(),
  branch: z.string().optional(),
  pinned: z.boolean().optional(),
  bundleSummary: z.any().optional(),
  criticalCount: z.number().optional(),
});

export const BundleSummarySchema = z
  .object({
    id: z.string(),
    commitCount: z.number(),
    fileCount: z.number(),
    symbolCount: z.number(),
    createdAt: z.string().optional(),
    debtScore: z.number().optional(),
  })
  .passthrough();

export const BundleConfigSchema = z.object({
  mode: z.enum(['repo', 'module', 'changes', 'custom']),
  roots: z.array(z.string()),
  includeConnected: z.boolean(),
  exclusions: z.array(z.string()),
});

export const ContextFrameSchema = z.object({
  level: z.enum(['bundle', 'blast_radius', 'file', 'symbol', 'folder']),
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  parentId: z.string().optional(),
  status: z.enum(['ready', 'scanning', 'analyzing', 'unknown', 'error']),
  data: z.any().optional(),
  breadcrumbs: z.array(z.string()).optional(),
  tier: z.enum(['structure', 'hybrid', 'semantics']).optional(),
});

export const ExplorerNodeSchema: z.ZodType<any> = z.lazy(() =>
  z.object({
    id: z.string(),
    name: z.string(),
    description: z.string().optional(),
    type: z.enum(['file', 'symbol', 'folder']),
    status: z.enum(['ready', 'scanning', 'analyzing', 'unknown', 'error']),
    children: z.array(ExplorerNodeSchema).optional(),
  })
);

export const LiveAnalysisSummarySchema = z.object({
  missing: z.number(),
  zombies: z.number(),
  drift: z.number(),
  dead: z.number(),
  hybridDrifts: z.number().optional(),
});

export const NodeMetricsSchema = z.object({
  riskScore: z.number(),
  churnScore: z.number(),
  lastModified: z.number(),
  driftCount: z.number(),
  incomingRefs: z.number(),
  outgoingRefs: z.number(),
  authors: z.array(z.string()),
  ageDays: z.number(),
});

export const CockpitPayloadSchema = z.object({
  bundleFacts: BundleFactsSchema.nullable().optional(),
  bundleSummary: BundleSummarySchema.nullable().optional(),
  bundleView: BundleViewSchema.nullable().optional(),
  activeFrame: ContextFrameSchema.optional(),
  history: z.array(ContextFrameSchema).optional(),
  explorerData: z.array(ExplorerNodeSchema).optional(),
  nodeMetrics: z.record(NodeMetricsSchema).optional(),
  isAnalyzing: z.boolean().optional(),
  analysisStep: z.string().optional(),
  analysisProgress: z.number().optional(),
  error: z.string().nullable().optional(),
  liveAnalysis: z
    .object({
      isTracking: z.boolean(),
      pendingChanges: z.number(),
      totalEdits: z.number(),
      status: z.enum(['idle', 'analyzing', 'ready', 'error']),
      summary: LiveAnalysisSummarySchema.nullable(),
      facts: z.any().nullable(),
    })
    .optional(),
  repoName: z.string().nullable().optional(),
  branchName: z.string().nullable().optional(),
  bundleConfig: BundleConfigSchema.optional(),
  lastNCommits: z.number().optional(),
  commits: z.array(CommitDTOSchema).optional(),
  hasMoreCommits: z.boolean().optional(),
  llmOutputs: z.any().optional(),
  retrievedHistory: z.any().optional(),
  headInfo: z
    .object({
      sha: z.string(),
      date: z.string(),
      message: z.string(),
      author: z.string(),
    })
    .optional(),
});

export const CockpitClientMessageSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('ready') }),
  z.object({
    type: z.literal('runAnalysis'),
    mode: z.enum(['selection', 'lastN', 'staged', 'unstaged', 'changes']),
    lastN: z.number().optional(),
    force: z.boolean().optional(),
  }),
  z.object({ type: z.literal('openReport'), reportId: z.string() }),
  z.object({ type: z.literal('regenerateReport'), reportId: z.string() }),
  z.object({ type: z.literal('togglePinReport'), reportId: z.string() }),
  z.object({ type: z.literal('deleteReport'), reportId: z.string() }),
  z.object({ type: z.literal('navigateToFrame'), frame: ContextFrameSchema }),
  z.object({ type: z.literal('navigateBack') }),
  z.object({ type: z.literal('switchBundle'), id: z.string() }),
  z.object({
    type: z.literal('askAssistant'),
    payload: z.object({
      text: z.string().optional(),
      frame: ContextFrameSchema.optional(),
      symbolId: z.string().optional(),
      filePath: z.string().optional(),
      drift: z.any().optional(),
    }),
  }),
  z.object({
    type: z.literal('applyRefactorSuggestion'),
    payload: z.object({
      symbolId: z.string(),
      suggestedName: z.string(),
      filePath: z.string().optional(),
    }),
  }),
  z.object({ type: z.literal('openSymbolInEditor'), symbolId: z.string() }),
  z.object({ type: z.literal('analyzeFrame'), frameId: z.string() }),
  z.object({ type: z.literal('getExplorerTree') }),
  z.object({ type: z.literal('getBundleData') }),
  z.object({ type: z.literal('updateBundleConfig'), config: BundleConfigSchema.partial() }),
  z.object({ type: z.literal('setLastNCommits'), value: z.number() }),
  z.object({
    type: z.literal('updateCommitIndex'),
    payload: z.object({ commitIndex: z.number() }),
  }),
  z.object({ type: z.literal('clearError') }),
  z.object({ type: z.literal('getHeadInfo') }),
]);

export const CockpitStateSchema = z
  .object({
    repoName: z.string().nullable(),
    branchName: z.string().nullable(),
    workspaceScope: z.enum(['workspace', 'staged', 'unstaged']).optional(),
    metrics: z
      .object({
        debtScore: z.number().optional(),
        symbolCount: z.number().optional(),
        fileCount: z.number().optional(),
      })
      .optional(),
    activeSection: z.enum(['commits', 'bundle', 'symbols', 'reports', 'live']),
    isAnalyzing: z.boolean(),
    analysisStep: z.string().optional(),
    analysisProgress: z.number().optional(),
    error: z.string().nullable().optional(),
    currentStepId: z.string().nullable().optional(),
    pipelineErrors: z.array(z.object({ stepId: z.string(), error: z.string() })).optional(),
    pipelineStepTimings: z.record(z.number()).optional(),
    retrievedHistory: z.any().optional(),
    workspaceFacts: z.any().nullable().optional(),
    llmOutputs: z.any().optional(),
    headInfo: z
      .object({
        sha: z.string(),
        date: z.string(),
        message: z.string(),
        author: z.string(),
      })
      .optional(),
    selectedCommitShas: z.array(z.string()),
    selectedStagedPaths: z.array(z.string()),
    selectedUnstagedPaths: z.array(z.string()),
    commits: z.array(CommitDTOSchema),
    hasMoreCommits: z.boolean(),
    commitsFilterText: z.string(),
    commitsFilterScopes: z.object({
      staged: z.boolean(),
      unstaged: z.boolean(),
      history: z.boolean(),
    }),
    lastNCommits: z.number(),
    stagedFiles: z.array(FileDTOSchema),
    unstagedFiles: z.array(FileDTOSchema),
    bundleSummary: BundleSummarySchema.nullable().optional(),
    bundleFacts: BundleFactsSchema.nullable().optional(),
    bundleReportId: z.string().nullable(),
    bundleView: BundleViewSchema.nullable(),
    bundleViewVersion: z.number(),
    symbols: z.array(SymbolDTOSchema),
    symbolFilterText: z.string(),
    symbolKindFilter: z.string(),
    symbolChangeFilter: z.string(),
    activeSymbolId: z.string().nullable(),
    activeSymbolHistory: z.array(z.any()),
    reports: z.array(ReportDTOSchema),
    reportsFilterText: z.string(),
    reportsBranchFilter: z.string(),
    reportsShowPinnedOnly: z.boolean(),
    selectedFiles: z.array(z.string()).optional(),
    liveAnalysis: z.object({
      isTracking: z.boolean(),
      pendingChanges: z.number(),
      totalEdits: z.number(),
      status: z.enum(['idle', 'analyzing', 'ready', 'error']),
      summary: z.any().nullable(),
      facts: z.any().nullable(),
    }),
    bundleConfig: BundleConfigSchema,
    activeFrame: ContextFrameSchema,
    history: z.array(ContextFrameSchema),
    explorerData: z.array(ExplorerNodeSchema),
    actionHistory: z
      .array(
        z.object({
          type: z.string(),
          payload: z.any().optional(),
          timestamp: z.string(),
        })
      )
      .optional(),
  })
  .passthrough();

export const CockpitHostMessageSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('setData'),
    payload: CockpitPayloadSchema,
  }),
  z.object({
    type: z.literal('setProgress'),
    payload: z.object({
      isAnalyzing: z.boolean(),
      step: z.string().optional(),
      progress: z.number().optional(),
    }),
  }),
  z.object({
    type: z.literal('focusSection'),
    payload: z.object({
      section: z.enum(['commits', 'bundle', 'symbols', 'reports', 'live']),
    }),
  }),
  z.object({
    type: z.literal('assistantResponse'),
    payload: z.object({ text: z.string() }),
  }),
  z.object({
    type: z.literal('updateExplorerTree'),
    payload: z.array(ExplorerNodeSchema),
  }),
  z.object({
    type: z.literal('updateFrame'),
    payload: z.object({
      frame: ContextFrameSchema,
      data: z.any(),
    }),
  }),
]);

export const ActionPayloadSchemas: Record<string, z.ZodType<any>> = {
  BUNDLE_VIEW_UPDATED: z.object({
    view: BundleViewSchema,
  }),
  ANALYSIS_COMPLETED: z.object({
    facts: BundleFactsSchema,
    summary: z.any(),
    reportId: z.string(),
  }),
  FRAME_DATA_UPDATED: z.object({
    frameId: z.string(),
    data: z.union([BundleViewSchema, z.any()]),
  }),
};

/* ---------- Analysis Tier Schemas ---------- */

export const Tier1DataSchema = z.object({
  content: z.string(),
  lineCount: z.number(),
  language: z.string(),
  filePath: z.string(),
  fileExists: z.boolean(),
  symbols: z.array(z.any()).optional(),
  symbolId: z.string().optional(),
});

export const Tier2DataSchema = z.object({
  blastRadius: z.object({
    incoming: z.array(z.any()),
    outgoing: z.array(z.any()),
  }),
  hotspots: z.array(z.any()),
  drift: z.array(z.any()),
  hotspotScore: z.number().optional(),
  history: z.any().optional(),
  diff: z.any().optional(),
  lineCommits: z
    .array(
      z.object({
        line: z.number(),
        commitSha: z.string(),
        author: z.string(),
        date: z.string(),
      })
    )
    .optional(),
});

export const Tier3DataSchema = z.object({
  summary: z.string(),
  risks: z.array(z.any()),
});
