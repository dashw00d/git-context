[initializeExtension] OTLP exporter initialized/updated with direct backend connection
[ExtensionHostSampler] Sampling span "LocalCursorRulesService.load": ROOT_SPAN - sampleRate=0.1, random=0.9031, decision=NOT_RECORD
[ExtensionHostSampler] Sampling span "ClaudeSkillsCursorRulesService.load": ROOT_SPAN - sampleRate=0.1, random=0.7698, decision=NOT_RECORD
[ExtensionHostSampler] Sampling span "ClaudePluginsCursorRulesService.load": ROOT_SPAN - sampleRate=0.1, random=0.0914, decision=SAMPLED
[ExtensionHostSampler] Sampling span "MergedCursorRulesService.getAllCursorRules": ROOT_SPAN - sampleRate=0.1, random=0.8591, decision=NOT_RECORD
[ExtensionHostSampler] Sampling span "LocalCursorRulesService.getAllCursorRules": LOCAL_CHILD - inheriting parent's decision: NOT_RECORD
[ExtensionHostSampler] Sampling span "ClaudeSkillsCursorRulesService.getAllCursorRules": LOCAL_CHILD - inheriting parent's decision: NOT_RECORD
[ExtensionHostSampler] Sampling span "ClaudePluginsCursorRulesService.getAllCursorRules": LOCAL_CHILD - inheriting parent's decision: NOT_RECORD
[ExtensionHostSampler] Sampling span "MergedCursorRulesService.getAllCursorRules": ROOT_SPAN - sampleRate=0.1, random=0.1250, decision=NOT_RECORD
[ExtensionHostSampler] Sampling span "LocalCursorRulesService.getAllCursorRules": LOCAL_CHILD - inheriting parent's decision: NOT_RECORD
[ExtensionHostSampler] Sampling span "ClaudeSkillsCursorRulesService.getAllCursorRules": LOCAL_CHILD - inheriting parent's decision: NOT_RECORD
[ExtensionHostSampler] Sampling span "ClaudePluginsCursorRulesService.getAllCursorRules": LOCAL_CHILD - inheriting parent's decision: NOT_RECORD
[ExtensionHostSampler] Sampling span "LocalCursorRulesService.loadCursorrules": LOCAL_CHILD - inheriting parent's decision: NOT_RECORD
[ExtensionHostSampler] Sampling span "LocalCursorRulesService.loadRulesFromHierarchy": LOCAL_CHILD - inheriting parent's decision: NOT_RECORD
[ExtensionHostSampler] Sampling span "LocalCursorRulesService.dirIsDirectory": LOCAL_CHILD - inheriting parent's decision: NOT_RECORD
[ExtensionHostSampler] Sampling span "LocalCursorRulesService.loadAllRulesFromSubdirectories": LOCAL_CHILD - inheriting parent's decision: NOT_RECORD
[ExtensionHostSampler] Sampling span "LocalCursorRulesService.loadMarkdownFilesFromSubdirectories": LOCAL_CHILD - inheriting parent's decision: NOT_RECORD
[ExtensionHostSampler] Sampling span "LocalCursorRulesService.loadRulesFromCursorWorkspaceProjectDir": LOCAL_CHILD - inheriting parent's decision: NOT_RECORD
[ExtensionHostSampler] Sampling span "LocalCursorRulesService.dirIsDirectory": LOCAL_CHILD - inheriting parent's decision: NOT_RECORD
[ExtensionHostSampler] Sampling span "LocalCursorRulesService.loadRulesFromMarkdownFile": LOCAL_CHILD - inheriting parent's decision: NOT_RECORD
[ExtensionHostSampler] Sampling span "LocalCursorRulesService.loadRulesFromDirectory": LOCAL_CHILD - inheriting parent's decision: NOT_RECORD
[ExtensionHostSampler] Sampling span "LocalCursorRulesService.dirIsDirectory": LOCAL_CHILD - inheriting parent's decision: NOT_RECORD
[ExtensionHostSampler] Sampling span "LocalCursorRulesService.loadRulesFromMarkdownFile": LOCAL_CHILD - inheriting parent's decision: NOT_RECORD
[ExtensionHostSampler] Sampling span "LocalCursorRulesService.dirIsDirectory": LOCAL_CHILD - inheriting parent's decision: NOT_RECORD
[ExtensionHostSampler] Sampling span "LocalCursorRulesService.loadRulesFromMarkdownFile": LOCAL_CHILD - inheriting parent's decision: NOT_RECORD
[ExtensionHostSampler] Sampling span "LocalCursorRulesService.dirIsDirectory": LOCAL_CHILD - inheriting parent's decision: NOT_RECORD
[ExtensionHostSampler] Sampling span "LocalCursorRulesService.loadRulesFromMarkdownFile": LOCAL_CHILD - inheriting parent's decision: NOT_RECORD
[ExtensionHostSampler] Sampling span "LocalCursorRulesService.dirIsDirectory": LOCAL_CHILD - inheriting parent's decision: NOT_RECORD
[ExtensionHostSampler] Sampling span "LocalCursorRulesService.loadRulesFromMarkdownFile": LOCAL_CHILD - inheriting parent's decision: NOT_RECORD
[initializeExtension] Exporting spans to OTLP exporter 1
Git Context extension is activating...
Modules loaded successfully
DatabaseManager initialized with path: /home/ryan/sites/austinselite/.git/commit-tracker/commit_tracker.db
[Cockpit] Checking if initial commits need to be loaded...
[DB-INIT] Starting database initialization...
[DB-INIT] Loading SQL.js WASM...
[DB-INIT] WASM loaded in 32ms
[DB-INIT] Initializing schema...
[DB-INIT] Running modular schema migration...
[DB-INIT] Schema initialized in 76ms
[DB-INIT] Total initialization time: 112ms
[Cockpit] Database is empty, loading initial 5 commit metadata (without full analysis)...
[Cockpit] Initial commit metadata loaded. Full analysis will run when user requests it.
Core features registered successfully
[CockpitEffects] Constructed and subscribing to store
Cockpit features registered successfully
[BaseDetector:HotspotDetectorV2] Initialized with thresholds: {"similarityMin":0.7,"confidenceMin":0.5,"changeThreshold":3,"maxGroupSize":1000,"scoreWeight":1}
[BaseDetector:MovedBlockDetectorV2] Initialized with thresholds: {"similarityMin":0.7,"confidenceMin":0.5,"changeThreshold":3,"maxGroupSize":1000,"scoreWeight":1}
🔄 [REFRESH_REQUESTED] @ 10:50:59
   Payload: {"scope":"all"}

[StateLogger] REFRESH_REQUESTED
[Store] Action: REFRESH_REQUESTED payloadKeys=scope
[CockpitEffects] onAction received: REFRESH_REQUESTED
🔄 [REPORTS_UPDATED] @ 10:50:59
   Payload: {"reports":[]}

[StateLogger] REPORTS_UPDATED
[Store] Action: REPORTS_UPDATED payloadKeys=reports
[CockpitEffects] onAction received: REPORTS_UPDATED
[GitOperations] Starting git status --porcelain in /home/ryan/sites/austinselite
Git Context extension activated successfully
🔄 [SYMBOLS_UPDATED] @ 10:50:59
   Payload: {"symbols":[]}

[StateLogger] SYMBOLS_UPDATED
[Store] Action: SYMBOLS_UPDATED payloadKeys=symbols
[CockpitEffects] onAction received: SYMBOLS_UPDATED
🔄 [REPO_CONTEXT_UPDATED] @ 10:50:59
   Payload: {"repoName":"austinselite","branchName":"master"}

[StateLogger] REPO_CONTEXT_UPDATED
[Store] Action: REPO_CONTEXT_UPDATED payloadKeys=repoName,branchName
[CockpitEffects] onAction received: REPO_CONTEXT_UPDATED
[GitOperations] git status --porcelain completed in 40ms, 0 bytes
Staged files: 0
[GitOperations] Starting git ls-files --others in /home/ryan/sites/austinselite
[Cockpit] Loaded bundle config from workspace settings
[ContextSkeleton] Resolving skeleton for mode: repo
[ContextSkeleton] Resolved 553 files
[AnalysisController] Starting Quick Scan for 553 files...
[WorkspaceIndexer] Quick scanning 553 files (459 PHP, 21 JS/TS)...
[GitOperations] git ls-files --others completed in 1167ms, 0 bytes
🔄 [WORKSPACE_FILES_UPDATED] @ 10:51:00
   Payload: {"staged":[],"unstaged":[]}

[StateLogger] WORKSPACE_FILES_UPDATED
[Store] Action: WORKSPACE_FILES_UPDATED payloadKeys=staged,unstaged
[CockpitEffects] onAction received: WORKSPACE_FILES_UPDATED
[CockpitProvider] Payload schema validation passed
[CockpitProvider] Posted message: setData
[CockpitProvider] Payload schema validation passed
[CockpitProvider] Posted message: setData
[CockpitProvider] Payload schema validation passed
[CockpitProvider] Posted message: setData
[CockpitProvider] Payload schema validation passed
[CockpitProvider] Posted message: setData
Initializing 15 workers (2 reserved for on-demand, 13 for background)...
🔄 [COMMITS_UPDATED] @ 10:51:01
   Payload: {"commits":[{"sha":"b15320dd0316390b09a584ca603763a0f8bc8ce6","shortSha":"b15320dd","message":"refactor: Remove Tailwind CSS base styles from public app.css.","author":"Ryan","authoredAt":"2025-12-22 07:00:20 -0600","changes":0,"inBundle":false,"scope":"history","files":[],"analyzed":false},{"sha":"99fac67fd0c49fb7ac7f44525a0669802d087e83","shortSha":"99fac67f","message":"refactor: Update layout structure in event logs create and edit views for improved styling consistency.","author":"Ryan","authoredAt":"2025-12-22T12:43:04.000Z","changes":2,"inBundle":false,"scope":"history","files":[{"path":"resources/views/event-logs/create.blade.php","status":"modified"},{"path":"resources/views/event-logs/edit.blade.php","status":"modified"}],"analyzed":false},{"sha":"46212076d65fad8b968db275fad41c91ffd848fd","shortSha":"46212076","message":"feat: Add custom REGEXP function for SQLite to enhance regex support and improve compatibility with MySQL syntax.","author":"Ryan","authoredAt":"2025-12-22T12...

[StateLogger] COMMITS_UPDATED
[Store] Action: COMMITS_UPDATED payloadKeys=commits,hasMore
[CockpitEffects] onAction received: COMMITS_UPDATED
[CockpitProvider] Payload schema validation passed
[CockpitProvider] Posted message: setData
[ParserWorker] Initialization completed in 68ms
[ParserWorker] Initialization completed in 68ms
[ParserWorker] Initialization completed in 79ms
[ParserWorker] Initialization completed in 96ms
[ParserWorker] Initialization completed in 94ms
[ParserWorker] Initialization completed in 90ms
[ParserWorker] Initialization completed in 79ms
[ParserWorker] Initialization completed in 90ms
[ParserWorker] Initialization completed in 94ms
[ParserWorker] Initialization completed in 96ms
[ParserWorker] Initialization completed in 87ms
[ParserWorker] Initialization completed in 88ms
[ParserWorker] Initialization completed in 86ms
[ParserWorker] Initialization completed in 91ms
[ParserWorker] Initialization completed in 91ms
[ParserWorker] Initialization completed in 88ms
[ParserWorker] Initialization completed in 90ms
[ParserWorker] Initialization completed in 86ms
[ParserWorker] Initialization completed in 89ms
[ParserWorker] Initialization completed in 86ms
[ParserWorker] Initialization completed in 91ms
[ParserWorker] Initialization completed in 88ms
[ParserWorker] Initialization completed in 91ms
[ParserWorker] Initialization completed in 86ms
[ParserWorker] Initialization completed in 89ms
[ParserWorker] Initialization completed in 90ms
[ParserWorker] Initialization completed in 88ms
[ParserWorker] Initialization completed in 87ms
[ParserWorker] parser.parse() for app/Helpers/PaginationHelper.php: 6ms (3396 bytes)
[ParserWorker] extractSymbols completed for app/Helpers/PaginationHelper.php: 5 symbols in 6ms (964 iterations)
[ParserWorker] extractSymbols for app/Helpers/PaginationHelper.php: 6ms (5 symbols)
[ParserWorker] Initialization completed in 75ms
All 15 workers initialized.
[DatabaseWriteQueue] Flushed 2 operations in single transaction
[ParserWorker] parser.parse() for app/Helpers/PaginationHelper.php: 6ms (3396 bytes)
[ParserWorker] Initialization completed in 75ms
[ParserWorker] extractCstFacts for app/Helpers/PaginationHelper.php: 5ms (1 facts)
[ParserWorker] Total parse operation for app/Helpers/PaginationHelper.php: 18ms
[ParserWorker] parser.parse() for app/Helpers/NavigationHelper.php: 10ms (16062 bytes)
[ParserWorker] extractSymbols completed for app/Helpers/NavigationHelper.php: 12 symbols in 7ms (3823 iterations)
[ParserWorker] extractSymbols for app/Helpers/NavigationHelper.php: 7ms (12 symbols)
[ParserWorker] extractCstFacts for app/Helpers/NavigationHelper.php: 0ms (1 facts)
[ParserWorker] Total parse operation for app/Helpers/NavigationHelper.php: 17ms
[ParserWorker] parser.parse() for app/Helpers/MailgunHelper.php: 2ms (6532 bytes)
[ParserWorker] extractSymbols completed for app/Helpers/MailgunHelper.php: 7 symbols in 2ms (1293 iterations)
[ParserWorker] extractSymbols for app/Helpers/MailgunHelper.php: 2ms (7 symbols)
[ParserWorker] extractCstFacts for app/Helpers/MailgunHelper.php: 0ms (1 facts)
[ParserWorker] Total parse operation for app/Helpers/MailgunHelper.php: 4ms
[ParserWorker] parser.parse() for app/Helpers/ListActionHelper.php: 1ms (2823 bytes)
[ParserWorker] extractSymbols completed for app/Helpers/ListActionHelper.php: 5 symbols in 0ms (463 iterations)
[ParserWorker] extractSymbols for app/Helpers/ListActionHelper.php: 3ms (5 symbols)
[ParserWorker] extractCstFacts for app/Helpers/ListActionHelper.php: 0ms (1 facts)
[ParserWorker] Total parse operation for app/Helpers/ListActionHelper.php: 5ms
[ParserWorker] parser.parse() for app/Helpers/LegacyAdapter.php: 0ms (2499 bytes)
[ParserWorker] extractSymbols completed for app/Helpers/LegacyAdapter.php: 10 symbols in 0ms (366 iterations)
[ParserWorker] extractSymbols for app/Helpers/LegacyAdapter.php: 0ms (10 symbols)
[ParserWorker] extractCstFacts for app/Helpers/LegacyAdapter.php: 1ms (1 facts)
[ParserWorker] Total parse operation for app/Helpers/LegacyAdapter.php: 2ms
[ParserWorker] parser.parse() for app/Helpers/IncentiveHelper.php: 1ms (3974 bytes)
[ParserWorker] extractSymbols completed for app/Helpers/IncentiveHelper.php: 3 symbols in 1ms (898 iterations)
[ParserWorker] extractSymbols for app/Helpers/IncentiveHelper.php: 1ms (3 symbols)
[ParserWorker] extractCstFacts for app/Helpers/IncentiveHelper.php: 0ms (0 facts)
[ParserWorker] Total parse operation for app/Helpers/IncentiveHelper.php: 2ms
[ParserWorker] parser.parse() for app/Helpers/ImpersonationHelper.php: 1ms (4636 bytes)
[ParserWorker] extractSymbols completed for app/Helpers/ImpersonationHelper.php: 7 symbols in 2ms (857 iterations)
[ParserWorker] extractSymbols for app/Helpers/ImpersonationHelper.php: 2ms (7 symbols)
[ParserWorker] extractCstFacts for app/Helpers/ImpersonationHelper.php: 0ms (1 facts)
[ParserWorker] Total parse operation for app/Helpers/ImpersonationHelper.php: 3ms
[ParserWorker] parser.parse() for app/Helpers/ImageHelper.php: 0ms (1509 bytes)
[ParserWorker] extractSymbols completed for app/Helpers/ImageHelper.php: 2 symbols in 1ms (272 iterations)
[ParserWorker] extractSymbols for app/Helpers/ImageHelper.php: 1ms (2 symbols)
[ParserWorker] extractCstFacts for app/Helpers/ImageHelper.php: 0ms (1 facts)
[ParserWorker] Total parse operation for app/Helpers/ImageHelper.php: 1ms
[ParserWorker] parser.parse() for app/Helpers/HELPER_PATTERNS.md: 17ms (7200 bytes)
[ParserWorker] extractCstFacts for app/Helpers/HELPER_PATTERNS.md: 0ms (0 facts)
[ParserWorker] Total parse operation for app/Helpers/HELPER_PATTERNS.md: 19ms
[ParserWorker] parser.parse() for app/Helpers/FormatHelper.php: 3ms (11894 bytes)
[ParserWorker] extractSymbols completed for app/Helpers/FormatHelper.php: 18 symbols in 7ms (2605 iterations)
[ParserWorker] extractSymbols for app/Helpers/FormatHelper.php: 8ms (18 symbols)
[ParserWorker] extractCstFacts for app/Helpers/FormatHelper.php: 0ms (1 facts)
[ParserWorker] Total parse operation for app/Helpers/FormatHelper.php: 11ms
[ParserWorker] parser.parse() for app/Helpers/FilterHelper.php: 2ms (6205 bytes)
[ParserWorker] extractSymbols completed for app/Helpers/FilterHelper.php: 6 symbols in 2ms (1427 iterations)
[ParserWorker] extractSymbols for app/Helpers/FilterHelper.php: 2ms (6 symbols)
[ParserWorker] extractCstFacts for app/Helpers/FilterHelper.php: 1ms (1 facts)
[ParserWorker] Total parse operation for app/Helpers/FilterHelper.php: 5ms
[ParserWorker] parser.parse() for app/Helpers/FileBridgeHelper.php: 1ms (6183 bytes)
[ParserWorker] extractSymbols completed for app/Helpers/FileBridgeHelper.php: 5 symbols in 1ms (1441 iterations)
[ParserWorker] extractSymbols for app/Helpers/FileBridgeHelper.php: 1ms (5 symbols)
[ParserWorker] extractCstFacts for app/Helpers/FileBridgeHelper.php: 0ms (1 facts)
[ParserWorker] Total parse operation for app/Helpers/FileBridgeHelper.php: 6ms
[ParserWorker] parser.parse() for app/Helpers/EventListHelper.php: 1ms (3918 bytes)
[ParserWorker] extractSymbols completed for app/Helpers/EventListHelper.php: 2 symbols in 1ms (929 iterations)
[ParserWorker] extractSymbols for app/Helpers/EventListHelper.php: 1ms (2 symbols)
[ParserWorker] extractCstFacts for app/Helpers/EventListHelper.php: 0ms (1 facts)
[ParserWorker] Total parse operation for app/Helpers/EventListHelper.php: 3ms
[ParserWorker] parser.parse() for app/Helpers/EventHelper.php: 0ms (3770 bytes)
[ParserWorker] extractSymbols completed for app/Helpers/EventHelper.php: 7 symbols in 2ms (587 iterations)
[ParserWorker] extractSymbols for app/Helpers/EventHelper.php: 2ms (7 symbols)
[ParserWorker] extractCstFacts for app/Helpers/EventHelper.php: 0ms (1 facts)
[ParserWorker] Total parse operation for app/Helpers/EventHelper.php: 2ms
[ParserWorker] parser.parse() for app/Helpers/EmailHelper.php: 2ms (5069 bytes)
[ParserWorker] extractSymbols completed for app/Helpers/EmailHelper.php: 10 symbols in 2ms (1417 iterations)
[ParserWorker] extractSymbols for app/Helpers/EmailHelper.php: 2ms (10 symbols)
[ParserWorker] extractCstFacts for app/Helpers/EmailHelper.php: 0ms (1 facts)
[ParserWorker] Total parse operation for app/Helpers/EmailHelper.php: 7ms
[ParserWorker] parser.parse() for app/Helpers/DateRangeHelper.php: 1ms (7192 bytes)
[ParserWorker] extractSymbols completed for app/Helpers/DateRangeHelper.php: 10 symbols in 2ms (1565 iterations)
[ParserWorker] extractSymbols for app/Helpers/DateRangeHelper.php: 2ms (10 symbols)
[ParserWorker] extractCstFacts for app/Helpers/DateRangeHelper.php: 0ms (1 facts)
[ParserWorker] Total parse operation for app/Helpers/DateRangeHelper.php: 3ms
[ParserWorker] parser.parse() for app/Helpers/DatabaseSessionHandler.php: 2ms (5690 bytes)
[ParserWorker] extractSymbols completed for app/Helpers/DatabaseSessionHandler.php: 8 symbols in 4ms (1613 iterations)
[ParserWorker] extractSymbols for app/Helpers/DatabaseSessionHandler.php: 4ms (8 symbols)
[ParserWorker] extractCstFacts for app/Helpers/DatabaseSessionHandler.php: 0ms (1 facts)
[ParserWorker] Total parse operation for app/Helpers/DatabaseSessionHandler.php: 6ms
[ParserWorker] parser.parse() for app/Helpers/DatabaseHelper.php: 1ms (6802 bytes)
[ParserWorker] extractSymbols completed for app/Helpers/DatabaseHelper.php: 12 symbols in 2ms (1808 iterations)
[ParserWorker] extractSymbols for app/Helpers/DatabaseHelper.php: 2ms (12 symbols)
[ParserWorker] extractCstFacts for app/Helpers/DatabaseHelper.php: 0ms (1 facts)
[ParserWorker] Total parse operation for app/Helpers/DatabaseHelper.php: 4ms
[ParserWorker] parser.parse() for app/Helpers/DataCache.php: 1ms (4508 bytes)
[ParserWorker] extractSymbols completed for app/Helpers/DataCache.php: 17 symbols in 2ms (971 iterations)
[ParserWorker] extractSymbols for app/Helpers/DataCache.php: 5ms (17 symbols)
[ParserWorker] extractCstFacts for app/Helpers/DataCache.php: 0ms (1 facts)
[ParserWorker] Total parse operation for app/Helpers/DataCache.php: 6ms
[ParserWorker] parser.parse() for app/Helpers/CacheKeyHelper.php: 2ms (10640 bytes)
[ParserWorker] extractSymbols completed for app/Helpers/CacheKeyHelper.php: 18 symbols in 2ms (1685 iterations)
[ParserWorker] extractSymbols for app/Helpers/CacheKeyHelper.php: 3ms (18 symbols)
[ParserWorker] extractCstFacts for app/Helpers/CacheKeyHelper.php: 0ms (1 facts)
[ParserWorker] Total parse operation for app/Helpers/CacheKeyHelper.php: 5ms
[ParserWorker] parser.parse() for app/Helpers/CacheHelper.php: 3ms (12340 bytes)
[ParserWorker] extractSymbols completed for app/Helpers/CacheHelper.php: 16 symbols in 4ms (2869 iterations)
[ParserWorker] extractSymbols for app/Helpers/CacheHelper.php: 4ms (16 symbols)
[ParserWorker] extractCstFacts for app/Helpers/CacheHelper.php: 1ms (1 facts)
[ParserWorker] Total parse operation for app/Helpers/CacheHelper.php: 10ms
[ParserWorker] parser.parse() for app/Helpers/BootstrapHelper.php: 0ms (1894 bytes)
[ParserWorker] extractSymbols completed for app/Helpers/BootstrapHelper.php: 6 symbols in 1ms (330 iterations)
[ParserWorker] extractSymbols for app/Helpers/BootstrapHelper.php: 1ms (6 symbols)
[ParserWorker] extractCstFacts for app/Helpers/BootstrapHelper.php: 0ms (1 facts)
[ParserWorker] Total parse operation for app/Helpers/BootstrapHelper.php: 1ms
[ParserWorker] parser.parse() for app/Helpers/AuthHelper.php: 2ms (8739 bytes)
[ParserWorker] extractSymbols completed for app/Helpers/AuthHelper.php: 17 symbols in 2ms (2232 iterations)
[ParserWorker] extractSymbols for app/Helpers/AuthHelper.php: 5ms (17 symbols)
[ParserWorker] extractCstFacts for app/Helpers/AuthHelper.php: 0ms (1 facts)
[ParserWorker] Total parse operation for app/Helpers/AuthHelper.php: 7ms
[ParserWorker] parser.parse() for app/Helpers/AuthCookieHelper.php: 1ms (4730 bytes)
[ParserWorker] extractSymbols completed for app/Helpers/AuthCookieHelper.php: 6 symbols in 1ms (1331 iterations)
[ParserWorker] extractSymbols for app/Helpers/AuthCookieHelper.php: 1ms (6 symbols)
[ParserWorker] extractCstFacts for app/Helpers/AuthCookieHelper.php: 0ms (1 facts)
[ParserWorker] Total parse operation for app/Helpers/AuthCookieHelper.php: 2ms
[ParserWorker] parser.parse() for app/Helpers/AuthContext.php: 1ms (3781 bytes)
[ParserWorker] extractSymbols completed for app/Helpers/AuthContext.php: 7 symbols in 1ms (974 iterations)
[ParserWorker] extractSymbols for app/Helpers/AuthContext.php: 1ms (7 symbols)
[ParserWorker] extractCstFacts for app/Helpers/AuthContext.php: 0ms (1 facts)
[ParserWorker] Total parse operation for app/Helpers/AuthContext.php: 2ms
[ParserWorker] parser.parse() for app/Helpers/AppConfig.php: 2ms (6628 bytes)
[ParserWorker] extractSymbols completed for app/Helpers/AppConfig.php: 20 symbols in 1ms (1228 iterations)
[ParserWorker] extractSymbols for app/Helpers/AppConfig.php: 3ms (20 symbols)
[ParserWorker] extractCstFacts for app/Helpers/AppConfig.php: 1ms (1 facts)
[ParserWorker] Total parse operation for app/Helpers/AppConfig.php: 6ms
[ParserWorker] parser.parse() for app/Filters/ReportFilter.php: 3ms (11484 bytes)
[ParserWorker] extractSymbols completed for app/Filters/ReportFilter.php: 13 symbols in 3ms (3362 iterations)
[ParserWorker] extractSymbols for app/Filters/ReportFilter.php: 3ms (13 symbols)
[ParserWorker] extractCstFacts for app/Filters/ReportFilter.php: 1ms (1 facts)
[ParserWorker] Total parse operation for app/Filters/ReportFilter.php: 7ms
[ParserWorker] parser.parse() for app/Filters/EventFilter.php: 6ms (18234 bytes)
[ParserWorker] extractSymbols completed for app/Filters/EventFilter.php: 18 symbols in 5ms (4766 iterations)
[ParserWorker] extractSymbols for app/Filters/EventFilter.php: 6ms (18 symbols)
[ParserWorker] extractCstFacts for app/Filters/EventFilter.php: 0ms (1 facts)
[ParserWorker] Total parse operation for app/Filters/EventFilter.php: 12ms
[ParserWorker] parser.parse() for app/Filters/ClientFilter.php: 4ms (11795 bytes)
[ParserWorker] extractSymbols completed for app/Filters/ClientFilter.php: 18 symbols in 3ms (2911 iterations)
[ParserWorker] extractSymbols for app/Filters/ClientFilter.php: 4ms (18 symbols)
[ParserWorker] extractCstFacts for app/Filters/ClientFilter.php: 0ms (1 facts)
[ParserWorker] Total parse operation for app/Filters/ClientFilter.php: 8ms
[ParserWorker] parser.parse() for app/Enums/UserViewType.php: 1ms (3154 bytes)
[ParserWorker] extractSymbols completed for app/Enums/UserViewType.php: 6 symbols in 1ms (851 iterations)
[ParserWorker] extractSymbols for app/Enums/UserViewType.php: 1ms (6 symbols)
[ParserWorker] extractCstFacts for app/Enums/UserViewType.php: 0ms (1 facts)
[ParserWorker] Total parse operation for app/Enums/UserViewType.php: 2ms
[ParserWorker] parser.parse() for app/Enums/StaffRole.php: 1ms (5152 bytes)
[ParserWorker] extractSymbols completed for app/Enums/StaffRole.php: 13 symbols in 1ms (1067 iterations)
[ParserWorker] extractSymbols for app/Enums/StaffRole.php: 5ms (13 symbols)
[ParserWorker] extractCstFacts for app/Enums/StaffRole.php: 0ms (15 facts)
[ParserWorker] Total parse operation for app/Enums/StaffRole.php: 6ms
[ParserWorker] parser.parse() for app/Enums/SpecialDayType.php: 1ms (2799 bytes)
[ParserWorker] extractSymbols completed for app/Enums/SpecialDayType.php: 9 symbols in 1ms (521 iterations)
[ParserWorker] extractSymbols for app/Enums/SpecialDayType.php: 1ms (9 symbols)
[ParserWorker] extractCstFacts for app/Enums/SpecialDayType.php: 0ms (10 facts)
[ParserWorker] Total parse operation for app/Enums/SpecialDayType.php: 2ms
[ParserWorker] parser.parse() for app/Enums/SectionType.php: 2ms (8629 bytes)
[ParserWorker] extractSymbols completed for app/Enums/SectionType.php: 12 symbols in 2ms (2042 iterations)
[ParserWorker] extractSymbols for app/Enums/SectionType.php: 2ms (12 symbols)
[ParserWorker] extractCstFacts for app/Enums/SectionType.php: 0ms (13 facts)
[ParserWorker] Total parse operation for app/Enums/SectionType.php: 4ms
[ParserWorker] parser.parse() for app/Enums/RowType.php: 5ms (14374 bytes)
[ParserWorker] extractSymbols completed for app/Enums/RowType.php: 16 symbols in 5ms (3776 iterations)
[ParserWorker] extractSymbols for app/Enums/RowType.php: 5ms (16 symbols)
[ParserWorker] extractCstFacts for app/Enums/RowType.php: 1ms (24 facts)
[ParserWorker] Total parse operation for app/Enums/RowType.php: 11ms
[ParserWorker] parser.parse() for app/Enums/Message.php: 1ms (2304 bytes)
[ParserWorker] extractSymbols completed for app/Enums/Message.php: 1 symbols in 0ms (353 iterations)
[ParserWorker] extractSymbols for app/Enums/Message.php: 0ms (1 symbols)
[ParserWorker] extractCstFacts for app/Enums/Message.php: 0ms (7 facts)
[ParserWorker] Total parse operation for app/Enums/Message.php: 1ms
[ParserWorker] parser.parse() for app/Enums/EventStatus.php: 0ms (2226 bytes)
[ParserWorker] extractSymbols completed for app/Enums/EventStatus.php: 9 symbols in 1ms (511 iterations)
[ParserWorker] extractSymbols for app/Enums/EventStatus.php: 1ms (9 symbols)
[ParserWorker] extractCstFacts for app/Enums/EventStatus.php: 0ms (6 facts)
[ParserWorker] Total parse operation for app/Enums/EventStatus.php: 3ms
[ParserWorker] parser.parse() for app/Enums/DeletionStatus.php: 0ms (1979 bytes)
[ParserWorker] extractSymbols completed for app/Enums/DeletionStatus.php: 9 symbols in 1ms (376 iterations)
[ParserWorker] extractSymbols for app/Enums/DeletionStatus.php: 1ms (9 symbols)
[ParserWorker] extractCstFacts for app/Enums/DeletionStatus.php: 0ms (10 facts)
[ParserWorker] Total parse operation for app/Enums/DeletionStatus.php: 1ms
[ParserWorker] parser.parse() for app/Enums/ClientType.php: 0ms (2376 bytes)
[ParserWorker] extractSymbols completed for app/Enums/ClientType.php: 5 symbols in 1ms (409 iterations)
[ParserWorker] extractSymbols for app/Enums/ClientType.php: 1ms (5 symbols)
[ParserWorker] extractCstFacts for app/Enums/ClientType.php: 0ms (6 facts)
[ParserWorker] Total parse operation for app/Enums/ClientType.php: 1ms
[ParserWorker] parser.parse() for app/Enums/CertificationType.php: 0ms (545 bytes)
[ParserWorker] extractSymbols completed for app/Enums/CertificationType.php: 2 symbols in 0ms (130 iterations)
[ParserWorker] extractSymbols for app/Enums/CertificationType.php: 1ms (2 symbols)
[ParserWorker] extractCstFacts for app/Enums/CertificationType.php: 0ms (2 facts)
[ParserWorker] Total parse operation for app/Enums/CertificationType.php: 1ms
[ParserWorker] parser.parse() for app/Enums/AssignmentStatus.php: 0ms (2713 bytes)
[ParserWorker] extractSymbols completed for app/Enums/AssignmentStatus.php: 10 symbols in 1ms (561 iterations)
[ParserWorker] extractSymbols for app/Enums/AssignmentStatus.php: 1ms (10 symbols)
[ParserWorker] extractCstFacts for app/Enums/AssignmentStatus.php: 0ms (11 facts)
[ParserWorker] Total parse operation for app/Enums/AssignmentStatus.php: 1ms
[ParserWorker] parser.parse() for app/Enums/ApplicationStatus.php: 1ms (2754 bytes)
[ParserWorker] extractSymbols completed for app/Enums/ApplicationStatus.php: 10 symbols in 0ms (522 iterations)
[ParserWorker] extractSymbols for app/Enums/ApplicationStatus.php: 0ms (10 symbols)
[ParserWorker] extractCstFacts for app/Enums/ApplicationStatus.php: 1ms (13 facts)
[ParserWorker] Total parse operation for app/Enums/ApplicationStatus.php: 2ms
[ParserWorker] parser.parse() for app/Dto/PaginatedResult.php: 1ms (5393 bytes)
[ParserWorker] extractSymbols completed for app/Dto/PaginatedResult.php: 15 symbols in 1ms (1148 iterations)
[ParserWorker] extractSymbols for app/Dto/PaginatedResult.php: 4ms (15 symbols)
[ParserWorker] extractCstFacts for app/Dto/PaginatedResult.php: 0ms (1 facts)
[ParserWorker] Total parse operation for app/Dto/PaginatedResult.php: 5ms
[ParserWorker] parser.parse() for app/Contracts/CacheInvalidatable.php: 0ms (952 bytes)
[ParserWorker] extractSymbols completed for app/Contracts/CacheInvalidatable.php: 2 symbols in 0ms (44 iterations)
[ParserWorker] extractSymbols for app/Contracts/CacheInvalidatable.php: 0ms (2 symbols)
[ParserWorker] extractCstFacts for app/Contracts/CacheInvalidatable.php: 0ms (3 facts)
[ParserWorker] Total parse operation for app/Contracts/CacheInvalidatable.php: 1ms
[ParserWorker] parser.parse() for AGENTS.md: 6ms (13151 bytes)
[ParserWorker] extractCstFacts for AGENTS.md: 0ms (0 facts)
[ParserWorker] Total parse operation for AGENTS.md: 6ms
[ParserWorker] parser.parse() for .serena/memories/suggested_commands.md: 0ms (763 bytes)
[ParserWorker] extractCstFacts for .serena/memories/suggested_commands.md: 0ms (0 facts)
[ParserWorker] Total parse operation for .serena/memories/suggested_commands.md: 1ms
[ParserWorker] parser.parse() for .serena/memories/style_and_conventions.md: 0ms (583 bytes)
[ParserWorker] extractCstFacts for .serena/memories/style_and_conventions.md: 0ms (0 facts)
[ParserWorker] Total parse operation for .serena/memories/style_and_conventions.md: 3ms
[ParserWorker] parser.parse() for .serena/memories/project_overview.md: 0ms (763 bytes)
[ParserWorker] extractCstFacts for .serena/memories/project_overview.md: 0ms (0 facts)
[ParserWorker] Total parse operation for .serena/memories/project_overview.md: 0ms
[ParserWorker] parser.parse() for .serena/memories/completion_checklist.md: 1ms (377 bytes)
[ParserWorker] extractCstFacts for .serena/memories/completion_checklist.md: 0ms (0 facts)
[ParserWorker] Total parse operation for .serena/memories/completion_checklist.md: 1ms
[ParserWorker] parser.parse() for .claude/settings.local.json: 0ms (102 bytes)
[ParserWorker] extractCstFacts for .claude/settings.local.json: 1ms (1 facts)
[ParserWorker] Total parse operation for .claude/settings.local.json: 1ms
[ParserWorker] parser.parse() for .agent/rules/agents.md: 3ms (5690 bytes)
[ParserWorker] extractCstFacts for .agent/rules/agents.md: 0ms (0 facts)
[ParserWorker] Total parse operation for .agent/rules/agents.md: 3ms
[ParserWorker] parser.parse() for app/Helpers/PhotoUploadHelper.php: 10ms (26852 bytes)
[ParserWorker] extractSymbols completed for app/Helpers/PhotoUploadHelper.php: 14 symbols in 11ms (7209 iterations)
[ParserWorker] extractSymbols for app/Helpers/PhotoUploadHelper.php: 11ms (14 symbols)
[ParserWorker] extractCstFacts for app/Helpers/PhotoUploadHelper.php: 0ms (1 facts)
[ParserWorker] Total parse operation for app/Helpers/PhotoUploadHelper.php: 21ms
[ParserWorker] extractSymbols completed for app/Helpers/PaginationHelper.php: 5 symbols in 6ms (964 iterations)
[ParserWorker] extractSymbols for app/Helpers/PaginationHelper.php: 6ms (5 symbols)
[ParserWorker] extractCstFacts for app/Helpers/PaginationHelper.php: 5ms (1 facts)
[ParserWorker] Total parse operation for app/Helpers/PaginationHelper.php: 18ms
[ParserWorker] parser.parse() for app/Helpers/NavigationHelper.php: 10ms (16062 bytes)
[ParserWorker] extractSymbols completed for app/Helpers/NavigationHelper.php: 12 symbols in 7ms (3823 iterations)
[ParserWorker] extractSymbols for app/Helpers/NavigationHelper.php: 7ms (12 symbols)
[ParserWorker] extractCstFacts for app/Helpers/NavigationHelper.php: 0ms (1 facts)
[ParserWorker] Total parse operation for app/Helpers/NavigationHelper.php: 17ms
[ParserWorker] parser.parse() for app/Helpers/MailgunHelper.php: 2ms (6532 bytes)
[ParserWorker] extractSymbols completed for app/Helpers/MailgunHelper.php: 7 symbols in 2ms (1293 iterations)
[ParserWorker] extractSymbols for app/Helpers/MailgunHelper.php: 2ms (7 symbols)
[ParserWorker] extractCstFacts for app/Helpers/MailgunHelper.php: 0ms (1 facts)
[ParserWorker] Total parse operation for app/Helpers/MailgunHelper.php: 4ms
[ParserWorker] parser.parse() for app/Helpers/ListActionHelper.php: 1ms (2823 bytes)
[ParserWorker] extractSymbols completed for app/Helpers/ListActionHelper.php: 5 symbols in 0ms (463 iterations)
[ParserWorker] extractSymbols for app/Helpers/ListActionHelper.php: 3ms (5 symbols)
[ParserWorker] extractCstFacts for app/Helpers/ListActionHelper.php: 0ms (1 facts)
[ParserWorker] Total parse operation for app/Helpers/ListActionHelper.php: 5ms
[ParserWorker] parser.parse() for app/Helpers/LegacyAdapter.php: 0ms (2499 bytes)
[ParserWorker] extractSymbols completed for app/Helpers/LegacyAdapter.php: 10 symbols in 0ms (366 iterations)
[ParserWorker] extractSymbols for app/Helpers/LegacyAdapter.php: 0ms (10 symbols)
[ParserWorker] extractCstFacts for app/Helpers/LegacyAdapter.php: 1ms (1 facts)
[ParserWorker] Total parse operation for app/Helpers/LegacyAdapter.php: 2ms
[ParserWorker] parser.parse() for app/Helpers/IncentiveHelper.php: 1ms (3974 bytes)
[ParserWorker] extractSymbols completed for app/Helpers/IncentiveHelper.php: 3 symbols in 1ms (898 iterations)
[ParserWorker] extractSymbols for app/Helpers/IncentiveHelper.php: 1ms (3 symbols)
[ParserWorker] extractCstFacts for app/Helpers/IncentiveHelper.php: 0ms (0 facts)
[ParserWorker] Total parse operation for app/Helpers/IncentiveHelper.php: 2ms
[ParserWorker] parser.parse() for app/Helpers/ImpersonationHelper.php: 1ms (4636 bytes)
[ParserWorker] extractSymbols completed for app/Helpers/ImpersonationHelper.php: 7 symbols in 2ms (857 iterations)
[ParserWorker] extractSymbols for app/Helpers/ImpersonationHelper.php: 2ms (7 symbols)
[ParserWorker] extractCstFacts for app/Helpers/ImpersonationHelper.php: 0ms (1 facts)
[ParserWorker] Total parse operation for app/Helpers/ImpersonationHelper.php: 3ms
[ParserWorker] parser.parse() for app/Helpers/ImageHelper.php: 0ms (1509 bytes)
[ParserWorker] extractSymbols completed for app/Helpers/ImageHelper.php: 2 symbols in 1ms (272 iterations)
[ParserWorker] extractSymbols for app/Helpers/ImageHelper.php: 1ms (2 symbols)
[ParserWorker] extractCstFacts for app/Helpers/ImageHelper.php: 0ms (1 facts)
[ParserWorker] Total parse operation for app/Helpers/ImageHelper.php: 1ms
[ParserWorker] parser.parse() for app/Helpers/HELPER_PATTERNS.md: 17ms (7200 bytes)
[ParserWorker] extractCstFacts for app/Helpers/HELPER_PATTERNS.md: 0ms (0 facts)
[ParserWorker] Total parse operation for app/Helpers/HELPER_PATTERNS.md: 19ms
[ParserWorker] parser.parse() for app/Helpers/FormatHelper.php: 3ms (11894 bytes)
[ParserWorker] extractSymbols completed for app/Helpers/FormatHelper.php: 18 symbols in 7ms (2605 iterations)
[ParserWorker] extractSymbols for app/Helpers/FormatHelper.php: 8ms (18 symbols)
[ParserWorker] extractCstFacts for app/Helpers/FormatHelper.php: 0ms (1 facts)
[ParserWorker] Total parse operation for app/Helpers/FormatHelper.php: 11ms
[ParserWorker] parser.parse() for app/Helpers/FilterHelper.php: 2ms (6205 bytes)
[ParserWorker] extractSymbols completed for app/Helpers/FilterHelper.php: 6 symbols in 2ms (1427 iterations)
[ParserWorker] extractSymbols for app/Helpers/FilterHelper.php: 2ms (6 symbols)
[ParserWorker] extractCstFacts for app/Helpers/FilterHelper.php: 1ms (1 facts)
[ParserWorker] Total parse operation for app/Helpers/FilterHelper.php: 5ms
[ParserWorker] parser.parse() for app/Helpers/FileBridgeHelper.php: 1ms (6183 bytes)
[ParserWorker] extractSymbols completed for app/Helpers/FileBridgeHelper.php: 5 symbols in 1ms (1441 iterations)
[ParserWorker] extractSymbols for app/Helpers/FileBridgeHelper.php: 1ms (5 symbols)
[ParserWorker] extractCstFacts for app/Helpers/FileBridgeHelper.php: 0ms (1 facts)
[ParserWorker] Total parse operation for app/Helpers/FileBridgeHelper.php: 6ms
[ParserWorker] parser.parse() for app/Helpers/EventListHelper.php: 1ms (3918 bytes)
[ParserWorker] extractSymbols completed for app/Helpers/EventListHelper.php: 2 symbols in 1ms (929 iterations)
[ParserWorker] extractSymbols for app/Helpers/EventListHelper.php: 1ms (2 symbols)
[ParserWorker] extractCstFacts for app/Helpers/EventListHelper.php: 0ms (1 facts)
[ParserWorker] Total parse operation for app/Helpers/EventListHelper.php: 3ms
[ParserWorker] parser.parse() for app/Helpers/EventHelper.php: 0ms (3770 bytes)
[ParserWorker] extractSymbols completed for app/Helpers/EventHelper.php: 7 symbols in 2ms (587 iterations)
[ParserWorker] extractSymbols for app/Helpers/EventHelper.php: 2ms (7 symbols)
[ParserWorker] extractCstFacts for app/Helpers/EventHelper.php: 0ms (1 facts)
[ParserWorker] Total parse operation for app/Helpers/EventHelper.php: 2ms
[ParserWorker] parser.parse() for app/Helpers/EmailHelper.php: 2ms (5069 bytes)
[ParserWorker] extractSymbols completed for app/Helpers/EmailHelper.php: 10 symbols in 2ms (1417 iterations)
[ParserWorker] extractSymbols for app/Helpers/EmailHelper.php: 2ms (10 symbols)
[ParserWorker] extractCstFacts for app/Helpers/EmailHelper.php: 0ms (1 facts)
[ParserWorker] Total parse operation for app/Helpers/EmailHelper.php: 7ms
[ParserWorker] parser.parse() for app/Helpers/DateRangeHelper.php: 1ms (7192 bytes)
[ParserWorker] extractSymbols completed for app/Helpers/DateRangeHelper.php: 10 symbols in 2ms (1565 iterations)
[ParserWorker] extractSymbols for app/Helpers/DateRangeHelper.php: 2ms (10 symbols)
[ParserWorker] extractCstFacts for app/Helpers/DateRangeHelper.php: 0ms (1 facts)
[ParserWorker] Total parse operation for app/Helpers/DateRangeHelper.php: 3ms
[ParserWorker] parser.parse() for app/Helpers/DatabaseSessionHandler.php: 2ms (5690 bytes)
[ParserWorker] extractSymbols completed for app/Helpers/DatabaseSessionHandler.php: 8 symbols in 4ms (1613 iterations)
[ParserWorker] extractSymbols for app/Helpers/DatabaseSessionHandler.php: 4ms (8 symbols)
[ParserWorker] extractCstFacts for app/Helpers/DatabaseSessionHandler.php: 0ms (1 facts)
[ParserWorker] Total parse operation for app/Helpers/DatabaseSessionHandler.php: 6ms
[ParserWorker] parser.parse() for app/Helpers/DatabaseHelper.php: 1ms (6802 bytes)
[ParserWorker] extractSymbols completed for app/Helpers/DatabaseHelper.php: 12 symbols in 2ms (1808 iterations)
[ParserWorker] extractSymbols for app/Helpers/DatabaseHelper.php: 2ms (12 symbols)
[ParserWorker] extractCstFacts for app/Helpers/DatabaseHelper.php: 0ms (1 facts)
[ParserWorker] Total parse operation for app/Helpers/DatabaseHelper.php: 4ms
[ParserWorker] parser.parse() for app/Helpers/DataCache.php: 1ms (4508 bytes)
[ParserWorker] extractSymbols completed for app/Helpers/DataCache.php: 17 symbols in 2ms (971 iterations)
[ParserWorker] extractSymbols for app/Helpers/DataCache.php: 5ms (17 symbols)
[ParserWorker] extractCstFacts for app/Helpers/DataCache.php: 0ms (1 facts)
[ParserWorker] Total parse operation for app/Helpers/DataCache.php: 6ms
[ParserWorker] parser.parse() for app/Helpers/CacheKeyHelper.php: 2ms (10640 bytes)
[ParserWorker] extractSymbols completed for app/Helpers/CacheKeyHelper.php: 18 symbols in 2ms (1685 iterations)
[ParserWorker] extractSymbols for app/Helpers/CacheKeyHelper.php: 3ms (18 symbols)
[ParserWorker] extractCstFacts for app/Helpers/CacheKeyHelper.php: 0ms (1 facts)
[ParserWorker] Total parse operation for app/Helpers/CacheKeyHelper.php: 5ms
[ParserWorker] parser.parse() for app/Helpers/CacheHelper.php: 3ms (12340 bytes)
[ParserWorker] extractSymbols completed for app/Helpers/CacheHelper.php: 16 symbols in 4ms (2869 iterations)
[ParserWorker] extractSymbols for app/Helpers/CacheHelper.php: 4ms (16 symbols)
[ParserWorker] extractCstFacts for app/Helpers/CacheHelper.php: 1ms (1 facts)
[ParserWorker] Total parse operation for app/Helpers/CacheHelper.php: 10ms
[ParserWorker] parser.parse() for app/Helpers/BootstrapHelper.php: 0ms (1894 bytes)
[ParserWorker] extractSymbols completed for app/Helpers/BootstrapHelper.php: 6 symbols in 1ms (330 iterations)
[ParserWorker] extractSymbols for app/Helpers/BootstrapHelper.php: 1ms (6 symbols)
[ParserWorker] extractCstFacts for app/Helpers/BootstrapHelper.php: 0ms (1 facts)
[ParserWorker] Total parse operation for app/Helpers/BootstrapHelper.php: 1ms
[ParserWorker] parser.parse() for app/Helpers/AuthHelper.php: 2ms (8739 bytes)
[ParserWorker] extractSymbols completed for app/Helpers/AuthHelper.php: 17 symbols in 2ms (2232 iterations)
[ParserWorker] extractSymbols for app/Helpers/AuthHelper.php: 5ms (17 symbols)
[ParserWorker] extractCstFacts for app/Helpers/AuthHelper.php: 0ms (1 facts)
[ParserWorker] Total parse operation for app/Helpers/AuthHelper.php: 7ms
[ParserWorker] parser.parse() for app/Helpers/AuthCookieHelper.php: 1ms (4730 bytes)
[ParserWorker] extractSymbols completed for app/Helpers/AuthCookieHelper.php: 6 symbols in 1ms (1331 iterations)
[ParserWorker] extractSymbols for app/Helpers/AuthCookieHelper.php: 1ms (6 symbols)
[ParserWorker] extractCstFacts for app/Helpers/AuthCookieHelper.php: 0ms (1 facts)
[ParserWorker] Total parse operation for app/Helpers/AuthCookieHelper.php: 2ms
[ParserWorker] parser.parse() for app/Helpers/AuthContext.php: 1ms (3781 bytes)
[ParserWorker] extractSymbols completed for app/Helpers/AuthContext.php: 7 symbols in 1ms (974 iterations)
[ParserWorker] extractSymbols for app/Helpers/AuthContext.php: 1ms (7 symbols)
[ParserWorker] extractCstFacts for app/Helpers/AuthContext.php: 0ms (1 facts)
[ParserWorker] Total parse operation for app/Helpers/AuthContext.php: 2ms
[ParserWorker] parser.parse() for app/Helpers/AppConfig.php: 2ms (6628 bytes)
[ParserWorker] extractSymbols completed for app/Helpers/AppConfig.php: 20 symbols in 1ms (1228 iterations)
[ParserWorker] extractSymbols for app/Helpers/AppConfig.php: 3ms (20 symbols)
[ParserWorker] extractCstFacts for app/Helpers/AppConfig.php: 1ms (1 facts)
[ParserWorker] Total parse operation for app/Helpers/AppConfig.php: 6ms
[ParserWorker] parser.parse() for app/Filters/ReportFilter.php: 3ms (11484 bytes)
[ParserWorker] extractSymbols completed for app/Filters/ReportFilter.php: 13 symbols in 3ms (3362 iterations)
[ParserWorker] extractSymbols for app/Filters/ReportFilter.php: 3ms (13 symbols)
[ParserWorker] extractCstFacts for app/Filters/ReportFilter.php: 1ms (1 facts)
[ParserWorker] Total parse operation for app/Filters/ReportFilter.php: 7ms
[ParserWorker] parser.parse() for app/Filters/EventFilter.php: 6ms (18234 bytes)
[ParserWorker] extractSymbols completed for app/Filters/EventFilter.php: 18 symbols in 5ms (4766 iterations)
[ParserWorker] extractSymbols for app/Filters/EventFilter.php: 6ms (18 symbols)
[ParserWorker] extractCstFacts for app/Filters/EventFilter.php: 0ms (1 facts)
[ParserWorker] Total parse operation for app/Filters/EventFilter.php: 12ms
[ParserWorker] parser.parse() for app/Filters/ClientFilter.php: 4ms (11795 bytes)
[ParserWorker] extractSymbols completed for app/Filters/ClientFilter.php: 18 symbols in 3ms (2911 iterations)
[ParserWorker] extractSymbols for app/Filters/ClientFilter.php: 4ms (18 symbols)
[ParserWorker] extractCstFacts for app/Filters/ClientFilter.php: 0ms (1 facts)
[ParserWorker] Total parse operation for app/Filters/ClientFilter.php: 8ms
[ParserWorker] parser.parse() for app/Enums/UserViewType.php: 1ms (3154 bytes)
[ParserWorker] extractSymbols completed for app/Enums/UserViewType.php: 6 symbols in 1ms (851 iterations)
[ParserWorker] extractSymbols for app/Enums/UserViewType.php: 1ms (6 symbols)
[ParserWorker] extractCstFacts for app/Enums/UserViewType.php: 0ms (1 facts)
[ParserWorker] Total parse operation for app/Enums/UserViewType.php: 2ms
[ParserWorker] parser.parse() for app/Enums/StaffRole.php: 1ms (5152 bytes)
[ParserWorker] extractSymbols completed for app/Enums/StaffRole.php: 13 symbols in 1ms (1067 iterations)
[ParserWorker] extractSymbols for app/Enums/StaffRole.php: 5ms (13 symbols)
[ParserWorker] extractCstFacts for app/Enums/StaffRole.php: 0ms (15 facts)
[ParserWorker] Total parse operation for app/Enums/StaffRole.php: 6ms
[ParserWorker] parser.parse() for app/Enums/SpecialDayType.php: 1ms (2799 bytes)
[ParserWorker] extractSymbols completed for app/Enums/SpecialDayType.php: 9 symbols in 1ms (521 iterations)
[ParserWorker] extractSymbols for app/Enums/SpecialDayType.php: 1ms (9 symbols)
[ParserWorker] extractCstFacts for app/Enums/SpecialDayType.php: 0ms (10 facts)
[ParserWorker] Total parse operation for app/Enums/SpecialDayType.php: 2ms
[ParserWorker] parser.parse() for app/Enums/SectionType.php: 2ms (8629 bytes)
[ParserWorker] extractSymbols completed for app/Enums/SectionType.php: 12 symbols in 2ms (2042 iterations)
[ParserWorker] extractSymbols for app/Enums/SectionType.php: 2ms (12 symbols)
[ParserWorker] extractCstFacts for app/Enums/SectionType.php: 0ms (13 facts)
[ParserWorker] Total parse operation for app/Enums/SectionType.php: 4ms
[ParserWorker] parser.parse() for app/Enums/RowType.php: 5ms (14374 bytes)
[ParserWorker] extractSymbols completed for app/Enums/RowType.php: 16 symbols in 5ms (3776 iterations)
[ParserWorker] extractSymbols for app/Enums/RowType.php: 5ms (16 symbols)
[ParserWorker] extractCstFacts for app/Enums/RowType.php: 1ms (24 facts)
[ParserWorker] Total parse operation for app/Enums/RowType.php: 11ms
[ParserWorker] parser.parse() for app/Enums/Message.php: 1ms (2304 bytes)
[ParserWorker] extractSymbols completed for app/Enums/Message.php: 1 symbols in 0ms (353 iterations)
[ParserWorker] extractSymbols for app/Enums/Message.php: 0ms (1 symbols)
[ParserWorker] extractCstFacts for app/Enums/Message.php: 0ms (7 facts)
[ParserWorker] Total parse operation for app/Enums/Message.php: 1ms
[ParserWorker] parser.parse() for app/Enums/EventStatus.php: 0ms (2226 bytes)
[ParserWorker] extractSymbols completed for app/Enums/EventStatus.php: 9 symbols in 1ms (511 iterations)
[ParserWorker] extractSymbols for app/Enums/EventStatus.php: 1ms (9 symbols)
[ParserWorker] extractCstFacts for app/Enums/EventStatus.php: 0ms (6 facts)
[ParserWorker] Total parse operation for app/Enums/EventStatus.php: 3ms
[ParserWorker] parser.parse() for app/Enums/DeletionStatus.php: 0ms (1979 bytes)
[ParserWorker] extractSymbols completed for app/Enums/DeletionStatus.php: 9 symbols in 1ms (376 iterations)
[ParserWorker] extractSymbols for app/Enums/DeletionStatus.php: 1ms (9 symbols)
[ParserWorker] extractCstFacts for app/Enums/DeletionStatus.php: 0ms (10 facts)
[ParserWorker] Total parse operation for app/Enums/DeletionStatus.php: 1ms
[ParserWorker] parser.parse() for app/Enums/ClientType.php: 0ms (2376 bytes)
[ParserWorker] extractSymbols completed for app/Enums/ClientType.php: 5 symbols in 1ms (409 iterations)
[ParserWorker] extractSymbols for app/Enums/ClientType.php: 1ms (5 symbols)
[ParserWorker] extractCstFacts for app/Enums/ClientType.php: 0ms (6 facts)
[ParserWorker] Total parse operation for app/Enums/ClientType.php: 1ms
[ParserWorker] parser.parse() for app/Enums/CertificationType.php: 0ms (545 bytes)
[ParserWorker] extractSymbols completed for app/Enums/CertificationType.php: 2 symbols in 0ms (130 iterations)
[ParserWorker] extractSymbols for app/Enums/CertificationType.php: 1ms (2 symbols)
[ParserWorker] extractCstFacts for app/Enums/CertificationType.php: 0ms (2 facts)
[ParserWorker] Total parse operation for app/Enums/CertificationType.php: 1ms
[ParserWorker] parser.parse() for app/Enums/AssignmentStatus.php: 0ms (2713 bytes)
[ParserWorker] extractSymbols completed for app/Enums/AssignmentStatus.php: 10 symbols in 1ms (561 iterations)
[ParserWorker] extractSymbols for app/Enums/AssignmentStatus.php: 1ms (10 symbols)
[ParserWorker] extractCstFacts for app/Enums/AssignmentStatus.php: 0ms (11 facts)
[ParserWorker] Total parse operation for app/Enums/AssignmentStatus.php: 1ms
[ParserWorker] parser.parse() for app/Enums/ApplicationStatus.php: 1ms (2754 bytes)
[ParserWorker] extractSymbols completed for app/Enums/ApplicationStatus.php: 10 symbols in 0ms (522 iterations)
[ParserWorker] extractSymbols for app/Enums/ApplicationStatus.php: 0ms (10 symbols)
[ParserWorker] extractCstFacts for app/Enums/ApplicationStatus.php: 1ms (13 facts)
[ParserWorker] Total parse operation for app/Enums/ApplicationStatus.php: 2ms
[ParserWorker] parser.parse() for app/Dto/PaginatedResult.php: 1ms (5393 bytes)
[ParserWorker] extractSymbols completed for app/Dto/PaginatedResult.php: 15 symbols in 1ms (1148 iterations)
[ParserWorker] extractSymbols for app/Dto/PaginatedResult.php: 4ms (15 symbols)
[ParserWorker] extractCstFacts for app/Dto/PaginatedResult.php: 0ms (1 facts)
[ParserWorker] Total parse operation for app/Dto/PaginatedResult.php: 5ms
[ParserWorker] parser.parse() for app/Contracts/CacheInvalidatable.php: 0ms (952 bytes)
[ParserWorker] extractSymbols completed for app/Contracts/CacheInvalidatable.php: 2 symbols in 0ms (44 iterations)
[ParserWorker] extractSymbols for app/Contracts/CacheInvalidatable.php: 0ms (2 symbols)
[ParserWorker] extractCstFacts for app/Contracts/CacheInvalidatable.php: 0ms (3 facts)
[ParserWorker] Total parse operation for app/Contracts/CacheInvalidatable.php: 1ms
[ParserWorker] parser.parse() for AGENTS.md: 6ms (13151 bytes)
[ParserWorker] extractCstFacts for AGENTS.md: 0ms (0 facts)
[ParserWorker] Total parse operation for AGENTS.md: 6ms
[ParserWorker] parser.parse() for .serena/memories/suggested_commands.md: 0ms (763 bytes)
[ParserWorker] extractCstFacts for .serena/memories/suggested_commands.md: 0ms (0 facts)
[ParserWorker] Total parse operation for .serena/memories/suggested_commands.md: 1ms
[ParserWorker] parser.parse() for .serena/memories/style_and_conventions.md: 0ms (583 bytes)
[ParserWorker] extractCstFacts for .serena/memories/style_and_conventions.md: 0ms (0 facts)
[ParserWorker] Total parse operation for .serena/memories/style_and_conventions.md: 3ms
[ParserWorker] parser.parse() for .serena/memories/project_overview.md: 0ms (763 bytes)
[ParserWorker] extractCstFacts for .serena/memories/project_overview.md: 0ms (0 facts)
[ParserWorker] Total parse operation for .serena/memories/project_overview.md: 0ms
[ParserWorker] parser.parse() for .serena/memories/completion_checklist.md: 1ms (377 bytes)
[ParserWorker] extractCstFacts for .serena/memories/completion_checklist.md: 0ms (0 facts)
[ParserWorker] Total parse operation for .serena/memories/completion_checklist.md: 1ms
[ParserWorker] parser.parse() for .claude/settings.local.json: 0ms (102 bytes)
[ParserWorker] extractCstFacts for .claude/settings.local.json: 1ms (1 facts)
[ParserWorker] Total parse operation for .claude/settings.local.json: 1ms
[ParserWorker] parser.parse() for .agent/rules/agents.md: 3ms (5690 bytes)
[ParserWorker] extractCstFacts for .agent/rules/agents.md: 0ms (0 facts)
[ParserWorker] Total parse operation for .agent/rules/agents.md: 3ms
[ParserWorker] parser.parse() for app/Helpers/PhotoUploadHelper.php: 10ms (26852 bytes)
[ParserWorker] extractSymbols completed for app/Helpers/PhotoUploadHelper.php: 14 symbols in 11ms (7209 iterations)
[ParserWorker] extractSymbols for app/Helpers/PhotoUploadHelper.php: 11ms (14 symbols)
[ParserWorker] extractCstFacts for app/Helpers/PhotoUploadHelper.php: 0ms (1 facts)
[ParserWorker] Total parse operation for app/Helpers/PhotoUploadHelper.php: 21ms
[ParserWorker] parser.parse() for app/Http/Requests/EventLogPaymentRequest.php: 1ms (2274 bytes)
[ParserWorker] extractSymbols completed for app/Http/Requests/EventLogPaymentRequest.php: 4 symbols in 1ms (641 iterations)
[ParserWorker] extractSymbols for app/Http/Requests/EventLogPaymentRequest.php: 1ms (4 symbols)
[ParserWorker] extractCstFacts for app/Http/Requests/EventLogPaymentRequest.php: 0ms (0 facts)
[ParserWorker] Total parse operation for app/Http/Requests/EventLogPaymentRequest.php: 2ms
[ParserWorker] parser.parse() for app/Http/Requests/EventCreateRequest.php: 1ms (3036 bytes)
[ParserWorker] extractSymbols completed for app/Http/Requests/EventCreateRequest.php: 4 symbols in 1ms (532 iterations)
[ParserWorker] extractSymbols for app/Http/Requests/EventCreateRequest.php: 1ms (4 symbols)
[ParserWorker] extractCstFacts for app/Http/Requests/EventCreateRequest.php: 0ms (1 facts)
[ParserWorker] Total parse operation for app/Http/Requests/EventCreateRequest.php: 2ms
[ParserWorker] parser.parse() for app/Http/Requests/EventCloneRequest.php: 0ms (1494 bytes)
[ParserWorker] extractSymbols completed for app/Http/Requests/EventCloneRequest.php: 4 symbols in 1ms (256 iterations)
[ParserWorker] extractSymbols for app/Http/Requests/EventCloneRequest.php: 1ms (4 symbols)
[ParserWorker] extractCstFacts for app/Http/Requests/EventCloneRequest.php: 0ms (1 facts)
[ParserWorker] Total parse operation for app/Http/Requests/EventCloneRequest.php: 1ms
[ParserWorker] parser.parse() for app/Http/Requests/CreateUserRequest.php: 0ms (2025 bytes)
[ParserWorker] extractSymbols completed for app/Http/Requests/CreateUserRequest.php: 6 symbols in 1ms (448 iterations)
[ParserWorker] extractSymbols for app/Http/Requests/CreateUserRequest.php: 1ms (6 symbols)
[ParserWorker] extractCstFacts for app/Http/Requests/CreateUserRequest.php: 0ms (1 facts)
[ParserWorker] Total parse operation for app/Http/Requests/CreateUserRequest.php: 1ms
[ParserWorker] parser.parse() for app/Http/Requests/ClientUpdateRequest.php: 1ms (2729 bytes)
[ParserWorker] extractSymbols completed for app/Http/Requests/ClientUpdateRequest.php: 5 symbols in 0ms (557 iterations)
[ParserWorker] extractSymbols for app/Http/Requests/ClientUpdateRequest.php: 0ms (5 symbols)
[ParserWorker] extractCstFacts for app/Http/Requests/ClientUpdateRequest.php: 1ms (1 facts)
[ParserWorker] Total parse operation for app/Http/Requests/ClientUpdateRequest.php: 2ms
[ParserWorker] parser.parse() for app/Http/Requests/ClientCreateRequest.php: 0ms (2620 bytes)
[ParserWorker] extractSymbols completed for app/Http/Requests/ClientCreateRequest.php: 5 symbols in 1ms (504 iterations)
[ParserWorker] extractSymbols for app/Http/Requests/ClientCreateRequest.php: 1ms (5 symbols)
[ParserWorker] extractCstFacts for app/Http/Requests/ClientCreateRequest.php: 0ms (1 facts)
[ParserWorker] Total parse operation for app/Http/Requests/ClientCreateRequest.php: 1ms
[ParserWorker] parser.parse() for app/Http/Requests/CheckInRequest.php: 0ms (394 bytes)
[ParserWorker] parser.parse() for app/Http/Requests/EventLogPaymentRequest.php: 1ms (2274 bytes)
[ParserWorker] extractSymbols completed for app/Http/Requests/CheckInRequest.php: 2 symbols in 1ms (63 iterations)
[ParserWorker] extractSymbols for app/Http/Requests/CheckInRequest.php: 1ms (2 symbols)
[ParserWorker] extractCstFacts for app/Http/Requests/CheckInRequest.php: 0ms (0 facts)
[ParserWorker] Total parse operation for app/Http/Requests/CheckInRequest.php: 1ms
[ParserWorker] parser.parse() for app/Http/Middleware/RequireOnboarding.php: 0ms (1921 bytes)
[ParserWorker] extractSymbols completed for app/Http/Middleware/RequireOnboarding.php: 2 symbols in 1ms (445 iterations)
[ParserWorker] extractSymbols for app/Http/Middleware/RequireOnboarding.php: 1ms (2 symbols)
[ParserWorker] extractCstFacts for app/Http/Middleware/RequireOnboarding.php: 0ms (1 facts)
[ParserWorker] Total parse operation for app/Http/Middleware/RequireOnboarding.php: 1ms
[ParserWorker] parser.parse() for app/Http/Middleware/Authenticate.php: 0ms (1299 bytes)
[ParserWorker] extractSymbols completed for app/Http/Middleware/Authenticate.php: 2 symbols in 1ms (248 iterations)
[ParserWorker] extractSymbols for app/Http/Middleware/Authenticate.php: 1ms (2 symbols)
[ParserWorker] extractCstFacts for app/Http/Middleware/Authenticate.php: 0ms (1 facts)
[ParserWorker] Total parse operation for app/Http/Middleware/Authenticate.php: 1ms
[ParserWorker] parser.parse() for app/Http/Controllers/ViewerController.php: 1ms (2704 bytes)
[ParserWorker] extractSymbols completed for app/Http/Controllers/ViewerController.php: 4 symbols in 1ms (740 iterations)
[ParserWorker] extractSymbols for app/Http/Controllers/ViewerController.php: 1ms (4 symbols)
[ParserWorker] extractCstFacts for app/Http/Controllers/ViewerController.php: 0ms (1 facts)
[ParserWorker] Total parse operation for app/Http/Controllers/ViewerController.php: 2ms
[ParserWorker] parser.parse() for app/Http/Controllers/UserController.php: 18ms (55577 bytes)
[ParserWorker] extractSymbols completed for app/Http/Controllers/UserController.php: 45 symbols in 19ms (14369 iterations)
[ParserWorker] extractSymbols for app/Http/Controllers/UserController.php: 21ms (45 symbols)
[ParserWorker] extractCstFacts for app/Http/Controllers/UserController.php: 0ms (2 facts)
[ParserWorker] Total parse operation for app/Http/Controllers/UserController.php: 39ms
[ParserWorker] parser.parse() for app/Http/Controllers/SpecialDayController.php: 5ms (12029 bytes)
[ParserWorker] extractSymbols completed for app/Http/Controllers/SpecialDayController.php: 20 symbols in 6ms (3401 iterations)
[ParserWorker] extractSymbols for app/Http/Controllers/SpecialDayController.php: 6ms (20 symbols)
[ParserWorker] extractCstFacts for app/Http/Controllers/SpecialDayController.php: 0ms (1 facts)
[ParserWorker] Total parse operation for app/Http/Controllers/SpecialDayController.php: 12ms
[ParserWorker] parser.parse() for app/Http/Controllers/RoleController.php: 7ms (24368 bytes)
[ParserWorker] extractSymbols completed for app/Http/Controllers/RoleController.php: 22 symbols in 8ms (6439 iterations)
[ParserWorker] extractSymbols for app/Http/Controllers/RoleController.php: 9ms (22 symbols)
[ParserWorker] extractCstFacts for app/Http/Controllers/RoleController.php: 0ms (2 facts)
[ParserWorker] Total parse operation for app/Http/Controllers/RoleController.php: 16ms
[ParserWorker] parser.parse() for app/Http/Controllers/ResourceController.php: 1ms (2623 bytes)
[ParserWorker] extractSymbols completed for app/Http/Controllers/ResourceController.php: 6 symbols in 0ms (609 iterations)
[ParserWorker] extractSymbols for app/Http/Controllers/ResourceController.php: 1ms (6 symbols)
[ParserWorker] extractCstFacts for app/Http/Controllers/ResourceController.php: 0ms (1 facts)
[ParserWorker] Total parse operation for app/Http/Controllers/ResourceController.php: 2ms
[ParserWorker] parser.parse() for app/Http/Controllers/ReportController.php: 7ms (27591 bytes)
[ParserWorker] extractSymbols completed for app/Http/Controllers/ReportController.php: 20 symbols in 7ms (7250 iterations)
[ParserWorker] extractSymbols for app/Http/Controllers/ReportController.php: 9ms (20 symbols)
[ParserWorker] extractCstFacts for app/Http/Controllers/ReportController.php: 0ms (2 facts)
[ParserWorker] Total parse operation for app/Http/Controllers/ReportController.php: 16ms
[ParserWorker] parser.parse() for app/Http/Controllers/README.md: 2ms (4343 bytes)
[ParserWorker] extractCstFacts for app/Http/Controllers/README.md: 0ms (0 facts)
[ParserWorker] Total parse operation for app/Http/Controllers/README.md: 2ms
[ParserWorker] parser.parse() for app/Http/Controllers/PermissionController.php: 1ms (3468 bytes)
[ParserWorker] extractSymbols completed for app/Http/Controllers/PermissionController.php: 6 symbols in 1ms (1033 iterations)
[ParserWorker] extractSymbols for app/Http/Controllers/PermissionController.php: 1ms (6 symbols)
[ParserWorker] extractCstFacts for app/Http/Controllers/PermissionController.php: 0ms (0 facts)
[ParserWorker] Total parse operation for app/Http/Controllers/PermissionController.php: 3ms
[ParserWorker] parser.parse() for app/Http/Controllers/OnboardingController.php: 1ms (3269 bytes)
[ParserWorker] extractSymbols completed for app/Http/Controllers/OnboardingController.php: 5 symbols in 2ms (811 iterations)
[ParserWorker] extractSymbols for app/Http/Controllers/OnboardingController.php: 2ms (5 symbols)
[ParserWorker] extractCstFacts for app/Http/Controllers/OnboardingController.php: 0ms (1 facts)
[ParserWorker] Total parse operation for app/Http/Controllers/OnboardingController.php: 3ms
[ParserWorker] parser.parse() for app/Http/Controllers/LiveBindTestController.php: 2ms (10130 bytes)
[ParserWorker] extractSymbols completed for app/Http/Controllers/LiveBindTestController.php: 14 symbols in 2ms (2239 iterations)
[ParserWorker] extractSymbols for app/Http/Controllers/LiveBindTestController.php: 2ms (14 symbols)
[ParserWorker] extractCstFacts for app/Http/Controllers/LiveBindTestController.php: 0ms (1 facts)
[ParserWorker] Total parse operation for app/Http/Controllers/LiveBindTestController.php: 5ms
[ParserWorker] parser.parse() for app/Http/Controllers/InternalCalendarController.php: 4ms (13976 bytes)
[ParserWorker] extractSymbols completed for app/Http/Controllers/InternalCalendarController.php: 12 symbols in 4ms (3781 iterations)
[ParserWorker] extractSymbols for app/Http/Controllers/InternalCalendarController.php: 5ms (12 symbols)
[ParserWorker] extractCstFacts for app/Http/Controllers/InternalCalendarController.php: 0ms (2 facts)
[ParserWorker] Total parse operation for app/Http/Controllers/InternalCalendarController.php: 9ms
[ParserWorker] parser.parse() for app/Http/Controllers/FileUploadController.php: 3ms (11764 bytes)
[ParserWorker] extractSymbols completed for app/Http/Controllers/FileUploadController.php: 9 symbols in 3ms (3374 iterations)
[ParserWorker] extractSymbols for app/Http/Controllers/FileUploadController.php: 3ms (9 symbols)
[ParserWorker] extractCstFacts for app/Http/Controllers/FileUploadController.php: 1ms (1 facts)
[ParserWorker] Total parse operation for app/Http/Controllers/FileUploadController.php: 7ms
[ParserWorker] parser.parse() for app/Http/Controllers/EventLogController.php: 7ms (27741 bytes)
[ParserWorker] extractSymbols completed for app/Http/Controllers/EventLogController.php: 26 symbols in 8ms (7146 iterations)
[ParserWorker] extractSymbols for app/Http/Controllers/EventLogController.php: 8ms (26 symbols)
[ParserWorker] extractCstFacts for app/Http/Controllers/EventLogController.php: 0ms (1 facts)
[ParserWorker] Total parse operation for app/Http/Controllers/EventLogController.php: 15ms
[ParserWorker] parser.parse() for app/Http/Controllers/EventInvoiceController.php: 5ms (16382 bytes)
[ParserWorker] extractSymbols completed for app/Http/Controllers/EventInvoiceController.php: 18 symbols in 4ms (4506 iterations)
[ParserWorker] extractSymbols for app/Http/Controllers/EventInvoiceController.php: 4ms (18 symbols)
[ParserWorker] extractCstFacts for app/Http/Controllers/EventInvoiceController.php: 0ms (2 facts)
[ParserWorker] Total parse operation for app/Http/Controllers/EventInvoiceController.php: 12ms
[ParserWorker] parser.parse() for app/Http/Controllers/EventController.php: 8ms (30514 bytes)
[ParserWorker] extractSymbols completed for app/Http/Controllers/EventController.php: 24 symbols in 10ms (7926 iterations)
[ParserWorker] extractSymbols for app/Http/Controllers/EventController.php: 10ms (24 symbols)
[ParserWorker] extractCstFacts for app/Http/Controllers/EventController.php: 0ms (2 facts)
[ParserWorker] Total parse operation for app/Http/Controllers/EventController.php: 20ms
[ParserWorker] parser.parse() for app/Http/Controllers/EventAssignmentController.php: 8ms (35173 bytes)
[ParserWorker] extractSymbols completed for app/Http/Controllers/EventAssignmentController.php: 21 symbols in 9ms (8210 iterations)
[ParserWorker] extractSymbols for app/Http/Controllers/EventAssignmentController.php: 11ms (21 symbols)
[ParserWorker] extractCstFacts for app/Http/Controllers/EventAssignmentController.php: 0ms (2 facts)
[ParserWorker] Total parse operation for app/Http/Controllers/EventAssignmentController.php: 20ms
[ParserWorker] parser.parse() for app/Http/Controllers/EventAdminAssignController.php: 2ms (7233 bytes)
[ParserWorker] extractSymbols completed for app/Http/Controllers/EventAdminAssignController.php: 5 symbols in 1ms (1813 iterations)
[ParserWorker] extractSymbols for app/Http/Controllers/EventAdminAssignController.php: 1ms (5 symbols)
[ParserWorker] extractCstFacts for app/Http/Controllers/EventAdminAssignController.php: 1ms (2 facts)
[ParserWorker] Total parse operation for app/Http/Controllers/EventAdminAssignController.php: 4ms
[ParserWorker] parser.parse() for app/Http/Controllers/CommunicationController.php: 4ms (17443 bytes)
[ParserWorker] extractSymbols completed for app/Http/Controllers/CommunicationController.php: 18 symbols in 5ms (4398 iterations)
[ParserWorker] extractSymbols for app/Http/Controllers/CommunicationController.php: 5ms (18 symbols)
[ParserWorker] extractCstFacts for app/Http/Controllers/CommunicationController.php: 0ms (1 facts)
[ParserWorker] Total parse operation for app/Http/Controllers/CommunicationController.php: 11ms
[ParserWorker] parser.parse() for app/Http/Controllers/ClientController.php: 2ms (12553 bytes)
[ParserWorker] extractSymbols completed for app/Http/Controllers/ClientController.php: 17 symbols in 3ms (3069 iterations)
[ParserWorker] extractSymbols for app/Http/Controllers/ClientController.php: 3ms (17 symbols)
[ParserWorker] extractCstFacts for app/Http/Controllers/ClientController.php: 1ms (2 facts)
[ParserWorker] Total parse operation for app/Http/Controllers/ClientController.php: 6ms
[ParserWorker] parser.parse() for app/Http/Controllers/CheckInController.php: 2ms (9662 bytes)
[ParserWorker] extractSymbols completed for app/Http/Controllers/CheckInController.php: 5 symbols in 3ms (2545 iterations)
[ParserWorker] extractSymbols for app/Http/Controllers/CheckInController.php: 3ms (5 symbols)
[ParserWorker] extractCstFacts for app/Http/Controllers/CheckInController.php: 0ms (2 facts)
[ParserWorker] Total parse operation for app/Http/Controllers/CheckInController.php: 5ms
[ParserWorker] parser.parse() for app/Http/Controllers/CalendarController.php: 2ms (7359 bytes)
[ParserWorker] extractSymbols completed for app/Http/Controllers/CalendarController.php: 11 symbols in 2ms (1993 iterations)
[ParserWorker] extractSymbols for app/Http/Controllers/CalendarController.php: 2ms (11 symbols)
[ParserWorker] extractCstFacts for app/Http/Controllers/CalendarController.php: 0ms (1 facts)
[ParserWorker] Total parse operation for app/Http/Controllers/CalendarController.php: 4ms
[ParserWorker] parser.parse() for app/Http/Controllers/CacheController.php: 1ms (660 bytes)
[ParserWorker] extractSymbols completed for app/Http/Controllers/CacheController.php: 2 symbols in 0ms (142 iterations)
[ParserWorker] extractSymbols for app/Http/Controllers/CacheController.php: 0ms (2 symbols)
[ParserWorker] extractCstFacts for app/Http/Controllers/CacheController.php: 0ms (1 facts)
[ParserWorker] Total parse operation for app/Http/Controllers/CacheController.php: 1ms
[ParserWorker] parser.parse() for app/Http/Controllers/BaseController.php: 1ms (6101 bytes)
[ParserWorker] extractSymbols completed for app/Http/Controllers/BaseController.php: 18 symbols in 2ms (1251 iterations)
[ParserWorker] extractSymbols for app/Http/Controllers/BaseController.php: 2ms (18 symbols)
[ParserWorker] extractCstFacts for app/Http/Controllers/BaseController.php: 0ms (1 facts)
[ParserWorker] Total parse operation for app/Http/Controllers/BaseController.php: 3ms
[ParserWorker] parser.parse() for app/Http/Controllers/ApplyStaffEventController.php: 3ms (12066 bytes)
[ParserWorker] extractSymbols completed for app/Http/Controllers/ApplyStaffEventController.php: 7 symbols in 3ms (3060 iterations)
[ParserWorker] extractSymbols for app/Http/Controllers/ApplyStaffEventController.php: 3ms (7 symbols)
[ParserWorker] extractCstFacts for app/Http/Controllers/ApplyStaffEventController.php: 0ms (2 facts)
[ParserWorker] Total parse operation for app/Http/Controllers/ApplyStaffEventController.php: 6ms
[ParserWorker] parser.parse() for app/Http/Controllers/AdminPayTrackerController.php: 5ms (21641 bytes)
[ParserWorker] extractSymbols completed for app/Http/Controllers/AdminPayTrackerController.php: 11 symbols in 6ms (5997 iterations)
[ParserWorker] extractSymbols for app/Http/Controllers/AdminPayTrackerController.php: 6ms (11 symbols)
[ParserWorker] extractCstFacts for app/Http/Controllers/AdminPayTrackerController.php: 0ms (1 facts)
[ParserWorker] Total parse operation for app/Http/Controllers/AdminPayTrackerController.php: 11ms
[ParserWorker] parser.parse() for app/Helpers/WarningHelper.php: 0ms (3427 bytes)
[ParserWorker] extractSymbols completed for app/Helpers/WarningHelper.php: 6 symbols in 1ms (870 iterations)
[ParserWorker] extractSymbols for app/Helpers/WarningHelper.php: 1ms (6 symbols)
[ParserWorker] extractCstFacts for app/Helpers/WarningHelper.php: 0ms (1 facts)
[ParserWorker] Total parse operation for app/Helpers/WarningHelper.php: 1ms
[ParserWorker] parser.parse() for app/Helpers/ViewHelper.php: 5ms (18783 bytes)
[ParserWorker] extractSymbols completed for app/Helpers/ViewHelper.php: 12 symbols in 4ms (4687 iterations)
[ParserWorker] extractSymbols for app/Helpers/ViewHelper.php: 4ms (12 symbols)
[ParserWorker] extractCstFacts for app/Helpers/ViewHelper.php: 0ms (1 facts)
[ParserWorker] Total parse operation for app/Helpers/ViewHelper.php: 9ms
[ParserWorker] parser.parse() for app/Helpers/UserListHelper.php: 0ms (2018 bytes)
[ParserWorker] extractSymbols completed for app/Helpers/UserListHelper.php: 2 symbols in 1ms (381 iterations)
[ParserWorker] extractSymbols for app/Helpers/UserListHelper.php: 1ms (2 symbols)
[ParserWorker] extractCstFacts for app/Helpers/UserListHelper.php: 0ms (1 facts)
[ParserWorker] Total parse operation for app/Helpers/UserListHelper.php: 1ms
[ParserWorker] parser.parse() for app/Helpers/UserHelper.php: 1ms (3787 bytes)
[ParserWorker] extractSymbols completed for app/Helpers/UserHelper.php: 9 symbols in 0ms (803 iterations)
[ParserWorker] extractSymbols for app/Helpers/UserHelper.php: 1ms (9 symbols)
[ParserWorker] extractCstFacts for app/Helpers/UserHelper.php: 0ms (1 facts)
[ParserWorker] Total parse operation for app/Helpers/UserHelper.php: 2ms
[ParserWorker] parser.parse() for app/Helpers/UploadHelper.php: 5ms (20712 bytes)
[ParserWorker] extractSymbols completed for app/Helpers/UploadHelper.php: 20 symbols in 6ms (5760 iterations)
[ParserWorker] extractSymbols for app/Helpers/UploadHelper.php: 6ms (20 symbols)
[ParserWorker] extractCstFacts for app/Helpers/UploadHelper.php: 0ms (0 facts)
[ParserWorker] Total parse operation for app/Helpers/UploadHelper.php: 11ms
[ParserWorker] parser.parse() for app/Helpers/UnpolyHelper.php: 1ms (5792 bytes)
[ParserWorker] extractSymbols completed for app/Helpers/UnpolyHelper.php: 11 symbols in 1ms (1015 iterations)
[ParserWorker] extractSymbols for app/Helpers/UnpolyHelper.php: 1ms (11 symbols)
[ParserWorker] extractCstFacts for app/Helpers/UnpolyHelper.php: 0ms (1 facts)
[ParserWorker] Total parse operation for app/Helpers/UnpolyHelper.php: 2ms
[ParserWorker] parser.parse() for app/Helpers/ToastHelper.php: 1ms (1835 bytes)
[ParserWorker] extractSymbols completed for app/Helpers/ToastHelper.php: 7 symbols in 0ms (379 iterations)
[ParserWorker] extractSymbols for app/Helpers/ToastHelper.php: 0ms (7 symbols)
[ParserWorker] extractCstFacts for app/Helpers/ToastHelper.php: 0ms (1 facts)
[ParserWorker] Total parse operation for app/Helpers/ToastHelper.php: 1ms
[ParserWorker] parser.parse() for app/Helpers/TableHelper.php: 2ms (7175 bytes)
[ParserWorker] extractSymbols completed for app/Helpers/TableHelper.php: 6 symbols in 2ms (1821 iterations)
[ParserWorker] extractSymbols for app/Helpers/TableHelper.php: 2ms (6 symbols)
[ParserWorker] extractCstFacts for app/Helpers/TableHelper.php: 0ms (1 facts)
[ParserWorker] Total parse operation for app/Helpers/TableHelper.php: 4ms
[ParserWorker] parser.parse() for app/Helpers/StringHelper.php: 1ms (980 bytes)
[ParserWorker] extractSymbols completed for app/Helpers/StringHelper.php: 3 symbols in 0ms (225 iterations)
[ParserWorker] extractSymbols for app/Helpers/StringHelper.php: 0ms (3 symbols)
[ParserWorker] extractCstFacts for app/Helpers/StringHelper.php: 0ms (1 facts)
[ParserWorker] Total parse operation for app/Helpers/StringHelper.php: 1ms
[ParserWorker] parser.parse() for app/Helpers/SmsHelper.php: 1ms (3521 bytes)
[ParserWorker] extractSymbols completed for app/Helpers/SmsHelper.php: 7 symbols in 1ms (908 iterations)
[ParserWorker] extractSymbols for app/Helpers/SmsHelper.php: 1ms (7 symbols)
[ParserWorker] extractCstFacts for app/Helpers/SmsHelper.php: 0ms (1 facts)
[ParserWorker] Total parse operation for app/Helpers/SmsHelper.php: 2ms
[ParserWorker] parser.parse() for app/Helpers/SessionHelper.php: 3ms (8697 bytes)
[ParserWorker] extractSymbols completed for app/Helpers/SessionHelper.php: 30 symbols in 2ms (2079 iterations)
[ParserWorker] extractSymbols for app/Helpers/SessionHelper.php: 2ms (30 symbols)
[ParserWorker] extractCstFacts for app/Helpers/SessionHelper.php: 0ms (1 facts)
[ParserWorker] Total parse operation for app/Helpers/SessionHelper.php: 5ms
[ParserWorker] parser.parse() for app/Helpers/RouteHelper.php: 1ms (1700 bytes)
[ParserWorker] extractSymbols completed for app/Helpers/RouteHelper.php: 4 symbols in 0ms (474 iterations)
[ParserWorker] extractSymbols for app/Helpers/RouteHelper.php: 0ms (4 symbols)
[ParserWorker] extractCstFacts for app/Helpers/RouteHelper.php: 0ms (0 facts)
[ParserWorker] Total parse operation for app/Helpers/RouteHelper.php: 1ms
[ParserWorker] parser.parse() for app/Helpers/RequestHelper.php: 3ms (13798 bytes)
[ParserWorker] extractSymbols completed for app/Helpers/RequestHelper.php: 13 symbols in 4ms (3423 iterations)
[ParserWorker] extractSymbols for app/Helpers/RequestHelper.php: 4ms (13 symbols)
[ParserWorker] extractCstFacts for app/Helpers/RequestHelper.php: 0ms (1 facts)
[ParserWorker] Total parse operation for app/Helpers/RequestHelper.php: 7ms
[ParserWorker] parser.parse() for app/Helpers/ReminderHelper.php: 2ms (4700 bytes)
[ParserWorker] extractSymbols completed for app/Helpers/ReminderHelper.php: 4 symbols in 1ms (1317 iterations)
[ParserWorker] extractSymbols for app/Helpers/ReminderHelper.php: 1ms (4 symbols)
[ParserWorker] extractCstFacts for app/Helpers/ReminderHelper.php: 0ms (1 facts)
[ParserWorker] Total parse operation for app/Helpers/ReminderHelper.php: 3ms
[ParserWorker] parser.parse() for app/Helpers/README.md: 2ms (4967 bytes)
[ParserWorker] extractCstFacts for app/Helpers/README.md: 0ms (0 facts)
[ParserWorker] Total parse operation for app/Helpers/README.md: 2ms
[ParserWorker] parser.parse() for app/Helpers/QueryHelper.php: 2ms (5062 bytes)
[ParserWorker] extractSymbols completed for app/Helpers/QueryHelper.php: 5 symbols in 1ms (1287 iterations)
[ParserWorker] extractSymbols for app/Helpers/QueryHelper.php: 1ms (5 symbols)
[ParserWorker] extractCstFacts for app/Helpers/QueryHelper.php: 0ms (1 facts)
[ParserWorker] Total parse operation for app/Helpers/QueryHelper.php: 3ms
[ParserWorker] extractSymbols completed for app/Http/Requests/EventLogPaymentRequest.php: 4 symbols in 1ms (641 iterations)
[ParserWorker] extractSymbols for app/Http/Requests/EventLogPaymentRequest.php: 1ms (4 symbols)
[ParserWorker] extractCstFacts for app/Http/Requests/EventLogPaymentRequest.php: 0ms (0 facts)
[ParserWorker] Total parse operation for app/Http/Requests/EventLogPaymentRequest.php: 2ms
[ParserWorker] parser.parse() for app/Http/Requests/EventCreateRequest.php: 1ms (3036 bytes)
[ParserWorker] extractSymbols completed for app/Http/Requests/EventCreateRequest.php: 4 symbols in 1ms (532 iterations)
[ParserWorker] extractSymbols for app/Http/Requests/EventCreateRequest.php: 1ms (4 symbols)
[ParserWorker] extractCstFacts for app/Http/Requests/EventCreateRequest.php: 0ms (1 facts)
[ParserWorker] Total parse operation for app/Http/Requests/EventCreateRequest.php: 2ms
[ParserWorker] parser.parse() for app/Http/Requests/EventCloneRequest.php: 0ms (1494 bytes)
[ParserWorker] extractSymbols completed for app/Http/Requests/EventCloneRequest.php: 4 symbols in 1ms (256 iterations)
[ParserWorker] extractSymbols for app/Http/Requests/EventCloneRequest.php: 1ms (4 symbols)
[ParserWorker] extractCstFacts for app/Http/Requests/EventCloneRequest.php: 0ms (1 facts)
[ParserWorker] Total parse operation for app/Http/Requests/EventCloneRequest.php: 1ms
[ParserWorker] parser.parse() for app/Http/Requests/CreateUserRequest.php: 0ms (2025 bytes)
[ParserWorker] extractSymbols completed for app/Http/Requests/CreateUserRequest.php: 6 symbols in 1ms (448 iterations)
[ParserWorker] extractSymbols for app/Http/Requests/CreateUserRequest.php: 1ms (6 symbols)
[ParserWorker] extractCstFacts for app/Http/Requests/CreateUserRequest.php: 0ms (1 facts)
[ParserWorker] Total parse operation for app/Http/Requests/CreateUserRequest.php: 1ms
[ParserWorker] parser.parse() for app/Http/Requests/ClientUpdateRequest.php: 1ms (2729 bytes)
[ParserWorker] extractSymbols completed for app/Http/Requests/ClientUpdateRequest.php: 5 symbols in 0ms (557 iterations)
[ParserWorker] extractSymbols for app/Http/Requests/ClientUpdateRequest.php: 0ms (5 symbols)
[ParserWorker] extractCstFacts for app/Http/Requests/ClientUpdateRequest.php: 1ms (1 facts)
[ParserWorker] Total parse operation for app/Http/Requests/ClientUpdateRequest.php: 2ms
[ParserWorker] parser.parse() for app/Http/Requests/ClientCreateRequest.php: 0ms (2620 bytes)
[ParserWorker] extractSymbols completed for app/Http/Requests/ClientCreateRequest.php: 5 symbols in 1ms (504 iterations)
[ParserWorker] extractSymbols for app/Http/Requests/ClientCreateRequest.php: 1ms (5 symbols)
[ParserWorker] extractCstFacts for app/Http/Requests/ClientCreateRequest.php: 0ms (1 facts)
[ParserWorker] Total parse operation for app/Http/Requests/ClientCreateRequest.php: 1ms
[ParserWorker] parser.parse() for app/Http/Requests/CheckInRequest.php: 0ms (394 bytes)
[ParserWorker] extractSymbols completed for app/Http/Requests/CheckInRequest.php: 2 symbols in 1ms (63 iterations)
[ParserWorker] extractSymbols for app/Http/Requests/CheckInRequest.php: 1ms (2 symbols)
[ParserWorker] extractCstFacts for app/Http/Requests/CheckInRequest.php: 0ms (0 facts)
[ParserWorker] Total parse operation for app/Http/Requests/CheckInRequest.php: 1ms
[ParserWorker] parser.parse() for app/Http/Middleware/RequireOnboarding.php: 0ms (1921 bytes)
[ParserWorker] extractSymbols completed for app/Http/Middleware/RequireOnboarding.php: 2 symbols in 1ms (445 iterations)
[ParserWorker] extractSymbols for app/Http/Middleware/RequireOnboarding.php: 1ms (2 symbols)
[ParserWorker] extractCstFacts for app/Http/Middleware/RequireOnboarding.php: 0ms (1 facts)
[ParserWorker] Total parse operation for app/Http/Middleware/RequireOnboarding.php: 1ms
[ParserWorker] parser.parse() for app/Http/Middleware/Authenticate.php: 0ms (1299 bytes)
[ParserWorker] extractSymbols completed for app/Http/Middleware/Authenticate.php: 2 symbols in 1ms (248 iterations)
[ParserWorker] extractSymbols for app/Http/Middleware/Authenticate.php: 1ms (2 symbols)
[ParserWorker] extractCstFacts for app/Http/Middleware/Authenticate.php: 0ms (1 facts)
[ParserWorker] Total parse operation for app/Http/Middleware/Authenticate.php: 1ms
[ParserWorker] parser.parse() for app/Http/Controllers/ViewerController.php: 1ms (2704 bytes)
[ParserWorker] extractSymbols completed for app/Http/Controllers/ViewerController.php: 4 symbols in 1ms (740 iterations)
[ParserWorker] extractSymbols for app/Http/Controllers/ViewerController.php: 1ms (4 symbols)
[ParserWorker] extractCstFacts for app/Http/Controllers/ViewerController.php: 0ms (1 facts)
[ParserWorker] Total parse operation for app/Http/Controllers/ViewerController.php: 2ms
[ParserWorker] parser.parse() for app/Http/Controllers/UserController.php: 18ms (55577 bytes)
[ParserWorker] extractSymbols completed for app/Http/Controllers/UserController.php: 45 symbols in 19ms (14369 iterations)
[ParserWorker] extractSymbols for app/Http/Controllers/UserController.php: 21ms (45 symbols)
[ParserWorker] extractCstFacts for app/Http/Controllers/UserController.php: 0ms (2 facts)
[ParserWorker] Total parse operation for app/Http/Controllers/UserController.php: 39ms
[ParserWorker] parser.parse() for app/Http/Controllers/SpecialDayController.php: 5ms (12029 bytes)
[ParserWorker] extractSymbols completed for app/Http/Controllers/SpecialDayController.php: 20 symbols in 6ms (3401 iterations)
[ParserWorker] extractSymbols for app/Http/Controllers/SpecialDayController.php: 6ms (20 symbols)
[ParserWorker] extractCstFacts for app/Http/Controllers/SpecialDayController.php: 0ms (1 facts)
[ParserWorker] Total parse operation for app/Http/Controllers/SpecialDayController.php: 12ms
[ParserWorker] parser.parse() for app/Http/Controllers/RoleController.php: 7ms (24368 bytes)
[ParserWorker] extractSymbols completed for app/Http/Controllers/RoleController.php: 22 symbols in 8ms (6439 iterations)
[ParserWorker] extractSymbols for app/Http/Controllers/RoleController.php: 9ms (22 symbols)
[ParserWorker] extractCstFacts for app/Http/Controllers/RoleController.php: 0ms (2 facts)
[ParserWorker] Total parse operation for app/Http/Controllers/RoleController.php: 16ms
[ParserWorker] parser.parse() for app/Http/Controllers/ResourceController.php: 1ms (2623 bytes)
[ParserWorker] extractSymbols completed for app/Http/Controllers/ResourceController.php: 6 symbols in 0ms (609 iterations)
[ParserWorker] extractSymbols for app/Http/Controllers/ResourceController.php: 1ms (6 symbols)
[ParserWorker] extractCstFacts for app/Http/Controllers/ResourceController.php: 0ms (1 facts)
[ParserWorker] Total parse operation for app/Http/Controllers/ResourceController.php: 2ms
[ParserWorker] parser.parse() for app/Http/Controllers/ReportController.php: 7ms (27591 bytes)
[ParserWorker] extractSymbols completed for app/Http/Controllers/ReportController.php: 20 symbols in 7ms (7250 iterations)
[ParserWorker] extractSymbols for app/Http/Controllers/ReportController.php: 9ms (20 symbols)
[ParserWorker] extractCstFacts for app/Http/Controllers/ReportController.php: 0ms (2 facts)
[ParserWorker] Total parse operation for app/Http/Controllers/ReportController.php: 16ms
[ParserWorker] parser.parse() for app/Http/Controllers/README.md: 2ms (4343 bytes)
[ParserWorker] extractCstFacts for app/Http/Controllers/README.md: 0ms (0 facts)
[ParserWorker] Total parse operation for app/Http/Controllers/README.md: 2ms
[ParserWorker] parser.parse() for app/Http/Controllers/PermissionController.php: 1ms (3468 bytes)
[ParserWorker] extractSymbols completed for app/Http/Controllers/PermissionController.php: 6 symbols in 1ms (1033 iterations)
[ParserWorker] extractSymbols for app/Http/Controllers/PermissionController.php: 1ms (6 symbols)
[ParserWorker] extractCstFacts for app/Http/Controllers/PermissionController.php: 0ms (0 facts)
[ParserWorker] Total parse operation for app/Http/Controllers/PermissionController.php: 3ms
[ParserWorker] parser.parse() for app/Http/Controllers/OnboardingController.php: 1ms (3269 bytes)
[ParserWorker] extractSymbols completed for app/Http/Controllers/OnboardingController.php: 5 symbols in 2ms (811 iterations)
[ParserWorker] extractSymbols for app/Http/Controllers/OnboardingController.php: 2ms (5 symbols)
[ParserWorker] extractCstFacts for app/Http/Controllers/OnboardingController.php: 0ms (1 facts)
[ParserWorker] Total parse operation for app/Http/Controllers/OnboardingController.php: 3ms
[ParserWorker] parser.parse() for app/Http/Controllers/LiveBindTestController.php: 2ms (10130 bytes)
[ParserWorker] extractSymbols completed for app/Http/Controllers/LiveBindTestController.php: 14 symbols in 2ms (2239 iterations)
[ParserWorker] extractSymbols for app/Http/Controllers/LiveBindTestController.php: 2ms (14 symbols)
[ParserWorker] extractCstFacts for app/Http/Controllers/LiveBindTestController.php: 0ms (1 facts)
[ParserWorker] Total parse operation for app/Http/Controllers/LiveBindTestController.php: 5ms
[ParserWorker] parser.parse() for app/Http/Controllers/InternalCalendarController.php: 4ms (13976 bytes)
[ParserWorker] extractSymbols completed for app/Http/Controllers/InternalCalendarController.php: 12 symbols in 4ms (3781 iterations)
[ParserWorker] extractSymbols for app/Http/Controllers/InternalCalendarController.php: 5ms (12 symbols)
[ParserWorker] extractCstFacts for app/Http/Controllers/InternalCalendarController.php: 0ms (2 facts)
[ParserWorker] Total parse operation for app/Http/Controllers/InternalCalendarController.php: 9ms
[ParserWorker] parser.parse() for app/Http/Controllers/FileUploadController.php: 3ms (11764 bytes)
[ParserWorker] extractSymbols completed for app/Http/Controllers/FileUploadController.php: 9 symbols in 3ms (3374 iterations)
[ParserWorker] extractSymbols for app/Http/Controllers/FileUploadController.php: 3ms (9 symbols)
[ParserWorker] extractCstFacts for app/Http/Controllers/FileUploadController.php: 1ms (1 facts)
[ParserWorker] Total parse operation for app/Http/Controllers/FileUploadController.php: 7ms
[ParserWorker] parser.parse() for app/Http/Controllers/EventLogController.php: 7ms (27741 bytes)
[ParserWorker] extractSymbols completed for app/Http/Controllers/EventLogController.php: 26 symbols in 8ms (7146 iterations)
[ParserWorker] extractSymbols for app/Http/Controllers/EventLogController.php: 8ms (26 symbols)
[ParserWorker] extractCstFacts for app/Http/Controllers/EventLogController.php: 0ms (1 facts)
[ParserWorker] Total parse operation for app/Http/Controllers/EventLogController.php: 15ms
[ParserWorker] parser.parse() for app/Http/Controllers/EventInvoiceController.php: 5ms (16382 bytes)
[ParserWorker] extractSymbols completed for app/Http/Controllers/EventInvoiceController.php: 18 symbols in 4ms (4506 iterations)
[ParserWorker] extractSymbols for app/Http/Controllers/EventInvoiceController.php: 4ms (18 symbols)
[ParserWorker] extractCstFacts for app/Http/Controllers/EventInvoiceController.php: 0ms (2 facts)
[ParserWorker] Total parse operation for app/Http/Controllers/EventInvoiceController.php: 12ms
[ParserWorker] parser.parse() for app/Http/Controllers/EventController.php: 8ms (30514 bytes)
[ParserWorker] extractSymbols completed for app/Http/Controllers/EventController.php: 24 symbols in 10ms (7926 iterations)
[ParserWorker] extractSymbols for app/Http/Controllers/EventController.php: 10ms (24 symbols)
[ParserWorker] extractCstFacts for app/Http/Controllers/EventController.php: 0ms (2 facts)
[ParserWorker] Total parse operation for app/Http/Controllers/EventController.php: 20ms
[ParserWorker] parser.parse() for app/Http/Controllers/EventAssignmentController.php: 8ms (35173 bytes)
[ParserWorker] extractSymbols completed for app/Http/Controllers/EventAssignmentController.php: 21 symbols in 9ms (8210 iterations)
[ParserWorker] extractSymbols for app/Http/Controllers/EventAssignmentController.php: 11ms (21 symbols)
[ParserWorker] extractCstFacts for app/Http/Controllers/EventAssignmentController.php: 0ms (2 facts)
[ParserWorker] Total parse operation for app/Http/Controllers/EventAssignmentController.php: 20ms
[ParserWorker] parser.parse() for app/Http/Controllers/EventAdminAssignController.php: 2ms (7233 bytes)
[ParserWorker] extractSymbols completed for app/Http/Controllers/EventAdminAssignController.php: 5 symbols in 1ms (1813 iterations)
[ParserWorker] extractSymbols for app/Http/Controllers/EventAdminAssignController.php: 1ms (5 symbols)
[ParserWorker] extractCstFacts for app/Http/Controllers/EventAdminAssignController.php: 1ms (2 facts)
[ParserWorker] Total parse operation for app/Http/Controllers/EventAdminAssignController.php: 4ms
[ParserWorker] parser.parse() for app/Http/Controllers/CommunicationController.php: 4ms (17443 bytes)
[ParserWorker] extractSymbols completed for app/Http/Controllers/CommunicationController.php: 18 symbols in 5ms (4398 iterations)
[ParserWorker] extractSymbols for app/Http/Controllers/CommunicationController.php: 5ms (18 symbols)
[ParserWorker] extractCstFacts for app/Http/Controllers/CommunicationController.php: 0ms (1 facts)
[ParserWorker] Total parse operation for app/Http/Controllers/CommunicationController.php: 11ms
[ParserWorker] parser.parse() for app/Http/Controllers/ClientController.php: 2ms (12553 bytes)
[ParserWorker] extractSymbols completed for app/Http/Controllers/ClientController.php: 17 symbols in 3ms (3069 iterations)
[ParserWorker] extractSymbols for app/Http/Controllers/ClientController.php: 3ms (17 symbols)
[ParserWorker] extractCstFacts for app/Http/Controllers/ClientController.php: 1ms (2 facts)
[ParserWorker] Total parse operation for app/Http/Controllers/ClientController.php: 6ms
[ParserWorker] parser.parse() for app/Http/Controllers/CheckInController.php: 2ms (9662 bytes)
[ParserWorker] extractSymbols completed for app/Http/Controllers/CheckInController.php: 5 symbols in 3ms (2545 iterations)
[ParserWorker] extractSymbols for app/Http/Controllers/CheckInController.php: 3ms (5 symbols)
[ParserWorker] extractCstFacts for app/Http/Controllers/CheckInController.php: 0ms (2 facts)
[ParserWorker] Total parse operation for app/Http/Controllers/CheckInController.php: 5ms
[ParserWorker] parser.parse() for app/Http/Controllers/CalendarController.php: 2ms (7359 bytes)
[ParserWorker] extractSymbols completed for app/Http/Controllers/CalendarController.php: 11 symbols in 2ms (1993 iterations)
[ParserWorker] extractSymbols for app/Http/Controllers/CalendarController.php: 2ms (11 symbols)
[ParserWorker] extractCstFacts for app/Http/Controllers/CalendarController.php: 0ms (1 facts)
[ParserWorker] Total parse operation for app/Http/Controllers/CalendarController.php: 4ms
[ParserWorker] parser.parse() for app/Http/Controllers/CacheController.php: 1ms (660 bytes)
[ParserWorker] extractSymbols completed for app/Http/Controllers/CacheController.php: 2 symbols in 0ms (142 iterations)
[ParserWorker] extractSymbols for app/Http/Controllers/CacheController.php: 0ms (2 symbols)
[ParserWorker] extractCstFacts for app/Http/Controllers/CacheController.php: 0ms (1 facts)
[ParserWorker] Total parse operation for app/Http/Controllers/CacheController.php: 1ms
[ParserWorker] parser.parse() for app/Http/Controllers/BaseController.php: 1ms (6101 bytes)
[ParserWorker] extractSymbols completed for app/Http/Controllers/BaseController.php: 18 symbols in 2ms (1251 iterations)
[ParserWorker] extractSymbols for app/Http/Controllers/BaseController.php: 2ms (18 symbols)
[ParserWorker] extractCstFacts for app/Http/Controllers/BaseController.php: 0ms (1 facts)
[ParserWorker] Total parse operation for app/Http/Controllers/BaseController.php: 3ms
[ParserWorker] parser.parse() for app/Http/Controllers/ApplyStaffEventController.php: 3ms (12066 bytes)
[ParserWorker] extractSymbols completed for app/Http/Controllers/ApplyStaffEventController.php: 7 symbols in 3ms (3060 iterations)
[ParserWorker] extractSymbols for app/Http/Controllers/ApplyStaffEventController.php: 3ms (7 symbols)
[ParserWorker] extractCstFacts for app/Http/Controllers/ApplyStaffEventController.php: 0ms (2 facts)
[ParserWorker] Total parse operation for app/Http/Controllers/ApplyStaffEventController.php: 6ms
[ParserWorker] parser.parse() for app/Http/Controllers/AdminPayTrackerController.php: 5ms (21641 bytes)
[ParserWorker] extractSymbols completed for app/Http/Controllers/AdminPayTrackerController.php: 11 symbols in 6ms (5997 iterations)
[ParserWorker] extractSymbols for app/Http/Controllers/AdminPayTrackerController.php: 6ms (11 symbols)
[ParserWorker] extractCstFacts for app/Http/Controllers/AdminPayTrackerController.php: 0ms (1 facts)
[ParserWorker] Total parse operation for app/Http/Controllers/AdminPayTrackerController.php: 11ms
[ParserWorker] parser.parse() for app/Helpers/WarningHelper.php: 0ms (3427 bytes)
[ParserWorker] extractSymbols completed for app/Helpers/WarningHelper.php: 6 symbols in 1ms (870 iterations)
[ParserWorker] extractSymbols for app/Helpers/WarningHelper.php: 1ms (6 symbols)
[ParserWorker] extractCstFacts for app/Helpers/WarningHelper.php: 0ms (1 facts)
[ParserWorker] Total parse operation for app/Helpers/WarningHelper.php: 1ms
[ParserWorker] parser.parse() for app/Helpers/ViewHelper.php: 5ms (18783 bytes)
[ParserWorker] extractSymbols completed for app/Helpers/ViewHelper.php: 12 symbols in 4ms (4687 iterations)
[ParserWorker] extractSymbols for app/Helpers/ViewHelper.php: 4ms (12 symbols)
[ParserWorker] extractCstFacts for app/Helpers/ViewHelper.php: 0ms (1 facts)
[ParserWorker] Total parse operation for app/Helpers/ViewHelper.php: 9ms
[ParserWorker] parser.parse() for app/Helpers/UserListHelper.php: 0ms (2018 bytes)
[ParserWorker] extractSymbols completed for app/Helpers/UserListHelper.php: 2 symbols in 1ms (381 iterations)
[ParserWorker] extractSymbols for app/Helpers/UserListHelper.php: 1ms (2 symbols)
[ParserWorker] extractCstFacts for app/Helpers/UserListHelper.php: 0ms (1 facts)
[ParserWorker] Total parse operation for app/Helpers/UserListHelper.php: 1ms
[ParserWorker] parser.parse() for app/Helpers/UserHelper.php: 1ms (3787 bytes)
[ParserWorker] extractSymbols completed for app/Helpers/UserHelper.php: 9 symbols in 0ms (803 iterations)
[ParserWorker] extractSymbols for app/Helpers/UserHelper.php: 1ms (9 symbols)
[ParserWorker] extractCstFacts for app/Helpers/UserHelper.php: 0ms (1 facts)
[ParserWorker] Total parse operation for app/Helpers/UserHelper.php: 2ms
[ParserWorker] parser.parse() for app/Helpers/UploadHelper.php: 5ms (20712 bytes)
[ParserWorker] extractSymbols completed for app/Helpers/UploadHelper.php: 20 symbols in 6ms (5760 iterations)
[ParserWorker] extractSymbols for app/Helpers/UploadHelper.php: 6ms (20 symbols)
[ParserWorker] extractCstFacts for app/Helpers/UploadHelper.php: 0ms (0 facts)
[ParserWorker] Total parse operation for app/Helpers/UploadHelper.php: 11ms
[ParserWorker] parser.parse() for app/Helpers/UnpolyHelper.php: 1ms (5792 bytes)
[ParserWorker] extractSymbols completed for app/Helpers/UnpolyHelper.php: 11 symbols in 1ms (1015 iterations)
[ParserWorker] extractSymbols for app/Helpers/UnpolyHelper.php: 1ms (11 symbols)
[ParserWorker] extractCstFacts for app/Helpers/UnpolyHelper.php: 0ms (1 facts)
[ParserWorker] Total parse operation for app/Helpers/UnpolyHelper.php: 2ms
[ParserWorker] parser.parse() for app/Helpers/ToastHelper.php: 1ms (1835 bytes)
[ParserWorker] extractSymbols completed for app/Helpers/ToastHelper.php: 7 symbols in 0ms (379 iterations)
[ParserWorker] extractSymbols for app/Helpers/ToastHelper.php: 0ms (7 symbols)
[ParserWorker] extractCstFacts for app/Helpers/ToastHelper.php: 0ms (1 facts)
[ParserWorker] Total parse operation for app/Helpers/ToastHelper.php: 1ms
[ParserWorker] parser.parse() for app/Helpers/TableHelper.php: 2ms (7175 bytes)
[ParserWorker] extractSymbols completed for app/Helpers/TableHelper.php: 6 symbols in 2ms (1821 iterations)
[ParserWorker] extractSymbols for app/Helpers/TableHelper.php: 2ms (6 symbols)
[ParserWorker] extractCstFacts for app/Helpers/TableHelper.php: 0ms (1 facts)
[ParserWorker] Total parse operation for app/Helpers/TableHelper.php: 4ms
[ParserWorker] parser.parse() for app/Helpers/StringHelper.php: 1ms (980 bytes)
[ParserWorker] extractSymbols completed for app/Helpers/StringHelper.php: 3 symbols in 0ms (225 iterations)
[ParserWorker] extractSymbols for app/Helpers/StringHelper.php: 0ms (3 symbols)
[ParserWorker] extractCstFacts for app/Helpers/StringHelper.php: 0ms (1 facts)
[ParserWorker] Total parse operation for app/Helpers/StringHelper.php: 1ms
[ParserWorker] parser.parse() for app/Helpers/SmsHelper.php: 1ms (3521 bytes)
[ParserWorker] extractSymbols completed for app/Helpers/SmsHelper.php: 7 symbols in 1ms (908 iterations)
[ParserWorker] extractSymbols for app/Helpers/SmsHelper.php: 1ms (7 symbols)
[ParserWorker] extractCstFacts for app/Helpers/SmsHelper.php: 0ms (1 facts)
[ParserWorker] Total parse operation for app/Helpers/SmsHelper.php: 2ms
[ParserWorker] parser.parse() for app/Helpers/SessionHelper.php: 3ms (8697 bytes)
[ParserWorker] extractSymbols completed for app/Helpers/SessionHelper.php: 30 symbols in 2ms (2079 iterations)
[ParserWorker] extractSymbols for app/Helpers/SessionHelper.php: 2ms (30 symbols)
[ParserWorker] extractCstFacts for app/Helpers/SessionHelper.php: 0ms (1 facts)
[ParserWorker] Total parse operation for app/Helpers/SessionHelper.php: 5ms
[ParserWorker] parser.parse() for app/Helpers/RouteHelper.php: 1ms (1700 bytes)
[ParserWorker] extractSymbols completed for app/Helpers/RouteHelper.php: 4 symbols in 0ms (474 iterations)
[ParserWorker] extractSymbols for app/Helpers/RouteHelper.php: 0ms (4 symbols)
[ParserWorker] extractCstFacts for app/Helpers/RouteHelper.php: 0ms (0 facts)
[ParserWorker] Total parse operation for app/Helpers/RouteHelper.php: 1ms
[ParserWorker] parser.parse() for app/Helpers/RequestHelper.php: 3ms (13798 bytes)
[ParserWorker] extractSymbols completed for app/Helpers/RequestHelper.php: 13 symbols in 4ms (3423 iterations)
[ParserWorker] extractSymbols for app/Helpers/RequestHelper.php: 4ms (13 symbols)
[ParserWorker] extractCstFacts for app/Helpers/RequestHelper.php: 0ms (1 facts)
[ParserWorker] Total parse operation for app/Helpers/RequestHelper.php: 7ms
[ParserWorker] parser.parse() for app/Helpers/ReminderHelper.php: 2ms (4700 bytes)
[ParserWorker] extractSymbols completed for app/Helpers/ReminderHelper.php: 4 symbols in 1ms (1317 iterations)
[ParserWorker] extractSymbols for app/Helpers/ReminderHelper.php: 1ms (4 symbols)
[ParserWorker] extractCstFacts for app/Helpers/ReminderHelper.php: 0ms (1 facts)
[ParserWorker] Total parse operation for app/Helpers/ReminderHelper.php: 3ms
[ParserWorker] parser.parse() for app/Helpers/README.md: 2ms (4967 bytes)
[ParserWorker] extractCstFacts for app/Helpers/README.md: 0ms (0 facts)
[ParserWorker] Total parse operation for app/Helpers/README.md: 2ms
[ParserWorker] parser.parse() for app/Helpers/QueryHelper.php: 2ms (5062 bytes)
[ParserWorker] extractSymbols completed for app/Helpers/QueryHelper.php: 5 symbols in 1ms (1287 iterations)
[ParserWorker] extractSymbols for app/Helpers/QueryHelper.php: 1ms (5 symbols)
[ParserWorker] extractCstFacts for app/Helpers/QueryHelper.php: 0ms (1 facts)
[ParserWorker] Total parse operation for app/Helpers/QueryHelper.php: 3ms
[ParserWorker] parser.parse() for app/Services/EventReadService.php: 2ms (10564 bytes)
[ParserWorker] extractSymbols completed for app/Services/EventReadService.php: 12 symbols in 2ms (2084 iterations)
[ParserWorker] extractSymbols for app/Services/EventReadService.php: 2ms (12 symbols)
[ParserWorker] extractCstFacts for app/Services/EventReadService.php: 0ms (1 facts)
[ParserWorker] Total parse operation for app/Services/EventReadService.php: 5ms
[ParserWorker] parser.parse() for app/Services/EventAssignmentService.php: 2ms (8320 bytes)
[ParserWorker] extractSymbols completed for app/Services/EventAssignmentService.php: 10 symbols in 2ms (2046 iterations)
[ParserWorker] extractSymbols for app/Services/EventAssignmentService.php: 2ms (10 symbols)
[ParserWorker] extractCstFacts for app/Services/EventAssignmentService.php: 0ms (1 facts)
[ParserWorker] Total parse operation for app/Services/EventAssignmentService.php: 4ms
[ParserWorker] parser.parse() for app/Services/CommunicationService.php: 2ms (5117 bytes)
[ParserWorker] parser.parse() for app/Services/EventReadService.php: 2ms (10564 bytes)
[ParserWorker] extractSymbols completed for app/Services/CommunicationService.php: 10 symbols in 1ms (1414 iterations)
[ParserWorker] extractSymbols for app/Services/CommunicationService.php: 1ms (10 symbols)
[ParserWorker] extractCstFacts for app/Services/CommunicationService.php: 0ms (1 facts)
[ParserWorker] Total parse operation for app/Services/CommunicationService.php: 4ms
[ParserWorker] parser.parse() for app/Services/ClientService.php: 1ms (4815 bytes)
[ParserWorker] extractSymbols completed for app/Services/ClientService.php: 7 symbols in 6ms (1541 iterations)
[ParserWorker] extractSymbols for app/Services/ClientService.php: 6ms (7 symbols)
[ParserWorker] extractCstFacts for app/Services/ClientService.php: 0ms (1 facts)
[ParserWorker] Total parse operation for app/Services/ClientService.php: 7ms
[ParserWorker] parser.parse() for app/Repositories/UserRepository.php: 6ms (30763 bytes)
[ParserWorker] extractSymbols completed for app/Repositories/UserRepository.php: 31 symbols in 9ms (7267 iterations)
[ParserWorker] extractSymbols for app/Repositories/UserRepository.php: 9ms (31 symbols)
[ParserWorker] extractCstFacts for app/Repositories/UserRepository.php: 0ms (1 facts)
[ParserWorker] Total parse operation for app/Repositories/UserRepository.php: 15ms
[ParserWorker] parser.parse() for app/Repositories/SpecialDayRepository.php: 0ms (2140 bytes)
[ParserWorker] extractSymbols completed for app/Repositories/SpecialDayRepository.php: 7 symbols in 1ms (542 iterations)
[ParserWorker] extractSymbols for app/Repositories/SpecialDayRepository.php: 1ms (7 symbols)
[ParserWorker] extractCstFacts for app/Repositories/SpecialDayRepository.php: 0ms (0 facts)
[ParserWorker] Total parse operation for app/Repositories/SpecialDayRepository.php: 1ms
[ParserWorker] parser.parse() for app/Repositories/RoleRepository.php: 2ms (7416 bytes)
[ParserWorker] extractSymbols completed for app/Repositories/RoleRepository.php: 11 symbols in 2ms (1771 iterations)
[ParserWorker] extractSymbols for app/Repositories/RoleRepository.php: 2ms (11 symbols)
[ParserWorker] extractCstFacts for app/Repositories/RoleRepository.php: 0ms (1 facts)
[ParserWorker] Total parse operation for app/Repositories/RoleRepository.php: 6ms
[ParserWorker] parser.parse() for app/Repositories/ReportRepository.php: 7ms (33647 bytes)
[ParserWorker] extractSymbols completed for app/Repositories/ReportRepository.php: 11 symbols in 8ms (8132 iterations)
[ParserWorker] extractSymbols for app/Repositories/ReportRepository.php: 10ms (11 symbols)
[ParserWorker] extractCstFacts for app/Repositories/ReportRepository.php: 1ms (1 facts)
[ParserWorker] Total parse operation for app/Repositories/ReportRepository.php: 19ms
[ParserWorker] parser.parse() for app/Repositories/PermissionRepository.php: 1ms (4505 bytes)
[ParserWorker] extractSymbols completed for app/Repositories/PermissionRepository.php: 8 symbols in 2ms (1198 iterations)
[ParserWorker] extractSymbols for app/Repositories/PermissionRepository.php: 2ms (8 symbols)
[ParserWorker] extractCstFacts for app/Repositories/PermissionRepository.php: 0ms (0 facts)
[ParserWorker] Total parse operation for app/Repositories/PermissionRepository.php: 3ms
[ParserWorker] parser.parse() for app/Repositories/IncentiveRepository.php: 1ms (4716 bytes)
[ParserWorker] extractSymbols completed for app/Repositories/IncentiveRepository.php: 8 symbols in 1ms (966 iterations)
[ParserWorker] extractSymbols for app/Repositories/IncentiveRepository.php: 1ms (8 symbols)
[ParserWorker] extractCstFacts for app/Repositories/IncentiveRepository.php: 0ms (1 facts)
[ParserWorker] Total parse operation for app/Repositories/IncentiveRepository.php: 2ms
[ParserWorker] parser.parse() for app/Repositories/EventRepository.php: 12ms (55158 bytes)
[ParserWorker] extractSymbols completed for app/Repositories/EventRepository.php: 26 symbols in 16ms (12369 iterations)
[ParserWorker] extractSymbols for app/Repositories/EventRepository.php: 16ms (26 symbols)
[ParserWorker] extractCstFacts for app/Repositories/EventRepository.php: 0ms (1 facts)
[ParserWorker] Total parse operation for app/Repositories/EventRepository.php: 29ms
[ParserWorker] parser.parse() for app/Repositories/EventPositionRepository.php: 0ms (2976 bytes)
[ParserWorker] extractSymbols completed for app/Repositories/EventPositionRepository.php: 8 symbols in 0ms (532 iterations)
[ParserWorker] extractSymbols for app/Repositories/EventPositionRepository.php: 0ms (8 symbols)
[ParserWorker] extractCstFacts for app/Repositories/EventPositionRepository.php: 0ms (1 facts)
[ParserWorker] Total parse operation for app/Repositories/EventPositionRepository.php: 1ms
[ParserWorker] parser.parse() for app/Repositories/EventPositionAssignRepository.php: 2ms (6999 bytes)
[ParserWorker] extractSymbols completed for app/Repositories/EventPositionAssignRepository.php: 11 symbols in 2ms (1572 iterations)
[ParserWorker] extractSymbols for app/Repositories/EventPositionAssignRepository.php: 5ms (11 symbols)
[ParserWorker] extractCstFacts for app/Repositories/EventPositionAssignRepository.php: 0ms (1 facts)
[ParserWorker] Total parse operation for app/Repositories/EventPositionAssignRepository.php: 8ms
[ParserWorker] parser.parse() for app/Repositories/EventLogRepository.php: 12ms (41320 bytes)
[ParserWorker] extractSymbols completed for app/Repositories/EventLogRepository.php: 19 symbols in 13ms (10097 iterations)
[ParserWorker] extractSymbols for app/Repositories/EventLogRepository.php: 14ms (19 symbols)
[ParserWorker] extractCstFacts for app/Repositories/EventLogRepository.php: 1ms (1 facts)
[ParserWorker] Total parse operation for app/Repositories/EventLogRepository.php: 30ms
[ParserWorker] parser.parse() for app/Repositories/EmailQueueRepository.php: 2ms (4282 bytes)
[ParserWorker] extractSymbols completed for app/Repositories/EmailQueueRepository.php: 9 symbols in 1ms (827 iterations)
[ParserWorker] extractSymbols for app/Repositories/EmailQueueRepository.php: 1ms (9 symbols)
[ParserWorker] extractCstFacts for app/Repositories/EmailQueueRepository.php: 0ms (1 facts)
[ParserWorker] Total parse operation for app/Repositories/EmailQueueRepository.php: 3ms
[ParserWorker] parser.parse() for app/Repositories/EloquentRepository.php: 4ms (9685 bytes)
[ParserWorker] extractSymbols completed for app/Repositories/EloquentRepository.php: 23 symbols in 2ms (1952 iterations)
[ParserWorker] extractSymbols for app/Repositories/EloquentRepository.php: 2ms (23 symbols)
[ParserWorker] extractCstFacts for app/Repositories/EloquentRepository.php: 0ms (1 facts)
[ParserWorker] Total parse operation for app/Repositories/EloquentRepository.php: 9ms
[ParserWorker] parser.parse() for app/Repositories/ClientRepository.php: 3ms (10807 bytes)
[ParserWorker] extractSymbols completed for app/Repositories/ClientRepository.php: 8 symbols in 5ms (2609 iterations)
[ParserWorker] extractSymbols for app/Repositories/ClientRepository.php: 5ms (8 symbols)
[ParserWorker] extractCstFacts for app/Repositories/ClientRepository.php: 0ms (1 facts)
[ParserWorker] Total parse operation for app/Repositories/ClientRepository.php: 8ms
[ParserWorker] parser.parse() for app/Repositories/ApplyStaffEventRepository.php: 2ms (6251 bytes)
[ParserWorker] extractSymbols completed for app/Repositories/ApplyStaffEventRepository.php: 11 symbols in 2ms (1189 iterations)
[ParserWorker] extractSymbols for app/Repositories/ApplyStaffEventRepository.php: 2ms (11 symbols)
[ParserWorker] extractCstFacts for app/Repositories/ApplyStaffEventRepository.php: 1ms (1 facts)
[ParserWorker] Total parse operation for app/Repositories/ApplyStaffEventRepository.php: 5ms
[ParserWorker] parser.parse() for app/Repositories/AdminTimeEntryRepository.php: 3ms (11639 bytes)
[ParserWorker] extractSymbols completed for app/Repositories/AdminTimeEntryRepository.php: 14 symbols in 3ms (2460 iterations)
[ParserWorker] extractSymbols for app/Repositories/AdminTimeEntryRepository.php: 8ms (14 symbols)
[ParserWorker] extractCstFacts for app/Repositories/AdminTimeEntryRepository.php: 0ms (1 facts)
[ParserWorker] Total parse operation for app/Repositories/AdminTimeEntryRepository.php: 11ms
[ParserWorker] parser.parse() for app/Providers/ScheduleServiceProvider.php: 0ms (2479 bytes)
[ParserWorker] extractSymbols completed for app/Providers/ScheduleServiceProvider.php: 2 symbols in 0ms (527 iterations)
[ParserWorker] extractSymbols for app/Providers/ScheduleServiceProvider.php: 0ms (2 symbols)
[ParserWorker] extractCstFacts for app/Providers/ScheduleServiceProvider.php: 0ms (1 facts)
[ParserWorker] Total parse operation for app/Providers/ScheduleServiceProvider.php: 2ms
[ParserWorker] parser.parse() for app/Providers/RouteServiceProvider.php: 2ms (6492 bytes)
[ParserWorker] extractSymbols completed for app/Providers/RouteServiceProvider.php: 9 symbols in 2ms (1537 iterations)
[ParserWorker] extractSymbols for app/Providers/RouteServiceProvider.php: 2ms (9 symbols)
[ParserWorker] extractCstFacts for app/Providers/RouteServiceProvider.php: 1ms (1 facts)
[ParserWorker] Total parse operation for app/Providers/RouteServiceProvider.php: 5ms
[ParserWorker] parser.parse() for app/Providers/DatabaseServiceProvider.php: 7ms (20137 bytes)
[ParserWorker] extractSymbols completed for app/Providers/DatabaseServiceProvider.php: 0 symbols in 6ms (5514 iterations)
[ParserWorker] extractSymbols for app/Providers/DatabaseServiceProvider.php: 6ms (0 symbols)
[ParserWorker] extractCstFacts for app/Providers/DatabaseServiceProvider.php: 1ms (38 facts)
[ParserWorker] Total parse operation for app/Providers/DatabaseServiceProvider.php: 15ms
[ParserWorker] parser.parse() for app/Providers/BladeServiceProvider.php: 5ms (15511 bytes)
[ParserWorker] extractSymbols completed for app/Providers/BladeServiceProvider.php: 9 symbols in 3ms (3902 iterations)
[ParserWorker] extractSymbols for app/Providers/BladeServiceProvider.php: 3ms (9 symbols)
[ParserWorker] extractCstFacts for app/Providers/BladeServiceProvider.php: 0ms (44 facts)
[ParserWorker] Total parse operation for app/Providers/BladeServiceProvider.php: 12ms
[ParserWorker] parser.parse() for app/Providers/AE_Blade_Container.php: 1ms (829 bytes)
[ParserWorker] extractSymbols completed for app/Providers/AE_Blade_Container.php: 6 symbols in 0ms (235 iterations)
[ParserWorker] extractSymbols for app/Providers/AE_Blade_Container.php: 0ms (6 symbols)
[ParserWorker] extractCstFacts for app/Providers/AE_Blade_Container.php: 0ms (1 facts)
[ParserWorker] Total parse operation for app/Providers/AE_Blade_Container.php: 1ms
[ParserWorker] parser.parse() for app/Providers/AE_AppContainer.php: 1ms (2713 bytes)
[ParserWorker] extractSymbols completed for app/Providers/AE_AppContainer.php: 20 symbols in 1ms (1017 iterations)
[ParserWorker] extractSymbols for app/Providers/AE_AppContainer.php: 1ms (20 symbols)
[ParserWorker] extractCstFacts for app/Providers/AE_AppContainer.php: 0ms (1 facts)
[ParserWorker] Total parse operation for app/Providers/AE_AppContainer.php: 2ms
[ParserWorker] parser.parse() for app/Models/SpecialDay.php: 0ms (1139 bytes)
[ParserWorker] extractSymbols completed for app/Models/SpecialDay.php: 4 symbols in 0ms (328 iterations)
[ParserWorker] extractSymbols for app/Models/SpecialDay.php: 3ms (4 symbols)
[ParserWorker] extractCstFacts for app/Models/SpecialDay.php: 0ms (0 facts)
[ParserWorker] Total parse operation for app/Models/SpecialDay.php: 4ms
[ParserWorker] parser.parse() for app/Models/Role.php: 0ms (812 bytes)
[ParserWorker] extractSymbols completed for app/Models/Role.php: 4 symbols in 1ms (208 iterations)
[ParserWorker] extractSymbols for app/Models/Role.php: 1ms (4 symbols)
[ParserWorker] extractCstFacts for app/Models/Role.php: 0ms (1 facts)
[ParserWorker] Total parse operation for app/Models/Role.php: 1ms
[ParserWorker] parser.parse() for app/Models/Permission.php: 0ms (331 bytes)
[ParserWorker] extractSymbols completed for app/Models/Permission.php: 1 symbols in 1ms (106 iterations)
[ParserWorker] extractSymbols for app/Models/Permission.php: 1ms (1 symbols)
[ParserWorker] extractCstFacts for app/Models/Permission.php: 0ms (0 facts)
[ParserWorker] Total parse operation for app/Models/Permission.php: 1ms
[ParserWorker] parser.parse() for app/Models/PasswordResetToken.php: 0ms (1853 bytes)
[ParserWorker] extractSymbols completed for app/Models/PasswordResetToken.php: 7 symbols in 1ms (474 iterations)
[ParserWorker] extractSymbols for app/Models/PasswordResetToken.php: 1ms (7 symbols)
[ParserWorker] extractCstFacts for app/Models/PasswordResetToken.php: 1ms (1 facts)
[ParserWorker] Total parse operation for app/Models/PasswordResetToken.php: 2ms
[ParserWorker] parser.parse() for app/Models/InternalEvent.php: 1ms (3538 bytes)
[ParserWorker] extractSymbols completed for app/Models/InternalEvent.php: 14 symbols in 2ms (873 iterations)
[ParserWorker] extractSymbols for app/Models/InternalEvent.php: 2ms (14 symbols)
[ParserWorker] extractCstFacts for app/Models/InternalEvent.php: 0ms (0 facts)
[ParserWorker] Total parse operation for app/Models/InternalEvent.php: 3ms
[ParserWorker] parser.parse() for app/Models/Incentive.php: 0ms (1243 bytes)
[ParserWorker] extractSymbols completed for app/Models/Incentive.php: 4 symbols in 1ms (337 iterations)
[ParserWorker] extractSymbols for app/Models/Incentive.php: 1ms (4 symbols)
[ParserWorker] extractCstFacts for app/Models/Incentive.php: 0ms (0 facts)
[ParserWorker] Total parse operation for app/Models/Incentive.php: 1ms
[ParserWorker] parser.parse() for app/Models/EventPositionAssign.php: 3ms (6185 bytes)
[ParserWorker] extractSymbols completed for app/Models/EventPositionAssign.php: 14 symbols in 2ms (1363 iterations)
[ParserWorker] extractSymbols for app/Models/EventPositionAssign.php: 10ms (14 symbols)
[ParserWorker] extractCstFacts for app/Models/EventPositionAssign.php: 0ms (0 facts)
[ParserWorker] Total parse operation for app/Models/EventPositionAssign.php: 13ms
[ParserWorker] parser.parse() for app/Models/EventPosition.php: 1ms (2783 bytes)
[ParserWorker] extractSymbols completed for app/Models/EventPosition.php: 9 symbols in 2ms (669 iterations)
[ParserWorker] extractSymbols for app/Models/EventPosition.php: 2ms (9 symbols)
[ParserWorker] extractCstFacts for app/Models/EventPosition.php: 0ms (0 facts)
[ParserWorker] Total parse operation for app/Models/EventPosition.php: 3ms
[ParserWorker] parser.parse() for app/Models/EventFile.php: 1ms (1716 bytes)
[ParserWorker] extractSymbols completed for app/Models/EventFile.php: 6 symbols in 0ms (431 iterations)
[ParserWorker] extractSymbols for app/Models/EventFile.php: 0ms (6 symbols)
[ParserWorker] extractCstFacts for app/Models/EventFile.php: 0ms (0 facts)
[ParserWorker] Total parse operation for app/Models/EventFile.php: 1ms
[ParserWorker] parser.parse() for app/Models/EventExcess.php: 0ms (2248 bytes)
[ParserWorker] extractSymbols completed for app/Models/EventExcess.php: 6 symbols in 1ms (556 iterations)
[ParserWorker] extractSymbols for app/Models/EventExcess.php: 1ms (6 symbols)
[ParserWorker] extractCstFacts for app/Models/EventExcess.php: 0ms (0 facts)
[ParserWorker] Total parse operation for app/Models/EventExcess.php: 1ms
[ParserWorker] parser.parse() for app/Models/Event.php: 9ms (36151 bytes)
[ParserWorker] extractSymbols completed for app/Models/Event.php: 63 symbols in 11ms (8497 iterations)
[ParserWorker] extractSymbols for app/Models/Event.php: 12ms (63 symbols)
[ParserWorker] extractCstFacts for app/Models/Event.php: 0ms (0 facts)
[ParserWorker] Total parse operation for app/Models/Event.php: 21ms
[ParserWorker] parser.parse() for app/Models/EmailQueue.php: 0ms (2588 bytes)
[ParserWorker] extractSymbols completed for app/Models/EmailQueue.php: 8 symbols in 0ms (701 iterations)
[ParserWorker] extractSymbols for app/Models/EmailQueue.php: 1ms (8 symbols)
[ParserWorker] extractCstFacts for app/Models/EmailQueue.php: 0ms (1 facts)
[ParserWorker] Total parse operation for app/Models/EmailQueue.php: 2ms
[ParserWorker] parser.parse() for app/Models/BaseModel.php: 0ms (1190 bytes)
[ParserWorker] extractSymbols completed for app/Models/BaseModel.php: 2 symbols in 0ms (178 iterations)
[ParserWorker] extractSymbols for app/Models/BaseModel.php: 0ms (2 symbols)
[ParserWorker] extractCstFacts for app/Models/BaseModel.php: 1ms (1 facts)
[ParserWorker] Total parse operation for app/Models/BaseModel.php: 1ms
[ParserWorker] parser.parse() for app/Models/ApplyStaffEvent.php: 0ms (2998 bytes)
[ParserWorker] extractSymbols completed for app/Models/ApplyStaffEvent.php: 9 symbols in 1ms (690 iterations)
[ParserWorker] extractSymbols for app/Models/ApplyStaffEvent.php: 1ms (9 symbols)
[ParserWorker] extractCstFacts for app/Models/ApplyStaffEvent.php: 0ms (0 facts)
[ParserWorker] Total parse operation for app/Models/ApplyStaffEvent.php: 1ms
[ParserWorker] parser.parse() for app/Models/AdminUser.php: 5ms (19972 bytes)
[ParserWorker] extractSymbols completed for app/Models/AdminUser.php: 49 symbols in 5ms (4449 iterations)
[ParserWorker] extractSymbols for app/Models/AdminUser.php: 5ms (49 symbols)
[ParserWorker] extractCstFacts for app/Models/AdminUser.php: 0ms (0 facts)
[ParserWorker] Total parse operation for app/Models/AdminUser.php: 12ms
[ParserWorker] parser.parse() for app/Models/AdminTimeEntry.php: 1ms (5287 bytes)
[ParserWorker] extractSymbols completed for app/Models/AdminTimeEntry.php: 13 symbols in 1ms (1441 iterations)
[ParserWorker] extractSymbols for app/Models/AdminTimeEntry.php: 4ms (13 symbols)
[ParserWorker] extractCstFacts for app/Models/AdminTimeEntry.php: 0ms (0 facts)
[ParserWorker] Total parse operation for app/Models/AdminTimeEntry.php: 6ms
[ParserWorker] parser.parse() for app/Models/AdminAction.php: 1ms (1072 bytes)
[ParserWorker] extractSymbols completed for app/Models/AdminAction.php: 3 symbols in 0ms (237 iterations)
[ParserWorker] extractSymbols for app/Models/AdminAction.php: 0ms (3 symbols)
[ParserWorker] extractCstFacts for app/Models/AdminAction.php: 0ms (1 facts)
[ParserWorker] Total parse operation for app/Models/AdminAction.php: 1ms
[ParserWorker] parser.parse() for app/Http/Requests/ValidationHandledException.php: 0ms (774 bytes)
[ParserWorker] extractSymbols completed for app/Http/Requests/ValidationHandledException.php: 3 symbols in 1ms (104 iterations)
[ParserWorker] extractSymbols for app/Http/Requests/ValidationHandledException.php: 1ms (3 symbols)
[ParserWorker] extractCstFacts for app/Http/Requests/ValidationHandledException.php: 0ms (1 facts)
[ParserWorker] Total parse operation for app/Http/Requests/ValidationHandledException.php: 1ms
[ParserWorker] parser.parse() for app/Http/Requests/UserValidationRules.php: 1ms (3734 bytes)
[ParserWorker] extractSymbols completed for app/Http/Requests/UserValidationRules.php: 3 symbols in 1ms (745 iterations)
[ParserWorker] extractSymbols for app/Http/Requests/UserValidationRules.php: 1ms (3 symbols)
[ParserWorker] extractCstFacts for app/Http/Requests/UserValidationRules.php: 0ms (4 facts)
[ParserWorker] Total parse operation for app/Http/Requests/UserValidationRules.php: 2ms
[ParserWorker] parser.parse() for app/Http/Requests/UserListRequest.php: 1ms (2329 bytes)
[ParserWorker] extractSymbols completed for app/Http/Requests/UserListRequest.php: 2 symbols in 0ms (743 iterations)
[ParserWorker] extractSymbols for app/Http/Requests/UserListRequest.php: 1ms (2 symbols)
[ParserWorker] extractCstFacts for app/Http/Requests/UserListRequest.php: 0ms (1 facts)
[ParserWorker] Total parse operation for app/Http/Requests/UserListRequest.php: 2ms
[ParserWorker] parser.parse() for app/Http/Requests/UpdateUserRequest.php: 0ms (2187 bytes)
[ParserWorker] extractSymbols completed for app/Http/Requests/UpdateUserRequest.php: 5 symbols in 1ms (484 iterations)
[ParserWorker] extractSymbols for app/Http/Requests/UpdateUserRequest.php: 1ms (5 symbols)
[ParserWorker] extractCstFacts for app/Http/Requests/UpdateUserRequest.php: 0ms (1 facts)
[ParserWorker] Total parse operation for app/Http/Requests/UpdateUserRequest.php: 1ms
[ParserWorker] parser.parse() for app/Http/Requests/RoleRequest.php: 0ms (493 bytes)
[ParserWorker] extractSymbols completed for app/Http/Requests/RoleRequest.php: 2 symbols in 0ms (96 iterations)
[ParserWorker] extractSymbols for app/Http/Requests/RoleRequest.php: 0ms (2 symbols)
[ParserWorker] extractCstFacts for app/Http/Requests/RoleRequest.php: 0ms (0 facts)
[ParserWorker] Total parse operation for app/Http/Requests/RoleRequest.php: 1ms
[ParserWorker] parser.parse() for app/Http/Requests/FormRequest.php: 1ms (8371 bytes)
[ParserWorker] extractSymbols completed for app/Http/Requests/FormRequest.php: 22 symbols in 1ms (1618 iterations)
[ParserWorker] extractSymbols for app/Http/Requests/FormRequest.php: 1ms (22 symbols)
[ParserWorker] extractCstFacts for app/Http/Requests/FormRequest.php: 0ms (1 facts)
[ParserWorker] Total parse operation for app/Http/Requests/FormRequest.php: 5ms
[ParserWorker] parser.parse() for app/Http/Requests/EventUpdateRequest.php: 0ms (3376 bytes)
[ParserWorker] extractSymbols completed for app/Http/Requests/EventUpdateRequest.php: 5 symbols in 1ms (588 iterations)
[ParserWorker] extractSymbols for app/Http/Requests/EventUpdateRequest.php: 1ms (5 symbols)
[ParserWorker] extractCstFacts for app/Http/Requests/EventUpdateRequest.php: 0ms (1 facts)
[ParserWorker] Total parse operation for app/Http/Requests/EventUpdateRequest.php: 2ms
[ParserWorker] parser.parse() for app/Http/Requests/EventLogRequest.php: 2ms (7666 bytes)
[ParserWorker] extractSymbols completed for app/Http/Requests/EventLogRequest.php: 8 symbols in 2ms (1950 iterations)
[ParserWorker] extractSymbols for app/Http/Requests/EventLogRequest.php: 4ms (8 symbols)
[ParserWorker] extractCstFacts for app/Http/Requests/EventLogRequest.php: 1ms (1 facts)
[ParserWorker] Total parse operation for app/Http/Requests/EventLogRequest.php: 7ms
[ParserWorker] extractSymbols completed for app/Services/EventReadService.php: 12 symbols in 2ms (2084 iterations)
[ParserWorker] extractSymbols for app/Services/EventReadService.php: 2ms (12 symbols)
[ParserWorker] extractCstFacts for app/Services/EventReadService.php: 0ms (1 facts)
[ParserWorker] Total parse operation for app/Services/EventReadService.php: 5ms
[ParserWorker] parser.parse() for app/Services/EventAssignmentService.php: 2ms (8320 bytes)
[ParserWorker] extractSymbols completed for app/Services/EventAssignmentService.php: 10 symbols in 2ms (2046 iterations)
[ParserWorker] extractSymbols for app/Services/EventAssignmentService.php: 2ms (10 symbols)
[ParserWorker] extractCstFacts for app/Services/EventAssignmentService.php: 0ms (1 facts)
[ParserWorker] Total parse operation for app/Services/EventAssignmentService.php: 4ms
[ParserWorker] parser.parse() for app/Services/CommunicationService.php: 2ms (5117 bytes)
[ParserWorker] extractSymbols completed for app/Services/CommunicationService.php: 10 symbols in 1ms (1414 iterations)
[ParserWorker] extractSymbols for app/Services/CommunicationService.php: 1ms (10 symbols)
[ParserWorker] extractCstFacts for app/Services/CommunicationService.php: 0ms (1 facts)
[ParserWorker] Total parse operation for app/Services/CommunicationService.php: 4ms
[ParserWorker] parser.parse() for app/Services/ClientService.php: 1ms (4815 bytes)
[ParserWorker] extractSymbols completed for app/Services/ClientService.php: 7 symbols in 6ms (1541 iterations)
[ParserWorker] extractSymbols for app/Services/ClientService.php: 6ms (7 symbols)
[ParserWorker] extractCstFacts for app/Services/ClientService.php: 0ms (1 facts)
[ParserWorker] Total parse operation for app/Services/ClientService.php: 7ms
[ParserWorker] parser.parse() for app/Repositories/UserRepository.php: 6ms (30763 bytes)
[ParserWorker] extractSymbols completed for app/Repositories/UserRepository.php: 31 symbols in 9ms (7267 iterations)
[ParserWorker] extractSymbols for app/Repositories/UserRepository.php: 9ms (31 symbols)
[ParserWorker] extractCstFacts for app/Repositories/UserRepository.php: 0ms (1 facts)
[ParserWorker] Total parse operation for app/Repositories/UserRepository.php: 15ms
[ParserWorker] parser.parse() for app/Repositories/SpecialDayRepository.php: 0ms (2140 bytes)
[ParserWorker] extractSymbols completed for app/Repositories/SpecialDayRepository.php: 7 symbols in 1ms (542 iterations)
[ParserWorker] extractSymbols for app/Repositories/SpecialDayRepository.php: 1ms (7 symbols)
[ParserWorker] extractCstFacts for app/Repositories/SpecialDayRepository.php: 0ms (0 facts)
[ParserWorker] Total parse operation for app/Repositories/SpecialDayRepository.php: 1ms
[ParserWorker] parser.parse() for app/Repositories/RoleRepository.php: 2ms (7416 bytes)
[ParserWorker] extractSymbols completed for app/Repositories/RoleRepository.php: 11 symbols in 2ms (1771 iterations)
[ParserWorker] extractSymbols for app/Repositories/RoleRepository.php: 2ms (11 symbols)
[ParserWorker] extractCstFacts for app/Repositories/RoleRepository.php: 0ms (1 facts)
[ParserWorker] Total parse operation for app/Repositories/RoleRepository.php: 6ms
[ParserWorker] parser.parse() for app/Repositories/ReportRepository.php: 7ms (33647 bytes)
[ParserWorker] extractSymbols completed for app/Repositories/ReportRepository.php: 11 symbols in 8ms (8132 iterations)
[ParserWorker] extractSymbols for app/Repositories/ReportRepository.php: 10ms (11 symbols)
[ParserWorker] extractCstFacts for app/Repositories/ReportRepository.php: 1ms (1 facts)
[ParserWorker] Total parse operation for app/Repositories/ReportRepository.php: 19ms
[ParserWorker] parser.parse() for app/Repositories/PermissionRepository.php: 1ms (4505 bytes)
[ParserWorker] extractSymbols completed for app/Repositories/PermissionRepository.php: 8 symbols in 2ms (1198 iterations)
[ParserWorker] extractSymbols for app/Repositories/PermissionRepository.php: 2ms (8 symbols)
[ParserWorker] extractCstFacts for app/Repositories/PermissionRepository.php: 0ms (0 facts)
[ParserWorker] Total parse operation for app/Repositories/PermissionRepository.php: 3ms
[ParserWorker] parser.parse() for app/Repositories/IncentiveRepository.php: 1ms (4716 bytes)
[ParserWorker] extractSymbols completed for app/Repositories/IncentiveRepository.php: 8 symbols in 1ms (966 iterations)
[ParserWorker] extractSymbols for app/Repositories/IncentiveRepository.php: 1ms (8 symbols)
[ParserWorker] extractCstFacts for app/Repositories/IncentiveRepository.php: 0ms (1 facts)
[ParserWorker] Total parse operation for app/Repositories/IncentiveRepository.php: 2ms
[ParserWorker] parser.parse() for app/Repositories/EventRepository.php: 12ms (55158 bytes)
[ParserWorker] extractSymbols completed for app/Repositories/EventRepository.php: 26 symbols in 16ms (12369 iterations)
[ParserWorker] extractSymbols for app/Repositories/EventRepository.php: 16ms (26 symbols)
[ParserWorker] extractCstFacts for app/Repositories/EventRepository.php: 0ms (1 facts)
[ParserWorker] Total parse operation for app/Repositories/EventRepository.php: 29ms
[ParserWorker] parser.parse() for app/Repositories/EventPositionRepository.php: 0ms (2976 bytes)
[ParserWorker] extractSymbols completed for app/Repositories/EventPositionRepository.php: 8 symbols in 0ms (532 iterations)
[ParserWorker] extractSymbols for app/Repositories/EventPositionRepository.php: 0ms (8 symbols)
[ParserWorker] extractCstFacts for app/Repositories/EventPositionRepository.php: 0ms (1 facts)
[ParserWorker] Total parse operation for app/Repositories/EventPositionRepository.php: 1ms
[ParserWorker] parser.parse() for app/Repositories/EventPositionAssignRepository.php: 2ms (6999 bytes)
[ParserWorker] extractSymbols completed for app/Repositories/EventPositionAssignRepository.php: 11 symbols in 2ms (1572 iterations)
[ParserWorker] extractSymbols for app/Repositories/EventPositionAssignRepository.php: 5ms (11 symbols)
[ParserWorker] extractCstFacts for app/Repositories/EventPositionAssignRepository.php: 0ms (1 facts)
[ParserWorker] Total parse operation for app/Repositories/EventPositionAssignRepository.php: 8ms
[ParserWorker] parser.parse() for app/Repositories/EventLogRepository.php: 12ms (41320 bytes)
[ParserWorker] extractSymbols completed for app/Repositories/EventLogRepository.php: 19 symbols in 13ms (10097 iterations)
[ParserWorker] extractSymbols for app/Repositories/EventLogRepository.php: 14ms (19 symbols)
[ParserWorker] extractCstFacts for app/Repositories/EventLogRepository.php: 1ms (1 facts)
[ParserWorker] Total parse operation for app/Repositories/EventLogRepository.php: 30ms
[ParserWorker] parser.parse() for app/Repositories/EmailQueueRepository.php: 2ms (4282 bytes)
[ParserWorker] extractSymbols completed for app/Repositories/EmailQueueRepository.php: 9 symbols in 1ms (827 iterations)
[ParserWorker] extractSymbols for app/Repositories/EmailQueueRepository.php: 1ms (9 symbols)
[ParserWorker] extractCstFacts for app/Repositories/EmailQueueRepository.php: 0ms (1 facts)
[ParserWorker] Total parse operation for app/Repositories/EmailQueueRepository.php: 3ms
[ParserWorker] parser.parse() for app/Repositories/EloquentRepository.php: 4ms (9685 bytes)
[ParserWorker] extractSymbols completed for app/Repositories/EloquentRepository.php: 23 symbols in 2ms (1952 iterations)
[ParserWorker] extractSymbols for app/Repositories/EloquentRepository.php: 2ms (23 symbols)
[ParserWorker] extractCstFacts for app/Repositories/EloquentRepository.php: 0ms (1 facts)
[ParserWorker] Total parse operation for app/Repositories/EloquentRepository.php: 9ms
[ParserWorker] parser.parse() for app/Repositories/ClientRepository.php: 3ms (10807 bytes)
[ParserWorker] extractSymbols completed for app/Repositories/ClientRepository.php: 8 symbols in 5ms (2609 iterations)
[ParserWorker] extractSymbols for app/Repositories/ClientRepository.php: 5ms (8 symbols)
[ParserWorker] extractCstFacts for app/Repositories/ClientRepository.php: 0ms (1 facts)
[ParserWorker] Total parse operation for app/Repositories/ClientRepository.php: 8ms
[ParserWorker] parser.parse() for app/Repositories/ApplyStaffEventRepository.php: 2ms (6251 bytes)
[ParserWorker] extractSymbols completed for app/Repositories/ApplyStaffEventRepository.php: 11 symbols in 2ms (1189 iterations)
[ParserWorker] extractSymbols for app/Repositories/ApplyStaffEventRepository.php: 2ms (11 symbols)
[ParserWorker] extractCstFacts for app/Repositories/ApplyStaffEventRepository.php: 1ms (1 facts)
[ParserWorker] Total parse operation for app/Repositories/ApplyStaffEventRepository.php: 5ms
[ParserWorker] parser.parse() for app/Repositories/AdminTimeEntryRepository.php: 3ms (11639 bytes)
[ParserWorker] extractSymbols completed for app/Repositories/AdminTimeEntryRepository.php: 14 symbols in 3ms (2460 iterations)
[ParserWorker] extractSymbols for app/Repositories/AdminTimeEntryRepository.php: 8ms (14 symbols)
[ParserWorker] extractCstFacts for app/Repositories/AdminTimeEntryRepository.php: 0ms (1 facts)
[ParserWorker] Total parse operation for app/Repositories/AdminTimeEntryRepository.php: 11ms
[ParserWorker] parser.parse() for app/Providers/ScheduleServiceProvider.php: 0ms (2479 bytes)
[ParserWorker] extractSymbols completed for app/Providers/ScheduleServiceProvider.php: 2 symbols in 0ms (527 iterations)
[ParserWorker] extractSymbols for app/Providers/ScheduleServiceProvider.php: 0ms (2 symbols)
[ParserWorker] extractCstFacts for app/Providers/ScheduleServiceProvider.php: 0ms (1 facts)
[ParserWorker] Total parse operation for app/Providers/ScheduleServiceProvider.php: 2ms
[ParserWorker] parser.parse() for app/Providers/RouteServiceProvider.php: 2ms (6492 bytes)
[ParserWorker] extractSymbols completed for app/Providers/RouteServiceProvider.php: 9 symbols in 2ms (1537 iterations)
[ParserWorker] extractSymbols for app/Providers/RouteServiceProvider.php: 2ms (9 symbols)
[ParserWorker] extractCstFacts for app/Providers/RouteServiceProvider.php: 1ms (1 facts)
[ParserWorker] Total parse operation for app/Providers/RouteServiceProvider.php: 5ms
[ParserWorker] parser.parse() for app/Providers/DatabaseServiceProvider.php: 7ms (20137 bytes)
[ParserWorker] extractSymbols completed for app/Providers/DatabaseServiceProvider.php: 0 symbols in 6ms (5514 iterations)
[ParserWorker] extractSymbols for app/Providers/DatabaseServiceProvider.php: 6ms (0 symbols)
[ParserWorker] extractCstFacts for app/Providers/DatabaseServiceProvider.php: 1ms (38 facts)
[ParserWorker] Total parse operation for app/Providers/DatabaseServiceProvider.php: 15ms
[ParserWorker] parser.parse() for app/Providers/BladeServiceProvider.php: 5ms (15511 bytes)
[ParserWorker] extractSymbols completed for app/Providers/BladeServiceProvider.php: 9 symbols in 3ms (3902 iterations)
[ParserWorker] extractSymbols for app/Providers/BladeServiceProvider.php: 3ms (9 symbols)
[ParserWorker] extractCstFacts for app/Providers/BladeServiceProvider.php: 0ms (44 facts)
[ParserWorker] Total parse operation for app/Providers/BladeServiceProvider.php: 12ms
[ParserWorker] parser.parse() for app/Providers/AE_Blade_Container.php: 1ms (829 bytes)
[ParserWorker] extractSymbols completed for app/Providers/AE_Blade_Container.php: 6 symbols in 0ms (235 iterations)
[ParserWorker] extractSymbols for app/Providers/AE_Blade_Container.php: 0ms (6 symbols)
[ParserWorker] extractCstFacts for app/Providers/AE_Blade_Container.php: 0ms (1 facts)
[ParserWorker] Total parse operation for app/Providers/AE_Blade_Container.php: 1ms
[ParserWorker] parser.parse() for app/Providers/AE_AppContainer.php: 1ms (2713 bytes)
[ParserWorker] extractSymbols completed for app/Providers/AE_AppContainer.php: 20 symbols in 1ms (1017 iterations)
[ParserWorker] extractSymbols for app/Providers/AE_AppContainer.php: 1ms (20 symbols)
[ParserWorker] extractCstFacts for app/Providers/AE_AppContainer.php: 0ms (1 facts)
[ParserWorker] Total parse operation for app/Providers/AE_AppContainer.php: 2ms
[ParserWorker] parser.parse() for app/Models/SpecialDay.php: 0ms (1139 bytes)
[ParserWorker] extractSymbols completed for app/Models/SpecialDay.php: 4 symbols in 0ms (328 iterations)
[ParserWorker] extractSymbols for app/Models/SpecialDay.php: 3ms (4 symbols)
[ParserWorker] extractCstFacts for app/Models/SpecialDay.php: 0ms (0 facts)
[ParserWorker] Total parse operation for app/Models/SpecialDay.php: 4ms
[ParserWorker] parser.parse() for app/Models/Role.php: 0ms (812 bytes)
[ParserWorker] extractSymbols completed for app/Models/Role.php: 4 symbols in 1ms (208 iterations)
[ParserWorker] extractSymbols for app/Models/Role.php: 1ms (4 symbols)
[ParserWorker] extractCstFacts for app/Models/Role.php: 0ms (1 facts)
[ParserWorker] Total parse operation for app/Models/Role.php: 1ms
[ParserWorker] parser.parse() for app/Models/Permission.php: 0ms (331 bytes)
[ParserWorker] extractSymbols completed for app/Models/Permission.php: 1 symbols in 1ms (106 iterations)
[ParserWorker] extractSymbols for app/Models/Permission.php: 1ms (1 symbols)
[ParserWorker] extractCstFacts for app/Models/Permission.php: 0ms (0 facts)
[ParserWorker] Total parse operation for app/Models/Permission.php: 1ms
[ParserWorker] parser.parse() for app/Models/PasswordResetToken.php: 0ms (1853 bytes)
[ParserWorker] extractSymbols completed for app/Models/PasswordResetToken.php: 7 symbols in 1ms (474 iterations)
[ParserWorker] extractSymbols for app/Models/PasswordResetToken.php: 1ms (7 symbols)
[ParserWorker] extractCstFacts for app/Models/PasswordResetToken.php: 1ms (1 facts)
[ParserWorker] Total parse operation for app/Models/PasswordResetToken.php: 2ms
[ParserWorker] parser.parse() for app/Models/InternalEvent.php: 1ms (3538 bytes)
[ParserWorker] extractSymbols completed for app/Models/InternalEvent.php: 14 symbols in 2ms (873 iterations)
[ParserWorker] extractSymbols for app/Models/InternalEvent.php: 2ms (14 symbols)
[ParserWorker] extractCstFacts for app/Models/InternalEvent.php: 0ms (0 facts)
[ParserWorker] Total parse operation for app/Models/InternalEvent.php: 3ms
[ParserWorker] parser.parse() for app/Models/Incentive.php: 0ms (1243 bytes)
[ParserWorker] extractSymbols completed for app/Models/Incentive.php: 4 symbols in 1ms (337 iterations)
[ParserWorker] extractSymbols for app/Models/Incentive.php: 1ms (4 symbols)
[ParserWorker] extractCstFacts for app/Models/Incentive.php: 0ms (0 facts)
[ParserWorker] Total parse operation for app/Models/Incentive.php: 1ms
[ParserWorker] parser.parse() for app/Models/EventPositionAssign.php: 3ms (6185 bytes)
[ParserWorker] extractSymbols completed for app/Models/EventPositionAssign.php: 14 symbols in 2ms (1363 iterations)
[ParserWorker] extractSymbols for app/Models/EventPositionAssign.php: 10ms (14 symbols)
[ParserWorker] extractCstFacts for app/Models/EventPositionAssign.php: 0ms (0 facts)
[ParserWorker] Total parse operation for app/Models/EventPositionAssign.php: 13ms
[ParserWorker] parser.parse() for app/Models/EventPosition.php: 1ms (2783 bytes)
[ParserWorker] extractSymbols completed for app/Models/EventPosition.php: 9 symbols in 2ms (669 iterations)
[ParserWorker] extractSymbols for app/Models/EventPosition.php: 2ms (9 symbols)
[ParserWorker] extractCstFacts for app/Models/EventPosition.php: 0ms (0 facts)
[ParserWorker] Total parse operation for app/Models/EventPosition.php: 3ms
[ParserWorker] parser.parse() for app/Models/EventFile.php: 1ms (1716 bytes)
[ParserWorker] extractSymbols completed for app/Models/EventFile.php: 6 symbols in 0ms (431 iterations)
[ParserWorker] extractSymbols for app/Models/EventFile.php: 0ms (6 symbols)
[ParserWorker] extractCstFacts for app/Models/EventFile.php: 0ms (0 facts)
[ParserWorker] Total parse operation for app/Models/EventFile.php: 1ms
[ParserWorker] parser.parse() for app/Models/EventExcess.php: 0ms (2248 bytes)
[ParserWorker] extractSymbols completed for app/Models/EventExcess.php: 6 symbols in 1ms (556 iterations)
[ParserWorker] extractSymbols for app/Models/EventExcess.php: 1ms (6 symbols)
[ParserWorker] extractCstFacts for app/Models/EventExcess.php: 0ms (0 facts)
[ParserWorker] Total parse operation for app/Models/EventExcess.php: 1ms
[ParserWorker] parser.parse() for app/Models/Event.php: 9ms (36151 bytes)
[ParserWorker] extractSymbols completed for app/Models/Event.php: 63 symbols in 11ms (8497 iterations)
[ParserWorker] extractSymbols for app/Models/Event.php: 12ms (63 symbols)
[ParserWorker] extractCstFacts for app/Models/Event.php: 0ms (0 facts)
[ParserWorker] Total parse operation for app/Models/Event.php: 21ms
[ParserWorker] parser.parse() for app/Models/EmailQueue.php: 0ms (2588 bytes)
[ParserWorker] extractSymbols completed for app/Models/EmailQueue.php: 8 symbols in 0ms (701 iterations)
[ParserWorker] extractSymbols for app/Models/EmailQueue.php: 1ms (8 symbols)
[ParserWorker] extractCstFacts for app/Models/EmailQueue.php: 0ms (1 facts)
[ParserWorker] Total parse operation for app/Models/EmailQueue.php: 2ms
[ParserWorker] parser.parse() for app/Models/BaseModel.php: 0ms (1190 bytes)
[ParserWorker] extractSymbols completed for app/Models/BaseModel.php: 2 symbols in 0ms (178 iterations)
[ParserWorker] extractSymbols for app/Models/BaseModel.php: 0ms (2 symbols)
[ParserWorker] extractCstFacts for app/Models/BaseModel.php: 1ms (1 facts)
[ParserWorker] Total parse operation for app/Models/BaseModel.php: 1ms
[ParserWorker] parser.parse() for app/Models/ApplyStaffEvent.php: 0ms (2998 bytes)
[ParserWorker] extractSymbols completed for app/Models/ApplyStaffEvent.php: 9 symbols in 1ms (690 iterations)
[ParserWorker] extractSymbols for app/Models/ApplyStaffEvent.php: 1ms (9 symbols)
[ParserWorker] extractCstFacts for app/Models/ApplyStaffEvent.php: 0ms (0 facts)
[ParserWorker] Total parse operation for app/Models/ApplyStaffEvent.php: 1ms
[ParserWorker] parser.parse() for app/Models/AdminUser.php: 5ms (19972 bytes)
[ParserWorker] extractSymbols completed for app/Models/AdminUser.php: 49 symbols in 5ms (4449 iterations)
[ParserWorker] extractSymbols for app/Models/AdminUser.php: 5ms (49 symbols)
[ParserWorker] extractCstFacts for app/Models/AdminUser.php: 0ms (0 facts)
[ParserWorker] Total parse operation for app/Models/AdminUser.php: 12ms
[ParserWorker] parser.parse() for app/Models/AdminTimeEntry.php: 1ms (5287 bytes)
[ParserWorker] extractSymbols completed for app/Models/AdminTimeEntry.php: 13 symbols in 1ms (1441 iterations)
[ParserWorker] extractSymbols for app/Models/AdminTimeEntry.php: 4ms (13 symbols)
[ParserWorker] extractCstFacts for app/Models/AdminTimeEntry.php: 0ms (0 facts)
[ParserWorker] Total parse operation for app/Models/AdminTimeEntry.php: 6ms
[ParserWorker] parser.parse() for app/Models/AdminAction.php: 1ms (1072 bytes)
[ParserWorker] extractSymbols completed for app/Models/AdminAction.php: 3 symbols in 0ms (237 iterations)
[ParserWorker] extractSymbols for app/Models/AdminAction.php: 0ms (3 symbols)
[ParserWorker] extractCstFacts for app/Models/AdminAction.php: 0ms (1 facts)
[ParserWorker] Total parse operation for app/Models/AdminAction.php: 1ms
[ParserWorker] parser.parse() for app/Http/Requests/ValidationHandledException.php: 0ms (774 bytes)
[ParserWorker] extractSymbols completed for app/Http/Requests/ValidationHandledException.php: 3 symbols in 1ms (104 iterations)
[ParserWorker] extractSymbols for app/Http/Requests/ValidationHandledException.php: 1ms (3 symbols)
[ParserWorker] extractCstFacts for app/Http/Requests/ValidationHandledException.php: 0ms (1 facts)
[ParserWorker] Total parse operation for app/Http/Requests/ValidationHandledException.php: 1ms
[ParserWorker] parser.parse() for app/Http/Requests/UserValidationRules.php: 1ms (3734 bytes)
[ParserWorker] extractSymbols completed for app/Http/Requests/UserValidationRules.php: 3 symbols in 1ms (745 iterations)
[ParserWorker] extractSymbols for app/Http/Requests/UserValidationRules.php: 1ms (3 symbols)
[ParserWorker] extractCstFacts for app/Http/Requests/UserValidationRules.php: 0ms (4 facts)
[ParserWorker] Total parse operation for app/Http/Requests/UserValidationRules.php: 2ms
[ParserWorker] parser.parse() for app/Http/Requests/UserListRequest.php: 1ms (2329 bytes)
[ParserWorker] extractSymbols completed for app/Http/Requests/UserListRequest.php: 2 symbols in 0ms (743 iterations)
[ParserWorker] extractSymbols for app/Http/Requests/UserListRequest.php: 1ms (2 symbols)
[ParserWorker] extractCstFacts for app/Http/Requests/UserListRequest.php: 0ms (1 facts)
[ParserWorker] Total parse operation for app/Http/Requests/UserListRequest.php: 2ms
[ParserWorker] parser.parse() for app/Http/Requests/UpdateUserRequest.php: 0ms (2187 bytes)
[ParserWorker] extractSymbols completed for app/Http/Requests/UpdateUserRequest.php: 5 symbols in 1ms (484 iterations)
[ParserWorker] extractSymbols for app/Http/Requests/UpdateUserRequest.php: 1ms (5 symbols)
[ParserWorker] extractCstFacts for app/Http/Requests/UpdateUserRequest.php: 0ms (1 facts)
[ParserWorker] Total parse operation for app/Http/Requests/UpdateUserRequest.php: 1ms
[ParserWorker] parser.parse() for app/Http/Requests/RoleRequest.php: 0ms (493 bytes)
[ParserWorker] extractSymbols completed for app/Http/Requests/RoleRequest.php: 2 symbols in 0ms (96 iterations)
[ParserWorker] extractSymbols for app/Http/Requests/RoleRequest.php: 0ms (2 symbols)
[ParserWorker] extractCstFacts for app/Http/Requests/RoleRequest.php: 0ms (0 facts)
[ParserWorker] Total parse operation for app/Http/Requests/RoleRequest.php: 1ms
[ParserWorker] parser.parse() for app/Http/Requests/FormRequest.php: 1ms (8371 bytes)
[ParserWorker] extractSymbols completed for app/Http/Requests/FormRequest.php: 22 symbols in 1ms (1618 iterations)
[ParserWorker] extractSymbols for app/Http/Requests/FormRequest.php: 1ms (22 symbols)
[ParserWorker] extractCstFacts for app/Http/Requests/FormRequest.php: 0ms (1 facts)
[ParserWorker] Total parse operation for app/Http/Requests/FormRequest.php: 5ms
[ParserWorker] parser.parse() for app/Http/Requests/EventUpdateRequest.php: 0ms (3376 bytes)
[ParserWorker] extractSymbols completed for app/Http/Requests/EventUpdateRequest.php: 5 symbols in 1ms (588 iterations)
[ParserWorker] extractSymbols for app/Http/Requests/EventUpdateRequest.php: 1ms (5 symbols)
[ParserWorker] extractCstFacts for app/Http/Requests/EventUpdateRequest.php: 0ms (1 facts)
[ParserWorker] Total parse operation for app/Http/Requests/EventUpdateRequest.php: 2ms
[ParserWorker] parser.parse() for app/Http/Requests/EventLogRequest.php: 2ms (7666 bytes)
[ParserWorker] extractSymbols completed for app/Http/Requests/EventLogRequest.php: 8 symbols in 2ms (1950 iterations)
[ParserWorker] extractSymbols for app/Http/Requests/EventLogRequest.php: 4ms (8 symbols)
[ParserWorker] extractCstFacts for app/Http/Requests/EventLogRequest.php: 1ms (1 facts)
[ParserWorker] Total parse operation for app/Http/Requests/EventLogRequest.php: 7ms
[ParserWorker] parser.parse() for integration-tests/database/legacy-database-test.php: 2ms (10136 bytes)
[ParserWorker] extractSymbols completed for integration-tests/database/legacy-database-test.php: 13 symbols in 3ms (2656 iterations)
[ParserWorker] extractSymbols for integration-tests/database/legacy-database-test.php: 3ms (13 symbols)
[ParserWorker] extractCstFacts for integration-tests/database/legacy-database-test.php: 0ms (2 facts)
[ParserWorker] Total parse operation for integration-tests/database/legacy-database-test.php: 5ms
[ParserWorker] parser.parse() for integration-tests/database/cache-test.php: 3ms (9453 bytes)
[ParserWorker] extractSymbols completed for integration-tests/database/cache-test.php: 9 symbols in 3ms (2840 iterations)
[ParserWorker] extractSymbols for integration-tests/database/cache-test.php: 3ms (9 symbols)
[ParserWorker] extractCstFacts for integration-tests/database/cache-test.php: 0ms (2 facts)
[ParserWorker] Total parse operation for integration-tests/database/cache-test.php: 6ms
[ParserWorker] parser.parse() for integration-tests/controllers/user-controller-test.php: 3ms (11846 bytes)
[ParserWorker] parser.parse() for integration-tests/database/legacy-database-test.php: 2ms (10136 bytes)
[ParserWorker] extractSymbols completed for integration-tests/controllers/user-controller-test.php: 12 symbols in 3ms (3279 iterations)
[ParserWorker] extractSymbols for integration-tests/controllers/user-controller-test.php: 3ms (12 symbols)
[ParserWorker] extractCstFacts for integration-tests/controllers/user-controller-test.php: 0ms (2 facts)
[ParserWorker] Total parse operation for integration-tests/controllers/user-controller-test.php: 6ms
[ParserWorker] parser.parse() for integration-tests/controllers/service-layer-test.php: 3ms (11301 bytes)
[ParserWorker] extractSymbols completed for integration-tests/controllers/service-layer-test.php: 7 symbols in 2ms (2701 iterations)
[ParserWorker] extractSymbols for integration-tests/controllers/service-layer-test.php: 2ms (7 symbols)
[ParserWorker] extractCstFacts for integration-tests/controllers/service-layer-test.php: 0ms (2 facts)
[ParserWorker] Total parse operation for integration-tests/controllers/service-layer-test.php: 9ms
[ParserWorker] parser.parse() for integration-tests/controllers/event-controller-test.php: 2ms (10944 bytes)
[ParserWorker] extractSymbols completed for integration-tests/controllers/event-controller-test.php: 11 symbols in 6ms (2895 iterations)
[ParserWorker] extractSymbols for integration-tests/controllers/event-controller-test.php: 7ms (11 symbols)
[ParserWorker] extractCstFacts for integration-tests/controllers/event-controller-test.php: 0ms (2 facts)
[ParserWorker] Total parse operation for integration-tests/controllers/event-controller-test.php: 9ms
[ParserWorker] parser.parse() for integration-tests/controllers/event-assignment-controller-test.php: 2ms (9882 bytes)
[ParserWorker] extractSymbols completed for integration-tests/controllers/event-assignment-controller-test.php: 10 symbols in 2ms (2309 iterations)
[ParserWorker] extractSymbols for integration-tests/controllers/event-assignment-controller-test.php: 2ms (10 symbols)
[ParserWorker] extractCstFacts for integration-tests/controllers/event-assignment-controller-test.php: 0ms (2 facts)
[ParserWorker] Total parse operation for integration-tests/controllers/event-assignment-controller-test.php: 5ms
[ParserWorker] parser.parse() for integration-tests/controllers/event-admin-assign-controller-test.php: 3ms (10520 bytes)
[ParserWorker] extractSymbols completed for integration-tests/controllers/event-admin-assign-controller-test.php: 11 symbols in 2ms (2468 iterations)
[ParserWorker] extractSymbols for integration-tests/controllers/event-admin-assign-controller-test.php: 2ms (11 symbols)
[ParserWorker] extractCstFacts for integration-tests/controllers/event-admin-assign-controller-test.php: 0ms (2 facts)
[ParserWorker] Total parse operation for integration-tests/controllers/event-admin-assign-controller-test.php: 8ms
[ParserWorker] parser.parse() for integration-tests/controllers/create-operations-test.php: 5ms (19622 bytes)
[ParserWorker] extractSymbols completed for integration-tests/controllers/create-operations-test.php: 6 symbols in 4ms (4151 iterations)
[ParserWorker] extractSymbols for integration-tests/controllers/create-operations-test.php: 5ms (6 symbols)
[ParserWorker] extractCstFacts for integration-tests/controllers/create-operations-test.php: 0ms (2 facts)
[ParserWorker] Total parse operation for integration-tests/controllers/create-operations-test.php: 10ms
[ParserWorker] parser.parse() for integration-tests/controllers/communication-controller-test.php: 2ms (5254 bytes)
[ParserWorker] extractSymbols completed for integration-tests/controllers/communication-controller-test.php: 14 symbols in 1ms (1301 iterations)
[ParserWorker] extractSymbols for integration-tests/controllers/communication-controller-test.php: 1ms (14 symbols)
[ParserWorker] extractCstFacts for integration-tests/controllers/communication-controller-test.php: 0ms (2 facts)
[ParserWorker] Total parse operation for integration-tests/controllers/communication-controller-test.php: 3ms
[ParserWorker] parser.parse() for integration-tests/controllers/client-controller-test.php: 1ms (4996 bytes)
[ParserWorker] extractSymbols completed for integration-tests/controllers/client-controller-test.php: 9 symbols in 1ms (1177 iterations)
[ParserWorker] extractSymbols for integration-tests/controllers/client-controller-test.php: 4ms (9 symbols)
[ParserWorker] extractCstFacts for integration-tests/controllers/client-controller-test.php: 0ms (2 facts)
[ParserWorker] Total parse operation for integration-tests/controllers/client-controller-test.php: 6ms
[ParserWorker] parser.parse() for integration-tests/controllers/calendar-controller-test.php: 2ms (6947 bytes)
[ParserWorker] extractSymbols completed for integration-tests/controllers/calendar-controller-test.php: 15 symbols in 2ms (1728 iterations)
[ParserWorker] extractSymbols for integration-tests/controllers/calendar-controller-test.php: 2ms (15 symbols)
[ParserWorker] extractCstFacts for integration-tests/controllers/calendar-controller-test.php: 0ms (2 facts)
[ParserWorker] Total parse operation for integration-tests/controllers/calendar-controller-test.php: 4ms
[ParserWorker] parser.parse() for integration-tests/controllers/apply-staff-event-controller-test.php: 2ms (7839 bytes)
[ParserWorker] extractSymbols completed for integration-tests/controllers/apply-staff-event-controller-test.php: 9 symbols in 2ms (1900 iterations)
[ParserWorker] extractSymbols for integration-tests/controllers/apply-staff-event-controller-test.php: 4ms (9 symbols)
[ParserWorker] extractCstFacts for integration-tests/controllers/apply-staff-event-controller-test.php: 0ms (2 facts)
[ParserWorker] Total parse operation for integration-tests/controllers/apply-staff-event-controller-test.php: 6ms
[ParserWorker] parser.parse() for integration-tests/TestRunner.php: 1ms (5226 bytes)
[ParserWorker] extractSymbols completed for integration-tests/TestRunner.php: 9 symbols in 2ms (1823 iterations)
[ParserWorker] extractSymbols for integration-tests/TestRunner.php: 2ms (9 symbols)
[ParserWorker] extractCstFacts for integration-tests/TestRunner.php: 0ms (1 facts)
[ParserWorker] Total parse operation for integration-tests/TestRunner.php: 3ms
[ParserWorker] parser.parse() for integration-tests/README.md: 3ms (10260 bytes)
[ParserWorker] extractCstFacts for integration-tests/README.md: 0ms (0 facts)
[ParserWorker] Total parse operation for integration-tests/README.md: 6ms
[ParserWorker] parser.parse() for integration-tests/FAILURE_ANALYSIS.md: 5ms (10239 bytes)
[ParserWorker] extractCstFacts for integration-tests/FAILURE_ANALYSIS.md: 0ms (0 facts)
[ParserWorker] Total parse operation for integration-tests/FAILURE_ANALYSIS.md: 5ms
[ParserWorker] parser.parse() for estimate-git-hours.js: 11ms (12597 bytes)
[ParserWorker] extractSymbols completed for estimate-git-hours.js: 5 symbols in 3ms (3598 iterations)
[ParserWorker] extractSymbols for estimate-git-hours.js: 4ms (5 symbols)
[ParserWorker] extractCstFacts for estimate-git-hours.js: 0ms (8 facts)
[ParserWorker] Total parse operation for estimate-git-hours.js: 16ms
[ParserWorker] parser.parse() for docs/validation-overview.md: 0ms (1625 bytes)
[ParserWorker] extractCstFacts for docs/validation-overview.md: 0ms (0 facts)
[ParserWorker] Total parse operation for docs/validation-overview.md: 1ms
[ParserWorker] parser.parse() for docs/searchable-select-pattern.md: 11ms (26448 bytes)
[ParserWorker] extractCstFacts for docs/searchable-select-pattern.md: 0ms (0 facts)
[ParserWorker] Total parse operation for docs/searchable-select-pattern.md: 11ms
[ParserWorker] parser.parse() for docs/pagination-overview.md: 1ms (2756 bytes)
[ParserWorker] extractCstFacts for docs/pagination-overview.md: 0ms (0 facts)
[ParserWorker] Total parse operation for docs/pagination-overview.md: 1ms
[ParserWorker] parser.parse() for docs/optimization-strategy.md: 2ms (3847 bytes)
[ParserWorker] extractCstFacts for docs/optimization-strategy.md: 0ms (0 facts)
[ParserWorker] Total parse operation for docs/optimization-strategy.md: 2ms
[ParserWorker] parser.parse() for docs/livebind-usage.md: 6ms (12036 bytes)
[ParserWorker] extractCstFacts for docs/livebind-usage.md: 0ms (0 facts)
[ParserWorker] Total parse operation for docs/livebind-usage.md: 6ms
[ParserWorker] parser.parse() for docs/db-edits/multiple-assignments.md: 0ms (895 bytes)
[ParserWorker] extractCstFacts for docs/db-edits/multiple-assignments.md: 0ms (0 facts)
[ParserWorker] Total parse operation for docs/db-edits/multiple-assignments.md: 0ms
[ParserWorker] parser.parse() for docs/db-edits/indexes.md: 1ms (1966 bytes)
[ParserWorker] extractCstFacts for docs/db-edits/indexes.md: 0ms (0 facts)
[ParserWorker] Total parse operation for docs/db-edits/indexes.md: 2ms
[ParserWorker] parser.parse() for docs/db-edits/admin-pay-tracker.md: 1ms (2553 bytes)
[ParserWorker] extractCstFacts for docs/db-edits/admin-pay-tracker.md: 0ms (0 facts)
[ParserWorker] Total parse operation for docs/db-edits/admin-pay-tracker.md: 1ms
[ParserWorker] parser.parse() for docs/UNPOLY_GUIDE.md: 3ms (6202 bytes)
[ParserWorker] extractCstFacts for docs/UNPOLY_GUIDE.md: 0ms (0 facts)
[ParserWorker] Total parse operation for docs/UNPOLY_GUIDE.md: 3ms
[ParserWorker] parser.parse() for docs/PERMISSIONS.md: 2ms (4675 bytes)
[ParserWorker] extractCstFacts for docs/PERMISSIONS.md: 0ms (0 facts)
[ParserWorker] Total parse operation for docs/PERMISSIONS.md: 4ms
[ParserWorker] parser.parse() for docs/MEDIA_FILE_STRUCTURE.md: 4ms (7651 bytes)
[ParserWorker] extractCstFacts for docs/MEDIA_FILE_STRUCTURE.md: 0ms (0 facts)
[ParserWorker] Total parse operation for docs/MEDIA_FILE_STRUCTURE.md: 4ms
[ParserWorker] parser.parse() for docs/LIVEBIND_UNPOLY_PATTERNS.md: 10ms (20396 bytes)
[ParserWorker] extractCstFacts for docs/LIVEBIND_UNPOLY_PATTERNS.md: 0ms (0 facts)
[ParserWorker] Total parse operation for docs/LIVEBIND_UNPOLY_PATTERNS.md: 10ms
[ParserWorker] parser.parse() for docs/EVENT_FILTER_CENTRALIZATION.md: 7ms (16374 bytes)
[ParserWorker] extractCstFacts for docs/EVENT_FILTER_CENTRALIZATION.md: 0ms (0 facts)
[ParserWorker] Total parse operation for docs/EVENT_FILTER_CENTRALIZATION.md: 7ms
[ParserWorker] parser.parse() for docs/CSS_VARIABLES_AND_ZOOM_PLAN.md: 10ms (19122 bytes)
[ParserWorker] extractCstFacts for docs/CSS_VARIABLES_AND_ZOOM_PLAN.md: 1ms (0 facts)
[ParserWorker] Total parse operation for docs/CSS_VARIABLES_AND_ZOOM_PLAN.md: 11ms
[ParserWorker] parser.parse() for docs/CSS_MIGRATION_AND_ZOOM_GUIDE.md: 7ms (13899 bytes)
[ParserWorker] extractCstFacts for docs/CSS_MIGRATION_AND_ZOOM_GUIDE.md: 0ms (0 facts)
[ParserWorker] Total parse operation for docs/CSS_MIGRATION_AND_ZOOM_GUIDE.md: 9ms
[ParserWorker] parser.parse() for docs/CACHE_ARCHITECTURE.md: 3ms (8208 bytes)
[ParserWorker] extractCstFacts for docs/CACHE_ARCHITECTURE.md: 1ms (0 facts)
[ParserWorker] Total parse operation for docs/CACHE_ARCHITECTURE.md: 4ms
[ParserWorker] parser.parse() for database/factories/AdminUserFactory.php: 1ms (2758 bytes)
[ParserWorker] extractSymbols completed for database/factories/AdminUserFactory.php: 5 symbols in 0ms (707 iterations)
[ParserWorker] extractSymbols for database/factories/AdminUserFactory.php: 0ms (5 symbols)
[ParserWorker] extractCstFacts for database/factories/AdminUserFactory.php: 0ms (1 facts)
[ParserWorker] Total parse operation for database/factories/AdminUserFactory.php: 2ms
[ParserWorker] parser.parse() for config/uploads.php: 1ms (6499 bytes)
[ParserWorker] extractSymbols completed for config/uploads.php: 0 symbols in 1ms (1127 iterations)
[ParserWorker] extractSymbols for config/uploads.php: 3ms (0 symbols)
[ParserWorker] extractCstFacts for config/uploads.php: 1ms (21 facts)
[ParserWorker] Total parse operation for config/uploads.php: 5ms
[ParserWorker] parser.parse() for config/session.php: 1ms (2568 bytes)
[ParserWorker] extractSymbols completed for config/session.php: 0 symbols in 0ms (564 iterations)
[ParserWorker] extractSymbols for config/session.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for config/session.php: 1ms (18 facts)
[ParserWorker] Total parse operation for config/session.php: 2ms
[ParserWorker] parser.parse() for config/queue.php: 0ms (339 bytes)
[ParserWorker] extractSymbols completed for config/queue.php: 0 symbols in 1ms (102 iterations)
[ParserWorker] extractSymbols for config/queue.php: 1ms (0 symbols)
[ParserWorker] extractCstFacts for config/queue.php: 0ms (1 facts)
[ParserWorker] Total parse operation for config/queue.php: 1ms
[ParserWorker] parser.parse() for config/mail.php: 0ms (849 bytes)
[ParserWorker] extractSymbols completed for config/mail.php: 0 symbols in 1ms (257 iterations)
[ParserWorker] extractSymbols for config/mail.php: 1ms (0 symbols)
[ParserWorker] extractCstFacts for config/mail.php: 0ms (1 facts)
[ParserWorker] Total parse operation for config/mail.php: 1ms
[ParserWorker] parser.parse() for config/logging.php: 0ms (1164 bytes)
[ParserWorker] extractSymbols completed for config/logging.php: 0 symbols in 1ms (339 iterations)
[ParserWorker] extractSymbols for config/logging.php: 1ms (0 symbols)
[ParserWorker] extractCstFacts for config/logging.php: 0ms (1 facts)
[ParserWorker] Total parse operation for config/logging.php: 1ms
[ParserWorker] parser.parse() for config/database.php: 1ms (2330 bytes)
[ParserWorker] extractSymbols completed for config/database.php: 0 symbols in 1ms (594 iterations)
[ParserWorker] extractSymbols for config/database.php: 1ms (0 symbols)
[ParserWorker] extractCstFacts for config/database.php: 0ms (1 facts)
[ParserWorker] Total parse operation for config/database.php: 2ms
[ParserWorker] parser.parse() for config/cache.php: 1ms (5655 bytes)
[ParserWorker] extractSymbols completed for config/cache.php: 0 symbols in 1ms (537 iterations)
[ParserWorker] extractSymbols for config/cache.php: 4ms (0 symbols)
[ParserWorker] extractCstFacts for config/cache.php: 0ms (4 facts)
[ParserWorker] Total parse operation for config/cache.php: 5ms
[ParserWorker] parser.parse() for config/auth.php: 0ms (414 bytes)
[ParserWorker] extractSymbols completed for config/auth.php: 0 symbols in 1ms (133 iterations)
[ParserWorker] extractSymbols for config/auth.php: 1ms (0 symbols)
[ParserWorker] extractCstFacts for config/auth.php: 0ms (1 facts)
[ParserWorker] Total parse operation for config/auth.php: 1ms
[ParserWorker] parser.parse() for composer.json: 0ms (2690 bytes)
[ParserWorker] extractCstFacts for composer.json: 1ms (8 facts)
[ParserWorker] Total parse operation for composer.json: 1ms
[ParserWorker] parser.parse() for app/helpers.php: 9ms (34456 bytes)
[ParserWorker] extractSymbols completed for app/helpers.php: 54 symbols in 9ms (8144 iterations)
[ParserWorker] extractSymbols for app/helpers.php: 11ms (54 symbols)
[ParserWorker] extractCstFacts for app/helpers.php: 3ms (52 facts)
[ParserWorker] Total parse operation for app/helpers.php: 23ms
[ParserWorker] parser.parse() for app/bootstrap.php: 1ms (4611 bytes)
[ParserWorker] extractSymbols completed for app/bootstrap.php: 0 symbols in 1ms (1313 iterations)
[ParserWorker] extractSymbols for app/bootstrap.php: 2ms (0 symbols)
[ParserWorker] extractCstFacts for app/bootstrap.php: 0ms (19 facts)
[ParserWorker] Total parse operation for app/bootstrap.php: 3ms
[ParserWorker] parser.parse() for app/Traits/CacheInvalidation.php: 0ms (1459 bytes)
[ParserWorker] extractSymbols completed for app/Traits/CacheInvalidation.php: 1 symbols in 1ms (266 iterations)
[ParserWorker] extractSymbols for app/Traits/CacheInvalidation.php: 1ms (1 symbols)
[ParserWorker] extractCstFacts for app/Traits/CacheInvalidation.php: 0ms (2 facts)
[ParserWorker] Total parse operation for app/Traits/CacheInvalidation.php: 1ms
[ParserWorker] parser.parse() for app/Services/UserService.php: 4ms (12472 bytes)
[ParserWorker] extractSymbols completed for app/Services/UserService.php: 10 symbols in 3ms (3386 iterations)
[ParserWorker] extractSymbols for app/Services/UserService.php: 3ms (10 symbols)
[ParserWorker] extractCstFacts for app/Services/UserService.php: 0ms (1 facts)
[ParserWorker] Total parse operation for app/Services/UserService.php: 7ms
[ParserWorker] parser.parse() for app/Services/RoleService.php: 1ms (4950 bytes)
[ParserWorker] extractSymbols completed for app/Services/RoleService.php: 10 symbols in 1ms (1288 iterations)
[ParserWorker] extractSymbols for app/Services/RoleService.php: 1ms (10 symbols)
[ParserWorker] extractCstFacts for app/Services/RoleService.php: 0ms (1 facts)
[ParserWorker] Total parse operation for app/Services/RoleService.php: 2ms
[ParserWorker] parser.parse() for app/Services/PositionsService.php: 1ms (7632 bytes)
[ParserWorker] extractSymbols completed for app/Services/PositionsService.php: 11 symbols in 2ms (1405 iterations)
[ParserWorker] extractSymbols for app/Services/PositionsService.php: 2ms (11 symbols)
[ParserWorker] extractCstFacts for app/Services/PositionsService.php: 0ms (1 facts)
[ParserWorker] Total parse operation for app/Services/PositionsService.php: 5ms
[ParserWorker] parser.parse() for app/Services/NotificationService.php: 3ms (13511 bytes)
[ParserWorker] extractSymbols completed for app/Services/NotificationService.php: 9 symbols in 4ms (3298 iterations)
[ParserWorker] extractSymbols for app/Services/NotificationService.php: 6ms (9 symbols)
[ParserWorker] extractCstFacts for app/Services/NotificationService.php: 0ms (1 facts)
[ParserWorker] Total parse operation for app/Services/NotificationService.php: 9ms
[ParserWorker] parser.parse() for app/Services/EventService.php: 7ms (23012 bytes)
[ParserWorker] extractSymbols completed for app/Services/EventService.php: 23 symbols in 9ms (6042 iterations)
[ParserWorker] extractSymbols for app/Services/EventService.php: 9ms (23 symbols)
[ParserWorker] extractCstFacts for app/Services/EventService.php: 0ms (1 facts)
[ParserWorker] Total parse operation for app/Services/EventService.php: 16ms
[ParserWorker] extractSymbols completed for integration-tests/database/legacy-database-test.php: 13 symbols in 3ms (2656 iterations)
[ParserWorker] extractSymbols for integration-tests/database/legacy-database-test.php: 3ms (13 symbols)
[ParserWorker] extractCstFacts for integration-tests/database/legacy-database-test.php: 0ms (2 facts)
[ParserWorker] Total parse operation for integration-tests/database/legacy-database-test.php: 5ms
[ParserWorker] parser.parse() for integration-tests/database/cache-test.php: 3ms (9453 bytes)
[ParserWorker] extractSymbols completed for integration-tests/database/cache-test.php: 9 symbols in 3ms (2840 iterations)
[ParserWorker] extractSymbols for integration-tests/database/cache-test.php: 3ms (9 symbols)
[ParserWorker] extractCstFacts for integration-tests/database/cache-test.php: 0ms (2 facts)
[ParserWorker] Total parse operation for integration-tests/database/cache-test.php: 6ms
[ParserWorker] parser.parse() for integration-tests/controllers/user-controller-test.php: 3ms (11846 bytes)
[ParserWorker] extractSymbols completed for integration-tests/controllers/user-controller-test.php: 12 symbols in 3ms (3279 iterations)
[ParserWorker] extractSymbols for integration-tests/controllers/user-controller-test.php: 3ms (12 symbols)
[ParserWorker] extractCstFacts for integration-tests/controllers/user-controller-test.php: 0ms (2 facts)
[ParserWorker] Total parse operation for integration-tests/controllers/user-controller-test.php: 6ms
[ParserWorker] parser.parse() for integration-tests/controllers/service-layer-test.php: 3ms (11301 bytes)
[ParserWorker] extractSymbols completed for integration-tests/controllers/service-layer-test.php: 7 symbols in 2ms (2701 iterations)
[ParserWorker] extractSymbols for integration-tests/controllers/service-layer-test.php: 2ms (7 symbols)
[ParserWorker] extractCstFacts for integration-tests/controllers/service-layer-test.php: 0ms (2 facts)
[ParserWorker] Total parse operation for integration-tests/controllers/service-layer-test.php: 9ms
[ParserWorker] parser.parse() for integration-tests/controllers/event-controller-test.php: 2ms (10944 bytes)
[ParserWorker] extractSymbols completed for integration-tests/controllers/event-controller-test.php: 11 symbols in 6ms (2895 iterations)
[ParserWorker] extractSymbols for integration-tests/controllers/event-controller-test.php: 7ms (11 symbols)
[ParserWorker] extractCstFacts for integration-tests/controllers/event-controller-test.php: 0ms (2 facts)
[ParserWorker] Total parse operation for integration-tests/controllers/event-controller-test.php: 9ms
[ParserWorker] parser.parse() for integration-tests/controllers/event-assignment-controller-test.php: 2ms (9882 bytes)
[ParserWorker] extractSymbols completed for integration-tests/controllers/event-assignment-controller-test.php: 10 symbols in 2ms (2309 iterations)
[ParserWorker] extractSymbols for integration-tests/controllers/event-assignment-controller-test.php: 2ms (10 symbols)
[ParserWorker] extractCstFacts for integration-tests/controllers/event-assignment-controller-test.php: 0ms (2 facts)
[ParserWorker] Total parse operation for integration-tests/controllers/event-assignment-controller-test.php: 5ms
[ParserWorker] parser.parse() for integration-tests/controllers/event-admin-assign-controller-test.php: 3ms (10520 bytes)
[ParserWorker] extractSymbols completed for integration-tests/controllers/event-admin-assign-controller-test.php: 11 symbols in 2ms (2468 iterations)
[ParserWorker] extractSymbols for integration-tests/controllers/event-admin-assign-controller-test.php: 2ms (11 symbols)
[ParserWorker] extractCstFacts for integration-tests/controllers/event-admin-assign-controller-test.php: 0ms (2 facts)
[ParserWorker] Total parse operation for integration-tests/controllers/event-admin-assign-controller-test.php: 8ms
[ParserWorker] parser.parse() for integration-tests/controllers/create-operations-test.php: 5ms (19622 bytes)
[ParserWorker] extractSymbols completed for integration-tests/controllers/create-operations-test.php: 6 symbols in 4ms (4151 iterations)
[ParserWorker] extractSymbols for integration-tests/controllers/create-operations-test.php: 5ms (6 symbols)
[ParserWorker] extractCstFacts for integration-tests/controllers/create-operations-test.php: 0ms (2 facts)
[ParserWorker] Total parse operation for integration-tests/controllers/create-operations-test.php: 10ms
[ParserWorker] parser.parse() for integration-tests/controllers/communication-controller-test.php: 2ms (5254 bytes)
[ParserWorker] extractSymbols completed for integration-tests/controllers/communication-controller-test.php: 14 symbols in 1ms (1301 iterations)
[ParserWorker] extractSymbols for integration-tests/controllers/communication-controller-test.php: 1ms (14 symbols)
[ParserWorker] extractCstFacts for integration-tests/controllers/communication-controller-test.php: 0ms (2 facts)
[ParserWorker] Total parse operation for integration-tests/controllers/communication-controller-test.php: 3ms
[ParserWorker] parser.parse() for integration-tests/controllers/client-controller-test.php: 1ms (4996 bytes)
[ParserWorker] extractSymbols completed for integration-tests/controllers/client-controller-test.php: 9 symbols in 1ms (1177 iterations)
[ParserWorker] extractSymbols for integration-tests/controllers/client-controller-test.php: 4ms (9 symbols)
[ParserWorker] extractCstFacts for integration-tests/controllers/client-controller-test.php: 0ms (2 facts)
[ParserWorker] Total parse operation for integration-tests/controllers/client-controller-test.php: 6ms
[ParserWorker] parser.parse() for integration-tests/controllers/calendar-controller-test.php: 2ms (6947 bytes)
[ParserWorker] extractSymbols completed for integration-tests/controllers/calendar-controller-test.php: 15 symbols in 2ms (1728 iterations)
[ParserWorker] extractSymbols for integration-tests/controllers/calendar-controller-test.php: 2ms (15 symbols)
[ParserWorker] extractCstFacts for integration-tests/controllers/calendar-controller-test.php: 0ms (2 facts)
[ParserWorker] Total parse operation for integration-tests/controllers/calendar-controller-test.php: 4ms
[ParserWorker] parser.parse() for integration-tests/controllers/apply-staff-event-controller-test.php: 2ms (7839 bytes)
[ParserWorker] extractSymbols completed for integration-tests/controllers/apply-staff-event-controller-test.php: 9 symbols in 2ms (1900 iterations)
[ParserWorker] extractSymbols for integration-tests/controllers/apply-staff-event-controller-test.php: 4ms (9 symbols)
[ParserWorker] extractCstFacts for integration-tests/controllers/apply-staff-event-controller-test.php: 0ms (2 facts)
[ParserWorker] Total parse operation for integration-tests/controllers/apply-staff-event-controller-test.php: 6ms
[ParserWorker] parser.parse() for integration-tests/TestRunner.php: 1ms (5226 bytes)
[ParserWorker] extractSymbols completed for integration-tests/TestRunner.php: 9 symbols in 2ms (1823 iterations)
[ParserWorker] extractSymbols for integration-tests/TestRunner.php: 2ms (9 symbols)
[ParserWorker] extractCstFacts for integration-tests/TestRunner.php: 0ms (1 facts)
[ParserWorker] Total parse operation for integration-tests/TestRunner.php: 3ms
[ParserWorker] parser.parse() for integration-tests/README.md: 3ms (10260 bytes)
[ParserWorker] extractCstFacts for integration-tests/README.md: 0ms (0 facts)
[ParserWorker] Total parse operation for integration-tests/README.md: 6ms
[ParserWorker] parser.parse() for integration-tests/FAILURE_ANALYSIS.md: 5ms (10239 bytes)
[ParserWorker] extractCstFacts for integration-tests/FAILURE_ANALYSIS.md: 0ms (0 facts)
[ParserWorker] Total parse operation for integration-tests/FAILURE_ANALYSIS.md: 5ms
[ParserWorker] parser.parse() for estimate-git-hours.js: 11ms (12597 bytes)
[ParserWorker] extractSymbols completed for estimate-git-hours.js: 5 symbols in 3ms (3598 iterations)
[ParserWorker] extractSymbols for estimate-git-hours.js: 4ms (5 symbols)
[ParserWorker] extractCstFacts for estimate-git-hours.js: 0ms (8 facts)
[ParserWorker] Total parse operation for estimate-git-hours.js: 16ms
[ParserWorker] parser.parse() for docs/validation-overview.md: 0ms (1625 bytes)
[ParserWorker] extractCstFacts for docs/validation-overview.md: 0ms (0 facts)
[ParserWorker] Total parse operation for docs/validation-overview.md: 1ms
[ParserWorker] parser.parse() for docs/searchable-select-pattern.md: 11ms (26448 bytes)
[ParserWorker] extractCstFacts for docs/searchable-select-pattern.md: 0ms (0 facts)
[ParserWorker] Total parse operation for docs/searchable-select-pattern.md: 11ms
[ParserWorker] parser.parse() for docs/pagination-overview.md: 1ms (2756 bytes)
[ParserWorker] extractCstFacts for docs/pagination-overview.md: 0ms (0 facts)
[ParserWorker] Total parse operation for docs/pagination-overview.md: 1ms
[ParserWorker] parser.parse() for docs/optimization-strategy.md: 2ms (3847 bytes)
[ParserWorker] extractCstFacts for docs/optimization-strategy.md: 0ms (0 facts)
[ParserWorker] Total parse operation for docs/optimization-strategy.md: 2ms
[ParserWorker] parser.parse() for docs/livebind-usage.md: 6ms (12036 bytes)
[ParserWorker] extractCstFacts for docs/livebind-usage.md: 0ms (0 facts)
[ParserWorker] Total parse operation for docs/livebind-usage.md: 6ms
[ParserWorker] parser.parse() for docs/db-edits/multiple-assignments.md: 0ms (895 bytes)
[ParserWorker] extractCstFacts for docs/db-edits/multiple-assignments.md: 0ms (0 facts)
[ParserWorker] Total parse operation for docs/db-edits/multiple-assignments.md: 0ms
[ParserWorker] parser.parse() for docs/db-edits/indexes.md: 1ms (1966 bytes)
[ParserWorker] extractCstFacts for docs/db-edits/indexes.md: 0ms (0 facts)
[ParserWorker] Total parse operation for docs/db-edits/indexes.md: 2ms
[ParserWorker] parser.parse() for docs/db-edits/admin-pay-tracker.md: 1ms (2553 bytes)
[ParserWorker] extractCstFacts for docs/db-edits/admin-pay-tracker.md: 0ms (0 facts)
[ParserWorker] Total parse operation for docs/db-edits/admin-pay-tracker.md: 1ms
[ParserWorker] parser.parse() for docs/UNPOLY_GUIDE.md: 3ms (6202 bytes)
[ParserWorker] extractCstFacts for docs/UNPOLY_GUIDE.md: 0ms (0 facts)
[ParserWorker] Total parse operation for docs/UNPOLY_GUIDE.md: 3ms
[ParserWorker] parser.parse() for docs/PERMISSIONS.md: 2ms (4675 bytes)
[ParserWorker] extractCstFacts for docs/PERMISSIONS.md: 0ms (0 facts)
[ParserWorker] Total parse operation for docs/PERMISSIONS.md: 4ms
[ParserWorker] parser.parse() for docs/MEDIA_FILE_STRUCTURE.md: 4ms (7651 bytes)
[ParserWorker] extractCstFacts for docs/MEDIA_FILE_STRUCTURE.md: 0ms (0 facts)
[ParserWorker] Total parse operation for docs/MEDIA_FILE_STRUCTURE.md: 4ms
[ParserWorker] parser.parse() for docs/LIVEBIND_UNPOLY_PATTERNS.md: 10ms (20396 bytes)
[ParserWorker] extractCstFacts for docs/LIVEBIND_UNPOLY_PATTERNS.md: 0ms (0 facts)
[ParserWorker] Total parse operation for docs/LIVEBIND_UNPOLY_PATTERNS.md: 10ms
[ParserWorker] parser.parse() for docs/EVENT_FILTER_CENTRALIZATION.md: 7ms (16374 bytes)
[ParserWorker] extractCstFacts for docs/EVENT_FILTER_CENTRALIZATION.md: 0ms (0 facts)
[ParserWorker] Total parse operation for docs/EVENT_FILTER_CENTRALIZATION.md: 7ms
[ParserWorker] parser.parse() for docs/CSS_VARIABLES_AND_ZOOM_PLAN.md: 10ms (19122 bytes)
[ParserWorker] extractCstFacts for docs/CSS_VARIABLES_AND_ZOOM_PLAN.md: 1ms (0 facts)
[ParserWorker] Total parse operation for docs/CSS_VARIABLES_AND_ZOOM_PLAN.md: 11ms
[ParserWorker] parser.parse() for docs/CSS_MIGRATION_AND_ZOOM_GUIDE.md: 7ms (13899 bytes)
[ParserWorker] extractCstFacts for docs/CSS_MIGRATION_AND_ZOOM_GUIDE.md: 0ms (0 facts)
[ParserWorker] Total parse operation for docs/CSS_MIGRATION_AND_ZOOM_GUIDE.md: 9ms
[ParserWorker] parser.parse() for docs/CACHE_ARCHITECTURE.md: 3ms (8208 bytes)
[ParserWorker] extractCstFacts for docs/CACHE_ARCHITECTURE.md: 1ms (0 facts)
[ParserWorker] Total parse operation for docs/CACHE_ARCHITECTURE.md: 4ms
[ParserWorker] parser.parse() for database/factories/AdminUserFactory.php: 1ms (2758 bytes)
[ParserWorker] extractSymbols completed for database/factories/AdminUserFactory.php: 5 symbols in 0ms (707 iterations)
[ParserWorker] extractSymbols for database/factories/AdminUserFactory.php: 0ms (5 symbols)
[ParserWorker] extractCstFacts for database/factories/AdminUserFactory.php: 0ms (1 facts)
[ParserWorker] Total parse operation for database/factories/AdminUserFactory.php: 2ms
[ParserWorker] parser.parse() for config/uploads.php: 1ms (6499 bytes)
[ParserWorker] extractSymbols completed for config/uploads.php: 0 symbols in 1ms (1127 iterations)
[ParserWorker] extractSymbols for config/uploads.php: 3ms (0 symbols)
[ParserWorker] extractCstFacts for config/uploads.php: 1ms (21 facts)
[ParserWorker] Total parse operation for config/uploads.php: 5ms
[ParserWorker] parser.parse() for config/session.php: 1ms (2568 bytes)
[ParserWorker] extractSymbols completed for config/session.php: 0 symbols in 0ms (564 iterations)
[ParserWorker] extractSymbols for config/session.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for config/session.php: 1ms (18 facts)
[ParserWorker] Total parse operation for config/session.php: 2ms
[ParserWorker] parser.parse() for config/queue.php: 0ms (339 bytes)
[ParserWorker] extractSymbols completed for config/queue.php: 0 symbols in 1ms (102 iterations)
[ParserWorker] extractSymbols for config/queue.php: 1ms (0 symbols)
[ParserWorker] extractCstFacts for config/queue.php: 0ms (1 facts)
[ParserWorker] Total parse operation for config/queue.php: 1ms
[ParserWorker] parser.parse() for config/mail.php: 0ms (849 bytes)
[ParserWorker] extractSymbols completed for config/mail.php: 0 symbols in 1ms (257 iterations)
[ParserWorker] extractSymbols for config/mail.php: 1ms (0 symbols)
[ParserWorker] extractCstFacts for config/mail.php: 0ms (1 facts)
[ParserWorker] Total parse operation for config/mail.php: 1ms
[ParserWorker] parser.parse() for config/logging.php: 0ms (1164 bytes)
[ParserWorker] extractSymbols completed for config/logging.php: 0 symbols in 1ms (339 iterations)
[ParserWorker] extractSymbols for config/logging.php: 1ms (0 symbols)
[ParserWorker] extractCstFacts for config/logging.php: 0ms (1 facts)
[ParserWorker] Total parse operation for config/logging.php: 1ms
[ParserWorker] parser.parse() for config/database.php: 1ms (2330 bytes)
[ParserWorker] extractSymbols completed for config/database.php: 0 symbols in 1ms (594 iterations)
[ParserWorker] extractSymbols for config/database.php: 1ms (0 symbols)
[ParserWorker] extractCstFacts for config/database.php: 0ms (1 facts)
[ParserWorker] Total parse operation for config/database.php: 2ms
[ParserWorker] parser.parse() for config/cache.php: 1ms (5655 bytes)
[ParserWorker] extractSymbols completed for config/cache.php: 0 symbols in 1ms (537 iterations)
[ParserWorker] extractSymbols for config/cache.php: 4ms (0 symbols)
[ParserWorker] extractCstFacts for config/cache.php: 0ms (4 facts)
[ParserWorker] Total parse operation for config/cache.php: 5ms
[ParserWorker] parser.parse() for config/auth.php: 0ms (414 bytes)
[ParserWorker] extractSymbols completed for config/auth.php: 0 symbols in 1ms (133 iterations)
[ParserWorker] extractSymbols for config/auth.php: 1ms (0 symbols)
[ParserWorker] extractCstFacts for config/auth.php: 0ms (1 facts)
[ParserWorker] Total parse operation for config/auth.php: 1ms
[ParserWorker] parser.parse() for composer.json: 0ms (2690 bytes)
[ParserWorker] extractCstFacts for composer.json: 1ms (8 facts)
[ParserWorker] Total parse operation for composer.json: 1ms
[ParserWorker] parser.parse() for app/helpers.php: 9ms (34456 bytes)
[ParserWorker] extractSymbols completed for app/helpers.php: 54 symbols in 9ms (8144 iterations)
[ParserWorker] extractSymbols for app/helpers.php: 11ms (54 symbols)
[ParserWorker] extractCstFacts for app/helpers.php: 3ms (52 facts)
[ParserWorker] Total parse operation for app/helpers.php: 23ms
[ParserWorker] parser.parse() for app/bootstrap.php: 1ms (4611 bytes)
[ParserWorker] extractSymbols completed for app/bootstrap.php: 0 symbols in 1ms (1313 iterations)
[ParserWorker] extractSymbols for app/bootstrap.php: 2ms (0 symbols)
[ParserWorker] extractCstFacts for app/bootstrap.php: 0ms (19 facts)
[ParserWorker] Total parse operation for app/bootstrap.php: 3ms
[ParserWorker] parser.parse() for app/Traits/CacheInvalidation.php: 0ms (1459 bytes)
[ParserWorker] extractSymbols completed for app/Traits/CacheInvalidation.php: 1 symbols in 1ms (266 iterations)
[ParserWorker] extractSymbols for app/Traits/CacheInvalidation.php: 1ms (1 symbols)
[ParserWorker] extractCstFacts for app/Traits/CacheInvalidation.php: 0ms (2 facts)
[ParserWorker] Total parse operation for app/Traits/CacheInvalidation.php: 1ms
[ParserWorker] parser.parse() for app/Services/UserService.php: 4ms (12472 bytes)
[ParserWorker] extractSymbols completed for app/Services/UserService.php: 10 symbols in 3ms (3386 iterations)
[ParserWorker] extractSymbols for app/Services/UserService.php: 3ms (10 symbols)
[ParserWorker] extractCstFacts for app/Services/UserService.php: 0ms (1 facts)
[ParserWorker] Total parse operation for app/Services/UserService.php: 7ms
[ParserWorker] parser.parse() for app/Services/RoleService.php: 1ms (4950 bytes)
[ParserWorker] extractSymbols completed for app/Services/RoleService.php: 10 symbols in 1ms (1288 iterations)
[ParserWorker] extractSymbols for app/Services/RoleService.php: 1ms (10 symbols)
[ParserWorker] extractCstFacts for app/Services/RoleService.php: 0ms (1 facts)
[ParserWorker] Total parse operation for app/Services/RoleService.php: 2ms
[ParserWorker] parser.parse() for app/Services/PositionsService.php: 1ms (7632 bytes)
[ParserWorker] extractSymbols completed for app/Services/PositionsService.php: 11 symbols in 2ms (1405 iterations)
[ParserWorker] extractSymbols for app/Services/PositionsService.php: 2ms (11 symbols)
[ParserWorker] extractCstFacts for app/Services/PositionsService.php: 0ms (1 facts)
[ParserWorker] Total parse operation for app/Services/PositionsService.php: 5ms
[ParserWorker] parser.parse() for app/Services/NotificationService.php: 3ms (13511 bytes)
[ParserWorker] extractSymbols completed for app/Services/NotificationService.php: 9 symbols in 4ms (3298 iterations)
[ParserWorker] extractSymbols for app/Services/NotificationService.php: 6ms (9 symbols)
[ParserWorker] extractCstFacts for app/Services/NotificationService.php: 0ms (1 facts)
[ParserWorker] Total parse operation for app/Services/NotificationService.php: 9ms
[ParserWorker] parser.parse() for app/Services/EventService.php: 7ms (23012 bytes)
[ParserWorker] extractSymbols completed for app/Services/EventService.php: 23 symbols in 9ms (6042 iterations)
[ParserWorker] extractSymbols for app/Services/EventService.php: 9ms (23 symbols)
[ParserWorker] extractCstFacts for app/Services/EventService.php: 0ms (1 facts)
[ParserWorker] Total parse operation for app/Services/EventService.php: 16ms
[ParserWorker] parser.parse() for notes/routing-conventions.md: 3ms (6085 bytes)
[ParserWorker] extractCstFacts for notes/routing-conventions.md: 0ms (0 facts)
[ParserWorker] Total parse operation for notes/routing-conventions.md: 3ms
[ParserWorker] parser.parse() for notes/reoganize-plan.md: 9ms (21387 bytes)
[ParserWorker] extractCstFacts for notes/reoganize-plan.md: 0ms (0 facts)
[ParserWorker] Total parse operation for notes/reoganize-plan.md: 9ms
[ParserWorker] parser.parse() for notes/routing-conventions.md: 3ms (6085 bytes)
[ParserWorker] parser.parse() for notes/refactor-skeleton.md: 9ms (23048 bytes)
[ParserWorker] extractCstFacts for notes/refactor-skeleton.md: 0ms (0 facts)
[ParserWorker] Total parse operation for notes/refactor-skeleton.md: 10ms
[ParserWorker] parser.parse() for notes/database-tables.md: 4ms (8774 bytes)
[ParserWorker] extractCstFacts for notes/database-tables.md: 1ms (0 facts)
[ParserWorker] Total parse operation for notes/database-tables.md: 5ms
[ParserWorker] parser.parse() for notes/SESSION_SUMMARY_EMAIL_SMS.md: 3ms (7230 bytes)
[ParserWorker] extractCstFacts for notes/SESSION_SUMMARY_EMAIL_SMS.md: 0ms (0 facts)
[ParserWorker] Total parse operation for notes/SESSION_SUMMARY_EMAIL_SMS.md: 3ms
[ParserWorker] parser.parse() for notes/REPOSITORY_PATTERN_CLEANUP_AUDIT.md: 9ms (21661 bytes)
[ParserWorker] extractCstFacts for notes/REPOSITORY_PATTERN_CLEANUP_AUDIT.md: 0ms (0 facts)
[ParserWorker] Total parse operation for notes/REPOSITORY_PATTERN_CLEANUP_AUDIT.md: 10ms
[ParserWorker] parser.parse() for notes/REFACTORING_ROADMAP.md: 10ms (24075 bytes)
[ParserWorker] extractCstFacts for notes/REFACTORING_ROADMAP.md: 0ms (0 facts)
[ParserWorker] Total parse operation for notes/REFACTORING_ROADMAP.md: 10ms
[ParserWorker] parser.parse() for notes/MIGRATION_COMPLETE.md: 2ms (4876 bytes)
[ParserWorker] extractCstFacts for notes/MIGRATION_COMPLETE.md: 0ms (0 facts)
[ParserWorker] Total parse operation for notes/MIGRATION_COMPLETE.md: 2ms
[ParserWorker] parser.parse() for notes/LARAVEL_ROUTING_CONTROLLER_GUIDE.md: 3ms (5772 bytes)
[ParserWorker] extractCstFacts for notes/LARAVEL_ROUTING_CONTROLLER_GUIDE.md: 0ms (0 facts)
[ParserWorker] Total parse operation for notes/LARAVEL_ROUTING_CONTROLLER_GUIDE.md: 4ms
[ParserWorker] parser.parse() for notes/LARAVEL_CONVENIENCES_NOT_USED.md: 12ms (21698 bytes)
[ParserWorker] extractCstFacts for notes/LARAVEL_CONVENIENCES_NOT_USED.md: 0ms (0 facts)
[ParserWorker] Total parse operation for notes/LARAVEL_CONVENIENCES_NOT_USED.md: 12ms
[ParserWorker] parser.parse() for notes/ENUM_USAGE_AUDIT.md: 10ms (18609 bytes)
[ParserWorker] extractCstFacts for notes/ENUM_USAGE_AUDIT.md: 0ms (0 facts)
[ParserWorker] Total parse operation for notes/ENUM_USAGE_AUDIT.md: 10ms
[ParserWorker] parser.parse() for notes/ELOQUENT_MVC_BEST_PRACTICES.md: 20ms (41595 bytes)
[ParserWorker] extractCstFacts for notes/ELOQUENT_MVC_BEST_PRACTICES.md: 0ms (0 facts)
[ParserWorker] Total parse operation for notes/ELOQUENT_MVC_BEST_PRACTICES.md: 20ms
[ParserWorker] parser.parse() for integration-tests/validation/client-validation-test.php: 2ms (8024 bytes)
[ParserWorker] extractSymbols completed for integration-tests/validation/client-validation-test.php: 12 symbols in 4ms (1924 iterations)
[ParserWorker] extractSymbols for integration-tests/validation/client-validation-test.php: 5ms (12 symbols)
[ParserWorker] extractCstFacts for integration-tests/validation/client-validation-test.php: 0ms (2 facts)
[ParserWorker] Total parse operation for integration-tests/validation/client-validation-test.php: 7ms
[ParserWorker] parser.parse() for integration-tests/unpoly/unpoly-integration-test.php: 2ms (7110 bytes)
[ParserWorker] extractSymbols completed for integration-tests/unpoly/unpoly-integration-test.php: 10 symbols in 2ms (1866 iterations)
[ParserWorker] extractSymbols for integration-tests/unpoly/unpoly-integration-test.php: 2ms (10 symbols)
[ParserWorker] extractCstFacts for integration-tests/unpoly/unpoly-integration-test.php: 0ms (2 facts)
[ParserWorker] Total parse operation for integration-tests/unpoly/unpoly-integration-test.php: 4ms
[ParserWorker] parser.parse() for integration-tests/services/user-service-test.php: 6ms (25770 bytes)
[ParserWorker] extractSymbols completed for integration-tests/services/user-service-test.php: 18 symbols in 8ms (7046 iterations)
[ParserWorker] extractSymbols for integration-tests/services/user-service-test.php: 9ms (18 symbols)
[ParserWorker] extractCstFacts for integration-tests/services/user-service-test.php: 0ms (2 facts)
[ParserWorker] Total parse operation for integration-tests/services/user-service-test.php: 15ms
[ParserWorker] parser.parse() for integration-tests/services/role-service-test.php: 5ms (19763 bytes)
[ParserWorker] extractSymbols completed for integration-tests/services/role-service-test.php: 16 symbols in 5ms (5362 iterations)
[ParserWorker] extractSymbols for integration-tests/services/role-service-test.php: 5ms (16 symbols)
[ParserWorker] extractCstFacts for integration-tests/services/role-service-test.php: 1ms (2 facts)
[ParserWorker] Total parse operation for integration-tests/services/role-service-test.php: 11ms
[ParserWorker] parser.parse() for integration-tests/services/positions-service-test.php: 6ms (22603 bytes)
[ParserWorker] extractSymbols completed for integration-tests/services/positions-service-test.php: 15 symbols in 7ms (6395 iterations)
[ParserWorker] extractSymbols for integration-tests/services/positions-service-test.php: 7ms (15 symbols)
[ParserWorker] extractCstFacts for integration-tests/services/positions-service-test.php: 0ms (2 facts)
[ParserWorker] Total parse operation for integration-tests/services/positions-service-test.php: 18ms
[ParserWorker] parser.parse() for integration-tests/services/notification-service-test.php: 2ms (6616 bytes)
[ParserWorker] extractSymbols completed for integration-tests/services/notification-service-test.php: 7 symbols in 2ms (1664 iterations)
[ParserWorker] extractSymbols for integration-tests/services/notification-service-test.php: 2ms (7 symbols)
[ParserWorker] extractCstFacts for integration-tests/services/notification-service-test.php: 0ms (2 facts)
[ParserWorker] Total parse operation for integration-tests/services/notification-service-test.php: 4ms
[ParserWorker] parser.parse() for integration-tests/services/event-service-test.php: 7ms (26644 bytes)
[ParserWorker] extractSymbols completed for integration-tests/services/event-service-test.php: 18 symbols in 13ms (7823 iterations)
[ParserWorker] extractSymbols for integration-tests/services/event-service-test.php: 14ms (18 symbols)
[ParserWorker] extractCstFacts for integration-tests/services/event-service-test.php: 0ms (2 facts)
[ParserWorker] Total parse operation for integration-tests/services/event-service-test.php: 22ms
[ParserWorker] parser.parse() for integration-tests/services/event-read-service-test.php: 6ms (27008 bytes)
[ParserWorker] extractSymbols completed for integration-tests/services/event-read-service-test.php: 20 symbols in 9ms (7639 iterations)
[ParserWorker] extractSymbols for integration-tests/services/event-read-service-test.php: 11ms (20 symbols)
[ParserWorker] extractCstFacts for integration-tests/services/event-read-service-test.php: 0ms (2 facts)
[ParserWorker] Total parse operation for integration-tests/services/event-read-service-test.php: 19ms
[ParserWorker] parser.parse() for integration-tests/services/event-assignment-service-test.php: 6ms (28556 bytes)
[ParserWorker] extractSymbols completed for integration-tests/services/event-assignment-service-test.php: 15 symbols in 8ms (8154 iterations)
[ParserWorker] extractSymbols for integration-tests/services/event-assignment-service-test.php: 8ms (15 symbols)
[ParserWorker] extractCstFacts for integration-tests/services/event-assignment-service-test.php: 0ms (2 facts)
[ParserWorker] Total parse operation for integration-tests/services/event-assignment-service-test.php: 17ms
[ParserWorker] parser.parse() for integration-tests/services/email-service-test.php: 3ms (10612 bytes)
[ParserWorker] extractSymbols completed for integration-tests/services/email-service-test.php: 9 symbols in 3ms (3077 iterations)
[ParserWorker] extractSymbols for integration-tests/services/email-service-test.php: 3ms (9 symbols)
[ParserWorker] extractCstFacts for integration-tests/services/email-service-test.php: 1ms (2 facts)
[ParserWorker] Total parse operation for integration-tests/services/email-service-test.php: 7ms
[ParserWorker] parser.parse() for integration-tests/services/communication-service-test.php: 3ms (10386 bytes)
[ParserWorker] extractSymbols completed for integration-tests/services/communication-service-test.php: 12 symbols in 3ms (2852 iterations)
[ParserWorker] extractSymbols for integration-tests/services/communication-service-test.php: 3ms (12 symbols)
[ParserWorker] extractCstFacts for integration-tests/services/communication-service-test.php: 0ms (2 facts)
[ParserWorker] Total parse operation for integration-tests/services/communication-service-test.php: 8ms
[ParserWorker] parser.parse() for integration-tests/services/client-service-test.php: 4ms (16535 bytes)
[ParserWorker] extractSymbols completed for integration-tests/services/client-service-test.php: 13 symbols in 5ms (4485 iterations)
[ParserWorker] extractSymbols for integration-tests/services/client-service-test.php: 6ms (13 symbols)
[ParserWorker] extractCstFacts for integration-tests/services/client-service-test.php: 0ms (2 facts)
[ParserWorker] Total parse operation for integration-tests/services/client-service-test.php: 10ms
[ParserWorker] parser.parse() for integration-tests/run-all-tests.php: 2ms (5027 bytes)
[ParserWorker] extractSymbols completed for integration-tests/run-all-tests.php: 0 symbols in 2ms (1611 iterations)
[ParserWorker] extractSymbols for integration-tests/run-all-tests.php: 2ms (0 symbols)
[ParserWorker] extractCstFacts for integration-tests/run-all-tests.php: 4ms (13 facts)
[ParserWorker] Total parse operation for integration-tests/run-all-tests.php: 8ms
[ParserWorker] parser.parse() for integration-tests/repositories/user-repository-test.php: 3ms (12659 bytes)
[ParserWorker] extractSymbols completed for integration-tests/repositories/user-repository-test.php: 11 symbols in 4ms (3558 iterations)
[ParserWorker] extractSymbols for integration-tests/repositories/user-repository-test.php: 7ms (11 symbols)
[ParserWorker] extractCstFacts for integration-tests/repositories/user-repository-test.php: 0ms (2 facts)
[ParserWorker] Total parse operation for integration-tests/repositories/user-repository-test.php: 11ms
[ParserWorker] parser.parse() for integration-tests/repositories/user-repository-comprehensive-test.php: 3ms (14944 bytes)
[ParserWorker] extractSymbols completed for integration-tests/repositories/user-repository-comprehensive-test.php: 10 symbols in 3ms (3918 iterations)
[ParserWorker] extractSymbols for integration-tests/repositories/user-repository-comprehensive-test.php: 5ms (10 symbols)
[ParserWorker] extractCstFacts for integration-tests/repositories/user-repository-comprehensive-test.php: 0ms (2 facts)
[ParserWorker] Total parse operation for integration-tests/repositories/user-repository-comprehensive-test.php: 10ms
[ParserWorker] parser.parse() for integration-tests/repositories/special-day-repository-test.php: 1ms (4992 bytes)
[ParserWorker] extractSymbols completed for integration-tests/repositories/special-day-repository-test.php: 13 symbols in 1ms (1344 iterations)
[ParserWorker] extractSymbols for integration-tests/repositories/special-day-repository-test.php: 1ms (13 symbols)
[ParserWorker] extractCstFacts for integration-tests/repositories/special-day-repository-test.php: 0ms (2 facts)
[ParserWorker] Total parse operation for integration-tests/repositories/special-day-repository-test.php: 3ms
[ParserWorker] parser.parse() for integration-tests/repositories/role-repository-test.php: 1ms (4455 bytes)
[ParserWorker] extractSymbols completed for integration-tests/repositories/role-repository-test.php: 13 symbols in 2ms (1264 iterations)
[ParserWorker] extractSymbols for integration-tests/repositories/role-repository-test.php: 2ms (13 symbols)
[ParserWorker] extractCstFacts for integration-tests/repositories/role-repository-test.php: 0ms (2 facts)
[ParserWorker] Total parse operation for integration-tests/repositories/role-repository-test.php: 3ms
[ParserWorker] parser.parse() for integration-tests/repositories/report-repository-test.php: 2ms (9422 bytes)
[ParserWorker] extractSymbols completed for integration-tests/repositories/report-repository-test.php: 11 symbols in 3ms (2675 iterations)
[ParserWorker] extractSymbols for integration-tests/repositories/report-repository-test.php: 3ms (11 symbols)
[ParserWorker] extractCstFacts for integration-tests/repositories/report-repository-test.php: 0ms (2 facts)
[ParserWorker] Total parse operation for integration-tests/repositories/report-repository-test.php: 7ms
[ParserWorker] parser.parse() for integration-tests/repositories/permission-repository-test.php: 2ms (5950 bytes)
[ParserWorker] extractSymbols completed for integration-tests/repositories/permission-repository-test.php: 13 symbols in 2ms (1591 iterations)
[ParserWorker] extractSymbols for integration-tests/repositories/permission-repository-test.php: 2ms (13 symbols)
[ParserWorker] extractCstFacts for integration-tests/repositories/permission-repository-test.php: 0ms (2 facts)
[ParserWorker] Total parse operation for integration-tests/repositories/permission-repository-test.php: 4ms
[ParserWorker] parser.parse() for integration-tests/repositories/incentive-repository-test.php: 2ms (9858 bytes)
[ParserWorker] extractSymbols completed for integration-tests/repositories/incentive-repository-test.php: 11 symbols in 2ms (2646 iterations)
[ParserWorker] extractSymbols for integration-tests/repositories/incentive-repository-test.php: 3ms (11 symbols)
[ParserWorker] extractCstFacts for integration-tests/repositories/incentive-repository-test.php: 0ms (2 facts)
[ParserWorker] Total parse operation for integration-tests/repositories/incentive-repository-test.php: 7ms
[ParserWorker] parser.parse() for integration-tests/repositories/event-repository-test.php: 3ms (10079 bytes)
[ParserWorker] extractSymbols completed for integration-tests/repositories/event-repository-test.php: 11 symbols in 2ms (2666 iterations)
[ParserWorker] extractSymbols for integration-tests/repositories/event-repository-test.php: 5ms (11 symbols)
[ParserWorker] extractCstFacts for integration-tests/repositories/event-repository-test.php: 0ms (2 facts)
[ParserWorker] Total parse operation for integration-tests/repositories/event-repository-test.php: 8ms
[ParserWorker] parser.parse() for integration-tests/repositories/event-repository-comprehensive-test.php: 4ms (14151 bytes)
[ParserWorker] extractSymbols completed for integration-tests/repositories/event-repository-comprehensive-test.php: 10 symbols in 4ms (3862 iterations)
[ParserWorker] extractSymbols for integration-tests/repositories/event-repository-comprehensive-test.php: 4ms (10 symbols)
[ParserWorker] extractCstFacts for integration-tests/repositories/event-repository-comprehensive-test.php: 0ms (2 facts)
[ParserWorker] Total parse operation for integration-tests/repositories/event-repository-comprehensive-test.php: 8ms
[ParserWorker] parser.parse() for integration-tests/repositories/event-position-repository-test.php: 1ms (5503 bytes)
[ParserWorker] extractSymbols completed for integration-tests/repositories/event-position-repository-test.php: 13 symbols in 2ms (1470 iterations)
[ParserWorker] extractSymbols for integration-tests/repositories/event-position-repository-test.php: 2ms (13 symbols)
[ParserWorker] extractCstFacts for integration-tests/repositories/event-position-repository-test.php: 0ms (2 facts)
[ParserWorker] Total parse operation for integration-tests/repositories/event-position-repository-test.php: 3ms
[ParserWorker] parser.parse() for integration-tests/repositories/event-position-assign-repository-test.php: 3ms (9931 bytes)
[ParserWorker] extractSymbols completed for integration-tests/repositories/event-position-assign-repository-test.php: 10 symbols in 2ms (2549 iterations)
[ParserWorker] extractSymbols for integration-tests/repositories/event-position-assign-repository-test.php: 5ms (10 symbols)
[ParserWorker] extractCstFacts for integration-tests/repositories/event-position-assign-repository-test.php: 0ms (2 facts)
[ParserWorker] Total parse operation for integration-tests/repositories/event-position-assign-repository-test.php: 8ms
[ParserWorker] parser.parse() for integration-tests/repositories/event-log-repository-test.php: 1ms (5710 bytes)
[ParserWorker] extractSymbols completed for integration-tests/repositories/event-log-repository-test.php: 11 symbols in 2ms (1501 iterations)
[ParserWorker] extractSymbols for integration-tests/repositories/event-log-repository-test.php: 3ms (11 symbols)
[ParserWorker] extractCstFacts for integration-tests/repositories/event-log-repository-test.php: 0ms (2 facts)
[ParserWorker] Total parse operation for integration-tests/repositories/event-log-repository-test.php: 4ms
[ParserWorker] parser.parse() for integration-tests/repositories/email-queue-repository-test.php: 3ms (9337 bytes)
[ParserWorker] extractSymbols completed for integration-tests/repositories/email-queue-repository-test.php: 11 symbols in 3ms (2588 iterations)
[ParserWorker] extractSymbols for integration-tests/repositories/email-queue-repository-test.php: 4ms (11 symbols)
[ParserWorker] extractCstFacts for integration-tests/repositories/email-queue-repository-test.php: 0ms (2 facts)
[ParserWorker] Total parse operation for integration-tests/repositories/email-queue-repository-test.php: 7ms
[ParserWorker] parser.parse() for integration-tests/repositories/client-repository-test.php: 2ms (6896 bytes)
[ParserWorker] extractSymbols completed for integration-tests/repositories/client-repository-test.php: 11 symbols in 2ms (2073 iterations)
[ParserWorker] extractSymbols for integration-tests/repositories/client-repository-test.php: 2ms (11 symbols)
[ParserWorker] extractCstFacts for integration-tests/repositories/client-repository-test.php: 0ms (2 facts)
[ParserWorker] Total parse operation for integration-tests/repositories/client-repository-test.php: 4ms
[ParserWorker] parser.parse() for integration-tests/repositories/apply-staff-event-repository-test.php: 2ms (9660 bytes)
[ParserWorker] extractSymbols completed for integration-tests/repositories/apply-staff-event-repository-test.php: 11 symbols in 3ms (2518 iterations)
[ParserWorker] extractSymbols for integration-tests/repositories/apply-staff-event-repository-test.php: 3ms (11 symbols)
[ParserWorker] extractCstFacts for integration-tests/repositories/apply-staff-event-repository-test.php: 0ms (2 facts)
[ParserWorker] Total parse operation for integration-tests/repositories/apply-staff-event-repository-test.php: 8ms
[ParserWorker] parser.parse() for integration-tests/permissions/permission-system-test.php: 2ms (8389 bytes)
[ParserWorker] extractSymbols completed for integration-tests/permissions/permission-system-test.php: 10 symbols in 2ms (2289 iterations)
[ParserWorker] extractSymbols for integration-tests/permissions/permission-system-test.php: 6ms (10 symbols)
[ParserWorker] extractCstFacts for integration-tests/permissions/permission-system-test.php: 0ms (2 facts)
[ParserWorker] Total parse operation for integration-tests/permissions/permission-system-test.php: 8ms
[ParserWorker] parser.parse() for integration-tests/models/incentive-model-test.php: 2ms (10642 bytes)
[ParserWorker] extractSymbols completed for integration-tests/models/incentive-model-test.php: 11 symbols in 3ms (2976 iterations)
[ParserWorker] extractSymbols for integration-tests/models/incentive-model-test.php: 3ms (11 symbols)
[ParserWorker] extractCstFacts for integration-tests/models/incentive-model-test.php: 1ms (2 facts)
[ParserWorker] Total parse operation for integration-tests/models/incentive-model-test.php: 6ms
[ParserWorker] parser.parse() for integration-tests/models/event-position-model-test.php: 2ms (8652 bytes)
[ParserWorker] extractSymbols completed for integration-tests/models/event-position-model-test.php: 10 symbols in 2ms (2272 iterations)
[ParserWorker] extractSymbols for integration-tests/models/event-position-model-test.php: 3ms (10 symbols)
[ParserWorker] extractCstFacts for integration-tests/models/event-position-model-test.php: 0ms (2 facts)
[ParserWorker] Total parse operation for integration-tests/models/event-position-model-test.php: 7ms
[ParserWorker] parser.parse() for integration-tests/models/apply-staff-event-model-test.php: 4ms (11385 bytes)
[ParserWorker] extractSymbols completed for integration-tests/models/apply-staff-event-model-test.php: 11 symbols in 4ms (3089 iterations)
[ParserWorker] extractSymbols for integration-tests/models/apply-staff-event-model-test.php: 5ms (11 symbols)
[ParserWorker] extractCstFacts for integration-tests/models/apply-staff-event-model-test.php: 0ms (2 facts)
[ParserWorker] Total parse operation for integration-tests/models/apply-staff-event-model-test.php: 9ms
[ParserWorker] parser.parse() for integration-tests/models/admin-action-model-test.php: 2ms (9828 bytes)
[ParserWorker] extractSymbols completed for integration-tests/models/admin-action-model-test.php: 12 symbols in 3ms (2661 iterations)
[ParserWorker] extractSymbols for integration-tests/models/admin-action-model-test.php: 3ms (12 symbols)
[ParserWorker] extractCstFacts for integration-tests/models/admin-action-model-test.php: 0ms (2 facts)
[ParserWorker] Total parse operation for integration-tests/models/admin-action-model-test.php: 5ms
[ParserWorker] parser.parse() for integration-tests/livebind/livebind-integration-test.php: 5ms (17700 bytes)
[ParserWorker] extractSymbols completed for integration-tests/livebind/livebind-integration-test.php: 16 symbols in 5ms (5170 iterations)
[ParserWorker] extractSymbols for integration-tests/livebind/livebind-integration-test.php: 5ms (16 symbols)
[ParserWorker] extractCstFacts for integration-tests/livebind/livebind-integration-test.php: 0ms (2 facts)
[ParserWorker] Total parse operation for integration-tests/livebind/livebind-integration-test.php: 10ms
[ParserWorker] parser.parse() for integration-tests/livebind/livebind-frontend-test.php: 3ms (11559 bytes)
[ParserWorker] extractSymbols completed for integration-tests/livebind/livebind-frontend-test.php: 11 symbols in 5ms (2833 iterations)
[ParserWorker] extractSymbols for integration-tests/livebind/livebind-frontend-test.php: 5ms (11 symbols)
[ParserWorker] extractCstFacts for integration-tests/livebind/livebind-frontend-test.php: 0ms (2 facts)
[ParserWorker] Total parse operation for integration-tests/livebind/livebind-frontend-test.php: 8ms
[ParserWorker] parser.parse() for integration-tests/helpers/view-helper-test.php: 2ms (8625 bytes)
[ParserWorker] extractSymbols completed for integration-tests/helpers/view-helper-test.php: 9 symbols in 2ms (2110 iterations)
[ParserWorker] extractSymbols for integration-tests/helpers/view-helper-test.php: 4ms (9 symbols)
[ParserWorker] extractCstFacts for integration-tests/helpers/view-helper-test.php: 0ms (2 facts)
[ParserWorker] Total parse operation for integration-tests/helpers/view-helper-test.php: 6ms
[ParserWorker] parser.parse() for integration-tests/helpers/session-helper-test.php: 2ms (9990 bytes)
[ParserWorker] extractSymbols completed for integration-tests/helpers/session-helper-test.php: 10 symbols in 3ms (2704 iterations)
[ParserWorker] extractSymbols for integration-tests/helpers/session-helper-test.php: 3ms (10 symbols)
[ParserWorker] extractCstFacts for integration-tests/helpers/session-helper-test.php: 0ms (4 facts)
[ParserWorker] Total parse operation for integration-tests/helpers/session-helper-test.php: 5ms
[ParserWorker] parser.parse() for integration-tests/helpers/request-helper-test.php: 2ms (8856 bytes)
[ParserWorker] extractSymbols completed for integration-tests/helpers/request-helper-test.php: 10 symbols in 2ms (2673 iterations)
[ParserWorker] extractSymbols for integration-tests/helpers/request-helper-test.php: 2ms (10 symbols)
[ParserWorker] extractCstFacts for integration-tests/helpers/request-helper-test.php: 1ms (3 facts)
[ParserWorker] Total parse operation for integration-tests/helpers/request-helper-test.php: 8ms
[ParserWorker] parser.parse() for resources/css/filepond.css: 3ms (7170 bytes)
[ParserWorker] extractCstFacts for resources/css/filepond.css: 1ms (27 facts)
[ParserWorker] Total parse operation for resources/css/filepond.css: 4ms
[ParserWorker] extractCstFacts for notes/routing-conventions.md: 0ms (0 facts)
[ParserWorker] Total parse operation for notes/routing-conventions.md: 3ms
[ParserWorker] parser.parse() for notes/reoganize-plan.md: 9ms (21387 bytes)
[ParserWorker] parser.parse() for resources/css/components/utilities.css: 3ms (20487 bytes)
[ParserWorker] extractCstFacts for notes/reoganize-plan.md: 0ms (0 facts)
[ParserWorker] Total parse operation for notes/reoganize-plan.md: 9ms
[ParserWorker] parser.parse() for notes/refactor-skeleton.md: 9ms (23048 bytes)
[ParserWorker] extractCstFacts for notes/refactor-skeleton.md: 0ms (0 facts)
[ParserWorker] Total parse operation for notes/refactor-skeleton.md: 10ms
[ParserWorker] parser.parse() for notes/database-tables.md: 4ms (8774 bytes)
[ParserWorker] extractCstFacts for notes/database-tables.md: 1ms (0 facts)
[ParserWorker] Total parse operation for notes/database-tables.md: 5ms
[ParserWorker] parser.parse() for notes/SESSION_SUMMARY_EMAIL_SMS.md: 3ms (7230 bytes)
[ParserWorker] extractCstFacts for notes/SESSION_SUMMARY_EMAIL_SMS.md: 0ms (0 facts)
[ParserWorker] Total parse operation for notes/SESSION_SUMMARY_EMAIL_SMS.md: 3ms
[ParserWorker] parser.parse() for notes/REPOSITORY_PATTERN_CLEANUP_AUDIT.md: 9ms (21661 bytes)
[ParserWorker] extractCstFacts for notes/REPOSITORY_PATTERN_CLEANUP_AUDIT.md: 0ms (0 facts)
[ParserWorker] Total parse operation for notes/REPOSITORY_PATTERN_CLEANUP_AUDIT.md: 10ms
[ParserWorker] parser.parse() for notes/REFACTORING_ROADMAP.md: 10ms (24075 bytes)
[ParserWorker] extractCstFacts for notes/REFACTORING_ROADMAP.md: 0ms (0 facts)
[ParserWorker] Total parse operation for notes/REFACTORING_ROADMAP.md: 10ms
[ParserWorker] parser.parse() for notes/MIGRATION_COMPLETE.md: 2ms (4876 bytes)
[ParserWorker] extractCstFacts for notes/MIGRATION_COMPLETE.md: 0ms (0 facts)
[ParserWorker] Total parse operation for notes/MIGRATION_COMPLETE.md: 2ms
[ParserWorker] parser.parse() for notes/LARAVEL_ROUTING_CONTROLLER_GUIDE.md: 3ms (5772 bytes)
[ParserWorker] extractCstFacts for notes/LARAVEL_ROUTING_CONTROLLER_GUIDE.md: 0ms (0 facts)
[ParserWorker] Total parse operation for notes/LARAVEL_ROUTING_CONTROLLER_GUIDE.md: 4ms
[ParserWorker] parser.parse() for notes/LARAVEL_CONVENIENCES_NOT_USED.md: 12ms (21698 bytes)
[ParserWorker] extractCstFacts for notes/LARAVEL_CONVENIENCES_NOT_USED.md: 0ms (0 facts)
[ParserWorker] Total parse operation for notes/LARAVEL_CONVENIENCES_NOT_USED.md: 12ms
[ParserWorker] parser.parse() for notes/ENUM_USAGE_AUDIT.md: 10ms (18609 bytes)
[ParserWorker] extractCstFacts for notes/ENUM_USAGE_AUDIT.md: 0ms (0 facts)
[ParserWorker] Total parse operation for notes/ENUM_USAGE_AUDIT.md: 10ms
[ParserWorker] parser.parse() for notes/ELOQUENT_MVC_BEST_PRACTICES.md: 20ms (41595 bytes)
[ParserWorker] extractCstFacts for notes/ELOQUENT_MVC_BEST_PRACTICES.md: 0ms (0 facts)
[ParserWorker] Total parse operation for notes/ELOQUENT_MVC_BEST_PRACTICES.md: 20ms
[ParserWorker] parser.parse() for integration-tests/validation/client-validation-test.php: 2ms (8024 bytes)
[ParserWorker] extractSymbols completed for integration-tests/validation/client-validation-test.php: 12 symbols in 4ms (1924 iterations)
[ParserWorker] extractSymbols for integration-tests/validation/client-validation-test.php: 5ms (12 symbols)
[ParserWorker] extractCstFacts for integration-tests/validation/client-validation-test.php: 0ms (2 facts)
[ParserWorker] Total parse operation for integration-tests/validation/client-validation-test.php: 7ms
[ParserWorker] parser.parse() for integration-tests/unpoly/unpoly-integration-test.php: 2ms (7110 bytes)
[ParserWorker] extractSymbols completed for integration-tests/unpoly/unpoly-integration-test.php: 10 symbols in 2ms (1866 iterations)
[ParserWorker] extractSymbols for integration-tests/unpoly/unpoly-integration-test.php: 2ms (10 symbols)
[ParserWorker] extractCstFacts for integration-tests/unpoly/unpoly-integration-test.php: 0ms (2 facts)
[ParserWorker] Total parse operation for integration-tests/unpoly/unpoly-integration-test.php: 4ms
[ParserWorker] parser.parse() for integration-tests/services/user-service-test.php: 6ms (25770 bytes)
[ParserWorker] extractSymbols completed for integration-tests/services/user-service-test.php: 18 symbols in 8ms (7046 iterations)
[ParserWorker] extractSymbols for integration-tests/services/user-service-test.php: 9ms (18 symbols)
[ParserWorker] extractCstFacts for integration-tests/services/user-service-test.php: 0ms (2 facts)
[ParserWorker] Total parse operation for integration-tests/services/user-service-test.php: 15ms
[ParserWorker] parser.parse() for integration-tests/services/role-service-test.php: 5ms (19763 bytes)
[ParserWorker] extractSymbols completed for integration-tests/services/role-service-test.php: 16 symbols in 5ms (5362 iterations)
[ParserWorker] extractSymbols for integration-tests/services/role-service-test.php: 5ms (16 symbols)
[ParserWorker] extractCstFacts for integration-tests/services/role-service-test.php: 1ms (2 facts)
[ParserWorker] Total parse operation for integration-tests/services/role-service-test.php: 11ms
[ParserWorker] parser.parse() for integration-tests/services/positions-service-test.php: 6ms (22603 bytes)
[ParserWorker] extractSymbols completed for integration-tests/services/positions-service-test.php: 15 symbols in 7ms (6395 iterations)
[ParserWorker] extractSymbols for integration-tests/services/positions-service-test.php: 7ms (15 symbols)
[ParserWorker] extractCstFacts for integration-tests/services/positions-service-test.php: 0ms (2 facts)
[ParserWorker] Total parse operation for integration-tests/services/positions-service-test.php: 18ms
[ParserWorker] parser.parse() for integration-tests/services/notification-service-test.php: 2ms (6616 bytes)
[ParserWorker] extractSymbols completed for integration-tests/services/notification-service-test.php: 7 symbols in 2ms (1664 iterations)
[ParserWorker] extractSymbols for integration-tests/services/notification-service-test.php: 2ms (7 symbols)
[ParserWorker] extractCstFacts for integration-tests/services/notification-service-test.php: 0ms (2 facts)
[ParserWorker] Total parse operation for integration-tests/services/notification-service-test.php: 4ms
[ParserWorker] parser.parse() for integration-tests/services/event-service-test.php: 7ms (26644 bytes)
[ParserWorker] extractCstFacts for resources/css/components/utilities.css: 9ms (318 facts)
[ParserWorker] Total parse operation for resources/css/components/utilities.css: 13ms
[ParserWorker] extractSymbols completed for integration-tests/services/event-service-test.php: 18 symbols in 13ms (7823 iterations)
[ParserWorker] extractSymbols for integration-tests/services/event-service-test.php: 14ms (18 symbols)
[ParserWorker] extractCstFacts for integration-tests/services/event-service-test.php: 0ms (2 facts)
[ParserWorker] Total parse operation for integration-tests/services/event-service-test.php: 22ms
[ParserWorker] parser.parse() for integration-tests/services/event-read-service-test.php: 6ms (27008 bytes)
[ParserWorker] extractSymbols completed for integration-tests/services/event-read-service-test.php: 20 symbols in 9ms (7639 iterations)
[ParserWorker] extractSymbols for integration-tests/services/event-read-service-test.php: 11ms (20 symbols)
[ParserWorker] extractCstFacts for integration-tests/services/event-read-service-test.php: 0ms (2 facts)
[ParserWorker] Total parse operation for integration-tests/services/event-read-service-test.php: 19ms
[ParserWorker] parser.parse() for integration-tests/services/event-assignment-service-test.php: 6ms (28556 bytes)
[ParserWorker] extractSymbols completed for integration-tests/services/event-assignment-service-test.php: 15 symbols in 8ms (8154 iterations)
[ParserWorker] extractSymbols for integration-tests/services/event-assignment-service-test.php: 8ms (15 symbols)
[ParserWorker] extractCstFacts for integration-tests/services/event-assignment-service-test.php: 0ms (2 facts)
[ParserWorker] Total parse operation for integration-tests/services/event-assignment-service-test.php: 17ms
[ParserWorker] parser.parse() for integration-tests/services/email-service-test.php: 3ms (10612 bytes)
[ParserWorker] extractSymbols completed for integration-tests/services/email-service-test.php: 9 symbols in 3ms (3077 iterations)
[ParserWorker] extractSymbols for integration-tests/services/email-service-test.php: 3ms (9 symbols)
[ParserWorker] parser.parse() for resources/css/components/typography.css: 1ms (2260 bytes)
[ParserWorker] extractCstFacts for resources/css/components/typography.css: 0ms (26 facts)
[ParserWorker] Total parse operation for resources/css/components/typography.css: 1ms
[ParserWorker] parser.parse() for resources/css/components/tables.css: 1ms (5549 bytes)
[ParserWorker] extractCstFacts for integration-tests/services/email-service-test.php: 1ms (2 facts)
[ParserWorker] Total parse operation for integration-tests/services/email-service-test.php: 7ms
[ParserWorker] parser.parse() for integration-tests/services/communication-service-test.php: 3ms (10386 bytes)
[ParserWorker] extractSymbols completed for integration-tests/services/communication-service-test.php: 12 symbols in 3ms (2852 iterations)
[ParserWorker] extractSymbols for integration-tests/services/communication-service-test.php: 3ms (12 symbols)
[ParserWorker] extractCstFacts for resources/css/components/tables.css: 1ms (18 facts)
[ParserWorker] Total parse operation for resources/css/components/tables.css: 2ms
[ParserWorker] extractCstFacts for integration-tests/services/communication-service-test.php: 0ms (2 facts)
[ParserWorker] Total parse operation for integration-tests/services/communication-service-test.php: 8ms
[ParserWorker] parser.parse() for integration-tests/services/client-service-test.php: 4ms (16535 bytes)
[ParserWorker] extractSymbols completed for integration-tests/services/client-service-test.php: 13 symbols in 5ms (4485 iterations)
[ParserWorker] extractSymbols for integration-tests/services/client-service-test.php: 6ms (13 symbols)
[ParserWorker] extractCstFacts for integration-tests/services/client-service-test.php: 0ms (2 facts)
[ParserWorker] Total parse operation for integration-tests/services/client-service-test.php: 10ms
[ParserWorker] parser.parse() for integration-tests/run-all-tests.php: 2ms (5027 bytes)
[ParserWorker] parser.parse() for resources/css/components/sticky-footer.css: 1ms (4735 bytes)
[ParserWorker] extractCstFacts for resources/css/components/sticky-footer.css: 0ms (9 facts)
[ParserWorker] Total parse operation for resources/css/components/sticky-footer.css: 1ms
[ParserWorker] extractSymbols completed for integration-tests/run-all-tests.php: 0 symbols in 2ms (1611 iterations)
[ParserWorker] extractSymbols for integration-tests/run-all-tests.php: 2ms (0 symbols)
[ParserWorker] extractCstFacts for integration-tests/run-all-tests.php: 4ms (13 facts)
[ParserWorker] Total parse operation for integration-tests/run-all-tests.php: 8ms
[ParserWorker] parser.parse() for integration-tests/repositories/user-repository-test.php: 3ms (12659 bytes)
[ParserWorker] extractSymbols completed for integration-tests/repositories/user-repository-test.php: 11 symbols in 4ms (3558 iterations)
[ParserWorker] extractSymbols for integration-tests/repositories/user-repository-test.php: 7ms (11 symbols)
[ParserWorker] extractCstFacts for integration-tests/repositories/user-repository-test.php: 0ms (2 facts)
[ParserWorker] parser.parse() for resources/css/components/modals.css: 1ms (5217 bytes)
[ParserWorker] Total parse operation for integration-tests/repositories/user-repository-test.php: 11ms
[ParserWorker] parser.parse() for integration-tests/repositories/user-repository-comprehensive-test.php: 3ms (14944 bytes)
[ParserWorker] extractSymbols completed for integration-tests/repositories/user-repository-comprehensive-test.php: 10 symbols in 3ms (3918 iterations)
[ParserWorker] extractSymbols for integration-tests/repositories/user-repository-comprehensive-test.php: 5ms (10 symbols)
[ParserWorker] extractCstFacts for integration-tests/repositories/user-repository-comprehensive-test.php: 0ms (2 facts)
[ParserWorker] Total parse operation for integration-tests/repositories/user-repository-comprehensive-test.php: 10ms
[ParserWorker] parser.parse() for integration-tests/repositories/special-day-repository-test.php: 1ms (4992 bytes)
[ParserWorker] extractCstFacts for resources/css/components/modals.css: 1ms (25 facts)
[ParserWorker] Total parse operation for resources/css/components/modals.css: 2ms
[ParserWorker] parser.parse() for resources/css/components/layout.css: 0ms (2110 bytes)
[ParserWorker] extractCstFacts for resources/css/components/layout.css: 0ms (18 facts)
[ParserWorker] Total parse operation for resources/css/components/layout.css: 1ms
[ParserWorker] extractSymbols completed for integration-tests/repositories/special-day-repository-test.php: 13 symbols in 1ms (1344 iterations)
[ParserWorker] extractSymbols for integration-tests/repositories/special-day-repository-test.php: 1ms (13 symbols)
[ParserWorker] extractCstFacts for integration-tests/repositories/special-day-repository-test.php: 0ms (2 facts)
[ParserWorker] Total parse operation for integration-tests/repositories/special-day-repository-test.php: 3ms
[ParserWorker] parser.parse() for integration-tests/repositories/role-repository-test.php: 1ms (4455 bytes)
[ParserWorker] extractSymbols completed for integration-tests/repositories/role-repository-test.php: 13 symbols in 2ms (1264 iterations)
[ParserWorker] extractSymbols for integration-tests/repositories/role-repository-test.php: 2ms (13 symbols)
[ParserWorker] extractCstFacts for integration-tests/repositories/role-repository-test.php: 0ms (2 facts)
[ParserWorker] Total parse operation for integration-tests/repositories/role-repository-test.php: 3ms
[ParserWorker] parser.parse() for resources/css/components/forms.css: 0ms (1409 bytes)
[ParserWorker] extractCstFacts for resources/css/components/forms.css: 0ms (7 facts)
[ParserWorker] Total parse operation for resources/css/components/forms.css: 0ms
[ParserWorker] parser.parse() for integration-tests/repositories/report-repository-test.php: 2ms (9422 bytes)
[ParserWorker] extractSymbols completed for integration-tests/repositories/report-repository-test.php: 11 symbols in 3ms (2675 iterations)
[ParserWorker] extractSymbols for integration-tests/repositories/report-repository-test.php: 3ms (11 symbols)
[ParserWorker] extractCstFacts for integration-tests/repositories/report-repository-test.php: 0ms (2 facts)
[ParserWorker] Total parse operation for integration-tests/repositories/report-repository-test.php: 7ms
[ParserWorker] parser.parse() for integration-tests/repositories/permission-repository-test.php: 2ms (5950 bytes)
[ParserWorker] extractSymbols completed for integration-tests/repositories/permission-repository-test.php: 13 symbols in 2ms (1591 iterations)
[ParserWorker] extractSymbols for integration-tests/repositories/permission-repository-test.php: 2ms (13 symbols)
[ParserWorker] extractCstFacts for integration-tests/repositories/permission-repository-test.php: 0ms (2 facts)
[ParserWorker] Total parse operation for integration-tests/repositories/permission-repository-test.php: 4ms
[ParserWorker] parser.parse() for integration-tests/repositories/incentive-repository-test.php: 2ms (9858 bytes)
[ParserWorker] extractSymbols completed for integration-tests/repositories/incentive-repository-test.php: 11 symbols in 2ms (2646 iterations)
[ParserWorker] extractSymbols for integration-tests/repositories/incentive-repository-test.php: 3ms (11 symbols)
[ParserWorker] extractCstFacts for integration-tests/repositories/incentive-repository-test.php: 0ms (2 facts)
[ParserWorker] Total parse operation for integration-tests/repositories/incentive-repository-test.php: 7ms
[ParserWorker] parser.parse() for integration-tests/repositories/event-repository-test.php: 3ms (10079 bytes)
[ParserWorker] extractSymbols completed for integration-tests/repositories/event-repository-test.php: 11 symbols in 2ms (2666 iterations)
[ParserWorker] extractSymbols for integration-tests/repositories/event-repository-test.php: 5ms (11 symbols)
[ParserWorker] extractCstFacts for integration-tests/repositories/event-repository-test.php: 0ms (2 facts)
[ParserWorker] Total parse operation for integration-tests/repositories/event-repository-test.php: 8ms
[ParserWorker] parser.parse() for integration-tests/repositories/event-repository-comprehensive-test.php: 4ms (14151 bytes)
[ParserWorker] extractSymbols completed for integration-tests/repositories/event-repository-comprehensive-test.php: 10 symbols in 4ms (3862 iterations)
[ParserWorker] extractSymbols for integration-tests/repositories/event-repository-comprehensive-test.php: 4ms (10 symbols)
[ParserWorker] extractCstFacts for integration-tests/repositories/event-repository-comprehensive-test.php: 0ms (2 facts)
[ParserWorker] Total parse operation for integration-tests/repositories/event-repository-comprehensive-test.php: 8ms
[ParserWorker] parser.parse() for integration-tests/repositories/event-position-repository-test.php: 1ms (5503 bytes)
[ParserWorker] extractSymbols completed for integration-tests/repositories/event-position-repository-test.php: 13 symbols in 2ms (1470 iterations)
[ParserWorker] extractSymbols for integration-tests/repositories/event-position-repository-test.php: 2ms (13 symbols)
[ParserWorker] extractCstFacts for integration-tests/repositories/event-position-repository-test.php: 0ms (2 facts)
[ParserWorker] Total parse operation for integration-tests/repositories/event-position-repository-test.php: 3ms
[ParserWorker] parser.parse() for integration-tests/repositories/event-position-assign-repository-test.php: 3ms (9931 bytes)
[ParserWorker] extractSymbols completed for integration-tests/repositories/event-position-assign-repository-test.php: 10 symbols in 2ms (2549 iterations)
[ParserWorker] parser.parse() for resources/css/components/field-formatter.css: 2ms (10641 bytes)
[ParserWorker] extractCstFacts for resources/css/components/field-formatter.css: 2ms (80 facts)
[ParserWorker] Total parse operation for resources/css/components/field-formatter.css: 4ms
[ParserWorker] parser.parse() for resources/css/components/buttons.css: 1ms (1731 bytes)
[ParserWorker] extractCstFacts for resources/css/components/buttons.css: 0ms (11 facts)
[ParserWorker] Total parse operation for resources/css/components/buttons.css: 1ms
[ParserWorker] extractSymbols for integration-tests/repositories/event-position-assign-repository-test.php: 5ms (10 symbols)
[ParserWorker] extractCstFacts for integration-tests/repositories/event-position-assign-repository-test.php: 0ms (2 facts)
[ParserWorker] Total parse operation for integration-tests/repositories/event-position-assign-repository-test.php: 8ms
[ParserWorker] parser.parse() for integration-tests/repositories/event-log-repository-test.php: 1ms (5710 bytes)
[ParserWorker] extractSymbols completed for integration-tests/repositories/event-log-repository-test.php: 11 symbols in 2ms (1501 iterations)
[ParserWorker] extractSymbols for integration-tests/repositories/event-log-repository-test.php: 3ms (11 symbols)
[ParserWorker] extractCstFacts for integration-tests/repositories/event-log-repository-test.php: 0ms (2 facts)
[ParserWorker] Total parse operation for integration-tests/repositories/event-log-repository-test.php: 4ms
[ParserWorker] parser.parse() for integration-tests/repositories/email-queue-repository-test.php: 3ms (9337 bytes)
[ParserWorker] extractSymbols completed for integration-tests/repositories/email-queue-repository-test.php: 11 symbols in 3ms (2588 iterations)
[ParserWorker] parser.parse() for resources/css/components/badges.css: 0ms (477 bytes)
[ParserWorker] extractCstFacts for resources/css/components/badges.css: 0ms (2 facts)
[ParserWorker] Total parse operation for resources/css/components/badges.css: 0ms
[ParserWorker] parser.parse() for resources/css/components/action-links.css: 0ms (751 bytes)
[ParserWorker] extractCstFacts for resources/css/components/action-links.css: 0ms (5 facts)
[ParserWorker] Total parse operation for resources/css/components/action-links.css: 1ms
[ParserWorker] extractSymbols for integration-tests/repositories/email-queue-repository-test.php: 4ms (11 symbols)
[ParserWorker] extractCstFacts for integration-tests/repositories/email-queue-repository-test.php: 0ms (2 facts)
[ParserWorker] Total parse operation for integration-tests/repositories/email-queue-repository-test.php: 7ms
[ParserWorker] parser.parse() for integration-tests/repositories/client-repository-test.php: 2ms (6896 bytes)
[ParserWorker] extractSymbols completed for integration-tests/repositories/client-repository-test.php: 11 symbols in 2ms (2073 iterations)
[ParserWorker] extractSymbols for integration-tests/repositories/client-repository-test.php: 2ms (11 symbols)
[ParserWorker] extractCstFacts for integration-tests/repositories/client-repository-test.php: 0ms (2 facts)
[ParserWorker] Total parse operation for integration-tests/repositories/client-repository-test.php: 4ms
[ParserWorker] parser.parse() for integration-tests/repositories/apply-staff-event-repository-test.php: 2ms (9660 bytes)
[ParserWorker] extractSymbols completed for integration-tests/repositories/apply-staff-event-repository-test.php: 11 symbols in 3ms (2518 iterations)
[ParserWorker] extractSymbols for integration-tests/repositories/apply-staff-event-repository-test.php: 3ms (11 symbols)
[ParserWorker] extractCstFacts for integration-tests/repositories/apply-staff-event-repository-test.php: 0ms (2 facts)
[ParserWorker] Total parse operation for integration-tests/repositories/apply-staff-event-repository-test.php: 8ms
[ParserWorker] parser.parse() for integration-tests/permissions/permission-system-test.php: 2ms (8389 bytes)
[ParserWorker] extractSymbols completed for integration-tests/permissions/permission-system-test.php: 10 symbols in 2ms (2289 iterations)
[ParserWorker] extractSymbols for integration-tests/permissions/permission-system-test.php: 6ms (10 symbols)
[ParserWorker] extractCstFacts for integration-tests/permissions/permission-system-test.php: 0ms (2 facts)
[ParserWorker] Total parse operation for integration-tests/permissions/permission-system-test.php: 8ms
[ParserWorker] parser.parse() for integration-tests/models/incentive-model-test.php: 2ms (10642 bytes)
[ParserWorker] extractSymbols completed for integration-tests/models/incentive-model-test.php: 11 symbols in 3ms (2976 iterations)
[ParserWorker] extractSymbols for integration-tests/models/incentive-model-test.php: 3ms (11 symbols)
[ParserWorker] extractCstFacts for integration-tests/models/incentive-model-test.php: 1ms (2 facts)
[ParserWorker] Total parse operation for integration-tests/models/incentive-model-test.php: 6ms
[ParserWorker] parser.parse() for resources/css/base.css: 1ms (5780 bytes)
[ParserWorker] extractCstFacts for resources/css/base.css: 0ms (23 facts)
[ParserWorker] Total parse operation for resources/css/base.css: 1ms
[ParserWorker] parser.parse() for resources/css/app.css: 0ms (2390 bytes)
[ParserWorker] extractCstFacts for resources/css/app.css: 1ms (0 facts)
[ParserWorker] Total parse operation for resources/css/app.css: 1ms
[ParserWorker] parser.parse() for resources/css/animations.css: 0ms (600 bytes)
[ParserWorker] extractCstFacts for resources/css/animations.css: 0ms (1 facts)
[ParserWorker] Total parse operation for resources/css/animations.css: 1ms
[ParserWorker] parser.parse() for rector.php: 0ms (593 bytes)
[ParserWorker] extractSymbols completed for rector.php: 0 symbols in 0ms (183 iterations)
[ParserWorker] extractSymbols for rector.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for rector.php: 1ms (0 facts)
[ParserWorker] Total parse operation for rector.php: 1ms
[ParserWorker] parser.parse() for postcss.config.js: 0ms (456 bytes)
[ParserWorker] parser.parse() for integration-tests/models/event-position-model-test.php: 2ms (8652 bytes)
[ParserWorker] extractSymbols completed for integration-tests/models/event-position-model-test.php: 10 symbols in 2ms (2272 iterations)
[ParserWorker] extractSymbols for integration-tests/models/event-position-model-test.php: 3ms (10 symbols)
[ParserWorker] extractCstFacts for integration-tests/models/event-position-model-test.php: 0ms (2 facts)
[ParserWorker] Total parse operation for integration-tests/models/event-position-model-test.php: 7ms
[ParserWorker] parser.parse() for integration-tests/models/apply-staff-event-model-test.php: 4ms (11385 bytes)
[ParserWorker] extractSymbols completed for integration-tests/models/apply-staff-event-model-test.php: 11 symbols in 4ms (3089 iterations)
[ParserWorker] extractSymbols for integration-tests/models/apply-staff-event-model-test.php: 5ms (11 symbols)
[ParserWorker] extractCstFacts for integration-tests/models/apply-staff-event-model-test.php: 0ms (2 facts)
[ParserWorker] Total parse operation for integration-tests/models/apply-staff-event-model-test.php: 9ms
[ParserWorker] parser.parse() for integration-tests/models/admin-action-model-test.php: 2ms (9828 bytes)
[ParserWorker] extractSymbols completed for integration-tests/models/admin-action-model-test.php: 12 symbols in 3ms (2661 iterations)
[ParserWorker] extractSymbols completed for postcss.config.js: 0 symbols in 0ms (86 iterations)
[ParserWorker] extractSymbols for postcss.config.js: 0ms (0 symbols)
[ParserWorker] extractCstFacts for postcss.config.js: 0ms (0 facts)
[ParserWorker] Total parse operation for postcss.config.js: 0ms
[ParserWorker] parser.parse() for package.json: 0ms (1296 bytes)
[ParserWorker] extractCstFacts for package.json: 1ms (3 facts)
[ParserWorker] Total parse operation for package.json: 1ms
[ParserWorker] extractSymbols for integration-tests/models/admin-action-model-test.php: 3ms (12 symbols)
[ParserWorker] extractCstFacts for integration-tests/models/admin-action-model-test.php: 0ms (2 facts)
[ParserWorker] Total parse operation for integration-tests/models/admin-action-model-test.php: 5ms
[ParserWorker] parser.parse() for integration-tests/livebind/livebind-integration-test.php: 5ms (17700 bytes)
[ParserWorker] extractSymbols completed for integration-tests/livebind/livebind-integration-test.php: 16 symbols in 5ms (5170 iterations)
[ParserWorker] extractSymbols for integration-tests/livebind/livebind-integration-test.php: 5ms (16 symbols)
[ParserWorker] extractCstFacts for integration-tests/livebind/livebind-integration-test.php: 0ms (2 facts)
[ParserWorker] Total parse operation for integration-tests/livebind/livebind-integration-test.php: 10ms
[ParserWorker] parser.parse() for integration-tests/livebind/livebind-frontend-test.php: 3ms (11559 bytes)
[ParserWorker] extractSymbols completed for integration-tests/livebind/livebind-frontend-test.php: 11 symbols in 5ms (2833 iterations)
[ParserWorker] extractSymbols for integration-tests/livebind/livebind-frontend-test.php: 5ms (11 symbols)
[ParserWorker] extractCstFacts for integration-tests/livebind/livebind-frontend-test.php: 0ms (2 facts)
[ParserWorker] Total parse operation for integration-tests/livebind/livebind-frontend-test.php: 8ms
[ParserWorker] parser.parse() for integration-tests/helpers/view-helper-test.php: 2ms (8625 bytes)
[ParserWorker] extractSymbols completed for integration-tests/helpers/view-helper-test.php: 9 symbols in 2ms (2110 iterations)
[ParserWorker] extractSymbols for integration-tests/helpers/view-helper-test.php: 4ms (9 symbols)
[ParserWorker] extractCstFacts for integration-tests/helpers/view-helper-test.php: 0ms (2 facts)
[ParserWorker] Total parse operation for integration-tests/helpers/view-helper-test.php: 6ms
[ParserWorker] parser.parse() for integration-tests/helpers/session-helper-test.php: 2ms (9990 bytes)
[ParserWorker] extractSymbols completed for integration-tests/helpers/session-helper-test.php: 10 symbols in 3ms (2704 iterations)
[ParserWorker] extractSymbols for integration-tests/helpers/session-helper-test.php: 3ms (10 symbols)
[ParserWorker] extractCstFacts for integration-tests/helpers/session-helper-test.php: 0ms (4 facts)
[ParserWorker] Total parse operation for integration-tests/helpers/session-helper-test.php: 5ms
[ParserWorker] parser.parse() for integration-tests/helpers/request-helper-test.php: 2ms (8856 bytes)
[ParserWorker] extractSymbols completed for integration-tests/helpers/request-helper-test.php: 10 symbols in 2ms (2673 iterations)
[ParserWorker] extractSymbols for integration-tests/helpers/request-helper-test.php: 2ms (10 symbols)
[ParserWorker] extractCstFacts for integration-tests/helpers/request-helper-test.php: 1ms (3 facts)
[ParserWorker] Total parse operation for integration-tests/helpers/request-helper-test.php: 8ms
[ParserWorker] parser.parse() for package-lock.json: 59ms (419974 bytes)
[ParserWorker] extractCstFacts for package-lock.json: 30ms (4 facts)
[ParserWorker] Total parse operation for package-lock.json: 89ms
[ParserWorker] parser.parse() for notes/unpoly-usage-guide.md: 7ms (17782 bytes)
[ParserWorker] extractCstFacts for notes/unpoly-usage-guide.md: 0ms (0 facts)
[ParserWorker] Total parse operation for notes/unpoly-usage-guide.md: 8ms
[ParserWorker] parser.parse() for resources/templates/email-templates/client-event-details.blade.php: 0ms (5867 bytes)
[ParserWorker] extractSymbols completed for resources/templates/email-templates/client-event-details.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/templates/email-templates/client-event-details.blade.php: 1ms (0 symbols)
[ParserWorker] extractCstFacts for resources/templates/email-templates/client-event-details.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/templates/email-templates/client-event-details.blade.php: 1ms
[ParserWorker] parser.parse() for resources/templates/email-templates/approval-email.blade.php: 0ms (1271 bytes)
[ParserWorker] extractSymbols completed for resources/templates/email-templates/approval-email.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/templates/email-templates/approval-email.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/templates/email-templates/approval-email.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/templates/email-templates/approval-email.blade.php: 0ms
[ParserWorker] parser.parse() for resources/js/utils/Toast.js: 1ms (5822 bytes)
[ParserWorker] extractSymbols completed for resources/js/utils/Toast.js: 6 symbols in 1ms (913 iterations)
[ParserWorker] extractSymbols for resources/js/utils/Toast.js: 1ms (6 symbols)
[ParserWorker] extractCstFacts for resources/js/utils/Toast.js: 0ms (1 facts)
[ParserWorker] Total parse operation for resources/js/utils/Toast.js: 2ms
[ParserWorker] parser.parse() for resources/js/utils/TimePicker.js: 3ms (16630 bytes)
[ParserWorker] extractSymbols completed for resources/js/utils/TimePicker.js: 11 symbols in 4ms (3685 iterations)
[ParserWorker] extractSymbols for resources/js/utils/TimePicker.js: 4ms (11 symbols)
[ParserWorker] extractCstFacts for resources/js/utils/TimePicker.js: 0ms (1 facts)
[ParserWorker] Total parse operation for resources/js/utils/TimePicker.js: 7ms
[ParserWorker] parser.parse() for resources/js/utils/SortableList.js: 2ms (7385 bytes)
[ParserWorker] parser.parse() for resources/css/filepond.css: 3ms (7170 bytes)
[ParserWorker] extractCstFacts for resources/css/filepond.css: 1ms (27 facts)
[ParserWorker] Total parse operation for resources/css/filepond.css: 4ms
[ParserWorker] parser.parse() for resources/css/components/utilities.css: 3ms (20487 bytes)
[ParserWorker] extractCstFacts for resources/css/components/utilities.css: 9ms (318 facts)
[ParserWorker] Total parse operation for resources/css/components/utilities.css: 13ms
[ParserWorker] parser.parse() for resources/css/components/typography.css: 1ms (2260 bytes)
[ParserWorker] extractCstFacts for resources/css/components/typography.css: 0ms (26 facts)
[ParserWorker] Total parse operation for resources/css/components/typography.css: 1ms
[ParserWorker] parser.parse() for resources/css/components/tables.css: 1ms (5549 bytes)
[ParserWorker] extractCstFacts for resources/css/components/tables.css: 1ms (18 facts)
[ParserWorker] Total parse operation for resources/css/components/tables.css: 2ms
[ParserWorker] parser.parse() for resources/css/components/sticky-footer.css: 1ms (4735 bytes)
[ParserWorker] extractCstFacts for resources/css/components/sticky-footer.css: 0ms (9 facts)
[ParserWorker] Total parse operation for resources/css/components/sticky-footer.css: 1ms
[ParserWorker] extractSymbols completed for resources/js/utils/SortableList.js: 14 symbols in 2ms (1879 iterations)
[ParserWorker] extractSymbols for resources/js/utils/SortableList.js: 2ms (14 symbols)
[ParserWorker] extractCstFacts for resources/js/utils/SortableList.js: 0ms (1 facts)
[ParserWorker] Total parse operation for resources/js/utils/SortableList.js: 4ms
[ParserWorker] parser.parse() for resources/css/components/modals.css: 1ms (5217 bytes)
[ParserWorker] extractCstFacts for resources/css/components/modals.css: 1ms (25 facts)
[ParserWorker] Total parse operation for resources/css/components/modals.css: 2ms
[ParserWorker] parser.parse() for resources/css/components/layout.css: 0ms (2110 bytes)
[ParserWorker] extractCstFacts for resources/css/components/layout.css: 0ms (18 facts)
[ParserWorker] Total parse operation for resources/css/components/layout.css: 1ms
[ParserWorker] parser.parse() for resources/js/utils/Repeater.js: 1ms (3992 bytes)
[ParserWorker] parser.parse() for resources/css/components/forms.css: 0ms (1409 bytes)
[ParserWorker] extractCstFacts for resources/css/components/forms.css: 0ms (7 facts)
[ParserWorker] Total parse operation for resources/css/components/forms.css: 0ms
[ParserWorker] parser.parse() for resources/css/components/field-formatter.css: 2ms (10641 bytes)
[ParserWorker] extractCstFacts for resources/css/components/field-formatter.css: 2ms (80 facts)
[ParserWorker] Total parse operation for resources/css/components/field-formatter.css: 4ms
[ParserWorker] parser.parse() for resources/css/components/buttons.css: 1ms (1731 bytes)
[ParserWorker] extractCstFacts for resources/css/components/buttons.css: 0ms (11 facts)
[ParserWorker] extractSymbols completed for resources/js/utils/Repeater.js: 6 symbols in 1ms (895 iterations)
[ParserWorker] extractSymbols for resources/js/utils/Repeater.js: 1ms (6 symbols)
[ParserWorker] extractCstFacts for resources/js/utils/Repeater.js: 0ms (1 facts)
[ParserWorker] Total parse operation for resources/js/utils/Repeater.js: 3ms
[ParserWorker] Total parse operation for resources/css/components/buttons.css: 1ms
[ParserWorker] parser.parse() for resources/css/components/badges.css: 0ms (477 bytes)
[ParserWorker] extractCstFacts for resources/css/components/badges.css: 0ms (2 facts)
[ParserWorker] Total parse operation for resources/css/components/badges.css: 0ms
[ParserWorker] parser.parse() for resources/css/components/action-links.css: 0ms (751 bytes)
[ParserWorker] extractCstFacts for resources/css/components/action-links.css: 0ms (5 facts)
[ParserWorker] Total parse operation for resources/css/components/action-links.css: 1ms
[ParserWorker] parser.parse() for resources/css/base.css: 1ms (5780 bytes)
[ParserWorker] extractCstFacts for resources/css/base.css: 0ms (23 facts)
[ParserWorker] Total parse operation for resources/css/base.css: 1ms
[ParserWorker] parser.parse() for resources/css/app.css: 0ms (2390 bytes)
[ParserWorker] extractCstFacts for resources/css/app.css: 1ms (0 facts)
[ParserWorker] Total parse operation for resources/css/app.css: 1ms
[ParserWorker] parser.parse() for resources/css/animations.css: 0ms (600 bytes)
[ParserWorker] extractCstFacts for resources/css/animations.css: 0ms (1 facts)
[ParserWorker] Total parse operation for resources/css/animations.css: 1ms
[ParserWorker] parser.parse() for resources/js/utils/FormValidator.js: 1ms (5326 bytes)
[ParserWorker] parser.parse() for rector.php: 0ms (593 bytes)
[ParserWorker] extractSymbols completed for rector.php: 0 symbols in 0ms (183 iterations)
[ParserWorker] extractSymbols for rector.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for rector.php: 1ms (0 facts)
[ParserWorker] Total parse operation for rector.php: 1ms
[ParserWorker] extractSymbols completed for resources/js/utils/FormValidator.js: 6 symbols in 1ms (1234 iterations)
[ParserWorker] extractSymbols for resources/js/utils/FormValidator.js: 1ms (6 symbols)
[ParserWorker] extractCstFacts for resources/js/utils/FormValidator.js: 0ms (1 facts)
[ParserWorker] Total parse operation for resources/js/utils/FormValidator.js: 3ms
[ParserWorker] parser.parse() for postcss.config.js: 0ms (456 bytes)
[ParserWorker] extractSymbols completed for postcss.config.js: 0 symbols in 0ms (86 iterations)
[ParserWorker] extractSymbols for postcss.config.js: 0ms (0 symbols)
[ParserWorker] extractCstFacts for postcss.config.js: 0ms (0 facts)
[ParserWorker] Total parse operation for postcss.config.js: 0ms
[ParserWorker] parser.parse() for package.json: 0ms (1296 bytes)
[ParserWorker] extractCstFacts for package.json: 1ms (3 facts)
[ParserWorker] Total parse operation for package.json: 1ms
[ParserWorker] parser.parse() for package-lock.json: 59ms (419974 bytes)
[ParserWorker] extractCstFacts for package-lock.json: 30ms (4 facts)
[ParserWorker] Total parse operation for package-lock.json: 89ms
[ParserWorker] parser.parse() for notes/unpoly-usage-guide.md: 7ms (17782 bytes)
[ParserWorker] extractCstFacts for notes/unpoly-usage-guide.md: 0ms (0 facts)
[ParserWorker] Total parse operation for notes/unpoly-usage-guide.md: 8ms
[ParserWorker] parser.parse() for resources/js/utils/FieldFormatter.js: 8ms (40462 bytes)
[ParserWorker] extractSymbols completed for resources/js/utils/FieldFormatter.js: 35 symbols in 10ms (9021 iterations)
[ParserWorker] extractSymbols for resources/js/utils/FieldFormatter.js: 11ms (35 symbols)
[ParserWorker] extractCstFacts for resources/js/utils/FieldFormatter.js: 2ms (25 facts)
[ParserWorker] Total parse operation for resources/js/utils/FieldFormatter.js: 22ms
[ParserWorker] parser.parse() for resources/js/utils/BulkSelector.js: 0ms (3099 bytes)
[ParserWorker] extractSymbols completed for resources/js/utils/BulkSelector.js: 6 symbols in 1ms (547 iterations)
[ParserWorker] extractSymbols for resources/js/utils/BulkSelector.js: 1ms (6 symbols)
[ParserWorker] extractCstFacts for resources/js/utils/BulkSelector.js: 0ms (1 facts)
[ParserWorker] Total parse operation for resources/js/utils/BulkSelector.js: 1ms
[ParserWorker] parser.parse() for resources/js/unpoly.js: 108ms (438993 bytes)
[WARN] [ParserWorker] Reached symbol limit (1000) for resources/js/unpoly.js, stopping symbol extraction early. Found 1000 symbols in 88ms (74198 iterations). File may be minified/bundled.
[ParserWorker] extractSymbols for resources/js/unpoly.js: 88ms (0 symbols)
[ParserWorker] Total parse operation for resources/js/unpoly.js: 196ms
[WARN] [ParserWorker] Reached symbol limit (1000) for resources/js/unpoly.js, stopping symbol extraction early. Found 1000 symbols in 88ms (74198 iterations). File may be minified/bundled.
[ParserWorker] parser.parse() for resources/js/app.js: 7ms (37979 bytes)
[ParserWorker] extractSymbols completed for resources/js/app.js: 11 symbols in 10ms (8661 iterations)
[ParserWorker] extractSymbols for resources/js/app.js: 10ms (11 symbols)
[ParserWorker] extractCstFacts for resources/js/app.js: 2ms (96 facts)
[ParserWorker] Total parse operation for resources/js/app.js: 20ms
[ParserWorker] parser.parse() for resources/js/LiveBind/tsup.config.ts: 12ms (979 bytes)
[ParserWorker] extractSymbols completed for resources/js/LiveBind/tsup.config.ts: 0 symbols in 0ms (228 iterations)
[ParserWorker] extractSymbols for resources/js/LiveBind/tsup.config.ts: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/js/LiveBind/tsup.config.ts: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/js/LiveBind/tsup.config.ts: 12ms
[ParserWorker] parser.parse() for resources/js/LiveBind/tsconfig.json: 1ms (693 bytes)
[ParserWorker] extractCstFacts for resources/js/LiveBind/tsconfig.json: 0ms (3 facts)
[ParserWorker] Total parse operation for resources/js/LiveBind/tsconfig.json: 1ms
[ParserWorker] parser.parse() for resources/js/LiveBind/src/types.ts: 1ms (4425 bytes)
[ParserWorker] extractSymbols completed for resources/js/LiveBind/src/types.ts: 0 symbols in 1ms (1170 iterations)
[ParserWorker] extractSymbols for resources/js/LiveBind/src/types.ts: 1ms (0 symbols)
[ParserWorker] extractCstFacts for resources/js/LiveBind/src/types.ts: 1ms (13 facts)
[ParserWorker] Total parse operation for resources/js/LiveBind/src/types.ts: 3ms
[ParserWorker] parser.parse() for resources/js/LiveBind/src/plugins/polling.ts: 1ms (3965 bytes)
[ParserWorker] extractSymbols completed for resources/js/LiveBind/src/plugins/polling.ts: 4 symbols in 2ms (1170 iterations)
[ParserWorker] extractSymbols for resources/js/LiveBind/src/plugins/polling.ts: 2ms (4 symbols)
[ParserWorker] extractCstFacts for resources/js/LiveBind/src/plugins/polling.ts: 0ms (1 facts)
[ParserWorker] Total parse operation for resources/js/LiveBind/src/plugins/polling.ts: 5ms
[ParserWorker] parser.parse() for resources/js/LiveBind/src/plugins/navigation.ts: 2ms (5261 bytes)
[ParserWorker] extractSymbols completed for resources/js/LiveBind/src/plugins/navigation.ts: 4 symbols in 2ms (1654 iterations)
[ParserWorker] extractSymbols for resources/js/LiveBind/src/plugins/navigation.ts: 2ms (4 symbols)
[ParserWorker] extractCstFacts for resources/js/LiveBind/src/plugins/navigation.ts: 0ms (1 facts)
[ParserWorker] Total parse operation for resources/js/LiveBind/src/plugins/navigation.ts: 4ms
[ParserWorker] parser.parse() for resources/js/LiveBind/src/plugins/forms.ts: 5ms (18883 bytes)
[ParserWorker] extractSymbols completed for resources/js/LiveBind/src/plugins/forms.ts: 8 symbols in 7ms (5380 iterations)
[ParserWorker] extractSymbols for resources/js/LiveBind/src/plugins/forms.ts: 7ms (8 symbols)
[ParserWorker] extractCstFacts for resources/js/LiveBind/src/plugins/forms.ts: 0ms (6 facts)
[ParserWorker] Total parse operation for resources/js/LiveBind/src/plugins/forms.ts: 14ms
[ParserWorker] parser.parse() for resources/js/LiveBind/src/plugins/alpine.ts: 0ms (2644 bytes)
[ParserWorker] extractSymbols completed for resources/js/LiveBind/src/plugins/alpine.ts: 2 symbols in 3ms (769 iterations)
[ParserWorker] extractSymbols for resources/js/LiveBind/src/plugins/alpine.ts: 3ms (2 symbols)
[ParserWorker] extractCstFacts for resources/js/LiveBind/src/plugins/alpine.ts: 0ms (1 facts)
[ParserWorker] Total parse operation for resources/js/LiveBind/src/plugins/alpine.ts: 5ms
[ParserWorker] parser.parse() for resources/js/LiveBind/src/plugins/actions.ts: 3ms (12766 bytes)
[ParserWorker] extractSymbols completed for resources/js/LiveBind/src/plugins/actions.ts: 3 symbols in 5ms (3543 iterations)
[ParserWorker] extractSymbols for resources/js/LiveBind/src/plugins/actions.ts: 5ms (3 symbols)
[ParserWorker] extractCstFacts for resources/js/LiveBind/src/plugins/actions.ts: 2ms (3 facts)
[ParserWorker] Total parse operation for resources/js/LiveBind/src/plugins/actions.ts: 11ms
[ParserWorker] parser.parse() for resources/js/LiveBind/src/index.ts: 0ms (1317 bytes)
[ParserWorker] extractSymbols completed for resources/js/LiveBind/src/index.ts: 0 symbols in 0ms (171 iterations)
[ParserWorker] extractSymbols for resources/js/LiveBind/src/index.ts: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/js/LiveBind/src/index.ts: 0ms (5 facts)
[ParserWorker] Total parse operation for resources/js/LiveBind/src/index.ts: 1ms
[ParserWorker] parser.parse() for resources/js/LiveBind/src/core.ts: 3ms (11936 bytes)
[ParserWorker] extractSymbols completed for resources/js/LiveBind/src/core.ts: 12 symbols in 4ms (3403 iterations)
[ParserWorker] extractSymbols for resources/js/LiveBind/src/core.ts: 7ms (12 symbols)
[ParserWorker] extractCstFacts for resources/js/LiveBind/src/core.ts: 0ms (1 facts)
[ParserWorker] Total parse operation for resources/js/LiveBind/src/core.ts: 10ms
[ParserWorker] parser.parse() for resources/js/LiveBind/package.json: 1ms (2836 bytes)
[ParserWorker] extractCstFacts for resources/js/LiveBind/package.json: 0ms (17 facts)
[ParserWorker] Total parse operation for resources/js/LiveBind/package.json: 2ms
[ParserWorker] parser.parse() for resources/js/LiveBind/package-lock.json: 5ms (46370 bytes)
[ParserWorker] extractCstFacts for resources/js/LiveBind/package-lock.json: 4ms (5 facts)
[ParserWorker] Total parse operation for resources/js/LiveBind/package-lock.json: 9ms
[ParserWorker] parser.parse() for resources/js/LiveBind/README.md: 5ms (12187 bytes)
[ParserWorker] extractCstFacts for resources/js/LiveBind/README.md: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/js/LiveBind/README.md: 5ms
[ParserWorker] parser.parse() for resources/css/variables.css: 3ms (22739 bytes)
[ParserWorker] extractCstFacts for resources/css/variables.css: 2ms (7 facts)
[ParserWorker] Total parse operation for resources/css/variables.css: 7ms
[ParserWorker] parser.parse() for resources/css/unpoly.css: 1ms (3936 bytes)
[ParserWorker] extractCstFacts for resources/css/unpoly.css: 1ms (48 facts)
[ParserWorker] Total parse operation for resources/css/unpoly.css: 3ms
[ParserWorker] parser.parse() for resources/css/layout/topbar.css: 1ms (6317 bytes)
[ParserWorker] extractCstFacts for resources/css/layout/topbar.css: 1ms (30 facts)
[ParserWorker] Total parse operation for resources/css/layout/topbar.css: 2ms
[ParserWorker] parser.parse() for resources/css/layout/sidebar.css: 1ms (5042 bytes)
[ParserWorker] extractCstFacts for resources/css/layout/sidebar.css: 1ms (24 facts)
[ParserWorker] Total parse operation for resources/css/layout/sidebar.css: 2ms
[ParserWorker] parser.parse() for resources/css/layout/breadcrumbs.css: 0ms (1658 bytes)
[ParserWorker] extractCstFacts for resources/css/layout/breadcrumbs.css: 0ms (10 facts)
[ParserWorker] Total parse operation for resources/css/layout/breadcrumbs.css: 4ms
[ParserWorker] parser.parse() for resources/css/layout/admin.css: 1ms (9139 bytes)
[ParserWorker] extractCstFacts for resources/css/layout/admin.css: 0ms (12 facts)
[ParserWorker] Total parse operation for resources/css/layout/admin.css: 2ms
[ParserWorker] parser.parse() for resources/views/components/bulk-actions/action-button.blade.php: 0ms (1582 bytes)
[ParserWorker] extractSymbols completed for resources/views/components/bulk-actions/action-button.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/components/bulk-actions/action-button.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/components/bulk-actions/action-button.blade.php: 1ms (0 facts)
[ParserWorker] Total parse operation for resources/views/components/bulk-actions/action-button.blade.php: 1ms
[ParserWorker] parser.parse() for resources/views/communication/email-queue.blade.php: 1ms (13156 bytes)
[ParserWorker] extractSymbols completed for resources/views/communication/email-queue.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/communication/email-queue.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/communication/email-queue.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/communication/email-queue.blade.php: 1ms
[ParserWorker] parser.parse() for resources/views/communication/compose.blade.php: 1ms (9314 bytes)
[ParserWorker] extractSymbols completed for resources/views/communication/compose.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/communication/compose.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/communication/compose.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/communication/compose.blade.php: 1ms
[ParserWorker] parser.parse() for resources/views/clients/show.blade.php: 1ms (9996 bytes)
[ParserWorker] extractSymbols completed for resources/views/clients/show.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/clients/show.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/clients/show.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/clients/show.blade.php: 1ms
[ParserWorker] parser.parse() for resources/views/clients/index.blade.php: 1ms (8039 bytes)
[ParserWorker] extractSymbols completed for resources/views/clients/index.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/clients/index.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/clients/index.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/clients/index.blade.php: 1ms
[ParserWorker] parser.parse() for resources/views/clients/edit.blade.php: 2ms (17809 bytes)
[ParserWorker] extractSymbols completed for resources/views/clients/edit.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/clients/edit.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/clients/edit.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/clients/edit.blade.php: 2ms
[ParserWorker] parser.parse() for resources/views/clients/_search_results.blade.php: 0ms (1023 bytes)
[ParserWorker] extractSymbols completed for resources/views/clients/_search_results.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/clients/_search_results.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/clients/_search_results.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/clients/_search_results.blade.php: 3ms
[ParserWorker] parser.parse() for resources/views/check-in/index.blade.php: 0ms (7233 bytes)
[ParserWorker] extractSymbols completed for resources/views/check-in/index.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/check-in/index.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/check-in/index.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/check-in/index.blade.php: 0ms
[ParserWorker] parser.parse() for resources/views/calendar/index.blade.php: 2ms (23842 bytes)
[ParserWorker] extractSymbols completed for resources/views/calendar/index.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/calendar/index.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/calendar/index.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/calendar/index.blade.php: 2ms
[ParserWorker] parser.parse() for resources/views/auth/reset-password.blade.php: 0ms (2903 bytes)
[ParserWorker] extractSymbols completed for resources/views/auth/reset-password.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/auth/reset-password.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/auth/reset-password.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/auth/reset-password.blade.php: 1ms
[ParserWorker] parser.parse() for resources/views/auth/login.blade.php: 0ms (5793 bytes)
[ParserWorker] extractSymbols completed for resources/views/auth/login.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/auth/login.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/auth/login.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/auth/login.blade.php: 0ms
[ParserWorker] parser.parse() for resources/views/auth/forgot-password.blade.php: 0ms (2406 bytes)
[ParserWorker] extractSymbols completed for resources/views/auth/forgot-password.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/auth/forgot-password.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/auth/forgot-password.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/auth/forgot-password.blade.php: 1ms
[ParserWorker] parser.parse() for resources/views/admin-pay-tracker/print-dashboard.blade.php: 0ms (5348 bytes)
[ParserWorker] extractSymbols completed for resources/views/admin-pay-tracker/print-dashboard.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/admin-pay-tracker/print-dashboard.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/admin-pay-tracker/print-dashboard.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/admin-pay-tracker/print-dashboard.blade.php: 0ms
[ParserWorker] parser.parse() for resources/views/admin-pay-tracker/index.blade.php: 0ms (16140 bytes)
[ParserWorker] extractSymbols completed for resources/views/admin-pay-tracker/index.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/admin-pay-tracker/index.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/admin-pay-tracker/index.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/admin-pay-tracker/index.blade.php: 1ms
[ParserWorker] parser.parse() for resources/views/admin-pay-tracker/form.blade.php: 1ms (15986 bytes)
[ParserWorker] extractSymbols completed for resources/views/admin-pay-tracker/form.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/admin-pay-tracker/form.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/admin-pay-tracker/form.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/admin-pay-tracker/form.blade.php: 1ms
[ParserWorker] parser.parse() for resources/views/admin-pay-tracker/dashboard.blade.php: 1ms (14902 bytes)
[ParserWorker] extractSymbols completed for resources/views/admin-pay-tracker/dashboard.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/admin-pay-tracker/dashboard.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/admin-pay-tracker/dashboard.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/admin-pay-tracker/dashboard.blade.php: 1ms
[ParserWorker] parser.parse() for resources/templates/sms-templates/reminder-sms.blade.php: 0ms (198 bytes)
[ParserWorker] extractSymbols completed for resources/templates/sms-templates/reminder-sms.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/templates/sms-templates/reminder-sms.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/templates/sms-templates/reminder-sms.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/templates/sms-templates/reminder-sms.blade.php: 0ms
[ParserWorker] parser.parse() for resources/templates/sms-templates/approval-sms.blade.php: 0ms (237 bytes)
[ParserWorker] extractSymbols completed for resources/templates/sms-templates/approval-sms.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/templates/sms-templates/approval-sms.blade.php: 3ms (0 symbols)
[ParserWorker] extractCstFacts for resources/templates/sms-templates/approval-sms.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/templates/sms-templates/approval-sms.blade.php: 4ms
[ParserWorker] parser.parse() for resources/templates/email-templates/reminder-email.blade.php: 0ms (1185 bytes)
[ParserWorker] extractSymbols completed for resources/templates/email-templates/reminder-email.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/templates/email-templates/reminder-email.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/templates/email-templates/reminder-email.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/templates/email-templates/reminder-email.blade.php: 0ms
[ParserWorker] parser.parse() for resources/templates/email-templates/rejection-email.blade.php: 1ms (557 bytes)
[ParserWorker] extractSymbols completed for resources/templates/email-templates/rejection-email.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/templates/email-templates/rejection-email.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/templates/email-templates/rejection-email.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/templates/email-templates/rejection-email.blade.php: 1ms
[ParserWorker] parser.parse() for resources/views/components/event-log/hours-preview.blade.php: 0ms (641 bytes)
[ParserWorker] extractSymbols completed for resources/views/components/event-log/hours-preview.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/components/event-log/hours-preview.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/components/event-log/hours-preview.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/components/event-log/hours-preview.blade.php: 0ms
[ParserWorker] parser.parse() for resources/views/components/bulk-actions/bulk-actions-form.blade.php: 0ms (2272 bytes)
[ParserWorker] extractSymbols completed for resources/views/components/bulk-actions/bulk-actions-form.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/components/bulk-actions/bulk-actions-form.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/components/bulk-actions/bulk-actions-form.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/components/bulk-actions/bulk-actions-form.blade.php: 1ms
[ParserWorker] parser.parse() for resources/views/components/bulk-actions/action-status.blade.php: 0ms (2588 bytes)
[ParserWorker] extractSymbols completed for resources/views/components/bulk-actions/action-status.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/components/bulk-actions/action-status.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/components/bulk-actions/action-status.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/components/bulk-actions/action-status.blade.php: 0ms
[ParserWorker] parser.parse() for resources/views/components/bulk-actions/action-status-dropdown.blade.php: 0ms (2533 bytes)
[ParserWorker] extractSymbols completed for resources/views/components/bulk-actions/action-status-dropdown.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/components/bulk-actions/action-status-dropdown.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/components/bulk-actions/action-status-dropdown.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/components/bulk-actions/action-status-dropdown.blade.php: 1ms
[ParserWorker] parser.parse() for resources/views/components/bulk-actions/action-permissions.blade.php: 0ms (2926 bytes)
[ParserWorker] extractSymbols completed for resources/views/components/bulk-actions/action-permissions.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/components/bulk-actions/action-permissions.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/components/bulk-actions/action-permissions.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/components/bulk-actions/action-permissions.blade.php: 0ms
[ParserWorker] parser.parse() for resources/views/components/bulk-actions/action-pay-status-dropdown.blade.php: 0ms (2657 bytes)
[ParserWorker] extractSymbols completed for resources/views/components/bulk-actions/action-pay-status-dropdown.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/components/bulk-actions/action-pay-status-dropdown.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/components/bulk-actions/action-pay-status-dropdown.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/components/bulk-actions/action-pay-status-dropdown.blade.php: 1ms
[ParserWorker] parser.parse() for resources/views/components/bulk-actions/action-export.blade.php: 0ms (1590 bytes)
[ParserWorker] extractSymbols completed for resources/views/components/bulk-actions/action-export.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/components/bulk-actions/action-export.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/components/bulk-actions/action-export.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/components/bulk-actions/action-export.blade.php: 0ms
[ParserWorker] parser.parse() for resources/views/components/bulk-actions/action-delete.blade.php: 0ms (1903 bytes)
[ParserWorker] extractSymbols completed for resources/views/components/bulk-actions/action-delete.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/components/bulk-actions/action-delete.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/components/bulk-actions/action-delete.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/components/bulk-actions/action-delete.blade.php: 1ms
[ParserWorker] parser.parse() for resources/views/components/bulk-actions/action-copy-permissions.blade.php: 0ms (2213 bytes)
[ParserWorker] extractSymbols completed for resources/views/components/bulk-actions/action-copy-permissions.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/components/bulk-actions/action-copy-permissions.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/components/bulk-actions/action-copy-permissions.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/components/bulk-actions/action-copy-permissions.blade.php: 0ms
[ParserWorker] parser.parse() for resources/views/components/event-log/payment-form-preview.blade.php: 1ms (1269 bytes)
[ParserWorker] extractSymbols completed for resources/views/components/event-log/payment-form-preview.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/components/event-log/payment-form-preview.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/components/event-log/payment-form-preview.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/components/event-log/payment-form-preview.blade.php: 1ms
[ParserWorker] parser.parse() for resources/views/components/event-log/time-form-body.blade.php: 1ms (5175 bytes)
[ParserWorker] extractSymbols completed for resources/views/components/event-log/time-form-body.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/components/event-log/time-form-body.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/components/event-log/time-form-body.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/components/event-log/time-form-body.blade.php: 1ms
[ParserWorker] parser.parse() for resources/templates/email-templates/client-event-details.blade.php: 0ms (5867 bytes)
[ParserWorker] extractSymbols completed for resources/templates/email-templates/client-event-details.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/templates/email-templates/client-event-details.blade.php: 1ms (0 symbols)
[ParserWorker] extractCstFacts for resources/templates/email-templates/client-event-details.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/templates/email-templates/client-event-details.blade.php: 1ms
[ParserWorker] parser.parse() for resources/templates/email-templates/approval-email.blade.php: 0ms (1271 bytes)
[ParserWorker] extractSymbols completed for resources/templates/email-templates/approval-email.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/templates/email-templates/approval-email.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/templates/email-templates/approval-email.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/templates/email-templates/approval-email.blade.php: 0ms
[ParserWorker] parser.parse() for resources/js/utils/Toast.js: 1ms (5822 bytes)
[ParserWorker] extractSymbols completed for resources/js/utils/Toast.js: 6 symbols in 1ms (913 iterations)
[ParserWorker] extractSymbols for resources/js/utils/Toast.js: 1ms (6 symbols)
[ParserWorker] extractCstFacts for resources/js/utils/Toast.js: 0ms (1 facts)
[ParserWorker] Total parse operation for resources/js/utils/Toast.js: 2ms
[ParserWorker] parser.parse() for resources/js/utils/TimePicker.js: 3ms (16630 bytes)
[ParserWorker] extractSymbols completed for resources/js/utils/TimePicker.js: 11 symbols in 4ms (3685 iterations)
[ParserWorker] extractSymbols for resources/js/utils/TimePicker.js: 4ms (11 symbols)
[ParserWorker] extractCstFacts for resources/js/utils/TimePicker.js: 0ms (1 facts)
[ParserWorker] Total parse operation for resources/js/utils/TimePicker.js: 7ms
[ParserWorker] parser.parse() for resources/js/utils/SortableList.js: 2ms (7385 bytes)
[ParserWorker] extractSymbols completed for resources/js/utils/SortableList.js: 14 symbols in 2ms (1879 iterations)
[ParserWorker] extractSymbols for resources/js/utils/SortableList.js: 2ms (14 symbols)
[ParserWorker] extractCstFacts for resources/js/utils/SortableList.js: 0ms (1 facts)
[ParserWorker] Total parse operation for resources/js/utils/SortableList.js: 4ms
[ParserWorker] parser.parse() for resources/js/utils/Repeater.js: 1ms (3992 bytes)
[ParserWorker] extractSymbols completed for resources/js/utils/Repeater.js: 6 symbols in 1ms (895 iterations)
[ParserWorker] extractSymbols for resources/js/utils/Repeater.js: 1ms (6 symbols)
[ParserWorker] extractCstFacts for resources/js/utils/Repeater.js: 0ms (1 facts)
[ParserWorker] Total parse operation for resources/js/utils/Repeater.js: 3ms
[ParserWorker] parser.parse() for resources/js/utils/FormValidator.js: 1ms (5326 bytes)
[ParserWorker] extractSymbols completed for resources/js/utils/FormValidator.js: 6 symbols in 1ms (1234 iterations)
[ParserWorker] extractSymbols for resources/js/utils/FormValidator.js: 1ms (6 symbols)
[ParserWorker] extractCstFacts for resources/js/utils/FormValidator.js: 0ms (1 facts)
[ParserWorker] Total parse operation for resources/js/utils/FormValidator.js: 3ms
[ParserWorker] parser.parse() for resources/js/utils/FieldFormatter.js: 8ms (40462 bytes)
[ParserWorker] extractSymbols completed for resources/js/utils/FieldFormatter.js: 35 symbols in 10ms (9021 iterations)
[ParserWorker] extractSymbols for resources/js/utils/FieldFormatter.js: 11ms (35 symbols)
[ParserWorker] extractCstFacts for resources/js/utils/FieldFormatter.js: 2ms (25 facts)
[ParserWorker] Total parse operation for resources/js/utils/FieldFormatter.js: 22ms
[ParserWorker] parser.parse() for resources/js/utils/BulkSelector.js: 0ms (3099 bytes)
[ParserWorker] extractSymbols completed for resources/js/utils/BulkSelector.js: 6 symbols in 1ms (547 iterations)
[ParserWorker] extractSymbols for resources/js/utils/BulkSelector.js: 1ms (6 symbols)
[ParserWorker] extractCstFacts for resources/js/utils/BulkSelector.js: 0ms (1 facts)
[ParserWorker] Total parse operation for resources/js/utils/BulkSelector.js: 1ms
[ParserWorker] parser.parse() for resources/js/unpoly.js: 108ms (438993 bytes)
[ParserWorker] extractSymbols for resources/js/unpoly.js: 88ms (0 symbols)
[ParserWorker] Total parse operation for resources/js/unpoly.js: 196ms
[ParserWorker] parser.parse() for resources/js/app.js: 7ms (37979 bytes)
[ParserWorker] extractSymbols completed for resources/js/app.js: 11 symbols in 10ms (8661 iterations)
[ParserWorker] extractSymbols for resources/js/app.js: 10ms (11 symbols)
[ParserWorker] extractCstFacts for resources/js/app.js: 2ms (96 facts)
[ParserWorker] Total parse operation for resources/js/app.js: 20ms
[ParserWorker] parser.parse() for resources/js/LiveBind/tsup.config.ts: 12ms (979 bytes)
[ParserWorker] extractSymbols completed for resources/js/LiveBind/tsup.config.ts: 0 symbols in 0ms (228 iterations)
[ParserWorker] extractSymbols for resources/js/LiveBind/tsup.config.ts: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/js/LiveBind/tsup.config.ts: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/js/LiveBind/tsup.config.ts: 12ms
[ParserWorker] parser.parse() for resources/js/LiveBind/tsconfig.json: 1ms (693 bytes)
[ParserWorker] extractCstFacts for resources/js/LiveBind/tsconfig.json: 0ms (3 facts)
[ParserWorker] Total parse operation for resources/js/LiveBind/tsconfig.json: 1ms
[ParserWorker] parser.parse() for resources/js/LiveBind/src/types.ts: 1ms (4425 bytes)
[ParserWorker] extractSymbols completed for resources/js/LiveBind/src/types.ts: 0 symbols in 1ms (1170 iterations)
[ParserWorker] extractSymbols for resources/js/LiveBind/src/types.ts: 1ms (0 symbols)
[ParserWorker] extractCstFacts for resources/js/LiveBind/src/types.ts: 1ms (13 facts)
[ParserWorker] Total parse operation for resources/js/LiveBind/src/types.ts: 3ms
[ParserWorker] parser.parse() for resources/js/LiveBind/src/plugins/polling.ts: 1ms (3965 bytes)
[ParserWorker] extractSymbols completed for resources/js/LiveBind/src/plugins/polling.ts: 4 symbols in 2ms (1170 iterations)
[ParserWorker] extractSymbols for resources/js/LiveBind/src/plugins/polling.ts: 2ms (4 symbols)
[ParserWorker] extractCstFacts for resources/js/LiveBind/src/plugins/polling.ts: 0ms (1 facts)
[ParserWorker] Total parse operation for resources/js/LiveBind/src/plugins/polling.ts: 5ms
[ParserWorker] parser.parse() for resources/js/LiveBind/src/plugins/navigation.ts: 2ms (5261 bytes)
[ParserWorker] extractSymbols completed for resources/js/LiveBind/src/plugins/navigation.ts: 4 symbols in 2ms (1654 iterations)
[ParserWorker] extractSymbols for resources/js/LiveBind/src/plugins/navigation.ts: 2ms (4 symbols)
[ParserWorker] extractCstFacts for resources/js/LiveBind/src/plugins/navigation.ts: 0ms (1 facts)
[ParserWorker] Total parse operation for resources/js/LiveBind/src/plugins/navigation.ts: 4ms
[ParserWorker] parser.parse() for resources/js/LiveBind/src/plugins/forms.ts: 5ms (18883 bytes)
[ParserWorker] extractSymbols completed for resources/js/LiveBind/src/plugins/forms.ts: 8 symbols in 7ms (5380 iterations)
[ParserWorker] extractSymbols for resources/js/LiveBind/src/plugins/forms.ts: 7ms (8 symbols)
[ParserWorker] extractCstFacts for resources/js/LiveBind/src/plugins/forms.ts: 0ms (6 facts)
[ParserWorker] Total parse operation for resources/js/LiveBind/src/plugins/forms.ts: 14ms
[ParserWorker] parser.parse() for resources/js/LiveBind/src/plugins/alpine.ts: 0ms (2644 bytes)
[ParserWorker] extractSymbols completed for resources/js/LiveBind/src/plugins/alpine.ts: 2 symbols in 3ms (769 iterations)
[ParserWorker] extractSymbols for resources/js/LiveBind/src/plugins/alpine.ts: 3ms (2 symbols)
[ParserWorker] extractCstFacts for resources/js/LiveBind/src/plugins/alpine.ts: 0ms (1 facts)
[ParserWorker] Total parse operation for resources/js/LiveBind/src/plugins/alpine.ts: 5ms
[ParserWorker] parser.parse() for resources/js/LiveBind/src/plugins/actions.ts: 3ms (12766 bytes)
[ParserWorker] extractSymbols completed for resources/js/LiveBind/src/plugins/actions.ts: 3 symbols in 5ms (3543 iterations)
[ParserWorker] extractSymbols for resources/js/LiveBind/src/plugins/actions.ts: 5ms (3 symbols)
[ParserWorker] extractCstFacts for resources/js/LiveBind/src/plugins/actions.ts: 2ms (3 facts)
[ParserWorker] Total parse operation for resources/js/LiveBind/src/plugins/actions.ts: 11ms
[ParserWorker] parser.parse() for resources/js/LiveBind/src/index.ts: 0ms (1317 bytes)
[ParserWorker] extractSymbols completed for resources/js/LiveBind/src/index.ts: 0 symbols in 0ms (171 iterations)
[ParserWorker] extractSymbols for resources/js/LiveBind/src/index.ts: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/js/LiveBind/src/index.ts: 0ms (5 facts)
[ParserWorker] Total parse operation for resources/js/LiveBind/src/index.ts: 1ms
[ParserWorker] parser.parse() for resources/js/LiveBind/src/core.ts: 3ms (11936 bytes)
[ParserWorker] extractSymbols completed for resources/js/LiveBind/src/core.ts: 12 symbols in 4ms (3403 iterations)
[ParserWorker] extractSymbols for resources/js/LiveBind/src/core.ts: 7ms (12 symbols)
[ParserWorker] extractCstFacts for resources/js/LiveBind/src/core.ts: 0ms (1 facts)
[ParserWorker] Total parse operation for resources/js/LiveBind/src/core.ts: 10ms
[ParserWorker] parser.parse() for resources/js/LiveBind/package.json: 1ms (2836 bytes)
[ParserWorker] extractCstFacts for resources/js/LiveBind/package.json: 0ms (17 facts)
[ParserWorker] Total parse operation for resources/js/LiveBind/package.json: 2ms
[ParserWorker] parser.parse() for resources/js/LiveBind/package-lock.json: 5ms (46370 bytes)
[ParserWorker] extractCstFacts for resources/js/LiveBind/package-lock.json: 4ms (5 facts)
[ParserWorker] Total parse operation for resources/js/LiveBind/package-lock.json: 9ms
[ParserWorker] parser.parse() for resources/js/LiveBind/README.md: 5ms (12187 bytes)
[ParserWorker] extractCstFacts for resources/js/LiveBind/README.md: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/js/LiveBind/README.md: 5ms
[ParserWorker] parser.parse() for resources/css/variables.css: 3ms (22739 bytes)
[ParserWorker] extractCstFacts for resources/css/variables.css: 2ms (7 facts)
[ParserWorker] Total parse operation for resources/css/variables.css: 7ms
[ParserWorker] parser.parse() for resources/css/unpoly.css: 1ms (3936 bytes)
[ParserWorker] extractCstFacts for resources/css/unpoly.css: 1ms (48 facts)
[ParserWorker] Total parse operation for resources/css/unpoly.css: 3ms
[ParserWorker] parser.parse() for resources/css/layout/topbar.css: 1ms (6317 bytes)
[ParserWorker] extractCstFacts for resources/css/layout/topbar.css: 1ms (30 facts)
[ParserWorker] Total parse operation for resources/css/layout/topbar.css: 2ms
[ParserWorker] parser.parse() for resources/css/layout/sidebar.css: 1ms (5042 bytes)
[ParserWorker] extractCstFacts for resources/css/layout/sidebar.css: 1ms (24 facts)
[ParserWorker] Total parse operation for resources/css/layout/sidebar.css: 2ms
[ParserWorker] parser.parse() for resources/css/layout/breadcrumbs.css: 0ms (1658 bytes)
[ParserWorker] extractCstFacts for resources/css/layout/breadcrumbs.css: 0ms (10 facts)
[ParserWorker] Total parse operation for resources/css/layout/breadcrumbs.css: 4ms
[ParserWorker] parser.parse() for resources/css/layout/admin.css: 1ms (9139 bytes)
[ParserWorker] extractCstFacts for resources/css/layout/admin.css: 0ms (12 facts)
[ParserWorker] Total parse operation for resources/css/layout/admin.css: 2ms
[ParserWorker] parser.parse() for resources/views/components/bulk-actions/action-button.blade.php: 0ms (1582 bytes)
[ParserWorker] extractSymbols completed for resources/views/components/bulk-actions/action-button.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/components/bulk-actions/action-button.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/components/bulk-actions/action-button.blade.php: 1ms (0 facts)
[ParserWorker] Total parse operation for resources/views/components/bulk-actions/action-button.blade.php: 1ms
[ParserWorker] parser.parse() for resources/views/communication/email-queue.blade.php: 1ms (13156 bytes)
[ParserWorker] extractSymbols completed for resources/views/communication/email-queue.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/communication/email-queue.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/communication/email-queue.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/communication/email-queue.blade.php: 1ms
[ParserWorker] parser.parse() for resources/views/communication/compose.blade.php: 1ms (9314 bytes)
[ParserWorker] extractSymbols completed for resources/views/communication/compose.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/communication/compose.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/communication/compose.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/communication/compose.blade.php: 1ms
[ParserWorker] parser.parse() for resources/views/clients/show.blade.php: 1ms (9996 bytes)
[ParserWorker] extractSymbols completed for resources/views/clients/show.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/clients/show.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/clients/show.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/clients/show.blade.php: 1ms
[ParserWorker] parser.parse() for resources/views/clients/index.blade.php: 1ms (8039 bytes)
[ParserWorker] extractSymbols completed for resources/views/clients/index.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/clients/index.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/clients/index.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/clients/index.blade.php: 1ms
[ParserWorker] parser.parse() for resources/views/clients/edit.blade.php: 2ms (17809 bytes)
[ParserWorker] extractSymbols completed for resources/views/clients/edit.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/clients/edit.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/clients/edit.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/clients/edit.blade.php: 2ms
[ParserWorker] parser.parse() for resources/views/clients/_search_results.blade.php: 0ms (1023 bytes)
[ParserWorker] extractSymbols completed for resources/views/clients/_search_results.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/clients/_search_results.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/clients/_search_results.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/clients/_search_results.blade.php: 3ms
[ParserWorker] parser.parse() for resources/views/check-in/index.blade.php: 0ms (7233 bytes)
[ParserWorker] extractSymbols completed for resources/views/check-in/index.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/check-in/index.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/check-in/index.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/check-in/index.blade.php: 0ms
[ParserWorker] parser.parse() for resources/views/calendar/index.blade.php: 2ms (23842 bytes)
[ParserWorker] extractSymbols completed for resources/views/calendar/index.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/calendar/index.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/calendar/index.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/calendar/index.blade.php: 2ms
[ParserWorker] parser.parse() for resources/views/auth/reset-password.blade.php: 0ms (2903 bytes)
[ParserWorker] extractSymbols completed for resources/views/auth/reset-password.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/auth/reset-password.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/auth/reset-password.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/auth/reset-password.blade.php: 1ms
[ParserWorker] parser.parse() for resources/views/auth/login.blade.php: 0ms (5793 bytes)
[ParserWorker] extractSymbols completed for resources/views/auth/login.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/auth/login.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/auth/login.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/auth/login.blade.php: 0ms
[ParserWorker] parser.parse() for resources/views/auth/forgot-password.blade.php: 0ms (2406 bytes)
[ParserWorker] extractSymbols completed for resources/views/auth/forgot-password.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/auth/forgot-password.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/auth/forgot-password.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/auth/forgot-password.blade.php: 1ms
[ParserWorker] parser.parse() for resources/views/admin-pay-tracker/print-dashboard.blade.php: 0ms (5348 bytes)
[ParserWorker] extractSymbols completed for resources/views/admin-pay-tracker/print-dashboard.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/admin-pay-tracker/print-dashboard.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/admin-pay-tracker/print-dashboard.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/admin-pay-tracker/print-dashboard.blade.php: 0ms
[ParserWorker] parser.parse() for resources/views/admin-pay-tracker/index.blade.php: 0ms (16140 bytes)
[ParserWorker] extractSymbols completed for resources/views/admin-pay-tracker/index.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/admin-pay-tracker/index.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/admin-pay-tracker/index.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/admin-pay-tracker/index.blade.php: 1ms
[ParserWorker] parser.parse() for resources/views/admin-pay-tracker/form.blade.php: 1ms (15986 bytes)
[ParserWorker] extractSymbols completed for resources/views/admin-pay-tracker/form.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/admin-pay-tracker/form.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/admin-pay-tracker/form.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/admin-pay-tracker/form.blade.php: 1ms
[ParserWorker] parser.parse() for resources/views/admin-pay-tracker/dashboard.blade.php: 1ms (14902 bytes)
[ParserWorker] extractSymbols completed for resources/views/admin-pay-tracker/dashboard.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/admin-pay-tracker/dashboard.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/admin-pay-tracker/dashboard.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/admin-pay-tracker/dashboard.blade.php: 1ms
[ParserWorker] parser.parse() for resources/templates/sms-templates/reminder-sms.blade.php: 0ms (198 bytes)
[ParserWorker] extractSymbols completed for resources/templates/sms-templates/reminder-sms.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/templates/sms-templates/reminder-sms.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/templates/sms-templates/reminder-sms.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/templates/sms-templates/reminder-sms.blade.php: 0ms
[ParserWorker] parser.parse() for resources/templates/sms-templates/approval-sms.blade.php: 0ms (237 bytes)
[ParserWorker] extractSymbols completed for resources/templates/sms-templates/approval-sms.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/templates/sms-templates/approval-sms.blade.php: 3ms (0 symbols)
[ParserWorker] extractCstFacts for resources/templates/sms-templates/approval-sms.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/templates/sms-templates/approval-sms.blade.php: 4ms
[ParserWorker] parser.parse() for resources/templates/email-templates/reminder-email.blade.php: 0ms (1185 bytes)
[ParserWorker] extractSymbols completed for resources/templates/email-templates/reminder-email.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/templates/email-templates/reminder-email.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/templates/email-templates/reminder-email.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/templates/email-templates/reminder-email.blade.php: 0ms
[ParserWorker] parser.parse() for resources/templates/email-templates/rejection-email.blade.php: 1ms (557 bytes)
[ParserWorker] extractSymbols completed for resources/templates/email-templates/rejection-email.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/templates/email-templates/rejection-email.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/templates/email-templates/rejection-email.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/templates/email-templates/rejection-email.blade.php: 1ms
[ParserWorker] parser.parse() for resources/views/components/event-log/hours-preview.blade.php: 0ms (641 bytes)
[ParserWorker] extractSymbols completed for resources/views/components/event-log/hours-preview.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/components/event-log/hours-preview.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/components/event-log/hours-preview.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/components/event-log/hours-preview.blade.php: 0ms
[ParserWorker] parser.parse() for resources/views/components/bulk-actions/bulk-actions-form.blade.php: 0ms (2272 bytes)
[ParserWorker] extractSymbols completed for resources/views/components/bulk-actions/bulk-actions-form.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/components/bulk-actions/bulk-actions-form.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/components/bulk-actions/bulk-actions-form.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/components/bulk-actions/bulk-actions-form.blade.php: 1ms
[ParserWorker] parser.parse() for resources/views/components/bulk-actions/action-status.blade.php: 0ms (2588 bytes)
[ParserWorker] extractSymbols completed for resources/views/components/bulk-actions/action-status.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/components/bulk-actions/action-status.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/components/bulk-actions/action-status.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/components/bulk-actions/action-status.blade.php: 0ms
[ParserWorker] parser.parse() for resources/views/components/bulk-actions/action-status-dropdown.blade.php: 0ms (2533 bytes)
[ParserWorker] extractSymbols completed for resources/views/components/bulk-actions/action-status-dropdown.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/components/bulk-actions/action-status-dropdown.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/components/bulk-actions/action-status-dropdown.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/components/bulk-actions/action-status-dropdown.blade.php: 1ms
[ParserWorker] parser.parse() for resources/views/components/bulk-actions/action-permissions.blade.php: 0ms (2926 bytes)
[ParserWorker] extractSymbols completed for resources/views/components/bulk-actions/action-permissions.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/components/bulk-actions/action-permissions.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/components/bulk-actions/action-permissions.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/components/bulk-actions/action-permissions.blade.php: 0ms
[ParserWorker] parser.parse() for resources/views/components/bulk-actions/action-pay-status-dropdown.blade.php: 0ms (2657 bytes)
[ParserWorker] extractSymbols completed for resources/views/components/bulk-actions/action-pay-status-dropdown.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/components/bulk-actions/action-pay-status-dropdown.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/components/bulk-actions/action-pay-status-dropdown.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/components/bulk-actions/action-pay-status-dropdown.blade.php: 1ms
[ParserWorker] parser.parse() for resources/views/components/bulk-actions/action-export.blade.php: 0ms (1590 bytes)
[ParserWorker] extractSymbols completed for resources/views/components/bulk-actions/action-export.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/components/bulk-actions/action-export.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/components/bulk-actions/action-export.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/components/bulk-actions/action-export.blade.php: 0ms
[ParserWorker] parser.parse() for resources/views/components/bulk-actions/action-delete.blade.php: 0ms (1903 bytes)
[ParserWorker] extractSymbols completed for resources/views/components/bulk-actions/action-delete.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/components/bulk-actions/action-delete.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/components/bulk-actions/action-delete.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/components/bulk-actions/action-delete.blade.php: 1ms
[ParserWorker] parser.parse() for resources/views/components/bulk-actions/action-copy-permissions.blade.php: 0ms (2213 bytes)
[ParserWorker] extractSymbols completed for resources/views/components/bulk-actions/action-copy-permissions.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/components/bulk-actions/action-copy-permissions.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/components/bulk-actions/action-copy-permissions.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/components/bulk-actions/action-copy-permissions.blade.php: 0ms
[ParserWorker] parser.parse() for resources/views/components/event-log/payment-form-preview.blade.php: 1ms (1269 bytes)
[ParserWorker] extractSymbols completed for resources/views/components/event-log/payment-form-preview.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/components/event-log/payment-form-preview.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/components/event-log/payment-form-preview.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/components/event-log/payment-form-preview.blade.php: 1ms
[ParserWorker] parser.parse() for resources/views/components/special-day-form.blade.php: 0ms (2877 bytes)
[ParserWorker] extractSymbols completed for resources/views/components/special-day-form.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/components/special-day-form.blade.php: 1ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/components/special-day-form.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/components/special-day-form.blade.php: 1ms
[ParserWorker] parser.parse() for resources/views/components/profile/info-field.blade.php: 0ms (1242 bytes)
[ParserWorker] extractSymbols completed for resources/views/components/profile/info-field.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/components/profile/info-field.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/components/profile/info-field.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/components/profile/info-field.blade.php: 0ms
[ParserWorker] parser.parse() for resources/views/components/profile/info-card.blade.php: 0ms (2999 bytes)
[ParserWorker] extractSymbols completed for resources/views/components/profile/info-card.blade.php: 0 symbols in 1ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/components/profile/info-card.blade.php: 1ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/components/profile/info-card.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/components/profile/info-card.blade.php: 1ms
[ParserWorker] parser.parse() for resources/views/components/profile/header.blade.php: 0ms (6321 bytes)
[ParserWorker] extractSymbols completed for resources/views/components/profile/header.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/components/profile/header.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/components/profile/header.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/components/profile/header.blade.php: 0ms
[ParserWorker] parser.parse() for resources/views/components/profile/form-header.blade.php: 0ms (1666 bytes)
[ParserWorker] extractSymbols completed for resources/views/components/profile/form-header.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/components/profile/form-header.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/components/profile/form-header.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/components/profile/form-header.blade.php: 1ms
[ParserWorker] parser.parse() for resources/views/components/navigation/nested-sidebar.blade.php: 0ms (4236 bytes)
[ParserWorker] extractSymbols completed for resources/views/components/navigation/nested-sidebar.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/components/navigation/nested-sidebar.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/components/navigation/nested-sidebar.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/components/navigation/nested-sidebar.blade.php: 0ms
[ParserWorker] parser.parse() for resources/views/components/navigation/nav-tabs.blade.php: 1ms (6003 bytes)
[ParserWorker] extractSymbols completed for resources/views/components/navigation/nav-tabs.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/components/navigation/nav-tabs.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/components/navigation/nav-tabs.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/components/navigation/nav-tabs.blade.php: 1ms
[ParserWorker] parser.parse() for resources/views/components/modals/viewer.blade.php: 0ms (5770 bytes)
[ParserWorker] extractSymbols completed for resources/views/components/modals/viewer.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/components/modals/viewer.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/components/modals/viewer.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/components/modals/viewer.blade.php: 0ms
[ParserWorker] parser.parse() for resources/views/components/modals/staff-events.blade.php: 1ms (9783 bytes)
[ParserWorker] extractSymbols completed for resources/views/components/modals/staff-events.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/components/modals/staff-events.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/components/modals/staff-events.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/components/modals/staff-events.blade.php: 1ms
[ParserWorker] parser.parse() for resources/views/components/modals/event-log-payment.blade.php: 1ms (12409 bytes)
[ParserWorker] extractSymbols completed for resources/views/components/modals/event-log-payment.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/components/modals/event-log-payment.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/components/modals/event-log-payment.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/components/modals/event-log-payment.blade.php: 1ms
[ParserWorker] parser.parse() for resources/views/components/modals/email-quick.blade.php: 1ms (2743 bytes)
[ParserWorker] extractSymbols completed for resources/views/components/modals/email-quick.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/components/modals/email-quick.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/components/modals/email-quick.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/components/modals/email-quick.blade.php: 1ms
[ParserWorker] parser.parse() for resources/views/components/modals/client-event-details-email.blade.php: 0ms (3284 bytes)
[ParserWorker] extractSymbols completed for resources/views/components/modals/client-event-details-email.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/components/modals/client-event-details-email.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/components/modals/client-event-details-email.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/components/modals/client-event-details-email.blade.php: 0ms
[ParserWorker] parser.parse() for resources/views/components/invoices/staff-assignments.blade.php: 1ms (14181 bytes)
[ParserWorker] extractSymbols completed for resources/views/components/invoices/staff-assignments.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/components/invoices/staff-assignments.blade.php: 1ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/components/invoices/staff-assignments.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/components/invoices/staff-assignments.blade.php: 2ms
[ParserWorker] parser.parse() for resources/views/components/form/toggle.blade.php: 0ms (1441 bytes)
[ParserWorker] extractSymbols completed for resources/views/components/form/toggle.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/components/form/toggle.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/components/form/toggle.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/components/form/toggle.blade.php: 0ms
[ParserWorker] parser.parse() for resources/views/components/form/time-range.blade.php: 0ms (3153 bytes)
[ParserWorker] extractSymbols completed for resources/views/components/form/time-range.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/components/form/time-range.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/components/form/time-range.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/components/form/time-range.blade.php: 0ms
[ParserWorker] parser.parse() for resources/views/components/form/time-picker.blade.php: 0ms (4849 bytes)
[ParserWorker] extractSymbols completed for resources/views/components/form/time-picker.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/components/form/time-picker.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/components/form/time-picker.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/components/form/time-picker.blade.php: 0ms
[ParserWorker] parser.parse() for resources/views/components/form/textarea.blade.php: 0ms (995 bytes)
[ParserWorker] extractSymbols completed for resources/views/components/form/textarea.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/components/form/textarea.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/components/form/textarea.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/components/form/textarea.blade.php: 0ms
[ParserWorker] parser.parse() for resources/views/components/form/sticky-footer.blade.php: 1ms (4554 bytes)
[ParserWorker] extractSymbols completed for resources/views/components/form/sticky-footer.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/components/form/sticky-footer.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/components/form/sticky-footer.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/components/form/sticky-footer.blade.php: 1ms
[ParserWorker] parser.parse() for resources/views/components/form/sticky-footer-wizard.blade.php: 0ms (3117 bytes)
[ParserWorker] extractSymbols completed for resources/views/components/form/sticky-footer-wizard.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/components/form/sticky-footer-wizard.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/components/form/sticky-footer-wizard.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/components/form/sticky-footer-wizard.blade.php: 0ms
[ParserWorker] parser.parse() for resources/views/components/form/select.blade.php: 1ms (1289 bytes)
[ParserWorker] extractSymbols completed for resources/views/components/form/select.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/components/form/select.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/components/form/select.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/components/form/select.blade.php: 1ms
[ParserWorker] parser.parse() for resources/views/components/form/search.blade.php: 0ms (1482 bytes)
[ParserWorker] extractSymbols completed for resources/views/components/form/search.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/components/form/search.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/components/form/search.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/components/form/search.blade.php: 0ms
[ParserWorker] parser.parse() for resources/views/components/form/repeater.blade.php: 1ms (7892 bytes)
[ParserWorker] extractSymbols completed for resources/views/components/form/repeater.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/components/form/repeater.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/components/form/repeater.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/components/form/repeater.blade.php: 1ms
[ParserWorker] parser.parse() for resources/views/components/form/radio-group.blade.php: 0ms (1119 bytes)
[ParserWorker] extractSymbols completed for resources/views/components/form/radio-group.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/components/form/radio-group.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/components/form/radio-group.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/components/form/radio-group.blade.php: 0ms
[ParserWorker] parser.parse() for resources/views/components/form/multi-select.blade.php: 0ms (1408 bytes)
[ParserWorker] extractSymbols completed for resources/views/components/form/multi-select.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/components/form/multi-select.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/components/form/multi-select.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/components/form/multi-select.blade.php: 1ms
[ParserWorker] parser.parse() for resources/views/components/form/input.blade.php: 0ms (1134 bytes)
[ParserWorker] extractSymbols completed for resources/views/components/form/input.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/components/form/input.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/components/form/input.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/components/form/input.blade.php: 0ms
[ParserWorker] parser.parse() for resources/views/components/event-log/time-form-body.blade.php: 1ms (5175 bytes)
[ParserWorker] parser.parse() for resources/views/components/form/input-addon.blade.php: 0ms (2021 bytes)
[ParserWorker] extractSymbols completed for resources/views/components/form/input-addon.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/components/form/input-addon.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/components/form/input-addon.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/components/form/input-addon.blade.php: 0ms
[ParserWorker] parser.parse() for resources/views/components/form/filepond.blade.php: 1ms (4133 bytes)
[ParserWorker] extractSymbols completed for resources/views/components/form/filepond.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/components/form/filepond.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/components/form/filepond.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/components/form/filepond.blade.php: 1ms
[ParserWorker] parser.parse() for resources/views/components/form/file.blade.php: 0ms (1272 bytes)
[ParserWorker] extractSymbols completed for resources/views/components/form/file.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/components/form/file.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/components/form/file.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/components/form/file.blade.php: 0ms
[ParserWorker] extractSymbols completed for resources/views/components/event-log/time-form-body.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/components/event-log/time-form-body.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/components/event-log/time-form-body.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/components/event-log/time-form-body.blade.php: 1ms
[ParserWorker] parser.parse() for resources/views/components/form/field-formatter.blade.php: 0ms (2988 bytes)
[ParserWorker] extractSymbols completed for resources/views/components/form/field-formatter.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/components/form/field-formatter.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/components/form/field-formatter.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/components/form/field-formatter.blade.php: 1ms
[ParserWorker] parser.parse() for resources/views/components/form/date-range.blade.php: 0ms (1772 bytes)
[ParserWorker] extractSymbols completed for resources/views/components/form/date-range.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/components/form/date-range.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/components/form/date-range.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/components/form/date-range.blade.php: 0ms
[ParserWorker] parser.parse() for resources/views/components/form/checkbox.blade.php: 0ms (938 bytes)
[ParserWorker] extractSymbols completed for resources/views/components/form/checkbox.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/components/form/checkbox.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/components/form/checkbox.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/components/form/checkbox.blade.php: 0ms
[ParserWorker] parser.parse() for resources/views/components/filters/partials/actions.blade.php: 1ms (763 bytes)
[ParserWorker] extractSymbols completed for resources/views/components/filters/partials/actions.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/components/filters/partials/actions.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/components/filters/partials/actions.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/components/filters/partials/actions.blade.php: 1ms
[ParserWorker] parser.parse() for resources/views/components/filters/input-text.blade.php: 0ms (1072 bytes)
[ParserWorker] extractSymbols completed for resources/views/components/filters/input-text.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/components/filters/input-text.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/components/filters/input-text.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/components/filters/input-text.blade.php: 0ms
[ParserWorker] parser.parse() for resources/views/components/filters/input-text-icon.blade.php: 0ms (2229 bytes)
[ParserWorker] extractSymbols completed for resources/views/components/filters/input-text-icon.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/components/filters/input-text-icon.blade.php: 1ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/components/filters/input-text-icon.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/components/filters/input-text-icon.blade.php: 1ms
[ParserWorker] parser.parse() for resources/views/components/filters/input-select.blade.php: 0ms (1762 bytes)
[ParserWorker] extractSymbols completed for resources/views/components/filters/input-select.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/components/filters/input-select.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/components/filters/input-select.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/components/filters/input-select.blade.php: 0ms
[ParserWorker] parser.parse() for resources/views/components/filters/input-search.blade.php: 0ms (1461 bytes)
[ParserWorker] extractSymbols completed for resources/views/components/filters/input-search.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/components/filters/input-search.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/components/filters/input-search.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/components/filters/input-search.blade.php: 0ms
[ParserWorker] parser.parse() for resources/views/components/filters/input-radio-group.blade.php: 0ms (2968 bytes)
[ParserWorker] extractSymbols completed for resources/views/components/filters/input-radio-group.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/components/filters/input-radio-group.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/components/filters/input-radio-group.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/components/filters/input-radio-group.blade.php: 1ms
[ParserWorker] parser.parse() for resources/views/components/filters/input-radio-group-tabs.blade.php: 0ms (4242 bytes)
[ParserWorker] extractSymbols completed for resources/views/components/filters/input-radio-group-tabs.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/components/filters/input-radio-group-tabs.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/components/filters/input-radio-group-tabs.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/components/filters/input-radio-group-tabs.blade.php: 0ms
[ParserWorker] parser.parse() for resources/views/components/filters/input-radio-group-inline.blade.php: 0ms (1359 bytes)
[ParserWorker] extractSymbols completed for resources/views/components/filters/input-radio-group-inline.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/components/filters/input-radio-group-inline.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/components/filters/input-radio-group-inline.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/components/filters/input-radio-group-inline.blade.php: 0ms
[ParserWorker] parser.parse() for resources/views/components/filters/input-pay-period.blade.php: 1ms (4105 bytes)
[ParserWorker] extractSymbols completed for resources/views/components/filters/input-pay-period.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/components/filters/input-pay-period.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/components/filters/input-pay-period.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/components/filters/input-pay-period.blade.php: 1ms
[ParserWorker] parser.parse() for resources/views/components/filters/input-date-range.blade.php: 0ms (9003 bytes)
[ParserWorker] extractSymbols completed for resources/views/components/filters/input-date-range.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/components/filters/input-date-range.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/components/filters/input-date-range.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/components/filters/input-date-range.blade.php: 1ms
[ParserWorker] parser.parse() for resources/views/components/filters/filter-form.blade.php: 0ms (7085 bytes)
[ParserWorker] extractSymbols completed for resources/views/components/filters/filter-form.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/components/filters/filter-form.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/components/filters/filter-form.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/components/filters/filter-form.blade.php: 1ms
[ParserWorker] parser.parse() for resources/views/components/field-formatter/section-schedule.blade.php: 0ms (2202 bytes)
[ParserWorker] extractSymbols completed for resources/views/components/field-formatter/section-schedule.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/components/field-formatter/section-schedule.blade.php: 1ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/components/field-formatter/section-schedule.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/components/field-formatter/section-schedule.blade.php: 1ms
[ParserWorker] parser.parse() for resources/views/components/field-formatter/section-list.blade.php: 0ms (2271 bytes)
[ParserWorker] extractSymbols completed for resources/views/components/field-formatter/section-list.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/components/field-formatter/section-list.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/components/field-formatter/section-list.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/components/field-formatter/section-list.blade.php: 0ms
[ParserWorker] parser.parse() for resources/views/components/field-formatter/section-generic.blade.php: 0ms (2637 bytes)
[ParserWorker] extractSymbols completed for resources/views/components/field-formatter/section-generic.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/components/field-formatter/section-generic.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/components/field-formatter/section-generic.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/components/field-formatter/section-generic.blade.php: 1ms
[ParserWorker] parser.parse() for resources/views/components/field-formatter/section-equipment.blade.php: 0ms (4048 bytes)
[ParserWorker] extractSymbols completed for resources/views/components/field-formatter/section-equipment.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/components/field-formatter/section-equipment.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/components/field-formatter/section-equipment.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/components/field-formatter/section-equipment.blade.php: 0ms
[ParserWorker] parser.parse() for resources/views/components/field-formatter/section-contact.blade.php: 1ms (2593 bytes)
[ParserWorker] extractSymbols completed for resources/views/components/field-formatter/section-contact.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/components/field-formatter/section-contact.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/components/field-formatter/section-contact.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/components/field-formatter/section-contact.blade.php: 1ms
[ParserWorker] parser.parse() for resources/views/components/field-formatter/printable.blade.php: 0ms (6976 bytes)
[ParserWorker] extractSymbols completed for resources/views/components/field-formatter/printable.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/components/field-formatter/printable.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/components/field-formatter/printable.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/components/field-formatter/printable.blade.php: 0ms
[ParserWorker] parser.parse() for resources/views/components/field-formatter/display.blade.php: 0ms (9835 bytes)
[ParserWorker] extractSymbols completed for resources/views/components/field-formatter/display.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/components/field-formatter/display.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/components/field-formatter/display.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/components/field-formatter/display.blade.php: 0ms
[ParserWorker] parser.parse() for resources/views/components/special-day-panel.blade.php: 0ms (6656 bytes)
[ParserWorker] extractSymbols completed for resources/views/components/special-day-panel.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/components/special-day-panel.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/components/special-day-panel.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/components/special-day-panel.blade.php: 1ms
[ParserWorker] parser.parse() for resources/views/components/special-day-form.blade.php: 0ms (2877 bytes)
[ParserWorker] extractSymbols completed for resources/views/components/special-day-form.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/components/special-day-form.blade.php: 1ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/components/special-day-form.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/components/special-day-form.blade.php: 1ms
[ParserWorker] parser.parse() for resources/views/components/profile/info-field.blade.php: 0ms (1242 bytes)
[ParserWorker] extractSymbols completed for resources/views/components/profile/info-field.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/components/profile/info-field.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/components/profile/info-field.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/components/profile/info-field.blade.php: 0ms
[ParserWorker] parser.parse() for resources/views/components/profile/info-card.blade.php: 0ms (2999 bytes)
[ParserWorker] extractSymbols completed for resources/views/components/profile/info-card.blade.php: 0 symbols in 1ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/components/profile/info-card.blade.php: 1ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/components/profile/info-card.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/components/profile/info-card.blade.php: 1ms
[ParserWorker] parser.parse() for resources/views/components/profile/header.blade.php: 0ms (6321 bytes)
[ParserWorker] extractSymbols completed for resources/views/components/profile/header.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/components/profile/header.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/components/profile/header.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/components/profile/header.blade.php: 0ms
[ParserWorker] parser.parse() for resources/views/components/profile/form-header.blade.php: 0ms (1666 bytes)
[ParserWorker] extractSymbols completed for resources/views/components/profile/form-header.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/components/profile/form-header.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/components/profile/form-header.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/components/profile/form-header.blade.php: 1ms
[ParserWorker] parser.parse() for resources/views/components/navigation/nested-sidebar.blade.php: 0ms (4236 bytes)
[ParserWorker] extractSymbols completed for resources/views/components/navigation/nested-sidebar.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/components/navigation/nested-sidebar.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/components/navigation/nested-sidebar.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/components/navigation/nested-sidebar.blade.php: 0ms
[ParserWorker] parser.parse() for resources/views/components/navigation/nav-tabs.blade.php: 1ms (6003 bytes)
[ParserWorker] extractSymbols completed for resources/views/components/navigation/nav-tabs.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/components/navigation/nav-tabs.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/components/navigation/nav-tabs.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/components/navigation/nav-tabs.blade.php: 1ms
[ParserWorker] parser.parse() for resources/views/components/modals/viewer.blade.php: 0ms (5770 bytes)
[ParserWorker] extractSymbols completed for resources/views/components/modals/viewer.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/components/modals/viewer.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/components/modals/viewer.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/components/modals/viewer.blade.php: 0ms
[ParserWorker] parser.parse() for resources/views/components/modals/staff-events.blade.php: 1ms (9783 bytes)
[ParserWorker] extractSymbols completed for resources/views/components/modals/staff-events.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/components/modals/staff-events.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/components/modals/staff-events.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/components/modals/staff-events.blade.php: 1ms
[ParserWorker] parser.parse() for resources/views/components/modals/event-log-payment.blade.php: 1ms (12409 bytes)
[ParserWorker] extractSymbols completed for resources/views/components/modals/event-log-payment.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/components/modals/event-log-payment.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/components/modals/event-log-payment.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/components/modals/event-log-payment.blade.php: 1ms
[ParserWorker] parser.parse() for resources/views/components/modals/email-quick.blade.php: 1ms (2743 bytes)
[ParserWorker] extractSymbols completed for resources/views/components/modals/email-quick.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/components/modals/email-quick.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/components/modals/email-quick.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/components/modals/email-quick.blade.php: 1ms
[ParserWorker] parser.parse() for resources/views/components/modals/client-event-details-email.blade.php: 0ms (3284 bytes)
[ParserWorker] extractSymbols completed for resources/views/components/modals/client-event-details-email.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/components/modals/client-event-details-email.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/components/modals/client-event-details-email.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/components/modals/client-event-details-email.blade.php: 0ms
[ParserWorker] parser.parse() for resources/views/components/invoices/staff-assignments.blade.php: 1ms (14181 bytes)
[ParserWorker] extractSymbols completed for resources/views/components/invoices/staff-assignments.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/components/invoices/staff-assignments.blade.php: 1ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/components/invoices/staff-assignments.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/components/invoices/staff-assignments.blade.php: 2ms
[ParserWorker] parser.parse() for resources/views/components/form/toggle.blade.php: 0ms (1441 bytes)
[ParserWorker] extractSymbols completed for resources/views/components/form/toggle.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/components/form/toggle.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/components/form/toggle.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/components/form/toggle.blade.php: 0ms
[ParserWorker] parser.parse() for resources/views/components/form/time-range.blade.php: 0ms (3153 bytes)
[ParserWorker] extractSymbols completed for resources/views/components/form/time-range.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/components/form/time-range.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/components/form/time-range.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/components/form/time-range.blade.php: 0ms
[ParserWorker] parser.parse() for resources/views/components/form/time-picker.blade.php: 0ms (4849 bytes)
[ParserWorker] extractSymbols completed for resources/views/components/form/time-picker.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/components/form/time-picker.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/components/form/time-picker.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/components/form/time-picker.blade.php: 0ms
[ParserWorker] parser.parse() for resources/views/components/form/textarea.blade.php: 0ms (995 bytes)
[ParserWorker] extractSymbols completed for resources/views/components/form/textarea.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/components/form/textarea.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/components/form/textarea.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/components/form/textarea.blade.php: 0ms
[ParserWorker] parser.parse() for resources/views/components/form/sticky-footer.blade.php: 1ms (4554 bytes)
[ParserWorker] extractSymbols completed for resources/views/components/form/sticky-footer.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/components/form/sticky-footer.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/components/form/sticky-footer.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/components/form/sticky-footer.blade.php: 1ms
[ParserWorker] parser.parse() for resources/views/components/form/sticky-footer-wizard.blade.php: 0ms (3117 bytes)
[ParserWorker] extractSymbols completed for resources/views/components/form/sticky-footer-wizard.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/components/form/sticky-footer-wizard.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/components/form/sticky-footer-wizard.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/components/form/sticky-footer-wizard.blade.php: 0ms
[ParserWorker] parser.parse() for resources/views/components/form/select.blade.php: 1ms (1289 bytes)
[ParserWorker] extractSymbols completed for resources/views/components/form/select.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/components/form/select.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/components/form/select.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/components/form/select.blade.php: 1ms
[ParserWorker] parser.parse() for resources/views/components/form/search.blade.php: 0ms (1482 bytes)
[ParserWorker] extractSymbols completed for resources/views/components/form/search.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/components/form/search.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/components/form/search.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/components/form/search.blade.php: 0ms
[ParserWorker] parser.parse() for resources/views/components/form/repeater.blade.php: 1ms (7892 bytes)
[ParserWorker] extractSymbols completed for resources/views/components/form/repeater.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/components/form/repeater.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/components/form/repeater.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/components/form/repeater.blade.php: 1ms
[ParserWorker] parser.parse() for resources/views/components/form/radio-group.blade.php: 0ms (1119 bytes)
[ParserWorker] extractSymbols completed for resources/views/components/form/radio-group.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/components/form/radio-group.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/components/form/radio-group.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/components/form/radio-group.blade.php: 0ms
[ParserWorker] parser.parse() for resources/views/components/form/multi-select.blade.php: 0ms (1408 bytes)
[ParserWorker] extractSymbols completed for resources/views/components/form/multi-select.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/components/form/multi-select.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/components/form/multi-select.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/components/form/multi-select.blade.php: 1ms
[ParserWorker] parser.parse() for resources/views/components/form/input.blade.php: 0ms (1134 bytes)
[ParserWorker] extractSymbols completed for resources/views/components/form/input.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/components/form/input.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/components/form/input.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/components/form/input.blade.php: 0ms
[ParserWorker] parser.parse() for resources/views/components/form/input-addon.blade.php: 0ms (2021 bytes)
[ParserWorker] extractSymbols completed for resources/views/components/form/input-addon.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/components/form/input-addon.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/components/form/input-addon.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/components/form/input-addon.blade.php: 0ms
[ParserWorker] parser.parse() for resources/views/components/form/filepond.blade.php: 1ms (4133 bytes)
[ParserWorker] extractSymbols completed for resources/views/components/form/filepond.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/components/form/filepond.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/components/form/filepond.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/components/form/filepond.blade.php: 1ms
[ParserWorker] parser.parse() for resources/views/components/form/file.blade.php: 0ms (1272 bytes)
[ParserWorker] extractSymbols completed for resources/views/components/form/file.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/components/form/file.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/components/form/file.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/components/form/file.blade.php: 0ms
[ParserWorker] parser.parse() for resources/views/components/form/field-formatter.blade.php: 0ms (2988 bytes)
[ParserWorker] extractSymbols completed for resources/views/components/form/field-formatter.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/components/form/field-formatter.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/components/form/field-formatter.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/components/form/field-formatter.blade.php: 1ms
[ParserWorker] parser.parse() for resources/views/components/form/date-range.blade.php: 0ms (1772 bytes)
[ParserWorker] extractSymbols completed for resources/views/components/form/date-range.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/components/form/date-range.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/components/form/date-range.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/components/form/date-range.blade.php: 0ms
[ParserWorker] parser.parse() for resources/views/components/form/checkbox.blade.php: 0ms (938 bytes)
[ParserWorker] extractSymbols completed for resources/views/components/form/checkbox.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/components/form/checkbox.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/components/form/checkbox.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/components/form/checkbox.blade.php: 0ms
[ParserWorker] parser.parse() for resources/views/components/filters/partials/actions.blade.php: 1ms (763 bytes)
[ParserWorker] extractSymbols completed for resources/views/components/filters/partials/actions.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/components/filters/partials/actions.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/components/filters/partials/actions.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/components/filters/partials/actions.blade.php: 1ms
[ParserWorker] parser.parse() for resources/views/components/filters/input-text.blade.php: 0ms (1072 bytes)
[ParserWorker] extractSymbols completed for resources/views/components/filters/input-text.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/components/filters/input-text.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/components/filters/input-text.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/components/filters/input-text.blade.php: 0ms
[ParserWorker] parser.parse() for resources/views/components/filters/input-text-icon.blade.php: 0ms (2229 bytes)
[ParserWorker] extractSymbols completed for resources/views/components/filters/input-text-icon.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/components/filters/input-text-icon.blade.php: 1ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/components/filters/input-text-icon.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/components/filters/input-text-icon.blade.php: 1ms
[ParserWorker] parser.parse() for resources/views/components/filters/input-select.blade.php: 0ms (1762 bytes)
[ParserWorker] extractSymbols completed for resources/views/components/filters/input-select.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/components/filters/input-select.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/components/filters/input-select.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/components/filters/input-select.blade.php: 0ms
[ParserWorker] parser.parse() for resources/views/components/filters/input-search.blade.php: 0ms (1461 bytes)
[ParserWorker] extractSymbols completed for resources/views/components/filters/input-search.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/components/filters/input-search.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/components/filters/input-search.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/components/filters/input-search.blade.php: 0ms
[ParserWorker] parser.parse() for resources/views/components/filters/input-radio-group.blade.php: 0ms (2968 bytes)
[ParserWorker] extractSymbols completed for resources/views/components/filters/input-radio-group.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/components/filters/input-radio-group.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/components/filters/input-radio-group.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/components/filters/input-radio-group.blade.php: 1ms
[ParserWorker] parser.parse() for resources/views/components/filters/input-radio-group-tabs.blade.php: 0ms (4242 bytes)
[ParserWorker] extractSymbols completed for resources/views/components/filters/input-radio-group-tabs.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/components/filters/input-radio-group-tabs.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/components/filters/input-radio-group-tabs.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/components/filters/input-radio-group-tabs.blade.php: 0ms
[ParserWorker] parser.parse() for resources/views/components/filters/input-radio-group-inline.blade.php: 0ms (1359 bytes)
[ParserWorker] extractSymbols completed for resources/views/components/filters/input-radio-group-inline.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/components/filters/input-radio-group-inline.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/components/filters/input-radio-group-inline.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/components/filters/input-radio-group-inline.blade.php: 0ms
[ParserWorker] parser.parse() for resources/views/components/filters/input-pay-period.blade.php: 1ms (4105 bytes)
[ParserWorker] extractSymbols completed for resources/views/components/filters/input-pay-period.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/components/filters/input-pay-period.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/components/filters/input-pay-period.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/components/filters/input-pay-period.blade.php: 1ms
[ParserWorker] parser.parse() for resources/views/components/filters/input-date-range.blade.php: 0ms (9003 bytes)
[ParserWorker] extractSymbols completed for resources/views/components/filters/input-date-range.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/components/filters/input-date-range.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/components/filters/input-date-range.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/components/filters/input-date-range.blade.php: 1ms
[ParserWorker] parser.parse() for resources/views/components/filters/filter-form.blade.php: 0ms (7085 bytes)
[ParserWorker] extractSymbols completed for resources/views/components/filters/filter-form.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/components/filters/filter-form.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/components/filters/filter-form.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/components/filters/filter-form.blade.php: 1ms
[ParserWorker] parser.parse() for resources/views/components/field-formatter/section-schedule.blade.php: 0ms (2202 bytes)
[ParserWorker] extractSymbols completed for resources/views/components/field-formatter/section-schedule.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/components/field-formatter/section-schedule.blade.php: 1ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/components/field-formatter/section-schedule.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/components/field-formatter/section-schedule.blade.php: 1ms
[ParserWorker] parser.parse() for resources/views/components/field-formatter/section-list.blade.php: 0ms (2271 bytes)
[ParserWorker] extractSymbols completed for resources/views/components/field-formatter/section-list.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/components/field-formatter/section-list.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/components/field-formatter/section-list.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/components/field-formatter/section-list.blade.php: 0ms
[ParserWorker] parser.parse() for resources/views/components/field-formatter/section-generic.blade.php: 0ms (2637 bytes)
[ParserWorker] extractSymbols completed for resources/views/components/field-formatter/section-generic.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/components/field-formatter/section-generic.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/components/field-formatter/section-generic.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/components/field-formatter/section-generic.blade.php: 1ms
[ParserWorker] parser.parse() for resources/views/components/field-formatter/section-equipment.blade.php: 0ms (4048 bytes)
[ParserWorker] extractSymbols completed for resources/views/components/field-formatter/section-equipment.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/components/field-formatter/section-equipment.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/components/field-formatter/section-equipment.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/components/field-formatter/section-equipment.blade.php: 0ms
[ParserWorker] parser.parse() for resources/views/components/field-formatter/section-contact.blade.php: 1ms (2593 bytes)
[ParserWorker] extractSymbols completed for resources/views/components/field-formatter/section-contact.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/components/field-formatter/section-contact.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/components/field-formatter/section-contact.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/components/field-formatter/section-contact.blade.php: 1ms
[ParserWorker] parser.parse() for resources/views/components/field-formatter/printable.blade.php: 0ms (6976 bytes)
[ParserWorker] extractSymbols completed for resources/views/components/field-formatter/printable.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/components/field-formatter/printable.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/components/field-formatter/printable.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/components/field-formatter/printable.blade.php: 0ms
[ParserWorker] parser.parse() for resources/views/components/field-formatter/display.blade.php: 0ms (9835 bytes)
[ParserWorker] extractSymbols completed for resources/views/components/field-formatter/display.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/components/field-formatter/display.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/components/field-formatter/display.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/components/field-formatter/display.blade.php: 0ms
[ParserWorker] parser.parse() for resources/views/components/ui/modal.blade.php: 0ms (3375 bytes)
[ParserWorker] extractSymbols completed for resources/views/components/ui/modal.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/components/ui/modal.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/components/ui/modal.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/components/ui/modal.blade.php: 1ms
[ParserWorker] parser.parse() for resources/views/components/ui/dropdown-menu.blade.php: 0ms (7196 bytes)
[ParserWorker] extractSymbols completed for resources/views/components/ui/dropdown-menu.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/components/ui/dropdown-menu.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/components/ui/dropdown-menu.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/components/ui/dropdown-menu.blade.php: 0ms
[ParserWorker] parser.parse() for resources/views/components/ui/breadcrumbs.blade.php: 1ms (3011 bytes)
[ParserWorker] extractSymbols completed for resources/views/components/ui/breadcrumbs.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/components/ui/breadcrumbs.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/components/ui/breadcrumbs.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/components/ui/breadcrumbs.blade.php: 1ms
[ParserWorker] parser.parse() for resources/views/components/ui/action-buttons.blade.php: 0ms (2797 bytes)
[ParserWorker] extractSymbols completed for resources/views/components/ui/action-buttons.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/components/ui/action-buttons.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/components/ui/action-buttons.blade.php: 1ms (0 facts)
[ParserWorker] Total parse operation for resources/views/components/ui/action-buttons.blade.php: 1ms
[ParserWorker] parser.parse() for resources/views/components/tables/truncatable-text.blade.php: 0ms (2375 bytes)
[ParserWorker] extractSymbols completed for resources/views/components/tables/truncatable-text.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/components/tables/truncatable-text.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/components/tables/truncatable-text.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/components/tables/truncatable-text.blade.php: 0ms
[ParserWorker] parser.parse() for resources/views/components/tables/data-table.blade.php: 1ms (25805 bytes)
[ParserWorker] extractSymbols completed for resources/views/components/tables/data-table.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/components/tables/data-table.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/components/tables/data-table.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/components/tables/data-table.blade.php: 2ms
[ParserWorker] parser.parse() for resources/views/components/table/responsive-data-table.blade.php: 0ms (3334 bytes)
[ParserWorker] extractSymbols completed for resources/views/components/table/responsive-data-table.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/components/table/responsive-data-table.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/components/table/responsive-data-table.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/components/table/responsive-data-table.blade.php: 0ms
[ParserWorker] parser.parse() for resources/views/components/table-headers/role-select-all.blade.php: 0ms (181 bytes)
[ParserWorker] extractSymbols completed for resources/views/components/table-headers/role-select-all.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/components/table-headers/role-select-all.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/components/table-headers/role-select-all.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/components/table-headers/role-select-all.blade.php: 0ms
[ParserWorker] parser.parse() for resources/views/components/table-cells/user-upcoming-events.blade.php: 0ms (517 bytes)
[ParserWorker] extractSymbols completed for resources/views/components/table-cells/user-upcoming-events.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/components/table-cells/user-upcoming-events.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/components/table-cells/user-upcoming-events.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/components/table-cells/user-upcoming-events.blade.php: 1ms
[ParserWorker] parser.parse() for resources/views/components/table-cells/user-unlogged-events.blade.php: 0ms (499 bytes)
[ParserWorker] extractSymbols completed for resources/views/components/table-cells/user-unlogged-events.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/components/table-cells/user-unlogged-events.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/components/table-cells/user-unlogged-events.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/components/table-cells/user-unlogged-events.blade.php: 0ms
[ParserWorker] parser.parse() for resources/views/components/table-cells/user-profile-picture.blade.php: 0ms (1393 bytes)
[ParserWorker] extractSymbols completed for resources/views/components/table-cells/user-profile-picture.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/components/table-cells/user-profile-picture.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/components/table-cells/user-profile-picture.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/components/table-cells/user-profile-picture.blade.php: 0ms
[ParserWorker] parser.parse() for resources/views/components/table-cells/user-phone.blade.php: 0ms (179 bytes)
[ParserWorker] extractSymbols completed for resources/views/components/table-cells/user-phone.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/components/table-cells/user-phone.blade.php: 1ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/components/table-cells/user-phone.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/components/table-cells/user-phone.blade.php: 1ms
[ParserWorker] parser.parse() for resources/views/components/table-cells/user-name.blade.php: 0ms (271 bytes)
[ParserWorker] extractSymbols completed for resources/views/components/table-cells/user-name.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/components/table-cells/user-name.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/components/table-cells/user-name.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/components/table-cells/user-name.blade.php: 0ms
[ParserWorker] parser.parse() for resources/views/components/table-cells/user-email.blade.php: 0ms (384 bytes)
[ParserWorker] extractSymbols completed for resources/views/components/table-cells/user-email.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/components/table-cells/user-email.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/components/table-cells/user-email.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/components/table-cells/user-email.blade.php: 0ms
[ParserWorker] parser.parse() for resources/views/components/table-cells/user-address.blade.php: 0ms (262 bytes)
[ParserWorker] extractSymbols completed for resources/views/components/table-cells/user-address.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/components/table-cells/user-address.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/components/table-cells/user-address.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/components/table-cells/user-address.blade.php: 0ms
[ParserWorker] parser.parse() for resources/views/components/table-cells/staff-report-income.blade.php: 0ms (252 bytes)
[ParserWorker] extractSymbols completed for resources/views/components/table-cells/staff-report-income.blade.php: 0 symbols in 1ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/components/table-cells/staff-report-income.blade.php: 1ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/components/table-cells/staff-report-income.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/components/table-cells/staff-report-income.blade.php: 1ms
[ParserWorker] parser.parse() for resources/views/components/table-cells/staff-report-id.blade.php: 0ms (602 bytes)
[ParserWorker] extractSymbols completed for resources/views/components/table-cells/staff-report-id.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/components/table-cells/staff-report-id.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/components/table-cells/staff-report-id.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/components/table-cells/staff-report-id.blade.php: 0ms
[ParserWorker] parser.parse() for resources/views/components/table-cells/staff-report-actions.blade.php: 0ms (2544 bytes)
[ParserWorker] extractSymbols completed for resources/views/components/table-cells/staff-report-actions.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/components/table-cells/staff-report-actions.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/components/table-cells/staff-report-actions.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/components/table-cells/staff-report-actions.blade.php: 0ms
[ParserWorker] parser.parse() for resources/views/components/table-cells/staff-contact.blade.php: 0ms (1538 bytes)
[ParserWorker] extractSymbols completed for resources/views/components/table-cells/staff-contact.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/components/table-cells/staff-contact.blade.php: 1ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/components/table-cells/staff-contact.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/components/table-cells/staff-contact.blade.php: 1ms
[ParserWorker] parser.parse() for resources/views/components/table-cells/staff-actions.blade.php: 0ms (5574 bytes)
[ParserWorker] extractSymbols completed for resources/views/components/table-cells/staff-actions.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/components/table-cells/staff-actions.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/components/table-cells/staff-actions.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/components/table-cells/staff-actions.blade.php: 0ms
[ParserWorker] parser.parse() for resources/views/components/table-cells/role-permissions.blade.php: 0ms (1196 bytes)
[ParserWorker] extractSymbols completed for resources/views/components/table-cells/role-permissions.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/components/table-cells/role-permissions.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/components/table-cells/role-permissions.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/components/table-cells/role-permissions.blade.php: 0ms
[ParserWorker] parser.parse() for resources/views/components/table-cells/role-name.blade.php: 0ms (974 bytes)
[ParserWorker] extractSymbols completed for resources/views/components/table-cells/role-name.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/components/table-cells/role-name.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/components/table-cells/role-name.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/components/table-cells/role-name.blade.php: 0ms
[ParserWorker] parser.parse() for resources/views/components/table-cells/role-checkbox.blade.php: 0ms (237 bytes)
[ParserWorker] extractSymbols completed for resources/views/components/table-cells/role-checkbox.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/components/table-cells/role-checkbox.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/components/table-cells/role-checkbox.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/components/table-cells/role-checkbox.blade.php: 0ms
[ParserWorker] parser.parse() for resources/views/components/table-cells/role-actions.blade.php: 1ms (6423 bytes)
[ParserWorker] extractSymbols completed for resources/views/components/table-cells/role-actions.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/components/table-cells/role-actions.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/components/table-cells/role-actions.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/components/table-cells/role-actions.blade.php: 1ms
[ParserWorker] parser.parse() for resources/views/components/table-cells/permission-type.blade.php: 0ms (786 bytes)
[ParserWorker] extractSymbols completed for resources/views/components/table-cells/permission-type.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/components/table-cells/permission-type.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/components/table-cells/permission-type.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/components/table-cells/permission-type.blade.php: 0ms
[ParserWorker] parser.parse() for resources/views/components/table-cells/permission-code.blade.php: 0ms (691 bytes)
[ParserWorker] extractSymbols completed for resources/views/components/table-cells/permission-code.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/components/table-cells/permission-code.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/components/table-cells/permission-code.blade.php: 1ms (0 facts)
[ParserWorker] Total parse operation for resources/views/components/table-cells/permission-code.blade.php: 1ms
[ParserWorker] parser.parse() for resources/views/components/table-cells/permission-category.blade.php: 0ms (255 bytes)
[ParserWorker] extractSymbols completed for resources/views/components/table-cells/permission-category.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/components/table-cells/permission-category.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/components/table-cells/permission-category.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/components/table-cells/permission-category.blade.php: 0ms
[ParserWorker] parser.parse() for resources/views/components/table-cells/permission-actions.blade.php: 1ms (3709 bytes)
[ParserWorker] extractSymbols completed for resources/views/components/table-cells/permission-actions.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/components/table-cells/permission-actions.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/components/table-cells/permission-actions.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/components/table-cells/permission-actions.blade.php: 1ms
[ParserWorker] parser.parse() for resources/views/components/table-cells/payment-status-compact.blade.php: 0ms (661 bytes)
[ParserWorker] extractSymbols completed for resources/views/components/table-cells/payment-status-compact.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/components/table-cells/payment-status-compact.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/components/table-cells/payment-status-compact.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/components/table-cells/payment-status-compact.blade.php: 0ms
[ParserWorker] parser.parse() for resources/views/components/table-cells/invoice-event-title.blade.php: 0ms (718 bytes)
[ParserWorker] extractSymbols completed for resources/views/components/table-cells/invoice-event-title.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/components/table-cells/invoice-event-title.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/components/table-cells/invoice-event-title.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/components/table-cells/invoice-event-title.blade.php: 0ms
[ParserWorker] parser.parse() for resources/views/components/table-cells/invoice-event-actions.blade.php: 0ms (1964 bytes)
[ParserWorker] extractSymbols completed for resources/views/components/table-cells/invoice-event-actions.blade.php: 0 symbols in 1ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/components/table-cells/invoice-event-actions.blade.php: 1ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/components/table-cells/invoice-event-actions.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/components/table-cells/invoice-event-actions.blade.php: 1ms
[ParserWorker] parser.parse() for resources/views/components/table-cells/event-status.blade.php: 0ms (1685 bytes)
[ParserWorker] extractSymbols completed for resources/views/components/table-cells/event-status.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/components/table-cells/event-status.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/components/table-cells/event-status.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/components/table-cells/event-status.blade.php: 0ms
[ParserWorker] parser.parse() for resources/views/components/table-cells/event-id.blade.php: 0ms (482 bytes)
[ParserWorker] extractSymbols completed for resources/views/components/table-cells/event-id.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/components/table-cells/event-id.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/components/table-cells/event-id.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/components/table-cells/event-id.blade.php: 0ms
[ParserWorker] parser.parse() for resources/views/components/table-cells/event-datetime.blade.php: 0ms (411 bytes)
[ParserWorker] extractSymbols completed for resources/views/components/table-cells/event-datetime.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/components/table-cells/event-datetime.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/components/table-cells/event-datetime.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/components/table-cells/event-datetime.blade.php: 1ms
[ParserWorker] parser.parse() for resources/views/components/table-cells/event-date.blade.php: 0ms (439 bytes)
[ParserWorker] extractSymbols completed for resources/views/components/table-cells/event-date.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/components/table-cells/event-date.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/components/table-cells/event-date.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/components/table-cells/event-date.blade.php: 0ms
[ParserWorker] parser.parse() for resources/views/components/table-cells/event-client.blade.php: 0ms (532 bytes)
[ParserWorker] extractSymbols completed for resources/views/components/table-cells/event-client.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/components/table-cells/event-client.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/components/table-cells/event-client.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/components/table-cells/event-client.blade.php: 0ms
[ParserWorker] parser.parse() for resources/views/components/table-cells/event-client-creator.blade.php: 0ms (1125 bytes)
[ParserWorker] extractSymbols completed for resources/views/components/table-cells/event-client-creator.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/components/table-cells/event-client-creator.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/components/table-cells/event-client-creator.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/components/table-cells/event-client-creator.blade.php: 0ms
[ParserWorker] parser.parse() for resources/views/components/table-cells/event-actions.blade.php: 0ms (4343 bytes)
[ParserWorker] extractSymbols completed for resources/views/components/table-cells/event-actions.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/components/table-cells/event-actions.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/components/table-cells/event-actions.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/components/table-cells/event-actions.blade.php: 0ms
[ParserWorker] parser.parse() for resources/views/components/table-cells/client-upcoming-events.blade.php: 0ms (469 bytes)
[ParserWorker] extractSymbols completed for resources/views/components/table-cells/client-upcoming-events.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/components/table-cells/client-upcoming-events.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/components/table-cells/client-upcoming-events.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/components/table-cells/client-upcoming-events.blade.php: 0ms
[ParserWorker] parser.parse() for resources/views/components/table-cells/client-recent-events.blade.php: 1ms (467 bytes)
[ParserWorker] extractSymbols completed for resources/views/components/table-cells/client-recent-events.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/components/table-cells/client-recent-events.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/components/table-cells/client-recent-events.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/components/table-cells/client-recent-events.blade.php: 1ms
[ParserWorker] parser.parse() for resources/views/components/table-cells/client-phone.blade.php: 0ms (151 bytes)
[ParserWorker] extractSymbols completed for resources/views/components/table-cells/client-phone.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/components/table-cells/client-phone.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/components/table-cells/client-phone.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/components/table-cells/client-phone.blade.php: 0ms
[ParserWorker] parser.parse() for resources/views/components/table-cells/client-name.blade.php: 0ms (762 bytes)
[ParserWorker] extractSymbols completed for resources/views/components/table-cells/client-name.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/components/table-cells/client-name.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/components/table-cells/client-name.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/components/table-cells/client-name.blade.php: 0ms
[ParserWorker] parser.parse() for resources/views/components/table-cells/client-events.blade.php: 0ms (179 bytes)
[ParserWorker] extractSymbols completed for resources/views/components/table-cells/client-events.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/components/table-cells/client-events.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/components/table-cells/client-events.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/components/table-cells/client-events.blade.php: 0ms
[ParserWorker] parser.parse() for resources/views/components/table-cells/client-email.blade.php: 0ms (356 bytes)
[ParserWorker] extractSymbols completed for resources/views/components/table-cells/client-email.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/components/table-cells/client-email.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/components/table-cells/client-email.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/components/table-cells/client-email.blade.php: 0ms
[ParserWorker] parser.parse() for resources/views/components/table-cells/client-contact.blade.php: 0ms (2343 bytes)
[ParserWorker] extractSymbols completed for resources/views/components/table-cells/client-contact.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/components/table-cells/client-contact.blade.php: 1ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/components/table-cells/client-contact.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/components/table-cells/client-contact.blade.php: 1ms
[ParserWorker] parser.parse() for resources/views/components/table-cells/client-address.blade.php: 0ms (234 bytes)
[ParserWorker] extractSymbols completed for resources/views/components/table-cells/client-address.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/components/table-cells/client-address.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/components/table-cells/client-address.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/components/table-cells/client-address.blade.php: 0ms
[ParserWorker] parser.parse() for resources/views/components/table-cells/client-actions.blade.php: 0ms (3160 bytes)
[ParserWorker] extractSymbols completed for resources/views/components/table-cells/client-actions.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/components/table-cells/client-actions.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/components/table-cells/client-actions.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/components/table-cells/client-actions.blade.php: 0ms
[ParserWorker] parser.parse() for resources/views/components/table-cells/admin-pay-tracker-actions.blade.php: 0ms (2075 bytes)
[ParserWorker] extractSymbols completed for resources/views/components/table-cells/admin-pay-tracker-actions.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/components/table-cells/admin-pay-tracker-actions.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/components/table-cells/admin-pay-tracker-actions.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/components/table-cells/admin-pay-tracker-actions.blade.php: 1ms
[ParserWorker] parser.parse() for resources/views/components/staff-search-list.blade.php: 0ms (829 bytes)
[ParserWorker] extractSymbols completed for resources/views/components/staff-search-list.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/components/staff-search-list.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/components/staff-search-list.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/components/staff-search-list.blade.php: 0ms
[ParserWorker] parser.parse() for resources/views/components/special-day-panel.blade.php: 0ms (6656 bytes)
[ParserWorker] extractSymbols completed for resources/views/components/special-day-panel.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/components/special-day-panel.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/components/special-day-panel.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/components/special-day-panel.blade.php: 1ms
[ParserWorker] parser.parse() for resources/views/components/ui/status-badge.blade.php: 0ms (1195 bytes)
[ParserWorker] extractSymbols completed for resources/views/components/ui/status-badge.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/components/ui/status-badge.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/components/ui/status-badge.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/components/ui/status-badge.blade.php: 1ms
[ParserWorker] parser.parse() for resources/views/components/ui/modal.blade.php: 0ms (3375 bytes)
[ParserWorker] extractSymbols completed for resources/views/components/ui/modal.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/components/ui/modal.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/components/ui/modal.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/components/ui/modal.blade.php: 1ms
[ParserWorker] parser.parse() for resources/views/components/ui/dropdown-menu.blade.php: 0ms (7196 bytes)
[ParserWorker] extractSymbols completed for resources/views/components/ui/dropdown-menu.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/components/ui/dropdown-menu.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/components/ui/dropdown-menu.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/components/ui/dropdown-menu.blade.php: 0ms
[ParserWorker] parser.parse() for resources/views/components/ui/breadcrumbs.blade.php: 1ms (3011 bytes)
[ParserWorker] extractSymbols completed for resources/views/components/ui/breadcrumbs.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/components/ui/breadcrumbs.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/components/ui/breadcrumbs.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/components/ui/breadcrumbs.blade.php: 1ms
[ParserWorker] parser.parse() for resources/views/components/ui/action-buttons.blade.php: 0ms (2797 bytes)
[ParserWorker] extractSymbols completed for resources/views/components/ui/action-buttons.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/components/ui/action-buttons.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/components/ui/action-buttons.blade.php: 1ms (0 facts)
[ParserWorker] Total parse operation for resources/views/components/ui/action-buttons.blade.php: 1ms
[ParserWorker] parser.parse() for resources/views/components/tables/truncatable-text.blade.php: 0ms (2375 bytes)
[ParserWorker] extractSymbols completed for resources/views/components/tables/truncatable-text.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/components/tables/truncatable-text.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/components/tables/truncatable-text.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/components/tables/truncatable-text.blade.php: 0ms
[ParserWorker] parser.parse() for resources/views/components/tables/data-table.blade.php: 1ms (25805 bytes)
[ParserWorker] extractSymbols completed for resources/views/components/tables/data-table.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/components/tables/data-table.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/components/tables/data-table.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/components/tables/data-table.blade.php: 2ms
[ParserWorker] parser.parse() for resources/views/components/table/responsive-data-table.blade.php: 0ms (3334 bytes)
[ParserWorker] extractSymbols completed for resources/views/components/table/responsive-data-table.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/components/table/responsive-data-table.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/components/table/responsive-data-table.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/components/table/responsive-data-table.blade.php: 0ms
[ParserWorker] parser.parse() for resources/views/components/table-headers/role-select-all.blade.php: 0ms (181 bytes)
[ParserWorker] extractSymbols completed for resources/views/components/table-headers/role-select-all.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/components/table-headers/role-select-all.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/components/table-headers/role-select-all.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/components/table-headers/role-select-all.blade.php: 0ms
[ParserWorker] parser.parse() for resources/views/components/table-cells/user-upcoming-events.blade.php: 0ms (517 bytes)
[ParserWorker] extractSymbols completed for resources/views/components/table-cells/user-upcoming-events.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/components/table-cells/user-upcoming-events.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/components/table-cells/user-upcoming-events.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/components/table-cells/user-upcoming-events.blade.php: 1ms
[ParserWorker] parser.parse() for resources/views/components/table-cells/user-unlogged-events.blade.php: 0ms (499 bytes)
[ParserWorker] extractSymbols completed for resources/views/components/table-cells/user-unlogged-events.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/components/table-cells/user-unlogged-events.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/components/table-cells/user-unlogged-events.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/components/table-cells/user-unlogged-events.blade.php: 0ms
[ParserWorker] parser.parse() for resources/views/components/table-cells/user-profile-picture.blade.php: 0ms (1393 bytes)
[ParserWorker] extractSymbols completed for resources/views/components/table-cells/user-profile-picture.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/components/table-cells/user-profile-picture.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/components/table-cells/user-profile-picture.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/components/table-cells/user-profile-picture.blade.php: 0ms
[ParserWorker] parser.parse() for resources/views/components/table-cells/user-phone.blade.php: 0ms (179 bytes)
[ParserWorker] extractSymbols completed for resources/views/components/table-cells/user-phone.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/components/table-cells/user-phone.blade.php: 1ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/components/table-cells/user-phone.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/components/table-cells/user-phone.blade.php: 1ms
[ParserWorker] parser.parse() for resources/views/components/table-cells/user-name.blade.php: 0ms (271 bytes)
[ParserWorker] extractSymbols completed for resources/views/components/table-cells/user-name.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/components/table-cells/user-name.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/components/table-cells/user-name.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/components/table-cells/user-name.blade.php: 0ms
[ParserWorker] parser.parse() for resources/views/components/table-cells/user-email.blade.php: 0ms (384 bytes)
[ParserWorker] extractSymbols completed for resources/views/components/table-cells/user-email.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/components/table-cells/user-email.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/components/table-cells/user-email.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/components/table-cells/user-email.blade.php: 0ms
[ParserWorker] parser.parse() for resources/views/components/table-cells/user-address.blade.php: 0ms (262 bytes)
[ParserWorker] extractSymbols completed for resources/views/components/table-cells/user-address.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/components/table-cells/user-address.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/components/table-cells/user-address.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/components/table-cells/user-address.blade.php: 0ms
[ParserWorker] parser.parse() for resources/views/components/table-cells/staff-report-income.blade.php: 0ms (252 bytes)
[ParserWorker] extractSymbols completed for resources/views/components/table-cells/staff-report-income.blade.php: 0 symbols in 1ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/components/table-cells/staff-report-income.blade.php: 1ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/components/table-cells/staff-report-income.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/components/table-cells/staff-report-income.blade.php: 1ms
[ParserWorker] parser.parse() for resources/views/components/table-cells/staff-report-id.blade.php: 0ms (602 bytes)
[ParserWorker] extractSymbols completed for resources/views/components/table-cells/staff-report-id.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/components/table-cells/staff-report-id.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/components/table-cells/staff-report-id.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/components/table-cells/staff-report-id.blade.php: 0ms
[ParserWorker] parser.parse() for resources/views/components/table-cells/staff-report-actions.blade.php: 0ms (2544 bytes)
[ParserWorker] extractSymbols completed for resources/views/components/table-cells/staff-report-actions.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/components/table-cells/staff-report-actions.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/components/table-cells/staff-report-actions.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/components/table-cells/staff-report-actions.blade.php: 0ms
[ParserWorker] parser.parse() for resources/views/components/table-cells/staff-contact.blade.php: 0ms (1538 bytes)
[ParserWorker] extractSymbols completed for resources/views/components/table-cells/staff-contact.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/components/table-cells/staff-contact.blade.php: 1ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/components/table-cells/staff-contact.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/components/table-cells/staff-contact.blade.php: 1ms
[ParserWorker] parser.parse() for resources/views/components/table-cells/staff-actions.blade.php: 0ms (5574 bytes)
[ParserWorker] extractSymbols completed for resources/views/components/table-cells/staff-actions.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/components/table-cells/staff-actions.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/components/table-cells/staff-actions.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/components/table-cells/staff-actions.blade.php: 0ms
[ParserWorker] parser.parse() for resources/views/components/table-cells/role-permissions.blade.php: 0ms (1196 bytes)
[ParserWorker] extractSymbols completed for resources/views/components/table-cells/role-permissions.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/components/table-cells/role-permissions.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/components/table-cells/role-permissions.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/components/table-cells/role-permissions.blade.php: 0ms
[ParserWorker] parser.parse() for resources/views/components/table-cells/role-name.blade.php: 0ms (974 bytes)
[ParserWorker] extractSymbols completed for resources/views/components/table-cells/role-name.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/components/table-cells/role-name.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/components/table-cells/role-name.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/components/table-cells/role-name.blade.php: 0ms
[ParserWorker] parser.parse() for resources/views/components/table-cells/role-checkbox.blade.php: 0ms (237 bytes)
[ParserWorker] extractSymbols completed for resources/views/components/table-cells/role-checkbox.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/components/table-cells/role-checkbox.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/components/table-cells/role-checkbox.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/components/table-cells/role-checkbox.blade.php: 0ms
[ParserWorker] parser.parse() for resources/views/components/table-cells/role-actions.blade.php: 1ms (6423 bytes)
[ParserWorker] extractSymbols completed for resources/views/components/table-cells/role-actions.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/components/table-cells/role-actions.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/components/table-cells/role-actions.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/components/table-cells/role-actions.blade.php: 1ms
[ParserWorker] parser.parse() for resources/views/components/table-cells/permission-type.blade.php: 0ms (786 bytes)
[ParserWorker] extractSymbols completed for resources/views/components/table-cells/permission-type.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/components/table-cells/permission-type.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/components/table-cells/permission-type.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/components/table-cells/permission-type.blade.php: 0ms
[ParserWorker] parser.parse() for resources/views/components/table-cells/permission-code.blade.php: 0ms (691 bytes)
[ParserWorker] extractSymbols completed for resources/views/components/table-cells/permission-code.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/components/table-cells/permission-code.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/components/table-cells/permission-code.blade.php: 1ms (0 facts)
[ParserWorker] Total parse operation for resources/views/components/table-cells/permission-code.blade.php: 1ms
[ParserWorker] parser.parse() for resources/views/components/table-cells/permission-category.blade.php: 0ms (255 bytes)
[ParserWorker] extractSymbols completed for resources/views/components/table-cells/permission-category.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/components/table-cells/permission-category.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/components/table-cells/permission-category.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/components/table-cells/permission-category.blade.php: 0ms
[ParserWorker] parser.parse() for resources/views/components/table-cells/permission-actions.blade.php: 1ms (3709 bytes)
[ParserWorker] extractSymbols completed for resources/views/components/table-cells/permission-actions.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/components/table-cells/permission-actions.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/components/table-cells/permission-actions.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/components/table-cells/permission-actions.blade.php: 1ms
[ParserWorker] parser.parse() for resources/views/components/table-cells/payment-status-compact.blade.php: 0ms (661 bytes)
[ParserWorker] extractSymbols completed for resources/views/components/table-cells/payment-status-compact.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/components/table-cells/payment-status-compact.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/components/table-cells/payment-status-compact.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/components/table-cells/payment-status-compact.blade.php: 0ms
[ParserWorker] parser.parse() for resources/views/components/table-cells/invoice-event-title.blade.php: 0ms (718 bytes)
[ParserWorker] extractSymbols completed for resources/views/components/table-cells/invoice-event-title.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/components/table-cells/invoice-event-title.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/components/table-cells/invoice-event-title.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/components/table-cells/invoice-event-title.blade.php: 0ms
[ParserWorker] parser.parse() for resources/views/components/table-cells/invoice-event-actions.blade.php: 0ms (1964 bytes)
[ParserWorker] extractSymbols completed for resources/views/components/table-cells/invoice-event-actions.blade.php: 0 symbols in 1ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/components/table-cells/invoice-event-actions.blade.php: 1ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/components/table-cells/invoice-event-actions.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/components/table-cells/invoice-event-actions.blade.php: 1ms
[ParserWorker] parser.parse() for resources/views/components/table-cells/event-status.blade.php: 0ms (1685 bytes)
[ParserWorker] extractSymbols completed for resources/views/components/table-cells/event-status.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/components/table-cells/event-status.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/components/table-cells/event-status.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/components/table-cells/event-status.blade.php: 0ms
[ParserWorker] parser.parse() for resources/views/components/table-cells/event-id.blade.php: 0ms (482 bytes)
[ParserWorker] extractSymbols completed for resources/views/components/table-cells/event-id.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/components/table-cells/event-id.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/components/table-cells/event-id.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/components/table-cells/event-id.blade.php: 0ms
[ParserWorker] parser.parse() for resources/views/components/table-cells/event-datetime.blade.php: 0ms (411 bytes)
[ParserWorker] extractSymbols completed for resources/views/components/table-cells/event-datetime.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/components/table-cells/event-datetime.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/components/table-cells/event-datetime.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/components/table-cells/event-datetime.blade.php: 1ms
[ParserWorker] parser.parse() for resources/views/components/table-cells/event-date.blade.php: 0ms (439 bytes)
[ParserWorker] extractSymbols completed for resources/views/components/table-cells/event-date.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/components/table-cells/event-date.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/components/table-cells/event-date.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/components/table-cells/event-date.blade.php: 0ms
[ParserWorker] parser.parse() for resources/views/components/table-cells/event-client.blade.php: 0ms (532 bytes)
[ParserWorker] extractSymbols completed for resources/views/components/table-cells/event-client.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/components/table-cells/event-client.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/components/table-cells/event-client.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/components/table-cells/event-client.blade.php: 0ms
[ParserWorker] parser.parse() for resources/views/components/table-cells/event-client-creator.blade.php: 0ms (1125 bytes)
[ParserWorker] extractSymbols completed for resources/views/components/table-cells/event-client-creator.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/components/table-cells/event-client-creator.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/components/table-cells/event-client-creator.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/components/table-cells/event-client-creator.blade.php: 0ms
[ParserWorker] parser.parse() for resources/views/components/table-cells/event-actions.blade.php: 0ms (4343 bytes)
[ParserWorker] extractSymbols completed for resources/views/components/table-cells/event-actions.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/components/table-cells/event-actions.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/components/table-cells/event-actions.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/components/table-cells/event-actions.blade.php: 0ms
[ParserWorker] parser.parse() for resources/views/components/table-cells/client-upcoming-events.blade.php: 0ms (469 bytes)
[ParserWorker] extractSymbols completed for resources/views/components/table-cells/client-upcoming-events.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/components/table-cells/client-upcoming-events.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/components/table-cells/client-upcoming-events.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/components/table-cells/client-upcoming-events.blade.php: 0ms
[ParserWorker] parser.parse() for resources/views/components/table-cells/client-recent-events.blade.php: 1ms (467 bytes)
[ParserWorker] extractSymbols completed for resources/views/components/table-cells/client-recent-events.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/components/table-cells/client-recent-events.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/components/table-cells/client-recent-events.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/components/table-cells/client-recent-events.blade.php: 1ms
[ParserWorker] parser.parse() for resources/views/components/table-cells/client-phone.blade.php: 0ms (151 bytes)
[ParserWorker] extractSymbols completed for resources/views/components/table-cells/client-phone.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/components/table-cells/client-phone.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/components/table-cells/client-phone.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/components/table-cells/client-phone.blade.php: 0ms
[ParserWorker] parser.parse() for resources/views/components/table-cells/client-name.blade.php: 0ms (762 bytes)
[ParserWorker] extractSymbols completed for resources/views/components/table-cells/client-name.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/components/table-cells/client-name.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/components/table-cells/client-name.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/components/table-cells/client-name.blade.php: 0ms
[ParserWorker] parser.parse() for resources/views/components/table-cells/client-events.blade.php: 0ms (179 bytes)
[ParserWorker] extractSymbols completed for resources/views/components/table-cells/client-events.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/components/table-cells/client-events.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/components/table-cells/client-events.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/components/table-cells/client-events.blade.php: 0ms
[ParserWorker] parser.parse() for resources/views/components/table-cells/client-email.blade.php: 0ms (356 bytes)
[ParserWorker] extractSymbols completed for resources/views/components/table-cells/client-email.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/components/table-cells/client-email.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/components/table-cells/client-email.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/components/table-cells/client-email.blade.php: 0ms
[ParserWorker] parser.parse() for resources/views/components/table-cells/client-contact.blade.php: 0ms (2343 bytes)
[ParserWorker] extractSymbols completed for resources/views/components/table-cells/client-contact.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/components/table-cells/client-contact.blade.php: 1ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/components/table-cells/client-contact.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/components/table-cells/client-contact.blade.php: 1ms
[ParserWorker] parser.parse() for resources/views/components/table-cells/client-address.blade.php: 0ms (234 bytes)
[ParserWorker] extractSymbols completed for resources/views/components/table-cells/client-address.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/components/table-cells/client-address.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/components/table-cells/client-address.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/components/table-cells/client-address.blade.php: 0ms
[ParserWorker] parser.parse() for resources/views/components/table-cells/client-actions.blade.php: 0ms (3160 bytes)
[ParserWorker] extractSymbols completed for resources/views/components/table-cells/client-actions.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/components/table-cells/client-actions.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/components/table-cells/client-actions.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/components/table-cells/client-actions.blade.php: 0ms
[ParserWorker] parser.parse() for resources/views/components/table-cells/admin-pay-tracker-actions.blade.php: 0ms (2075 bytes)
[ParserWorker] extractSymbols completed for resources/views/components/table-cells/admin-pay-tracker-actions.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/components/table-cells/admin-pay-tracker-actions.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/components/table-cells/admin-pay-tracker-actions.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/components/table-cells/admin-pay-tracker-actions.blade.php: 1ms
[ParserWorker] parser.parse() for resources/views/components/staff-search-list.blade.php: 0ms (829 bytes)
[ParserWorker] extractSymbols completed for resources/views/components/staff-search-list.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/components/staff-search-list.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/components/staff-search-list.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/components/staff-search-list.blade.php: 0ms
[ParserWorker] parser.parse() for resources/views/icons/user-plus.blade.php: 0ms (116 bytes)
[ParserWorker] extractSymbols completed for resources/views/icons/user-plus.blade.php: 0 symbols in 0ms (54 iterations)
[ParserWorker] extractSymbols for resources/views/icons/user-plus.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/icons/user-plus.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/icons/user-plus.blade.php: 1ms
[ParserWorker] parser.parse() for resources/views/icons/truck.blade.php: 0ms (112 bytes)
[ParserWorker] extractSymbols completed for resources/views/icons/truck.blade.php: 0 symbols in 0ms (54 iterations)
[ParserWorker] extractSymbols for resources/views/icons/truck.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/icons/truck.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/icons/truck.blade.php: 0ms
[ParserWorker] parser.parse() for resources/views/icons/tag.blade.php: 0ms (110 bytes)
[ParserWorker] extractSymbols completed for resources/views/icons/tag.blade.php: 0 symbols in 1ms (54 iterations)
[ParserWorker] extractSymbols for resources/views/icons/tag.blade.php: 1ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/icons/tag.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/icons/tag.blade.php: 1ms
[ParserWorker] parser.parse() for resources/views/icons/sparkles.blade.php: 0ms (115 bytes)
[ParserWorker] extractSymbols completed for resources/views/icons/sparkles.blade.php: 0 symbols in 0ms (54 iterations)
[ParserWorker] extractSymbols for resources/views/icons/sparkles.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/icons/sparkles.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/icons/sparkles.blade.php: 0ms
[ParserWorker] parser.parse() for resources/views/icons/print.blade.php: 0ms (114 bytes)
[ParserWorker] extractSymbols completed for resources/views/icons/print.blade.php: 0 symbols in 0ms (54 iterations)
[ParserWorker] extractSymbols for resources/views/icons/print.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/icons/print.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/icons/print.blade.php: 0ms
[ParserWorker] parser.parse() for resources/views/icons/plus.blade.php: 0ms (111 bytes)
[ParserWorker] extractSymbols completed for resources/views/icons/plus.blade.php: 0 symbols in 0ms (54 iterations)
[ParserWorker] extractSymbols for resources/views/icons/plus.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/icons/plus.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/icons/plus.blade.php: 1ms
[ParserWorker] parser.parse() for resources/views/icons/folder.blade.php: 0ms (113 bytes)
[ParserWorker] extractSymbols completed for resources/views/icons/folder.blade.php: 0 symbols in 0ms (54 iterations)
[ParserWorker] extractSymbols for resources/views/icons/folder.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/icons/folder.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/icons/folder.blade.php: 0ms
[ParserWorker] parser.parse() for resources/views/icons/eye.blade.php: 0ms (100 bytes)
[ParserWorker] extractSymbols completed for resources/views/icons/eye.blade.php: 0 symbols in 0ms (54 iterations)
[ParserWorker] extractSymbols for resources/views/icons/eye.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/icons/eye.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/icons/eye.blade.php: 0ms
[ParserWorker] parser.parse() for resources/views/icons/eye-slash.blade.php: 0ms (106 bytes)
[ParserWorker] extractSymbols completed for resources/views/icons/eye-slash.blade.php: 0 symbols in 0ms (54 iterations)
[ParserWorker] extractSymbols for resources/views/icons/eye-slash.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/icons/eye-slash.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/icons/eye-slash.blade.php: 0ms
[ParserWorker] parser.parse() for resources/views/icons/exclamation-triangle.blade.php: 0ms (127 bytes)
[ParserWorker] extractSymbols completed for resources/views/icons/exclamation-triangle.blade.php: 0 symbols in 0ms (54 iterations)
[ParserWorker] extractSymbols for resources/views/icons/exclamation-triangle.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/icons/exclamation-triangle.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/icons/exclamation-triangle.blade.php: 0ms
[ParserWorker] parser.parse() for resources/views/icons/exclamation-circle.blade.php: 0ms (125 bytes)
[ParserWorker] extractSymbols completed for resources/views/icons/exclamation-circle.blade.php: 0 symbols in 0ms (54 iterations)
[ParserWorker] extractSymbols for resources/views/icons/exclamation-circle.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/icons/exclamation-circle.blade.php: 1ms (0 facts)
[ParserWorker] Total parse operation for resources/views/icons/exclamation-circle.blade.php: 1ms
[ParserWorker] parser.parse() for resources/views/icons/envelope.blade.php: 0ms (115 bytes)
[ParserWorker] extractSymbols completed for resources/views/icons/envelope.blade.php: 0 symbols in 0ms (54 iterations)
[ParserWorker] extractSymbols for resources/views/icons/envelope.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/icons/envelope.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/icons/envelope.blade.php: 0ms
[ParserWorker] parser.parse() for resources/views/icons/document-text.blade.php: 0ms (120 bytes)
[ParserWorker] extractSymbols completed for resources/views/icons/document-text.blade.php: 0 symbols in 0ms (54 iterations)
[ParserWorker] extractSymbols for resources/views/icons/document-text.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/icons/document-text.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/icons/document-text.blade.php: 0ms
[ParserWorker] parser.parse() for resources/views/icons/cube.blade.php: 0ms (111 bytes)
[ParserWorker] extractSymbols completed for resources/views/icons/cube.blade.php: 0 symbols in 0ms (54 iterations)
[ParserWorker] extractSymbols for resources/views/icons/cube.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/icons/cube.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/icons/cube.blade.php: 1ms
[ParserWorker] parser.parse() for resources/views/icons/clock.blade.php: 0ms (112 bytes)
[ParserWorker] extractSymbols completed for resources/views/icons/clock.blade.php: 0 symbols in 0ms (54 iterations)
[ParserWorker] extractSymbols for resources/views/icons/clock.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/icons/clock.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/icons/clock.blade.php: 0ms
[ParserWorker] parser.parse() for resources/views/icons/clipboard-document-list.blade.php: 0ms (130 bytes)
[ParserWorker] extractSymbols completed for resources/views/icons/clipboard-document-list.blade.php: 0 symbols in 0ms (54 iterations)
[ParserWorker] extractSymbols for resources/views/icons/clipboard-document-list.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/icons/clipboard-document-list.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/icons/clipboard-document-list.blade.php: 0ms
[ParserWorker] parser.parse() for resources/views/icons/chevron-down.blade.php: 0ms (119 bytes)
[ParserWorker] extractSymbols completed for resources/views/icons/chevron-down.blade.php: 0 symbols in 0ms (54 iterations)
[ParserWorker] extractSymbols for resources/views/icons/chevron-down.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/icons/chevron-down.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/icons/chevron-down.blade.php: 0ms
[ParserWorker] parser.parse() for resources/views/icons/chat-bubble-left.blade.php: 0ms (123 bytes)
[ParserWorker] extractSymbols completed for resources/views/icons/chat-bubble-left.blade.php: 0 symbols in 0ms (54 iterations)
[ParserWorker] extractSymbols for resources/views/icons/chat-bubble-left.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/icons/chat-bubble-left.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/icons/chat-bubble-left.blade.php: 0ms
[ParserWorker] parser.parse() for resources/views/icons/chat-bubble-left-right.blade.php: 0ms (129 bytes)
[ParserWorker] extractSymbols completed for resources/views/icons/chat-bubble-left-right.blade.php: 0 symbols in 0ms (54 iterations)
[ParserWorker] extractSymbols for resources/views/icons/chat-bubble-left-right.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/icons/chat-bubble-left-right.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/icons/chat-bubble-left-right.blade.php: 1ms
[ParserWorker] parser.parse() for resources/views/icons/calendar.blade.php: 0ms (115 bytes)
[ParserWorker] extractSymbols completed for resources/views/icons/calendar.blade.php: 0 symbols in 0ms (54 iterations)
[ParserWorker] extractSymbols for resources/views/icons/calendar.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/icons/calendar.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/icons/calendar.blade.php: 0ms
[ParserWorker] parser.parse() for resources/views/icons/cake.blade.php: 0ms (111 bytes)
[ParserWorker] extractSymbols completed for resources/views/icons/cake.blade.php: 0 symbols in 0ms (54 iterations)
[ParserWorker] extractSymbols for resources/views/icons/cake.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/icons/cake.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/icons/cake.blade.php: 0ms
[ParserWorker] parser.parse() for resources/views/icons/beaker.blade.php: 0ms (113 bytes)
[ParserWorker] extractSymbols completed for resources/views/icons/beaker.blade.php: 0 symbols in 0ms (54 iterations)
[ParserWorker] extractSymbols for resources/views/icons/beaker.blade.php: 1ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/icons/beaker.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/icons/beaker.blade.php: 1ms
[ParserWorker] parser.parse() for resources/views/icons/bars-3.blade.php: 0ms (113 bytes)
[ParserWorker] extractSymbols completed for resources/views/icons/bars-3.blade.php: 0 symbols in 0ms (54 iterations)
[ParserWorker] extractSymbols for resources/views/icons/bars-3.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/icons/bars-3.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/icons/bars-3.blade.php: 0ms
[ParserWorker] parser.parse() for resources/views/icons/arrow-right-start-on-rectangle.blade.php: 0ms (137 bytes)
[ParserWorker] extractSymbols completed for resources/views/icons/arrow-right-start-on-rectangle.blade.php: 0 symbols in 0ms (54 iterations)
[ParserWorker] extractSymbols for resources/views/icons/arrow-right-start-on-rectangle.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/icons/arrow-right-start-on-rectangle.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/icons/arrow-right-start-on-rectangle.blade.php: 1ms
[ParserWorker] parser.parse() for resources/views/icons/arrow-left.blade.php: 0ms (117 bytes)
[ParserWorker] extractSymbols completed for resources/views/icons/arrow-left.blade.php: 0 symbols in 0ms (54 iterations)
[ParserWorker] extractSymbols for resources/views/icons/arrow-left.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/icons/arrow-left.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/icons/arrow-left.blade.php: 0ms
[ParserWorker] parser.parse() for resources/views/icons/arrow-down-tray.blade.php: 0ms (122 bytes)
[ParserWorker] extractSymbols completed for resources/views/icons/arrow-down-tray.blade.php: 0 symbols in 0ms (54 iterations)
[ParserWorker] extractSymbols for resources/views/icons/arrow-down-tray.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/icons/arrow-down-tray.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/icons/arrow-down-tray.blade.php: 0ms
[ParserWorker] parser.parse() for resources/views/icons/adjustments-horizontal.blade.php: 0ms (129 bytes)
[ParserWorker] extractSymbols completed for resources/views/icons/adjustments-horizontal.blade.php: 0 symbols in 0ms (54 iterations)
[ParserWorker] extractSymbols for resources/views/icons/adjustments-horizontal.blade.php: 1ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/icons/adjustments-horizontal.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/icons/adjustments-horizontal.blade.php: 1ms
[ParserWorker] parser.parse() for resources/views/events/print-field.blade.php: 0ms (139 bytes)
[ParserWorker] extractSymbols completed for resources/views/events/print-field.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/events/print-field.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/events/print-field.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/events/print-field.blade.php: 0ms
[ParserWorker] parser.parse() for resources/views/events/index.blade.php: 0ms (9489 bytes)
[ParserWorker] extractSymbols completed for resources/views/events/index.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/events/index.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/events/index.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/events/index.blade.php: 0ms
[ParserWorker] parser.parse() for resources/views/events/edit.blade.php: 1ms (29650 bytes)
[ParserWorker] extractSymbols completed for resources/views/events/edit.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/events/edit.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/events/edit.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/events/edit.blade.php: 1ms
[ParserWorker] parser.parse() for resources/views/events/create.blade.php: 2ms (25127 bytes)
[ParserWorker] extractSymbols completed for resources/views/events/create.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/events/create.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/events/create.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/events/create.blade.php: 2ms
[ParserWorker] parser.parse() for resources/views/components/ui/status-badge.blade.php: 0ms (1195 bytes)
[ParserWorker] extractSymbols completed for resources/views/components/ui/status-badge.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/components/ui/status-badge.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/components/ui/status-badge.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/components/ui/status-badge.blade.php: 1ms
[ParserWorker] parser.parse() for resources/views/event-logs/staff.blade.php: 2ms (25864 bytes)
[ParserWorker] extractSymbols completed for resources/views/event-logs/staff.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/event-logs/staff.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/event-logs/staff.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/event-logs/staff.blade.php: 2ms
[ParserWorker] parser.parse() for resources/views/event-logs/show.blade.php: 2ms (33502 bytes)
[ParserWorker] extractSymbols completed for resources/views/event-logs/show.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/event-logs/show.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/event-logs/show.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/event-logs/show.blade.php: 2ms
[ParserWorker] parser.parse() for resources/views/event-logs/print-client-copy.blade.php: 1ms (6063 bytes)
[ParserWorker] extractSymbols completed for resources/views/event-logs/print-client-copy.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/event-logs/print-client-copy.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/event-logs/print-client-copy.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/event-logs/print-client-copy.blade.php: 1ms
[ParserWorker] parser.parse() for resources/views/event-logs/edit.blade.php: 1ms (12460 bytes)
[ParserWorker] extractSymbols completed for resources/views/event-logs/edit.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/event-logs/edit.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/event-logs/edit.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/event-logs/edit.blade.php: 1ms
[ParserWorker] parser.parse() for resources/views/event-logs/create.blade.php: 1ms (11211 bytes)
[ParserWorker] extractSymbols completed for resources/views/event-logs/create.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/event-logs/create.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/event-logs/create.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/event-logs/create.blade.php: 1ms
[ParserWorker] parser.parse() for resources/views/event-assignment/show.blade.php: 3ms (52235 bytes)
[ParserWorker] extractSymbols completed for resources/views/event-assignment/show.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/event-assignment/show.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/event-assignment/show.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/event-assignment/show.blade.php: 3ms
[ParserWorker] parser.parse() for resources/views/event-assignment/request-position.blade.php: 0ms (9670 bytes)
[ParserWorker] extractSymbols completed for resources/views/event-assignment/request-position.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/event-assignment/request-position.blade.php: 3ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/event-assignment/request-position.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/event-assignment/request-position.blade.php: 3ms
[ParserWorker] parser.parse() for resources/views/event-assignment/reassign.blade.php: 0ms (5718 bytes)
[ParserWorker] extractSymbols completed for resources/views/event-assignment/reassign.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/event-assignment/reassign.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/event-assignment/reassign.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/event-assignment/reassign.blade.php: 1ms
[ParserWorker] parser.parse() for resources/views/event-assignment/policy-acknowledgment.blade.php: 0ms (3764 bytes)
[ParserWorker] extractSymbols completed for resources/views/event-assignment/policy-acknowledgment.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/event-assignment/policy-acknowledgment.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/event-assignment/policy-acknowledgment.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/event-assignment/policy-acknowledgment.blade.php: 0ms
[ParserWorker] parser.parse() for resources/views/event-assignment/assign-staff.blade.php: 1ms (8666 bytes)
[ParserWorker] extractSymbols completed for resources/views/event-assignment/assign-staff.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/event-assignment/assign-staff.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/event-assignment/assign-staff.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/event-assignment/assign-staff.blade.php: 1ms
[ParserWorker] parser.parse() for resources/views/event-assignment/_staff_search_results_row.blade.php: 0ms (1315 bytes)
[ParserWorker] extractSymbols completed for resources/views/event-assignment/_staff_search_results_row.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/event-assignment/_staff_search_results_row.blade.php: 1ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/event-assignment/_staff_search_results_row.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/event-assignment/_staff_search_results_row.blade.php: 1ms
[ParserWorker] parser.parse() for resources/views/event-assignment/_staff_search_results.blade.php: 0ms (3067 bytes)
[ParserWorker] extractSymbols completed for resources/views/event-assignment/_staff_search_results.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/event-assignment/_staff_search_results.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/event-assignment/_staff_search_results.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/event-assignment/_staff_search_results.blade.php: 0ms
[ParserWorker] parser.parse() for resources/views/event-assignment/_selected_staff.blade.php: 0ms (1561 bytes)
[ParserWorker] extractSymbols completed for resources/views/event-assignment/_selected_staff.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/event-assignment/_selected_staff.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/event-assignment/_selected_staff.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/event-assignment/_selected_staff.blade.php: 1ms
[ParserWorker] parser.parse() for resources/views/errors/403.blade.php: 0ms (2583 bytes)
[ParserWorker] extractSymbols completed for resources/views/errors/403.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/errors/403.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/errors/403.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/errors/403.blade.php: 0ms
[ParserWorker] parser.parse() for resources/views/components/ui/zoom-toggle.blade.php: 0ms (647 bytes)
[ParserWorker] extractSymbols completed for resources/views/components/ui/zoom-toggle.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/components/ui/zoom-toggle.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/components/ui/zoom-toggle.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/components/ui/zoom-toggle.blade.php: 0ms
[ParserWorker] parser.parse() for resources/views/components/ui/zoom-mode-toggle.blade.php: 1ms (22846 bytes)
[ParserWorker] extractSymbols completed for resources/views/components/ui/zoom-mode-toggle.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/components/ui/zoom-mode-toggle.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/components/ui/zoom-mode-toggle.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/components/ui/zoom-mode-toggle.blade.php: 2ms
[ParserWorker] parser.parse() for resources/views/components/ui/zoom-controls.blade.php: 0ms (1884 bytes)
[ParserWorker] extractSymbols completed for resources/views/components/ui/zoom-controls.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/components/ui/zoom-controls.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/components/ui/zoom-controls.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/components/ui/zoom-controls.blade.php: 0ms
[ParserWorker] parser.parse() for resources/views/components/ui/toast.blade.php: 0ms (5678 bytes)
[ParserWorker] extractSymbols completed for resources/views/components/ui/toast.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/components/ui/toast.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/components/ui/toast.blade.php: 1ms (0 facts)
[ParserWorker] Total parse operation for resources/views/components/ui/toast.blade.php: 1ms
[ParserWorker] parser.parse() for resources/views/icons/user.blade.php: 0ms (111 bytes)
[ParserWorker] extractSymbols completed for resources/views/icons/user.blade.php: 0 symbols in 0ms (54 iterations)
[ParserWorker] extractSymbols for resources/views/icons/user.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/icons/user.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/icons/user.blade.php: 1ms
[ParserWorker] parser.parse() for resources/views/icons/user-plus.blade.php: 0ms (116 bytes)
[ParserWorker] extractSymbols completed for resources/views/icons/user-plus.blade.php: 0 symbols in 0ms (54 iterations)
[ParserWorker] extractSymbols for resources/views/icons/user-plus.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/icons/user-plus.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/icons/user-plus.blade.php: 1ms
[ParserWorker] parser.parse() for resources/views/icons/truck.blade.php: 0ms (112 bytes)
[ParserWorker] extractSymbols completed for resources/views/icons/truck.blade.php: 0 symbols in 0ms (54 iterations)
[ParserWorker] extractSymbols for resources/views/icons/truck.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/icons/truck.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/icons/truck.blade.php: 0ms
[ParserWorker] parser.parse() for resources/views/icons/tag.blade.php: 0ms (110 bytes)
[ParserWorker] extractSymbols completed for resources/views/icons/tag.blade.php: 0 symbols in 1ms (54 iterations)
[ParserWorker] extractSymbols for resources/views/icons/tag.blade.php: 1ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/icons/tag.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/icons/tag.blade.php: 1ms
[ParserWorker] parser.parse() for resources/views/icons/sparkles.blade.php: 0ms (115 bytes)
[ParserWorker] extractSymbols completed for resources/views/icons/sparkles.blade.php: 0 symbols in 0ms (54 iterations)
[ParserWorker] extractSymbols for resources/views/icons/sparkles.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/icons/sparkles.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/icons/sparkles.blade.php: 0ms
[ParserWorker] parser.parse() for resources/views/icons/print.blade.php: 0ms (114 bytes)
[ParserWorker] extractSymbols completed for resources/views/icons/print.blade.php: 0 symbols in 0ms (54 iterations)
[ParserWorker] extractSymbols for resources/views/icons/print.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/icons/print.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/icons/print.blade.php: 0ms
[ParserWorker] parser.parse() for resources/views/icons/plus.blade.php: 0ms (111 bytes)
[ParserWorker] extractSymbols completed for resources/views/icons/plus.blade.php: 0 symbols in 0ms (54 iterations)
[ParserWorker] extractSymbols for resources/views/icons/plus.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/icons/plus.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/icons/plus.blade.php: 1ms
[ParserWorker] parser.parse() for resources/views/icons/folder.blade.php: 0ms (113 bytes)
[ParserWorker] extractSymbols completed for resources/views/icons/folder.blade.php: 0 symbols in 0ms (54 iterations)
[ParserWorker] extractSymbols for resources/views/icons/folder.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/icons/folder.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/icons/folder.blade.php: 0ms
[ParserWorker] parser.parse() for resources/views/icons/eye.blade.php: 0ms (100 bytes)
[ParserWorker] extractSymbols completed for resources/views/icons/eye.blade.php: 0 symbols in 0ms (54 iterations)
[ParserWorker] extractSymbols for resources/views/icons/eye.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/icons/eye.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/icons/eye.blade.php: 0ms
[ParserWorker] parser.parse() for resources/views/icons/eye-slash.blade.php: 0ms (106 bytes)
[ParserWorker] extractSymbols completed for resources/views/icons/eye-slash.blade.php: 0 symbols in 0ms (54 iterations)
[ParserWorker] extractSymbols for resources/views/icons/eye-slash.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/icons/eye-slash.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/icons/eye-slash.blade.php: 0ms
[ParserWorker] parser.parse() for resources/views/icons/exclamation-triangle.blade.php: 0ms (127 bytes)
[ParserWorker] extractSymbols completed for resources/views/icons/exclamation-triangle.blade.php: 0 symbols in 0ms (54 iterations)
[ParserWorker] extractSymbols for resources/views/icons/exclamation-triangle.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/icons/exclamation-triangle.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/icons/exclamation-triangle.blade.php: 0ms
[ParserWorker] parser.parse() for resources/views/icons/exclamation-circle.blade.php: 0ms (125 bytes)
[ParserWorker] extractSymbols completed for resources/views/icons/exclamation-circle.blade.php: 0 symbols in 0ms (54 iterations)
[ParserWorker] extractSymbols for resources/views/icons/exclamation-circle.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/icons/exclamation-circle.blade.php: 1ms (0 facts)
[ParserWorker] Total parse operation for resources/views/icons/exclamation-circle.blade.php: 1ms
[ParserWorker] parser.parse() for resources/views/icons/envelope.blade.php: 0ms (115 bytes)
[ParserWorker] extractSymbols completed for resources/views/icons/envelope.blade.php: 0 symbols in 0ms (54 iterations)
[ParserWorker] extractSymbols for resources/views/icons/envelope.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/icons/envelope.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/icons/envelope.blade.php: 0ms
[ParserWorker] parser.parse() for resources/views/icons/document-text.blade.php: 0ms (120 bytes)
[ParserWorker] extractSymbols completed for resources/views/icons/document-text.blade.php: 0 symbols in 0ms (54 iterations)
[ParserWorker] extractSymbols for resources/views/icons/document-text.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/icons/document-text.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/icons/document-text.blade.php: 0ms
[ParserWorker] parser.parse() for resources/views/icons/cube.blade.php: 0ms (111 bytes)
[ParserWorker] extractSymbols completed for resources/views/icons/cube.blade.php: 0 symbols in 0ms (54 iterations)
[ParserWorker] extractSymbols for resources/views/icons/cube.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/icons/cube.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/icons/cube.blade.php: 1ms
[ParserWorker] parser.parse() for resources/views/icons/clock.blade.php: 0ms (112 bytes)
[ParserWorker] extractSymbols completed for resources/views/icons/clock.blade.php: 0 symbols in 0ms (54 iterations)
[ParserWorker] extractSymbols for resources/views/icons/clock.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/icons/clock.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/icons/clock.blade.php: 0ms
[ParserWorker] parser.parse() for resources/views/icons/clipboard-document-list.blade.php: 0ms (130 bytes)
[ParserWorker] extractSymbols completed for resources/views/icons/clipboard-document-list.blade.php: 0 symbols in 0ms (54 iterations)
[ParserWorker] extractSymbols for resources/views/icons/clipboard-document-list.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/icons/clipboard-document-list.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/icons/clipboard-document-list.blade.php: 0ms
[ParserWorker] parser.parse() for resources/views/icons/chevron-down.blade.php: 0ms (119 bytes)
[ParserWorker] extractSymbols completed for resources/views/icons/chevron-down.blade.php: 0 symbols in 0ms (54 iterations)
[ParserWorker] extractSymbols for resources/views/icons/chevron-down.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/icons/chevron-down.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/icons/chevron-down.blade.php: 0ms
[ParserWorker] parser.parse() for resources/views/icons/chat-bubble-left.blade.php: 0ms (123 bytes)
[ParserWorker] extractSymbols completed for resources/views/icons/chat-bubble-left.blade.php: 0 symbols in 0ms (54 iterations)
[ParserWorker] extractSymbols for resources/views/icons/chat-bubble-left.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/icons/chat-bubble-left.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/icons/chat-bubble-left.blade.php: 0ms
[ParserWorker] parser.parse() for resources/views/icons/chat-bubble-left-right.blade.php: 0ms (129 bytes)
[ParserWorker] extractSymbols completed for resources/views/icons/chat-bubble-left-right.blade.php: 0 symbols in 0ms (54 iterations)
[ParserWorker] extractSymbols for resources/views/icons/chat-bubble-left-right.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/icons/chat-bubble-left-right.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/icons/chat-bubble-left-right.blade.php: 1ms
[ParserWorker] parser.parse() for resources/views/icons/calendar.blade.php: 0ms (115 bytes)
[ParserWorker] extractSymbols completed for resources/views/icons/calendar.blade.php: 0 symbols in 0ms (54 iterations)
[ParserWorker] extractSymbols for resources/views/icons/calendar.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/icons/calendar.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/icons/calendar.blade.php: 0ms
[ParserWorker] parser.parse() for resources/views/icons/cake.blade.php: 0ms (111 bytes)
[ParserWorker] extractSymbols completed for resources/views/icons/cake.blade.php: 0 symbols in 0ms (54 iterations)
[ParserWorker] extractSymbols for resources/views/icons/cake.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/icons/cake.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/icons/cake.blade.php: 0ms
[ParserWorker] parser.parse() for resources/views/icons/beaker.blade.php: 0ms (113 bytes)
[ParserWorker] extractSymbols completed for resources/views/icons/beaker.blade.php: 0 symbols in 0ms (54 iterations)
[ParserWorker] extractSymbols for resources/views/icons/beaker.blade.php: 1ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/icons/beaker.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/icons/beaker.blade.php: 1ms
[ParserWorker] parser.parse() for resources/views/icons/bars-3.blade.php: 0ms (113 bytes)
[ParserWorker] extractSymbols completed for resources/views/icons/bars-3.blade.php: 0 symbols in 0ms (54 iterations)
[ParserWorker] extractSymbols for resources/views/icons/bars-3.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/icons/bars-3.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/icons/bars-3.blade.php: 0ms
[ParserWorker] parser.parse() for resources/views/icons/arrow-right-start-on-rectangle.blade.php: 0ms (137 bytes)
[ParserWorker] extractSymbols completed for resources/views/icons/arrow-right-start-on-rectangle.blade.php: 0 symbols in 0ms (54 iterations)
[ParserWorker] extractSymbols for resources/views/icons/arrow-right-start-on-rectangle.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/icons/arrow-right-start-on-rectangle.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/icons/arrow-right-start-on-rectangle.blade.php: 1ms
[ParserWorker] parser.parse() for resources/views/icons/arrow-left.blade.php: 0ms (117 bytes)
[ParserWorker] extractSymbols completed for resources/views/icons/arrow-left.blade.php: 0 symbols in 0ms (54 iterations)
[ParserWorker] extractSymbols for resources/views/icons/arrow-left.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/icons/arrow-left.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/icons/arrow-left.blade.php: 0ms
[ParserWorker] parser.parse() for resources/views/icons/arrow-down-tray.blade.php: 0ms (122 bytes)
[ParserWorker] extractSymbols completed for resources/views/icons/arrow-down-tray.blade.php: 0 symbols in 0ms (54 iterations)
[ParserWorker] extractSymbols for resources/views/icons/arrow-down-tray.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/icons/arrow-down-tray.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/icons/arrow-down-tray.blade.php: 0ms
[ParserWorker] parser.parse() for resources/views/icons/adjustments-horizontal.blade.php: 0ms (129 bytes)
[ParserWorker] extractSymbols completed for resources/views/icons/adjustments-horizontal.blade.php: 0 symbols in 0ms (54 iterations)
[ParserWorker] extractSymbols for resources/views/icons/adjustments-horizontal.blade.php: 1ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/icons/adjustments-horizontal.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/icons/adjustments-horizontal.blade.php: 1ms
[ParserWorker] parser.parse() for resources/views/events/print-field.blade.php: 0ms (139 bytes)
[ParserWorker] extractSymbols completed for resources/views/events/print-field.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/events/print-field.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/events/print-field.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/events/print-field.blade.php: 0ms
[ParserWorker] parser.parse() for resources/views/events/index.blade.php: 0ms (9489 bytes)
[ParserWorker] extractSymbols completed for resources/views/events/index.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/events/index.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/events/index.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/events/index.blade.php: 0ms
[ParserWorker] parser.parse() for resources/views/events/edit.blade.php: 1ms (29650 bytes)
[ParserWorker] extractSymbols completed for resources/views/events/edit.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/events/edit.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/events/edit.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/events/edit.blade.php: 1ms
[ParserWorker] parser.parse() for resources/views/events/create.blade.php: 2ms (25127 bytes)
[ParserWorker] extractSymbols completed for resources/views/events/create.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/events/create.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/events/create.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/events/create.blade.php: 2ms
[ParserWorker] parser.parse() for resources/views/event-logs/staff.blade.php: 2ms (25864 bytes)
[ParserWorker] extractSymbols completed for resources/views/event-logs/staff.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/event-logs/staff.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/event-logs/staff.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/event-logs/staff.blade.php: 2ms
[ParserWorker] parser.parse() for resources/views/event-logs/show.blade.php: 2ms (33502 bytes)
[ParserWorker] extractSymbols completed for resources/views/event-logs/show.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/event-logs/show.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/event-logs/show.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/event-logs/show.blade.php: 2ms
[ParserWorker] parser.parse() for resources/views/event-logs/print-client-copy.blade.php: 1ms (6063 bytes)
[ParserWorker] extractSymbols completed for resources/views/event-logs/print-client-copy.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/event-logs/print-client-copy.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/event-logs/print-client-copy.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/event-logs/print-client-copy.blade.php: 1ms
[ParserWorker] parser.parse() for resources/views/event-logs/edit.blade.php: 1ms (12460 bytes)
[ParserWorker] extractSymbols completed for resources/views/event-logs/edit.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/event-logs/edit.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/event-logs/edit.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/event-logs/edit.blade.php: 1ms
[ParserWorker] parser.parse() for resources/views/event-logs/create.blade.php: 1ms (11211 bytes)
[ParserWorker] extractSymbols completed for resources/views/event-logs/create.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/event-logs/create.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/event-logs/create.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/event-logs/create.blade.php: 1ms
[ParserWorker] parser.parse() for resources/views/event-assignment/show.blade.php: 3ms (52235 bytes)
[ParserWorker] extractSymbols completed for resources/views/event-assignment/show.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/event-assignment/show.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/event-assignment/show.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/event-assignment/show.blade.php: 3ms
[ParserWorker] parser.parse() for resources/views/event-assignment/request-position.blade.php: 0ms (9670 bytes)
[ParserWorker] extractSymbols completed for resources/views/event-assignment/request-position.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/event-assignment/request-position.blade.php: 3ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/event-assignment/request-position.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/event-assignment/request-position.blade.php: 3ms
[ParserWorker] parser.parse() for resources/views/event-assignment/reassign.blade.php: 0ms (5718 bytes)
[ParserWorker] extractSymbols completed for resources/views/event-assignment/reassign.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/event-assignment/reassign.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/event-assignment/reassign.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/event-assignment/reassign.blade.php: 1ms
[ParserWorker] parser.parse() for resources/views/event-assignment/policy-acknowledgment.blade.php: 0ms (3764 bytes)
[ParserWorker] extractSymbols completed for resources/views/event-assignment/policy-acknowledgment.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/event-assignment/policy-acknowledgment.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/event-assignment/policy-acknowledgment.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/event-assignment/policy-acknowledgment.blade.php: 0ms
[ParserWorker] parser.parse() for resources/views/event-assignment/assign-staff.blade.php: 1ms (8666 bytes)
[ParserWorker] extractSymbols completed for resources/views/event-assignment/assign-staff.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/event-assignment/assign-staff.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/event-assignment/assign-staff.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/event-assignment/assign-staff.blade.php: 1ms
[ParserWorker] parser.parse() for resources/views/event-assignment/_staff_search_results_row.blade.php: 0ms (1315 bytes)
[ParserWorker] extractSymbols completed for resources/views/event-assignment/_staff_search_results_row.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/event-assignment/_staff_search_results_row.blade.php: 1ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/event-assignment/_staff_search_results_row.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/event-assignment/_staff_search_results_row.blade.php: 1ms
[ParserWorker] parser.parse() for resources/views/event-assignment/_staff_search_results.blade.php: 0ms (3067 bytes)
[ParserWorker] extractSymbols completed for resources/views/event-assignment/_staff_search_results.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/event-assignment/_staff_search_results.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/event-assignment/_staff_search_results.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/event-assignment/_staff_search_results.blade.php: 0ms
[ParserWorker] parser.parse() for resources/views/event-assignment/_selected_staff.blade.php: 0ms (1561 bytes)
[ParserWorker] extractSymbols completed for resources/views/event-assignment/_selected_staff.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/event-assignment/_selected_staff.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/event-assignment/_selected_staff.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/event-assignment/_selected_staff.blade.php: 1ms
[ParserWorker] parser.parse() for resources/views/errors/403.blade.php: 0ms (2583 bytes)
[ParserWorker] extractSymbols completed for resources/views/errors/403.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/errors/403.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/errors/403.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/errors/403.blade.php: 0ms
[ParserWorker] parser.parse() for resources/views/components/ui/zoom-toggle.blade.php: 0ms (647 bytes)
[ParserWorker] extractSymbols completed for resources/views/components/ui/zoom-toggle.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/components/ui/zoom-toggle.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/components/ui/zoom-toggle.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/components/ui/zoom-toggle.blade.php: 0ms
[ParserWorker] parser.parse() for resources/views/components/ui/zoom-mode-toggle.blade.php: 1ms (22846 bytes)
[ParserWorker] extractSymbols completed for resources/views/components/ui/zoom-mode-toggle.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/components/ui/zoom-mode-toggle.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/components/ui/zoom-mode-toggle.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/components/ui/zoom-mode-toggle.blade.php: 2ms
[ParserWorker] parser.parse() for resources/views/components/ui/zoom-controls.blade.php: 0ms (1884 bytes)
[ParserWorker] extractSymbols completed for resources/views/components/ui/zoom-controls.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/components/ui/zoom-controls.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/components/ui/zoom-controls.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/components/ui/zoom-controls.blade.php: 0ms
[ParserWorker] parser.parse() for resources/views/components/ui/toast.blade.php: 0ms (5678 bytes)
[ParserWorker] extractSymbols completed for resources/views/components/ui/toast.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/components/ui/toast.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/components/ui/toast.blade.php: 1ms (0 facts)
[ParserWorker] Total parse operation for resources/views/components/ui/toast.blade.php: 1ms
[ParserWorker] parser.parse() for resources/views/users/show.blade.php: 2ms (28114 bytes)
[ParserWorker] extractSymbols completed for resources/views/users/show.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/users/show.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/users/show.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/users/show.blade.php: 2ms
[ParserWorker] parser.parse() for resources/views/users/permissions.blade.php: 1ms (6501 bytes)
[ParserWorker] extractSymbols completed for resources/views/users/permissions.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/users/permissions.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/users/permissions.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/users/permissions.blade.php: 1ms
[ParserWorker] parser.parse() for resources/views/users/partials/role-table.blade.php: 0ms (775 bytes)
[ParserWorker] extractSymbols completed for resources/views/users/partials/role-table.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/users/partials/role-table.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/users/partials/role-table.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/users/partials/role-table.blade.php: 0ms
[ParserWorker] parser.parse() for resources/views/users/index.blade.php: 0ms (4209 bytes)
[ParserWorker] extractSymbols completed for resources/views/users/index.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/users/index.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/users/index.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/users/index.blade.php: 0ms
[ParserWorker] parser.parse() for resources/views/users/index-staff.blade.php: 0ms (5684 bytes)
[ParserWorker] extractSymbols completed for resources/views/users/index-staff.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/users/index-staff.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/users/index-staff.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/users/index-staff.blade.php: 1ms
[ParserWorker] parser.parse() for resources/views/users/form.blade.php: 2ms (36912 bytes)
[ParserWorker] extractSymbols completed for resources/views/users/form.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/users/form.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/users/form.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/users/form.blade.php: 2ms
[ParserWorker] parser.parse() for resources/views/role/partials/actions.blade.php: 0ms (2235 bytes)
[ParserWorker] extractSymbols completed for resources/views/role/partials/actions.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/role/partials/actions.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/role/partials/actions.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/role/partials/actions.blade.php: 0ms
[ParserWorker] parser.parse() for resources/views/role/index.blade.php: 0ms (6411 bytes)
[ParserWorker] extractSymbols completed for resources/views/role/index.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/role/index.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/role/index.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/role/index.blade.php: 0ms
[ParserWorker] parser.parse() for resources/views/role/form.blade.php: 1ms (13939 bytes)
[ParserWorker] extractSymbols completed for resources/views/role/form.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/role/form.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/role/form.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/role/form.blade.php: 1ms
[ParserWorker] parser.parse() for resources/views/resources/venmo.blade.php: 0ms (897 bytes)
[ParserWorker] extractSymbols completed for resources/views/resources/venmo.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/resources/venmo.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/resources/venmo.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/resources/venmo.blade.php: 0ms
[ParserWorker] parser.parse() for resources/views/resources/policies.blade.php: 0ms (9934 bytes)
[ParserWorker] extractSymbols completed for resources/views/resources/policies.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/resources/policies.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/resources/policies.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/resources/policies.blade.php: 0ms
[ParserWorker] parser.parse() for resources/views/resources/patch-notes/december-2025.blade.php: 1ms (9411 bytes)
[ParserWorker] extractSymbols completed for resources/views/resources/patch-notes/december-2025.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/resources/patch-notes/december-2025.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/resources/patch-notes/december-2025.blade.php: 1ms (0 facts)
[ParserWorker] Total parse operation for resources/views/resources/patch-notes/december-2025.blade.php: 2ms
[ParserWorker] parser.parse() for resources/views/resources/event-guidelines.blade.php: 0ms (2441 bytes)
[ParserWorker] extractSymbols completed for resources/views/resources/event-guidelines.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/resources/event-guidelines.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/resources/event-guidelines.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/resources/event-guidelines.blade.php: 0ms
[ParserWorker] parser.parse() for resources/views/resources/admin-docs.blade.php: 1ms (8730 bytes)
[ParserWorker] extractSymbols completed for resources/views/resources/admin-docs.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/resources/admin-docs.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/resources/admin-docs.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/resources/admin-docs.blade.php: 1ms
[ParserWorker] parser.parse() for resources/views/reports/week-summary.blade.php: 1ms (12546 bytes)
[ParserWorker] extractSymbols completed for resources/views/reports/week-summary.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/reports/week-summary.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/reports/week-summary.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/reports/week-summary.blade.php: 1ms
[ParserWorker] parser.parse() for resources/views/reports/staff.blade.php: 0ms (5759 bytes)
[ParserWorker] extractSymbols completed for resources/views/reports/staff.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/reports/staff.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/reports/staff.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/reports/staff.blade.php: 0ms
[ParserWorker] parser.parse() for resources/views/reports/staff-print.blade.php: 0ms (2014 bytes)
[ParserWorker] extractSymbols completed for resources/views/reports/staff-print.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/reports/staff-print.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/reports/staff-print.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/reports/staff-print.blade.php: 0ms
[ParserWorker] parser.parse() for resources/views/reports/payment.blade.php: 1ms (9225 bytes)
[ParserWorker] extractSymbols completed for resources/views/reports/payment.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/reports/payment.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/reports/payment.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/reports/payment.blade.php: 1ms
[ParserWorker] parser.parse() for resources/views/icons/user.blade.php: 0ms (111 bytes)
[ParserWorker] extractSymbols completed for resources/views/icons/user.blade.php: 0 symbols in 0ms (54 iterations)
[ParserWorker] parser.parse() for resources/views/reports/invoice-totals.blade.php: 1ms (17509 bytes)
[ParserWorker] extractSymbols completed for resources/views/reports/invoice-totals.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/reports/invoice-totals.blade.php: 0ms (0 symbols)
[ParserWorker] extractSymbols for resources/views/icons/user.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/icons/user.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/icons/user.blade.php: 1ms
[ParserWorker] extractCstFacts for resources/views/reports/invoice-totals.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/reports/invoice-totals.blade.php: 1ms
[ParserWorker] parser.parse() for resources/views/reports/checkin.blade.php: 0ms (6315 bytes)
[ParserWorker] extractSymbols completed for resources/views/reports/checkin.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/reports/checkin.blade.php: 1ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/reports/checkin.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/reports/checkin.blade.php: 1ms
[ParserWorker] parser.parse() for resources/views/reports/assignments.blade.php: 0ms (13204 bytes)
[ParserWorker] extractSymbols completed for resources/views/reports/assignments.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/reports/assignments.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/reports/assignments.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/reports/assignments.blade.php: 1ms
[ParserWorker] parser.parse() for resources/views/permission/index.blade.php: 0ms (7081 bytes)
[ParserWorker] extractSymbols completed for resources/views/permission/index.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/permission/index.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/permission/index.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/permission/index.blade.php: 0ms
[ParserWorker] parser.parse() for resources/views/partials/topbar.blade.php: 1ms (14086 bytes)
[ParserWorker] extractSymbols completed for resources/views/partials/topbar.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/partials/topbar.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/partials/topbar.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/partials/topbar.blade.php: 1ms
[ParserWorker] parser.parse() for resources/views/partials/sidebar.blade.php: 1ms (10925 bytes)
[ParserWorker] extractSymbols completed for resources/views/partials/sidebar.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/partials/sidebar.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/partials/sidebar.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/partials/sidebar.blade.php: 6ms
[ParserWorker] parser.parse() for resources/views/partials/pagination.blade.php: 0ms (4904 bytes)
[ParserWorker] extractSymbols completed for resources/views/partials/pagination.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/partials/pagination.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/partials/pagination.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/partials/pagination.blade.php: 0ms
[ParserWorker] parser.parse() for resources/views/partials/_flashes.blade.php: 0ms (109 bytes)
[ParserWorker] extractSymbols completed for resources/views/partials/_flashes.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/partials/_flashes.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/partials/_flashes.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/partials/_flashes.blade.php: 0ms
[ParserWorker] parser.parse() for resources/views/onboarding/wizard.blade.php: 1ms (18224 bytes)
[ParserWorker] extractSymbols completed for resources/views/onboarding/wizard.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/onboarding/wizard.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/onboarding/wizard.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/onboarding/wizard.blade.php: 1ms
[ParserWorker] parser.parse() for resources/views/livebind-test/index.blade.php: 3ms (38973 bytes)
[ParserWorker] extractSymbols completed for resources/views/livebind-test/index.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/livebind-test/index.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/livebind-test/index.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/livebind-test/index.blade.php: 3ms
[ParserWorker] parser.parse() for resources/views/livebind-test/_selected.blade.php: 0ms (179 bytes)
[ParserWorker] extractSymbols completed for resources/views/livebind-test/_selected.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/livebind-test/_selected.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/livebind-test/_selected.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/livebind-test/_selected.blade.php: 0ms
[ParserWorker] parser.parse() for resources/views/livebind-test/_search_results.blade.php: 0ms (656 bytes)
[ParserWorker] extractSymbols completed for resources/views/livebind-test/_search_results.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/livebind-test/_search_results.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/livebind-test/_search_results.blade.php: 1ms (0 facts)
[ParserWorker] Total parse operation for resources/views/livebind-test/_search_results.blade.php: 1ms
[ParserWorker] parser.parse() for resources/views/livebind-test/_reload_fragment.blade.php: 0ms (946 bytes)
[ParserWorker] extractSymbols completed for resources/views/livebind-test/_reload_fragment.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/livebind-test/_reload_fragment.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/livebind-test/_reload_fragment.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/livebind-test/_reload_fragment.blade.php: 0ms
[ParserWorker] parser.parse() for resources/views/livebind-test/_lazy_insights.blade.php: 0ms (931 bytes)
[ParserWorker] extractSymbols completed for resources/views/livebind-test/_lazy_insights.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/livebind-test/_lazy_insights.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/livebind-test/_lazy_insights.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/livebind-test/_lazy_insights.blade.php: 0ms
[ParserWorker] parser.parse() for resources/views/layouts/print.blade.php: 1ms (8643 bytes)
[ParserWorker] extractSymbols completed for resources/views/layouts/print.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/layouts/print.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/layouts/print.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/layouts/print.blade.php: 1ms
[ParserWorker] parser.parse() for resources/views/layouts/modern.blade.php: 0ms (7075 bytes)
[ParserWorker] extractSymbols completed for resources/views/layouts/modern.blade.php: 0 symbols in 1ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/layouts/modern.blade.php: 1ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/layouts/modern.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/layouts/modern.blade.php: 1ms
[ParserWorker] parser.parse() for resources/views/layouts/auth.blade.php: 0ms (7178 bytes)
[ParserWorker] extractSymbols completed for resources/views/layouts/auth.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/layouts/auth.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/layouts/auth.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/layouts/auth.blade.php: 3ms
[ParserWorker] parser.parse() for resources/views/invoices/event-invoice/weekly-totals.blade.php: 1ms (14982 bytes)
[ParserWorker] extractSymbols completed for resources/views/invoices/event-invoice/weekly-totals.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/invoices/event-invoice/weekly-totals.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/invoices/event-invoice/weekly-totals.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/invoices/event-invoice/weekly-totals.blade.php: 1ms
[ParserWorker] parser.parse() for resources/views/invoices/event-invoice/show.blade.php: 1ms (19315 bytes)
[ParserWorker] extractSymbols completed for resources/views/invoices/event-invoice/show.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/invoices/event-invoice/show.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/invoices/event-invoice/show.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/invoices/event-invoice/show.blade.php: 2ms
[ParserWorker] parser.parse() for resources/views/invoices/event-invoice/print-staff.blade.php: 0ms (2180 bytes)
[ParserWorker] extractSymbols completed for resources/views/invoices/event-invoice/print-staff.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/invoices/event-invoice/print-staff.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/invoices/event-invoice/print-staff.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/invoices/event-invoice/print-staff.blade.php: 0ms
[ParserWorker] parser.parse() for resources/views/invoices/event-invoice/print-lead.blade.php: 1ms (2326 bytes)
[ParserWorker] extractSymbols completed for resources/views/invoices/event-invoice/print-lead.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/invoices/event-invoice/print-lead.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/invoices/event-invoice/print-lead.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/invoices/event-invoice/print-lead.blade.php: 1ms
[ParserWorker] parser.parse() for resources/views/invoices/event-invoice/print-custom.blade.php: 1ms (7775 bytes)
[ParserWorker] extractSymbols completed for resources/views/invoices/event-invoice/print-custom.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/invoices/event-invoice/print-custom.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/invoices/event-invoice/print-custom.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/invoices/event-invoice/print-custom.blade.php: 1ms
[ParserWorker] parser.parse() for resources/views/invoices/event-invoice/print-basic.blade.php: 1ms (6328 bytes)
[ParserWorker] extractSymbols completed for resources/views/invoices/event-invoice/print-basic.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/invoices/event-invoice/print-basic.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/invoices/event-invoice/print-basic.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/invoices/event-invoice/print-basic.blade.php: 1ms
[ParserWorker] parser.parse() for resources/views/invoices/event-invoice/partials/attachments-print.blade.php: 0ms (2626 bytes)
[ParserWorker] extractSymbols completed for resources/views/invoices/event-invoice/partials/attachments-print.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/invoices/event-invoice/partials/attachments-print.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/invoices/event-invoice/partials/attachments-print.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/invoices/event-invoice/partials/attachments-print.blade.php: 0ms
[ParserWorker] parser.parse() for resources/views/internal-calendar/view.blade.php: 1ms (4768 bytes)
[ParserWorker] extractSymbols completed for resources/views/internal-calendar/view.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/internal-calendar/view.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/internal-calendar/view.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/internal-calendar/view.blade.php: 1ms
[ParserWorker] parser.parse() for resources/views/internal-calendar/time-off-form.blade.php: 0ms (5030 bytes)
[ParserWorker] extractSymbols completed for resources/views/internal-calendar/time-off-form.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/internal-calendar/time-off-form.blade.php: 1ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/internal-calendar/time-off-form.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/internal-calendar/time-off-form.blade.php: 1ms
[ParserWorker] parser.parse() for resources/views/internal-calendar/request-list.blade.php: 0ms (5447 bytes)
[ParserWorker] extractSymbols completed for resources/views/internal-calendar/request-list.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/internal-calendar/request-list.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/internal-calendar/request-list.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/internal-calendar/request-list.blade.php: 0ms
[ParserWorker] parser.parse() for resources/views/internal-calendar/index.blade.php: 2ms (30887 bytes)
[ParserWorker] extractSymbols completed for resources/views/internal-calendar/index.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/internal-calendar/index.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/internal-calendar/index.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/internal-calendar/index.blade.php: 4ms
[ParserWorker] parser.parse() for resources/views/internal-calendar/event-form.blade.php: 0ms (5099 bytes)
[ParserWorker] extractSymbols completed for resources/views/internal-calendar/event-form.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/internal-calendar/event-form.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/internal-calendar/event-form.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/internal-calendar/event-form.blade.php: 0ms
[ParserWorker] parser.parse() for resources/views/internal-calendar/edit-form.blade.php: 1ms (4670 bytes)
[ParserWorker] extractSymbols completed for resources/views/internal-calendar/edit-form.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/internal-calendar/edit-form.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/internal-calendar/edit-form.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/internal-calendar/edit-form.blade.php: 1ms
[ParserWorker] parser.parse() for resources/views/icons/x-mark.blade.php: 0ms (113 bytes)
[ParserWorker] extractSymbols completed for resources/views/icons/x-mark.blade.php: 0 symbols in 0ms (54 iterations)
[ParserWorker] extractSymbols for resources/views/icons/x-mark.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/icons/x-mark.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/icons/x-mark.blade.php: 1ms
[ParserWorker] parser.parse() for resources/views/users/show.blade.php: 2ms (28114 bytes)
[ParserWorker] extractSymbols completed for resources/views/users/show.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/users/show.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/users/show.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/users/show.blade.php: 2ms
[ParserWorker] parser.parse() for resources/views/users/permissions.blade.php: 1ms (6501 bytes)
[ParserWorker] extractSymbols completed for resources/views/users/permissions.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/users/permissions.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/users/permissions.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/users/permissions.blade.php: 1ms
[ParserWorker] parser.parse() for resources/views/users/partials/role-table.blade.php: 0ms (775 bytes)
[ParserWorker] extractSymbols completed for resources/views/users/partials/role-table.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/users/partials/role-table.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/users/partials/role-table.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/users/partials/role-table.blade.php: 0ms
[ParserWorker] parser.parse() for resources/views/users/index.blade.php: 0ms (4209 bytes)
[ParserWorker] extractSymbols completed for resources/views/users/index.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/users/index.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/users/index.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/users/index.blade.php: 0ms
[ParserWorker] parser.parse() for resources/views/users/index-staff.blade.php: 0ms (5684 bytes)
[ParserWorker] extractSymbols completed for resources/views/users/index-staff.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/users/index-staff.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/users/index-staff.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/users/index-staff.blade.php: 1ms
[ParserWorker] parser.parse() for resources/views/users/form.blade.php: 2ms (36912 bytes)
[ParserWorker] extractSymbols completed for resources/views/users/form.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/users/form.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/users/form.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/users/form.blade.php: 2ms
[ParserWorker] parser.parse() for resources/views/role/partials/actions.blade.php: 0ms (2235 bytes)
[ParserWorker] extractSymbols completed for resources/views/role/partials/actions.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/role/partials/actions.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/role/partials/actions.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/role/partials/actions.blade.php: 0ms
[ParserWorker] parser.parse() for resources/views/role/index.blade.php: 0ms (6411 bytes)
[ParserWorker] extractSymbols completed for resources/views/role/index.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/role/index.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/role/index.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/role/index.blade.php: 0ms
[ParserWorker] parser.parse() for resources/views/role/form.blade.php: 1ms (13939 bytes)
[ParserWorker] extractSymbols completed for resources/views/role/form.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/role/form.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/role/form.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/role/form.blade.php: 1ms
[ParserWorker] parser.parse() for resources/views/resources/venmo.blade.php: 0ms (897 bytes)
[ParserWorker] extractSymbols completed for resources/views/resources/venmo.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/resources/venmo.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/resources/venmo.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/resources/venmo.blade.php: 0ms
[ParserWorker] parser.parse() for resources/views/resources/policies.blade.php: 0ms (9934 bytes)
[ParserWorker] extractSymbols completed for resources/views/resources/policies.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/resources/policies.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/resources/policies.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/resources/policies.blade.php: 0ms
[ParserWorker] parser.parse() for routes/web.php: 8ms (32083 bytes)
[ParserWorker] parser.parse() for resources/views/resources/patch-notes/december-2025.blade.php: 1ms (9411 bytes)
[ParserWorker] extractSymbols completed for resources/views/resources/patch-notes/december-2025.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/resources/patch-notes/december-2025.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/resources/patch-notes/december-2025.blade.php: 1ms (0 facts)
[ParserWorker] Total parse operation for resources/views/resources/patch-notes/december-2025.blade.php: 2ms
[ParserWorker] parser.parse() for resources/views/resources/event-guidelines.blade.php: 0ms (2441 bytes)
[ParserWorker] extractSymbols completed for resources/views/resources/event-guidelines.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/resources/event-guidelines.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/resources/event-guidelines.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/resources/event-guidelines.blade.php: 0ms
[ParserWorker] parser.parse() for resources/views/resources/admin-docs.blade.php: 1ms (8730 bytes)
[ParserWorker] extractSymbols completed for resources/views/resources/admin-docs.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/resources/admin-docs.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/resources/admin-docs.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/resources/admin-docs.blade.php: 1ms
[ParserWorker] parser.parse() for resources/views/reports/week-summary.blade.php: 1ms (12546 bytes)
[ParserWorker] extractSymbols completed for resources/views/reports/week-summary.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/reports/week-summary.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/reports/week-summary.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/reports/week-summary.blade.php: 1ms
[ParserWorker] parser.parse() for resources/views/reports/staff.blade.php: 0ms (5759 bytes)
[ParserWorker] extractSymbols completed for resources/views/reports/staff.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/reports/staff.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/reports/staff.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/reports/staff.blade.php: 0ms
[ParserWorker] parser.parse() for resources/views/reports/staff-print.blade.php: 0ms (2014 bytes)
[ParserWorker] extractSymbols completed for resources/views/reports/staff-print.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/reports/staff-print.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/reports/staff-print.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/reports/staff-print.blade.php: 0ms
[ParserWorker] parser.parse() for resources/views/reports/payment.blade.php: 1ms (9225 bytes)
[ParserWorker] extractSymbols completed for resources/views/reports/payment.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/reports/payment.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/reports/payment.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/reports/payment.blade.php: 1ms
[ParserWorker] parser.parse() for resources/views/reports/invoice-totals.blade.php: 1ms (17509 bytes)
[ParserWorker] extractSymbols completed for resources/views/reports/invoice-totals.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/reports/invoice-totals.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/reports/invoice-totals.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/reports/invoice-totals.blade.php: 1ms
[ParserWorker] parser.parse() for resources/views/reports/checkin.blade.php: 0ms (6315 bytes)
[ParserWorker] extractSymbols completed for resources/views/reports/checkin.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/reports/checkin.blade.php: 1ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/reports/checkin.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/reports/checkin.blade.php: 1ms
[ParserWorker] parser.parse() for resources/views/reports/assignments.blade.php: 0ms (13204 bytes)
[ParserWorker] extractSymbols completed for resources/views/reports/assignments.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/reports/assignments.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/reports/assignments.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/reports/assignments.blade.php: 1ms
[ParserWorker] parser.parse() for resources/views/permission/index.blade.php: 0ms (7081 bytes)
[ParserWorker] extractSymbols completed for resources/views/permission/index.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/permission/index.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/permission/index.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/permission/index.blade.php: 0ms
[ParserWorker] parser.parse() for resources/views/partials/topbar.blade.php: 1ms (14086 bytes)
[ParserWorker] extractSymbols completed for resources/views/partials/topbar.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/partials/topbar.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/partials/topbar.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/partials/topbar.blade.php: 1ms
[ParserWorker] parser.parse() for resources/views/partials/sidebar.blade.php: 1ms (10925 bytes)
[ParserWorker] extractSymbols completed for resources/views/partials/sidebar.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/partials/sidebar.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/partials/sidebar.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/partials/sidebar.blade.php: 6ms
[ParserWorker] parser.parse() for resources/views/partials/pagination.blade.php: 0ms (4904 bytes)
[ParserWorker] extractSymbols completed for resources/views/partials/pagination.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/partials/pagination.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/partials/pagination.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/partials/pagination.blade.php: 0ms
[ParserWorker] parser.parse() for resources/views/partials/_flashes.blade.php: 0ms (109 bytes)
[ParserWorker] extractSymbols completed for resources/views/partials/_flashes.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/partials/_flashes.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/partials/_flashes.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/partials/_flashes.blade.php: 0ms
[ParserWorker] parser.parse() for resources/views/onboarding/wizard.blade.php: 1ms (18224 bytes)
[ParserWorker] extractSymbols completed for resources/views/onboarding/wizard.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/onboarding/wizard.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/onboarding/wizard.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/onboarding/wizard.blade.php: 1ms
[ParserWorker] parser.parse() for resources/views/livebind-test/index.blade.php: 3ms (38973 bytes)
[ParserWorker] extractSymbols completed for resources/views/livebind-test/index.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/livebind-test/index.blade.php: 0ms (0 symbols)
[ParserWorker] extractSymbols completed for routes/web.php: 0 symbols in 11ms (10410 iterations)
[ParserWorker] extractSymbols for routes/web.php: 11ms (0 symbols)
[ParserWorker] extractCstFacts for routes/web.php: 0ms (3 facts)
[ParserWorker] Total parse operation for routes/web.php: 19ms
[ParserWorker] extractCstFacts for resources/views/livebind-test/index.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/livebind-test/index.blade.php: 3ms
[ParserWorker] parser.parse() for resources/views/livebind-test/_selected.blade.php: 0ms (179 bytes)
[ParserWorker] extractSymbols completed for resources/views/livebind-test/_selected.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/livebind-test/_selected.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/livebind-test/_selected.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/livebind-test/_selected.blade.php: 0ms
[ParserWorker] parser.parse() for resources/views/livebind-test/_search_results.blade.php: 0ms (656 bytes)
[ParserWorker] extractSymbols completed for resources/views/livebind-test/_search_results.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/livebind-test/_search_results.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/livebind-test/_search_results.blade.php: 1ms (0 facts)
[ParserWorker] Total parse operation for resources/views/livebind-test/_search_results.blade.php: 1ms
[ParserWorker] parser.parse() for resources/views/livebind-test/_reload_fragment.blade.php: 0ms (946 bytes)
[ParserWorker] extractSymbols completed for resources/views/livebind-test/_reload_fragment.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/livebind-test/_reload_fragment.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/livebind-test/_reload_fragment.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/livebind-test/_reload_fragment.blade.php: 0ms
[ParserWorker] parser.parse() for resources/views/livebind-test/_lazy_insights.blade.php: 0ms (931 bytes)
[ParserWorker] extractSymbols completed for resources/views/livebind-test/_lazy_insights.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/livebind-test/_lazy_insights.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/livebind-test/_lazy_insights.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/livebind-test/_lazy_insights.blade.php: 0ms
[ParserWorker] parser.parse() for resources/views/layouts/print.blade.php: 1ms (8643 bytes)
[ParserWorker] extractSymbols completed for resources/views/layouts/print.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/layouts/print.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/layouts/print.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/layouts/print.blade.php: 1ms
[ParserWorker] parser.parse() for resources/views/layouts/modern.blade.php: 0ms (7075 bytes)
[ParserWorker] extractSymbols completed for resources/views/layouts/modern.blade.php: 0 symbols in 1ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/layouts/modern.blade.php: 1ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/layouts/modern.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/layouts/modern.blade.php: 1ms
[ParserWorker] parser.parse() for resources/views/layouts/auth.blade.php: 0ms (7178 bytes)
[ParserWorker] extractSymbols completed for resources/views/layouts/auth.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/layouts/auth.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/layouts/auth.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/layouts/auth.blade.php: 3ms
[ParserWorker] parser.parse() for resources/views/invoices/event-invoice/weekly-totals.blade.php: 1ms (14982 bytes)
[ParserWorker] extractSymbols completed for resources/views/invoices/event-invoice/weekly-totals.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/invoices/event-invoice/weekly-totals.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/invoices/event-invoice/weekly-totals.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/invoices/event-invoice/weekly-totals.blade.php: 1ms
[ParserWorker] parser.parse() for resources/views/invoices/event-invoice/show.blade.php: 1ms (19315 bytes)
[ParserWorker] extractSymbols completed for resources/views/invoices/event-invoice/show.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/invoices/event-invoice/show.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/invoices/event-invoice/show.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/invoices/event-invoice/show.blade.php: 2ms
[ParserWorker] parser.parse() for resources/views/invoices/event-invoice/print-staff.blade.php: 0ms (2180 bytes)
[ParserWorker] extractSymbols completed for resources/views/invoices/event-invoice/print-staff.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/invoices/event-invoice/print-staff.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/invoices/event-invoice/print-staff.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/invoices/event-invoice/print-staff.blade.php: 0ms
[ParserWorker] parser.parse() for resources/views/invoices/event-invoice/print-lead.blade.php: 1ms (2326 bytes)
[ParserWorker] extractSymbols completed for resources/views/invoices/event-invoice/print-lead.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/invoices/event-invoice/print-lead.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/invoices/event-invoice/print-lead.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/invoices/event-invoice/print-lead.blade.php: 1ms
[ParserWorker] parser.parse() for resources/views/invoices/event-invoice/print-custom.blade.php: 1ms (7775 bytes)
[ParserWorker] extractSymbols completed for resources/views/invoices/event-invoice/print-custom.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/invoices/event-invoice/print-custom.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/invoices/event-invoice/print-custom.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/invoices/event-invoice/print-custom.blade.php: 1ms
[ParserWorker] parser.parse() for resources/views/invoices/event-invoice/print-basic.blade.php: 1ms (6328 bytes)
[ParserWorker] extractSymbols completed for resources/views/invoices/event-invoice/print-basic.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/invoices/event-invoice/print-basic.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/invoices/event-invoice/print-basic.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/invoices/event-invoice/print-basic.blade.php: 1ms
[ParserWorker] parser.parse() for resources/views/invoices/event-invoice/partials/attachments-print.blade.php: 0ms (2626 bytes)
[ParserWorker] extractSymbols completed for resources/views/invoices/event-invoice/partials/attachments-print.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/invoices/event-invoice/partials/attachments-print.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/invoices/event-invoice/partials/attachments-print.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/invoices/event-invoice/partials/attachments-print.blade.php: 0ms
[ParserWorker] parser.parse() for resources/views/internal-calendar/view.blade.php: 1ms (4768 bytes)
[ParserWorker] extractSymbols completed for resources/views/internal-calendar/view.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/internal-calendar/view.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/internal-calendar/view.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/internal-calendar/view.blade.php: 1ms
[ParserWorker] parser.parse() for resources/views/internal-calendar/time-off-form.blade.php: 0ms (5030 bytes)
[ParserWorker] extractSymbols completed for resources/views/internal-calendar/time-off-form.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/internal-calendar/time-off-form.blade.php: 1ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/internal-calendar/time-off-form.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/internal-calendar/time-off-form.blade.php: 1ms
[ParserWorker] parser.parse() for resources/views/internal-calendar/request-list.blade.php: 0ms (5447 bytes)
[ParserWorker] extractSymbols completed for resources/views/internal-calendar/request-list.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/internal-calendar/request-list.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/internal-calendar/request-list.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/internal-calendar/request-list.blade.php: 0ms
[ParserWorker] parser.parse() for resources/views/internal-calendar/index.blade.php: 2ms (30887 bytes)
[ParserWorker] extractSymbols completed for resources/views/internal-calendar/index.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/internal-calendar/index.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/internal-calendar/index.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/internal-calendar/index.blade.php: 4ms
[ParserWorker] parser.parse() for resources/views/internal-calendar/event-form.blade.php: 0ms (5099 bytes)
[ParserWorker] extractSymbols completed for resources/views/internal-calendar/event-form.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/internal-calendar/event-form.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/internal-calendar/event-form.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/internal-calendar/event-form.blade.php: 0ms
[ParserWorker] parser.parse() for resources/views/internal-calendar/edit-form.blade.php: 1ms (4670 bytes)
[ParserWorker] extractSymbols completed for resources/views/internal-calendar/edit-form.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/internal-calendar/edit-form.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/internal-calendar/edit-form.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/internal-calendar/edit-form.blade.php: 1ms
[ParserWorker] parser.parse() for resources/views/icons/x-mark.blade.php: 0ms (113 bytes)
[ParserWorker] extractSymbols completed for resources/views/icons/x-mark.blade.php: 0 symbols in 0ms (54 iterations)
[ParserWorker] extractSymbols for resources/views/icons/x-mark.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/icons/x-mark.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/icons/x-mark.blade.php: 1ms
[ParserWorker] parser.parse() for tinker.php: 0ms (315 bytes)
[ParserWorker] extractSymbols completed for tinker.php: 0 symbols in 0ms (34 iterations)
[ParserWorker] extractSymbols for tinker.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for tinker.php: 0ms (4 facts)
[ParserWorker] Total parse operation for tinker.php: 1ms
[ParserWorker] parser.parse() for timesheet-summary.md: 1ms (4061 bytes)
[ParserWorker] extractCstFacts for timesheet-summary.md: 0ms (0 facts)
[ParserWorker] Total parse operation for timesheet-summary.md: 1ms
[ParserWorker] parser.parse() for tests/custom/test-cache.php: 4ms (14783 bytes)
[ParserWorker] parser.parse() for routes/web.php: 8ms (32083 bytes)
[ParserWorker] extractSymbols completed for routes/web.php: 0 symbols in 11ms (10410 iterations)
[ParserWorker] extractSymbols for routes/web.php: 11ms (0 symbols)
[ParserWorker] extractCstFacts for routes/web.php: 0ms (3 facts)
[ParserWorker] Total parse operation for routes/web.php: 19ms
[ParserWorker] extractSymbols completed for tests/custom/test-cache.php: 7 symbols in 4ms (4406 iterations)
[ParserWorker] extractSymbols for tests/custom/test-cache.php: 4ms (7 symbols)
[ParserWorker] extractCstFacts for tests/custom/test-cache.php: 0ms (7 facts)
[ParserWorker] Total parse operation for tests/custom/test-cache.php: 8ms
[ParserWorker] parser.parse() for tests/custom/list_tables.php: 1ms (143 bytes)
[ParserWorker] extractSymbols completed for tests/custom/list_tables.php: 0 symbols in 0ms (57 iterations)
[ParserWorker] extractSymbols for tests/custom/list_tables.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for tests/custom/list_tables.php: 0ms (0 facts)
[ParserWorker] Total parse operation for tests/custom/list_tables.php: 1ms
[ParserWorker] parser.parse() for tests/custom/db-test.php: 4ms (16295 bytes)
[ParserWorker] extractSymbols completed for tests/custom/db-test.php: 11 symbols in 5ms (4903 iterations)
[ParserWorker] extractSymbols for tests/custom/db-test.php: 5ms (11 symbols)
[ParserWorker] extractCstFacts for tests/custom/db-test.php: 0ms (6 facts)
[ParserWorker] Total parse operation for tests/custom/db-test.php: 9ms
[ParserWorker] parser.parse() for tests/Unit/Repositories/ClientRepositoryTest.php: 1ms (6162 bytes)
[ParserWorker] extractSymbols completed for tests/Unit/Repositories/ClientRepositoryTest.php: 10 symbols in 2ms (1790 iterations)
[ParserWorker] extractSymbols for tests/Unit/Repositories/ClientRepositoryTest.php: 2ms (10 symbols)
[ParserWorker] extractCstFacts for tests/Unit/Repositories/ClientRepositoryTest.php: 0ms (1 facts)
[ParserWorker] Total parse operation for tests/Unit/Repositories/ClientRepositoryTest.php: 3ms
[ParserWorker] parser.parse() for tests/TestCase.php: 1ms (1625 bytes)
[ParserWorker] extractSymbols completed for tests/TestCase.php: 4 symbols in 0ms (319 iterations)
[ParserWorker] extractSymbols for tests/TestCase.php: 0ms (4 symbols)
[ParserWorker] extractCstFacts for tests/TestCase.php: 0ms (1 facts)
[ParserWorker] Total parse operation for tests/TestCase.php: 1ms
[ParserWorker] parser.parse() for tailwind.config.js: 0ms (3124 bytes)
[ParserWorker] extractSymbols completed for tailwind.config.js: 0 symbols in 1ms (1018 iterations)
[ParserWorker] extractSymbols for tailwind.config.js: 1ms (0 symbols)
[ParserWorker] extractCstFacts for tailwind.config.js: 0ms (1 facts)
[ParserWorker] Total parse operation for tailwind.config.js: 2ms
[ParserWorker] parser.parse() for scripts/migrate-to-sqlite/update-models.php: 0ms (2063 bytes)
[ParserWorker] extractSymbols completed for scripts/migrate-to-sqlite/update-models.php: 0 symbols in 1ms (480 iterations)
[ParserWorker] extractSymbols for scripts/migrate-to-sqlite/update-models.php: 1ms (0 symbols)
[ParserWorker] extractCstFacts for scripts/migrate-to-sqlite/update-models.php: 0ms (4 facts)
[ParserWorker] Total parse operation for scripts/migrate-to-sqlite/update-models.php: 1ms
[ParserWorker] parser.parse() for scripts/migrate-to-sqlite/setup-test-sqlite.php: 1ms (3441 bytes)
[ParserWorker] extractSymbols completed for scripts/migrate-to-sqlite/setup-test-sqlite.php: 0 symbols in 1ms (978 iterations)
[ParserWorker] extractSymbols for scripts/migrate-to-sqlite/setup-test-sqlite.php: 1ms (0 symbols)
[ParserWorker] extractCstFacts for scripts/migrate-to-sqlite/setup-test-sqlite.php: 0ms (10 facts)
[ParserWorker] Total parse operation for scripts/migrate-to-sqlite/setup-test-sqlite.php: 2ms
[ParserWorker] parser.parse() for scripts/migrate-to-sqlite/migrate-data.php: 2ms (10565 bytes)
[ParserWorker] extractSymbols completed for scripts/migrate-to-sqlite/migrate-data.php: 3 symbols in 3ms (3096 iterations)
[ParserWorker] extractSymbols for scripts/migrate-to-sqlite/migrate-data.php: 3ms (3 symbols)
[ParserWorker] extractCstFacts for scripts/migrate-to-sqlite/migrate-data.php: 1ms (17 facts)
[ParserWorker] Total parse operation for scripts/migrate-to-sqlite/migrate-data.php: 6ms
[ParserWorker] parser.parse() for scripts/migrate-to-sqlite/create-sqlite-schema.php: 2ms (17007 bytes)
[ParserWorker] extractSymbols completed for scripts/migrate-to-sqlite/create-sqlite-schema.php: 0 symbols in 1ms (1516 iterations)
[ParserWorker] extractSymbols for scripts/migrate-to-sqlite/create-sqlite-schema.php: 1ms (0 symbols)
[ParserWorker] extractCstFacts for scripts/migrate-to-sqlite/create-sqlite-schema.php: 1ms (51 facts)
[ParserWorker] Total parse operation for scripts/migrate-to-sqlite/create-sqlite-schema.php: 4ms
[ParserWorker] parser.parse() for scripts/migrate-to-sqlite/README.md: 3ms (6858 bytes)
[ParserWorker] extractCstFacts for scripts/migrate-to-sqlite/README.md: 0ms (0 facts)
[ParserWorker] Total parse operation for scripts/migrate-to-sqlite/README.md: 3ms
[ParserWorker] parser.parse() for scripts/migrate-to-sqlite/QUICKSTART.md: 1ms (1604 bytes)
[ParserWorker] extractCstFacts for scripts/migrate-to-sqlite/QUICKSTART.md: 0ms (0 facts)
[ParserWorker] Total parse operation for scripts/migrate-to-sqlite/QUICKSTART.md: 1ms
[ParserWorker] parser.parse() for scripts/migrate-to-sqlite/MIGRATION_STATUS.md: 2ms (3548 bytes)
[ParserWorker] extractCstFacts for scripts/migrate-to-sqlite/MIGRATION_STATUS.md: 0ms (0 facts)
[ParserWorker] Total parse operation for scripts/migrate-to-sqlite/MIGRATION_STATUS.md: 2ms
[ParserWorker] parser.parse() for scripts/RunIndexMigration.php: 3ms (13106 bytes)
[ParserWorker] extractSymbols completed for scripts/RunIndexMigration.php: 0 symbols in 3ms (2980 iterations)
[ParserWorker] extractSymbols for scripts/RunIndexMigration.php: 3ms (0 symbols)
[ParserWorker] extractCstFacts for scripts/RunIndexMigration.php: 0ms (13 facts)
[ParserWorker] Total parse operation for scripts/RunIndexMigration.php: 6ms
[ParserWorker] parser.parse() for scripts/ResizeLargeImages.php: 1ms (4240 bytes)
[ParserWorker] extractSymbols completed for scripts/ResizeLargeImages.php: 0 symbols in 2ms (1607 iterations)
[ParserWorker] extractSymbols for scripts/ResizeLargeImages.php: 2ms (0 symbols)
[ParserWorker] extractCstFacts for scripts/ResizeLargeImages.php: 0ms (1 facts)
[ParserWorker] Total parse operation for scripts/ResizeLargeImages.php: 3ms
[ParserWorker] parser.parse() for scripts/OldMediaManifest.php: 3ms (9084 bytes)
[ParserWorker] extractSymbols completed for scripts/OldMediaManifest.php: 2 symbols in 3ms (3121 iterations)
[ParserWorker] extractSymbols for scripts/OldMediaManifest.php: 3ms (2 symbols)
[ParserWorker] extractCstFacts for scripts/OldMediaManifest.php: 0ms (22 facts)
[ParserWorker] Total parse operation for scripts/OldMediaManifest.php: 6ms
[ParserWorker] parser.parse() for scripts/DownloadMissingPhotosUserID.php: 2ms (4882 bytes)
[ParserWorker] extractSymbols completed for scripts/DownloadMissingPhotosUserID.php: 0 symbols in 1ms (1413 iterations)
[ParserWorker] extractSymbols for scripts/DownloadMissingPhotosUserID.php: 1ms (0 symbols)
[ParserWorker] extractCstFacts for scripts/DownloadMissingPhotosUserID.php: 1ms (4 facts)
[ParserWorker] Total parse operation for scripts/DownloadMissingPhotosUserID.php: 4ms
[ParserWorker] parser.parse() for scripts/CleanupOldMedia.php: 1ms (2765 bytes)
[ParserWorker] extractSymbols completed for scripts/CleanupOldMedia.php: 0 symbols in 1ms (989 iterations)
[ParserWorker] extractSymbols for scripts/CleanupOldMedia.php: 1ms (0 symbols)
[ParserWorker] extractCstFacts for scripts/CleanupOldMedia.php: 0ms (2 facts)
[ParserWorker] Total parse operation for scripts/CleanupOldMedia.php: 2ms
[ParserWorker] parser.parse() for schedule-run.php: 0ms (761 bytes)
[ParserWorker] extractSymbols completed for schedule-run.php: 0 symbols in 1ms (199 iterations)
[ParserWorker] extractSymbols for schedule-run.php: 1ms (0 symbols)
[ParserWorker] extractCstFacts for schedule-run.php: 0ms (4 facts)
[ParserWorker] Total parse operation for schedule-run.php: 1ms
[WorkspaceIndexer] Quick scan complete. Processed 553/553 files, 219 with symbols, 0 skipped. Total symbols: 2366
[AnalysisController] Quick Scan complete. Found 2366 symbols.
[ParserWorker] parser.parse() for tinker.php: 0ms (315 bytes)
[ParserWorker] extractSymbols completed for tinker.php: 0 symbols in 0ms (34 iterations)
[ParserWorker] extractSymbols for tinker.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for tinker.php: 0ms (4 facts)
[ParserWorker] Total parse operation for tinker.php: 1ms
[ParserWorker] parser.parse() for timesheet-summary.md: 1ms (4061 bytes)
[ParserWorker] extractCstFacts for timesheet-summary.md: 0ms (0 facts)
[ParserWorker] Total parse operation for timesheet-summary.md: 1ms
[ParserWorker] parser.parse() for tests/custom/test-cache.php: 4ms (14783 bytes)
[ParserWorker] extractSymbols completed for tests/custom/test-cache.php: 7 symbols in 4ms (4406 iterations)
[ParserWorker] extractSymbols for tests/custom/test-cache.php: 4ms (7 symbols)
[ParserWorker] extractCstFacts for tests/custom/test-cache.php: 0ms (7 facts)
[ParserWorker] Total parse operation for tests/custom/test-cache.php: 8ms
[ParserWorker] parser.parse() for tests/custom/list_tables.php: 1ms (143 bytes)
[ParserWorker] extractSymbols completed for tests/custom/list_tables.php: 0 symbols in 0ms (57 iterations)
[ParserWorker] extractSymbols for tests/custom/list_tables.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for tests/custom/list_tables.php: 0ms (0 facts)
[ParserWorker] Total parse operation for tests/custom/list_tables.php: 1ms
[ParserWorker] parser.parse() for tests/custom/db-test.php: 4ms (16295 bytes)
[ParserWorker] extractSymbols completed for tests/custom/db-test.php: 11 symbols in 5ms (4903 iterations)
[ParserWorker] extractSymbols for tests/custom/db-test.php: 5ms (11 symbols)
[ParserWorker] extractCstFacts for tests/custom/db-test.php: 0ms (6 facts)
[ParserWorker] Total parse operation for tests/custom/db-test.php: 9ms
[ParserWorker] parser.parse() for tests/Unit/Repositories/ClientRepositoryTest.php: 1ms (6162 bytes)
[ParserWorker] extractSymbols completed for tests/Unit/Repositories/ClientRepositoryTest.php: 10 symbols in 2ms (1790 iterations)
[ParserWorker] extractSymbols for tests/Unit/Repositories/ClientRepositoryTest.php: 2ms (10 symbols)
[ParserWorker] extractCstFacts for tests/Unit/Repositories/ClientRepositoryTest.php: 0ms (1 facts)
[ParserWorker] Total parse operation for tests/Unit/Repositories/ClientRepositoryTest.php: 3ms
[ParserWorker] parser.parse() for tests/TestCase.php: 1ms (1625 bytes)
[ParserWorker] extractSymbols completed for tests/TestCase.php: 4 symbols in 0ms (319 iterations)
[ParserWorker] extractSymbols for tests/TestCase.php: 0ms (4 symbols)
[ParserWorker] extractCstFacts for tests/TestCase.php: 0ms (1 facts)
[ParserWorker] Total parse operation for tests/TestCase.php: 1ms
[ParserWorker] parser.parse() for tailwind.config.js: 0ms (3124 bytes)
[ParserWorker] extractSymbols completed for tailwind.config.js: 0 symbols in 1ms (1018 iterations)
[ParserWorker] extractSymbols for tailwind.config.js: 1ms (0 symbols)
[ParserWorker] extractCstFacts for tailwind.config.js: 0ms (1 facts)
[ParserWorker] Total parse operation for tailwind.config.js: 2ms
[ParserWorker] parser.parse() for scripts/migrate-to-sqlite/update-models.php: 0ms (2063 bytes)
[ParserWorker] extractSymbols completed for scripts/migrate-to-sqlite/update-models.php: 0 symbols in 1ms (480 iterations)
[ParserWorker] extractSymbols for scripts/migrate-to-sqlite/update-models.php: 1ms (0 symbols)
[ParserWorker] extractCstFacts for scripts/migrate-to-sqlite/update-models.php: 0ms (4 facts)
[ParserWorker] Total parse operation for scripts/migrate-to-sqlite/update-models.php: 1ms
[ParserWorker] parser.parse() for scripts/migrate-to-sqlite/setup-test-sqlite.php: 1ms (3441 bytes)
[ParserWorker] extractSymbols completed for scripts/migrate-to-sqlite/setup-test-sqlite.php: 0 symbols in 1ms (978 iterations)
[ParserWorker] extractSymbols for scripts/migrate-to-sqlite/setup-test-sqlite.php: 1ms (0 symbols)
[ParserWorker] extractCstFacts for scripts/migrate-to-sqlite/setup-test-sqlite.php: 0ms (10 facts)
[ParserWorker] Total parse operation for scripts/migrate-to-sqlite/setup-test-sqlite.php: 2ms
[ParserWorker] parser.parse() for scripts/migrate-to-sqlite/migrate-data.php: 2ms (10565 bytes)
[ParserWorker] extractSymbols completed for scripts/migrate-to-sqlite/migrate-data.php: 3 symbols in 3ms (3096 iterations)
[ParserWorker] extractSymbols for scripts/migrate-to-sqlite/migrate-data.php: 3ms (3 symbols)
[ParserWorker] extractCstFacts for scripts/migrate-to-sqlite/migrate-data.php: 1ms (17 facts)
[ParserWorker] Total parse operation for scripts/migrate-to-sqlite/migrate-data.php: 6ms
[ParserWorker] parser.parse() for scripts/migrate-to-sqlite/create-sqlite-schema.php: 2ms (17007 bytes)
[ParserWorker] extractSymbols completed for scripts/migrate-to-sqlite/create-sqlite-schema.php: 0 symbols in 1ms (1516 iterations)
[ParserWorker] extractSymbols for scripts/migrate-to-sqlite/create-sqlite-schema.php: 1ms (0 symbols)
[ParserWorker] extractCstFacts for scripts/migrate-to-sqlite/create-sqlite-schema.php: 1ms (51 facts)
[ParserWorker] Total parse operation for scripts/migrate-to-sqlite/create-sqlite-schema.php: 4ms
[ParserWorker] parser.parse() for scripts/migrate-to-sqlite/README.md: 3ms (6858 bytes)
[ParserWorker] extractCstFacts for scripts/migrate-to-sqlite/README.md: 0ms (0 facts)
[ParserWorker] Total parse operation for scripts/migrate-to-sqlite/README.md: 3ms
[ParserWorker] parser.parse() for scripts/migrate-to-sqlite/QUICKSTART.md: 1ms (1604 bytes)
[ParserWorker] extractCstFacts for scripts/migrate-to-sqlite/QUICKSTART.md: 0ms (0 facts)
[ParserWorker] Total parse operation for scripts/migrate-to-sqlite/QUICKSTART.md: 1ms
[ParserWorker] parser.parse() for scripts/migrate-to-sqlite/MIGRATION_STATUS.md: 2ms (3548 bytes)
[ParserWorker] extractCstFacts for scripts/migrate-to-sqlite/MIGRATION_STATUS.md: 0ms (0 facts)
[ParserWorker] Total parse operation for scripts/migrate-to-sqlite/MIGRATION_STATUS.md: 2ms
[ParserWorker] parser.parse() for scripts/RunIndexMigration.php: 3ms (13106 bytes)
[ParserWorker] extractSymbols completed for scripts/RunIndexMigration.php: 0 symbols in 3ms (2980 iterations)
[ParserWorker] extractSymbols for scripts/RunIndexMigration.php: 3ms (0 symbols)
[ParserWorker] extractCstFacts for scripts/RunIndexMigration.php: 0ms (13 facts)
[ParserWorker] Total parse operation for scripts/RunIndexMigration.php: 6ms
[ParserWorker] parser.parse() for scripts/ResizeLargeImages.php: 1ms (4240 bytes)
[ParserWorker] extractSymbols completed for scripts/ResizeLargeImages.php: 0 symbols in 2ms (1607 iterations)
[ParserWorker] extractSymbols for scripts/ResizeLargeImages.php: 2ms (0 symbols)
[ParserWorker] extractCstFacts for scripts/ResizeLargeImages.php: 0ms (1 facts)
[ParserWorker] Total parse operation for scripts/ResizeLargeImages.php: 3ms
[ParserWorker] parser.parse() for scripts/OldMediaManifest.php: 3ms (9084 bytes)
[ParserWorker] extractSymbols completed for scripts/OldMediaManifest.php: 2 symbols in 3ms (3121 iterations)
[ParserWorker] extractSymbols for scripts/OldMediaManifest.php: 3ms (2 symbols)
[ParserWorker] extractCstFacts for scripts/OldMediaManifest.php: 0ms (22 facts)
[ParserWorker] Total parse operation for scripts/OldMediaManifest.php: 6ms
[ParserWorker] parser.parse() for scripts/DownloadMissingPhotosUserID.php: 2ms (4882 bytes)
[ParserWorker] extractSymbols completed for scripts/DownloadMissingPhotosUserID.php: 0 symbols in 1ms (1413 iterations)
[ParserWorker] extractSymbols for scripts/DownloadMissingPhotosUserID.php: 1ms (0 symbols)
[ParserWorker] extractCstFacts for scripts/DownloadMissingPhotosUserID.php: 1ms (4 facts)
[ParserWorker] Total parse operation for scripts/DownloadMissingPhotosUserID.php: 4ms
[ParserWorker] parser.parse() for scripts/CleanupOldMedia.php: 1ms (2765 bytes)
[ParserWorker] extractSymbols completed for scripts/CleanupOldMedia.php: 0 symbols in 1ms (989 iterations)
[ParserWorker] extractSymbols for scripts/CleanupOldMedia.php: 1ms (0 symbols)
[ParserWorker] extractCstFacts for scripts/CleanupOldMedia.php: 0ms (2 facts)
[ParserWorker] Total parse operation for scripts/CleanupOldMedia.php: 2ms
[ParserWorker] parser.parse() for schedule-run.php: 0ms (761 bytes)
[ParserWorker] extractSymbols completed for schedule-run.php: 0 symbols in 1ms (199 iterations)
[ParserWorker] extractSymbols for schedule-run.php: 1ms (0 symbols)
[ParserWorker] extractCstFacts for schedule-run.php: 0ms (4 facts)
[ParserWorker] Total parse operation for schedule-run.php: 1ms
[AnalysisController] Total commits: 198
[BundleView] Fallback hotspots not available in webview
[CockpitProvider] Built bundle view (0 hotspots)
[CockpitProvider] Payload schema validation passed
[CockpitProvider] Posted message: setData
Building tree for 553 files (status=scanning)
[ExplorerService] Hydrating symbols for 219 files
[ExplorerController] Updated explorer tree (2 root nodes)
[AnalysisController] Starting background analysis for 553 files...
[CockpitProvider] Payload schema validation passed
[CockpitProvider] Posted message: setData
[AnalysisCoordinator] Requesting background analysis for 5 commits
[AnalysisCoordinator] Requesting frame analysis for 5 commits
🔄 [ANALYSIS_STARTED] @ 10:51:11
   Payload: {"step":"Frame Analysis"}

[StateLogger] ANALYSIS_STARTED
[Store] Action: ANALYSIS_STARTED payloadKeys=step
[CockpitEffects] onAction received: ANALYSIS_STARTED
🎯 [RefactorPipeline] analyzeBundle called with 5 commits, workspace: true
🎯 [RefactorPipeline] Built timeline with 8 entries
🎯 [RefactorPipeline] Built steps: init, workspace_overlay, scope, index_commits, size, working, intended, hotspots, moved_blocks, drift, legacy, bundle_facts, embedding_index, retrieve_history
🎯 [RefactorPipeline] About to call runPipeline with 14 steps
🚀 [Pipeline] runPipeline called with 14 steps
🚀 [Pipeline] Levels: 8
[Pipeline] Processing level: init
🚀 [InitStep] Starting Data Gathering
[InitStep] Gathering data for 6 commits
[CockpitProvider] Payload schema validation passed
[CockpitProvider] Posted message: setData
[InitStep] 🕐 Commit 1/6 HEAD: 125ms
[InitStep] 🕐 Commit 2/6 b15320dd: 22ms
[InitStep] 🕐 Commit 3/6 99fac67f: 54ms
[InitStep] 🕐 Commit 4/6 46212076: 31ms
[InitStep] 🕐 Commit 5/6 2d307853: 35ms
[InitStep] 🕐 Commit 6/6 9f86403b: 39ms
[GitOperations] Starting git status --porcelain in /home/ryan/sites/austinselite
[GitOperations] git status --porcelain completed in 17ms, 0 bytes
[GitOperations] Starting git ls-files --others in /home/ryan/sites/austinselite
[GitOperations] git ls-files --others completed in 16ms, 0 bytes
[GitCacheService] Checking ignores for 601 files in 1 chunks
[GitCacheService] Ignore cache warmed in 20ms
[InitStep] Fetching 17 blobs (0 filtered as large)
[DatabaseWriteQueue] Flushed 17 operations in single transaction
🚀 [InitStep] Data gathering completed in 505ms
   - 6 commits with file changes
   - 22 file contents cached
   - 22 file sizes cached
   - 0 ignored paths
[Pipeline] Processing level: workspace_overlay, scope, index_commits
🟦 [WorkspaceStep] Starting run
🟦 [WorkspaceStep] Starting unstaged analysis
🟩 [ScopeStep] Starting run
🟩 [ScopeStep] Calling computeScope...
🟧 [IndexCommitsStep] Starting run
🟧 [IndexCommitsStep] Processing 5 commits with concurrency=8
[IndexCommits] Starting with concurrency=8 for 5 commits
[CommitIndexer] Indexing commit b15320dd0316390b09a584ca603763a0f8bc8ce6
[CommitIndexer] Indexing commit 99fac67fd0c49fb7ac7f44525a0669802d087e83
[CommitIndexer] Indexing commit 46212076d65fad8b968db275fad41c91ffd848fd
[CommitIndexer] Indexing commit 2d307853e1b34b3fc50e25a86d644c974b248c3b
[CommitIndexer] Indexing commit 9f86403bd61f11ceb65baa33589401451acc9574
[CommitIndexer] Skipping public/css/app.css: hardcoded exclusion: public/
[CommitIndexer] Skipping public/js/app.js: hardcoded exclusion: public/
[WorkspaceStep] 🕐 Unstaged analysis: 493ms
🟦 [WorkspaceStep] Starting staged analysis
[CommitIndexer] 🕐 getBlobSha for resources/css/layout/admin.css: 0ms
[CommitIndexer] 🕐 getBlobSha for resources/js/app.js: 0ms
[CommitIndexer] 🕐 getBlobSha for resources/views/event-logs/create.blade.php: 0ms
[CommitIndexer] 🕐 getBlobSha for resources/views/event-logs/edit.blade.php: 0ms
[CommitIndexer] 🕐 getBlobSha for app/Providers/DatabaseServiceProvider.php: 0ms
[CommitIndexer] 🕐 getBlobSha for resources/views/resources/patch-notes/december-2025.blade.php: 0ms
[CommitIndexer] 🕐 getBlobSha for app/Providers/DatabaseServiceProvider.php: 0ms
[CommitIndexer] 🕐 File 1/4 public/css/app.css: 473ms
[CommitIndexer] 🕐 File 2/4 public/js/app.js: 472ms
[CommitIndexer] 🕐 getContent for resources/css/layout/admin.css: 3ms (9139 bytes)
[Snapshot] Creating snapshot for resources/css/layout/admin.css@fd771f9d
[CommitIndexer] 🕐 getContent for resources/js/app.js: 5ms (37979 bytes)
[Snapshot] Creating snapshot for resources/js/app.js@35bb58b0
[ParserWorker] parser.parse() for resources/css/layout/admin.css: 1ms (9139 bytes)
[CommitIndexer] 🕐 getContent for resources/views/event-logs/create.blade.php: 5ms (11211 bytes)
[Snapshot] Creating snapshot for resources/views/event-logs/create.blade.php@67304ac3
[CommitIndexer] 🕐 getContent for resources/views/event-logs/edit.blade.php: 6ms (12460 bytes)
[Snapshot] Creating snapshot for resources/views/event-logs/edit.blade.php@52b8400e
[ParserWorker] extractCstFacts for resources/css/layout/admin.css: 0ms (12 facts)
[ParserWorker] Total parse operation for resources/css/layout/admin.css: 2ms
[CommitIndexer] 🕐 getContent for app/Providers/DatabaseServiceProvider.php: 7ms (20137 bytes)
[Snapshot] Creating snapshot for app/Providers/DatabaseServiceProvider.php@12859b93
[CommitIndexer] 🕐 getContent for resources/views/resources/patch-notes/december-2025.blade.php: 7ms (9411 bytes)
[Snapshot] Creating snapshot for resources/views/resources/patch-notes/december-2025.blade.php@b4d0310a
[CommitIndexer] 🕐 getContent for app/Providers/DatabaseServiceProvider.php: 8ms (18262 bytes)
[Snapshot] Creating snapshot for app/Providers/DatabaseServiceProvider.php@00d44f7a
[WorkspaceStep] 🕐 Staged analysis: 12ms
🟦 [WorkspaceStep] Completed successfully
[Scope] Using staged/unstaged files from plan (no git calls)
[computeScope] Calling computeBlastRadiusNeighbors...
🟩 [computeBlastRadius] Built DNA->path cache with 0 entries
🟩 [computeBlastRadius] Querying edges table...
🟩 [computeBlastRadius] Got 0 edges
[ParserWorker] parser.parse() for resources/js/app.js: 8ms (37979 bytes)
[computeScope] computeBlastRadiusNeighbors returned
[Scope] Using plan ignoreData for 8 paths
[Scope] Found 0 ignored paths
[Scope] staged=0, unstaged=0, total working=0, commits=8, blast=0, all=6
🟩 [ScopeStep] computeScope returned, updating state
🟩 [ScopeStep] Completed successfully
[ParserWorker] parser.parse() for resources/css/layout/admin.css: 1ms (9139 bytes)
[CommitIndexer] 🕐 Snapshot creation for resources/css/layout/admin.css: 20ms
[CommitIndexer] 🕐 Snapshot creation for resources/views/event-logs/create.blade.php: 22ms
[CommitIndexer] 🕐 Snapshot creation for resources/views/event-logs/edit.blade.php: 22ms
[CommitIndexer] 🕐 Snapshot creation for app/Providers/DatabaseServiceProvider.php: 38ms
[CommitIndexer] 🕐 Snapshot creation for resources/views/resources/patch-notes/december-2025.blade.php: 39ms
[CommitIndexer] 🕐 Snapshot creation for app/Providers/DatabaseServiceProvider.php: 51ms
[CommitIndexer] 🕐 parser.extractHybridFacts for resources/css/layout/admin.css: 39ms (12 facts)
[ParserWorker] extractSymbols completed for resources/js/app.js: 11 symbols in 9ms (8661 iterations)
[ParserWorker] extractSymbols for resources/js/app.js: 9ms (11 symbols)
[ParserWorker] extractCstFacts for resources/js/app.js: 2ms (96 facts)
[ParserWorker] Total parse operation for resources/js/app.js: 19ms
[ParserWorker] parser.parse() for resources/views/event-logs/create.blade.php: 1ms (11211 bytes)
[ParserWorker] extractSymbols completed for resources/views/event-logs/create.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/event-logs/create.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/event-logs/create.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/event-logs/create.blade.php: 1ms
[ParserWorker] parser.parse() for resources/views/event-logs/edit.blade.php: 1ms (12460 bytes)
[ParserWorker] extractSymbols completed for resources/views/event-logs/edit.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/event-logs/edit.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/event-logs/edit.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/event-logs/edit.blade.php: 2ms
[ParserWorker] parser.parse() for app/Providers/DatabaseServiceProvider.php: 7ms (20137 bytes)
[ParserWorker] extractSymbols completed for app/Providers/DatabaseServiceProvider.php: 0 symbols in 9ms (5514 iterations)
[ParserWorker] extractSymbols for app/Providers/DatabaseServiceProvider.php: 9ms (0 symbols)
[ParserWorker] extractCstFacts for app/Providers/DatabaseServiceProvider.php: 0ms (38 facts)
[ParserWorker] Total parse operation for app/Providers/DatabaseServiceProvider.php: 16ms
[ParserWorker] parser.parse() for resources/views/resources/patch-notes/december-2025.blade.php: 1ms (9411 bytes)
[ParserWorker] extractSymbols completed for resources/views/resources/patch-notes/december-2025.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/resources/patch-notes/december-2025.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/resources/patch-notes/december-2025.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/resources/patch-notes/december-2025.blade.php: 1ms
[ParserWorker] parser.parse() for app/Providers/DatabaseServiceProvider.php: 5ms (18262 bytes)
[ParserWorker] extractSymbols completed for app/Providers/DatabaseServiceProvider.php: 0 symbols in 6ms (5178 iterations)
[ParserWorker] extractSymbols for app/Providers/DatabaseServiceProvider.php: 6ms (0 symbols)
[ParserWorker] extractCstFacts for app/Providers/DatabaseServiceProvider.php: 1ms (38 facts)
[ParserWorker] Total parse operation for app/Providers/DatabaseServiceProvider.php: 12ms
[ParserWorker] parser.parse() for resources/css/layout/admin.css: 2ms (9139 bytes)
[ParserWorker] extractCstFacts for resources/css/layout/admin.css: 1ms (12 facts)
[ParserWorker] Total parse operation for resources/css/layout/admin.css: 3ms
[ParserWorker] parser.parse() for temp.ts: 0ms (147 bytes)
[ParserWorker] extractSymbols completed for temp.ts: 1 symbols in 0ms (46 iterations)
[ParserWorker] extractSymbols for temp.ts: 1ms (1 symbols)
[ParserWorker] extractCstFacts for temp.ts: 0ms (0 facts)
[ParserWorker] Total parse operation for temp.ts: 1ms
[ParserWorker] parser.parse() for resources/views/event-logs/create.blade.php: 0ms (11211 bytes)
[ParserWorker] extractCstFacts for resources/views/event-logs/create.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/event-logs/create.blade.php: 0ms
[ParserWorker] parser.parse() for resources/views/event-logs/edit.blade.php: 0ms (12460 bytes)
[ParserWorker] extractCstFacts for resources/views/event-logs/edit.blade.php: 1ms (0 facts)
[ParserWorker] Total parse operation for resources/views/event-logs/edit.blade.php: 1ms
[CstTimeline] Queued 12 hybrid facts for resources/css/layout/admin.css@b15320dd
[CommitIndexer] 🕐 cstTimelineManager.saveFacts for resources/css/layout/admin.css: 3ms
[CommitIndexer] Saved 12 hybrid facts for resources/css/layout/admin.css@b15320dd
[CommitIndexer] 🕐 extractAndSaveHybridFacts for resources/css/layout/admin.css: 43ms
[Snapshot] Creating snapshot for resources/css/layout/admin.css@616be8e7
[CommitIndexer] 🕐 parser.extractHybridFacts for resources/views/event-logs/create.blade.php: 41ms (0 facts)
[CommitIndexer] 🕐 cstTimelineManager.saveFacts for resources/views/event-logs/create.blade.php: 0ms
[CommitIndexer] 🕐 extractAndSaveHybridFacts for resources/views/event-logs/create.blade.php: 42ms
[Snapshot] Creating snapshot for resources/views/event-logs/create.blade.php@3a8f2101
[ParserWorker] parser.parse() for app/Providers/DatabaseServiceProvider.php: 4ms (20137 bytes)
[ParserWorker] extractCstFacts for app/Providers/DatabaseServiceProvider.php: 0ms (38 facts)
[ParserWorker] Total parse operation for app/Providers/DatabaseServiceProvider.php: 5ms
[CommitIndexer] 🕐 parser.extractHybridFacts for resources/views/event-logs/edit.blade.php: 41ms (0 facts)
[ParserWorker] parser.parse() for resources/views/resources/patch-notes/december-2025.blade.php: 1ms (9411 bytes)
[ParserWorker] extractCstFacts for resources/views/resources/patch-notes/december-2025.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/resources/patch-notes/december-2025.blade.php: 1ms
[CommitIndexer] 🕐 cstTimelineManager.saveFacts for resources/views/event-logs/edit.blade.php: 0ms
[CommitIndexer] 🕐 extractAndSaveHybridFacts for resources/views/event-logs/edit.blade.php: 43ms
[Snapshot] Creating snapshot for resources/views/event-logs/edit.blade.php@251078db
[CommitIndexer] 🕐 parser.extractHybridFacts for app/Providers/DatabaseServiceProvider.php: 27ms (38 facts)
[ParserWorker] parser.parse() for app/Providers/DatabaseServiceProvider.php: 5ms (18262 bytes)
[ParserWorker] extractCstFacts for app/Providers/DatabaseServiceProvider.php: 0ms (38 facts)
[ParserWorker] Total parse operation for app/Providers/DatabaseServiceProvider.php: 5ms
[ParserWorker] parser.parse() for resources/css/layout/admin.css: 1ms (8034 bytes)
[ParserWorker] extractCstFacts for resources/css/layout/admin.css: 0ms (12 facts)
[ParserWorker] Total parse operation for resources/css/layout/admin.css: 1ms
[ParserWorker] parser.parse() for temp.ts: 0ms (147 bytes)
[ParserWorker] extractSymbols completed for temp.ts: 1 symbols in 1ms (46 iterations)
[ParserWorker] extractSymbols for temp.ts: 1ms (1 symbols)
[ParserWorker] extractCstFacts for temp.ts: 0ms (0 facts)
[ParserWorker] Total parse operation for temp.ts: 1ms
[CstTimeline] Queued 38 hybrid facts for app/Providers/DatabaseServiceProvider.php@46212076
[CommitIndexer] 🕐 cstTimelineManager.saveFacts for app/Providers/DatabaseServiceProvider.php: 6ms
[CommitIndexer] Saved 38 hybrid facts for app/Providers/DatabaseServiceProvider.php@46212076
[CommitIndexer] 🕐 extractAndSaveHybridFacts for app/Providers/DatabaseServiceProvider.php: 34ms
[ParserWorker] parser.parse() for resources/views/event-logs/create.blade.php: 0ms (11153 bytes)
[ParserWorker] extractSymbols completed for resources/views/event-logs/create.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/event-logs/create.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/event-logs/create.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/event-logs/create.blade.php: 1ms
[Snapshot] LRU cache hit for app/Providers/DatabaseServiceProvider.php@00d44f7a
[CommitIndexer] 🕐 Parent snapshot for app/Providers/DatabaseServiceProvider.php: 1ms
[CommitIndexer] 🕐 Symbol diff for app/Providers/DatabaseServiceProvider.php: 0ms
[StructDiff] Computing diff for app/Providers/DatabaseServiceProvider.php
[CommitIndexer] 🕐 parser.extractHybridFacts for resources/views/resources/patch-notes/december-2025.blade.php: 45ms (0 facts)
[CommitIndexer] 🕐 cstTimelineManager.saveFacts for resources/views/resources/patch-notes/december-2025.blade.php: 1ms
[CommitIndexer] 🕐 extractAndSaveHybridFacts for resources/views/resources/patch-notes/december-2025.blade.php: 47ms
[Snapshot] Creating snapshot for resources/views/resources/patch-notes/december-2025.blade.php@e89e0378
[CommitIndexer] 🕐 parser.extractHybridFacts for app/Providers/DatabaseServiceProvider.php: 36ms (38 facts)
[CstTimeline] Queued 38 hybrid facts for app/Providers/DatabaseServiceProvider.php@9f86403b
[CommitIndexer] 🕐 cstTimelineManager.saveFacts for app/Providers/DatabaseServiceProvider.php: 7ms
[CommitIndexer] Saved 38 hybrid facts for app/Providers/DatabaseServiceProvider.php@9f86403b
[CommitIndexer] 🕐 extractAndSaveHybridFacts for app/Providers/DatabaseServiceProvider.php: 44ms
[Snapshot] Creating snapshot for app/Providers/DatabaseServiceProvider.php@99177fda
[CommitIndexer] 🕐 Parent snapshot for resources/css/layout/admin.css: 39ms
[CommitIndexer] 🕐 Symbol diff for resources/css/layout/admin.css: 0ms
[StructDiff] Computing diff for resources/css/layout/admin.css
[CommitIndexer] 🕐 Parent snapshot for resources/views/event-logs/create.blade.php: 47ms
[CommitIndexer] 🕐 Symbol diff for resources/views/event-logs/create.blade.php: 0ms
[StructDiff] Computing diff for resources/views/event-logs/create.blade.php
[ParserWorker] parser.parse() for resources/views/event-logs/edit.blade.php: 1ms (12464 bytes)
[ParserWorker] extractSymbols completed for resources/views/event-logs/edit.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/event-logs/edit.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/event-logs/edit.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/event-logs/edit.blade.php: 1ms
[ParserWorker] parser.parse() for resources/views/resources/patch-notes/december-2025.blade.php: 1ms (9098 bytes)
[ParserWorker] extractSymbols completed for resources/views/resources/patch-notes/december-2025.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/resources/patch-notes/december-2025.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/resources/patch-notes/december-2025.blade.php: 1ms (0 facts)
[ParserWorker] Total parse operation for resources/views/resources/patch-notes/december-2025.blade.php: 2ms
[ParserWorker] parser.parse() for app/Providers/DatabaseServiceProvider.php: 4ms (16925 bytes)
[ParserWorker] extractSymbols completed for app/Providers/DatabaseServiceProvider.php: 0 symbols in 5ms (4809 iterations)
[ParserWorker] extractSymbols for app/Providers/DatabaseServiceProvider.php: 5ms (0 symbols)
[ParserWorker] extractCstFacts for app/Providers/DatabaseServiceProvider.php: 1ms (38 facts)
[ParserWorker] Total parse operation for app/Providers/DatabaseServiceProvider.php: 12ms
[ParserWorker] parser.parse() for temp.ts: 0ms (147 bytes)
[ParserWorker] extractSymbols completed for temp.ts: 1 symbols in 0ms (46 iterations)
[ParserWorker] extractSymbols for temp.ts: 0ms (1 symbols)
[ParserWorker] extractCstFacts for temp.ts: 0ms (0 facts)
[ParserWorker] Total parse operation for temp.ts: 0ms
[CommitIndexer] 🕐 Parent snapshot for resources/views/event-logs/edit.blade.php: 56ms
[CommitIndexer] 🕐 Symbol diff for resources/views/event-logs/edit.blade.php: 0ms
[StructDiff] Computing diff for resources/views/event-logs/edit.blade.php
[CommitIndexer] 🕐 Parent snapshot for resources/views/resources/patch-notes/december-2025.blade.php: 44ms
[CommitIndexer] 🕐 Symbol diff for resources/views/resources/patch-notes/december-2025.blade.php: 0ms
[StructDiff] Computing diff for resources/views/resources/patch-notes/december-2025.blade.php
[CommitIndexer] 🕐 Parent snapshot for app/Providers/DatabaseServiceProvider.php: 47ms
[CommitIndexer] 🕐 Symbol diff for app/Providers/DatabaseServiceProvider.php: 0ms
[StructDiff] Computing diff for app/Providers/DatabaseServiceProvider.php
[ParserWorker] parser.parse() for temp.ts: 0ms (147 bytes)
[ParserWorker] extractSymbols completed for temp.ts: 1 symbols in 0ms (46 iterations)
[ParserWorker] extractSymbols for temp.ts: 1ms (1 symbols)
[ParserWorker] extractCstFacts for temp.ts: 0ms (0 facts)
[ParserWorker] Total parse operation for temp.ts: 1ms
[ParserWorker] extractCstFacts for resources/css/layout/admin.css: 0ms (12 facts)
[ParserWorker] Total parse operation for resources/css/layout/admin.css: 2ms
[ParserWorker] parser.parse() for resources/js/app.js: 8ms (37979 bytes)
[ParserWorker] extractSymbols completed for resources/js/app.js: 11 symbols in 9ms (8661 iterations)
[ParserWorker] extractSymbols for resources/js/app.js: 9ms (11 symbols)
[ParserWorker] extractCstFacts for resources/js/app.js: 2ms (96 facts)
[ParserWorker] Total parse operation for resources/js/app.js: 19ms
[ParserWorker] parser.parse() for resources/views/event-logs/create.blade.php: 1ms (11211 bytes)
[ParserWorker] extractSymbols completed for resources/views/event-logs/create.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/event-logs/create.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/event-logs/create.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/event-logs/create.blade.php: 1ms
[ParserWorker] parser.parse() for resources/views/event-logs/edit.blade.php: 1ms (12460 bytes)
[ParserWorker] extractSymbols completed for resources/views/event-logs/edit.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/event-logs/edit.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/event-logs/edit.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/event-logs/edit.blade.php: 2ms
[ParserWorker] parser.parse() for app/Providers/DatabaseServiceProvider.php: 7ms (20137 bytes)
[ParserWorker] extractSymbols completed for app/Providers/DatabaseServiceProvider.php: 0 symbols in 9ms (5514 iterations)
[ParserWorker] extractSymbols for app/Providers/DatabaseServiceProvider.php: 9ms (0 symbols)
[ParserWorker] extractCstFacts for app/Providers/DatabaseServiceProvider.php: 0ms (38 facts)
[ParserWorker] Total parse operation for app/Providers/DatabaseServiceProvider.php: 16ms
[ParserWorker] parser.parse() for resources/views/resources/patch-notes/december-2025.blade.php: 1ms (9411 bytes)
[ParserWorker] extractSymbols completed for resources/views/resources/patch-notes/december-2025.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/resources/patch-notes/december-2025.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/resources/patch-notes/december-2025.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/resources/patch-notes/december-2025.blade.php: 1ms
[ParserWorker] parser.parse() for app/Providers/DatabaseServiceProvider.php: 5ms (18262 bytes)
[ParserWorker] extractSymbols completed for app/Providers/DatabaseServiceProvider.php: 0 symbols in 6ms (5178 iterations)
[ParserWorker] extractSymbols for app/Providers/DatabaseServiceProvider.php: 6ms (0 symbols)
[ParserWorker] extractCstFacts for app/Providers/DatabaseServiceProvider.php: 1ms (38 facts)
[ParserWorker] Total parse operation for app/Providers/DatabaseServiceProvider.php: 12ms
[ParserWorker] parser.parse() for resources/css/layout/admin.css: 2ms (9139 bytes)
[ParserWorker] extractCstFacts for resources/css/layout/admin.css: 1ms (12 facts)
[ParserWorker] Total parse operation for resources/css/layout/admin.css: 3ms
[ParserWorker] parser.parse() for temp.ts: 0ms (147 bytes)
[ParserWorker] extractSymbols completed for temp.ts: 1 symbols in 0ms (46 iterations)
[ParserWorker] extractSymbols for temp.ts: 1ms (1 symbols)
[ParserWorker] extractCstFacts for temp.ts: 0ms (0 facts)
[ParserWorker] Total parse operation for temp.ts: 1ms
[ParserWorker] parser.parse() for resources/views/event-logs/create.blade.php: 0ms (11211 bytes)
[ParserWorker] extractCstFacts for resources/views/event-logs/create.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/event-logs/create.blade.php: 0ms
[ParserWorker] parser.parse() for resources/views/event-logs/edit.blade.php: 0ms (12460 bytes)
[ParserWorker] extractCstFacts for resources/views/event-logs/edit.blade.php: 1ms (0 facts)
[ParserWorker] Total parse operation for resources/views/event-logs/edit.blade.php: 1ms
[ParserWorker] parser.parse() for app/Providers/DatabaseServiceProvider.php: 4ms (20137 bytes)
[ParserWorker] extractCstFacts for app/Providers/DatabaseServiceProvider.php: 0ms (38 facts)
[ParserWorker] Total parse operation for app/Providers/DatabaseServiceProvider.php: 5ms
[ParserWorker] parser.parse() for resources/views/resources/patch-notes/december-2025.blade.php: 1ms (9411 bytes)
[ParserWorker] extractCstFacts for resources/views/resources/patch-notes/december-2025.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/resources/patch-notes/december-2025.blade.php: 1ms
[ParserWorker] parser.parse() for app/Providers/DatabaseServiceProvider.php: 5ms (18262 bytes)
[ParserWorker] extractCstFacts for app/Providers/DatabaseServiceProvider.php: 0ms (38 facts)
[ParserWorker] Total parse operation for app/Providers/DatabaseServiceProvider.php: 5ms
[ParserWorker] parser.parse() for resources/css/layout/admin.css: 1ms (8034 bytes)
[ParserWorker] extractCstFacts for resources/css/layout/admin.css: 0ms (12 facts)
[ParserWorker] Total parse operation for resources/css/layout/admin.css: 1ms
[ParserWorker] parser.parse() for temp.ts: 0ms (147 bytes)
[ParserWorker] extractSymbols completed for temp.ts: 1 symbols in 1ms (46 iterations)
[ParserWorker] extractSymbols for temp.ts: 1ms (1 symbols)
[ParserWorker] extractCstFacts for temp.ts: 0ms (0 facts)
[ParserWorker] Total parse operation for temp.ts: 1ms
[ParserWorker] parser.parse() for resources/views/event-logs/create.blade.php: 0ms (11153 bytes)
[ParserWorker] extractSymbols completed for resources/views/event-logs/create.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/event-logs/create.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/event-logs/create.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/event-logs/create.blade.php: 1ms
[ParserWorker] parser.parse() for resources/views/event-logs/edit.blade.php: 1ms (12464 bytes)
[ParserWorker] extractSymbols completed for resources/views/event-logs/edit.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/event-logs/edit.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/event-logs/edit.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/event-logs/edit.blade.php: 1ms
[ParserWorker] parser.parse() for temp.ts: 0ms (147 bytes)
[ParserWorker] extractSymbols completed for temp.ts: 1 symbols in 0ms (46 iterations)
[ParserWorker] extractSymbols for temp.ts: 0ms (1 symbols)
[ParserWorker] extractCstFacts for temp.ts: 0ms (0 facts)
[ParserWorker] Total parse operation for temp.ts: 0ms
[ParserWorker] parser.parse() for resources/views/resources/patch-notes/december-2025.blade.php: 1ms (9098 bytes)
[ParserWorker] extractSymbols completed for resources/views/resources/patch-notes/december-2025.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] parser.parse() for resources/css/layout/admin.css: 1ms (8034 bytes)
[ParserWorker] extractCstFacts for resources/css/layout/admin.css: 1ms (12 facts)
[ParserWorker] extractSymbols for resources/views/resources/patch-notes/december-2025.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/resources/patch-notes/december-2025.blade.php: 1ms (0 facts)
[ParserWorker] Total parse operation for resources/views/resources/patch-notes/december-2025.blade.php: 2ms
[ParserWorker] Total parse operation for resources/css/layout/admin.css: 2ms
[ParserWorker] parser.parse() for app/Providers/DatabaseServiceProvider.php: 4ms (16925 bytes)
[ParserWorker] extractSymbols completed for app/Providers/DatabaseServiceProvider.php: 0 symbols in 5ms (4809 iterations)
[ParserWorker] extractSymbols for app/Providers/DatabaseServiceProvider.php: 5ms (0 symbols)
[ParserWorker] extractCstFacts for app/Providers/DatabaseServiceProvider.php: 1ms (38 facts)
[ParserWorker] Total parse operation for app/Providers/DatabaseServiceProvider.php: 12ms
[ParserWorker] parser.parse() for temp.ts: 0ms (147 bytes)
[ParserWorker] extractSymbols completed for temp.ts: 1 symbols in 0ms (46 iterations)
[ParserWorker] extractSymbols for temp.ts: 0ms (1 symbols)
[ParserWorker] parser.parse() for resources/css/layout/admin.css: 2ms (9139 bytes)
[ParserWorker] extractCstFacts for temp.ts: 0ms (0 facts)
[ParserWorker] Total parse operation for temp.ts: 0ms
[ParserWorker] parser.parse() for temp.ts: 0ms (147 bytes)
[ParserWorker] extractSymbols completed for temp.ts: 1 symbols in 0ms (46 iterations)
[ParserWorker] extractSymbols for temp.ts: 1ms (1 symbols)
[ParserWorker] extractCstFacts for temp.ts: 0ms (0 facts)
[ParserWorker] Total parse operation for temp.ts: 1ms
[ParserWorker] extractCstFacts for resources/css/layout/admin.css: 1ms (12 facts)
[ParserWorker] Total parse operation for resources/css/layout/admin.css: 3ms
[ParserWorker] parser.parse() for app/Providers/DatabaseServiceProvider.php: 4ms (18262 bytes)
[ParserWorker] extractSymbols completed for app/Providers/DatabaseServiceProvider.php: 0 symbols in 6ms (5178 iterations)
[ParserWorker] extractSymbols for app/Providers/DatabaseServiceProvider.php: 6ms (0 symbols)
[ParserWorker] extractCstFacts for app/Providers/DatabaseServiceProvider.php: 0ms (38 facts)
[ParserWorker] Total parse operation for app/Providers/DatabaseServiceProvider.php: 14ms
[ParserWorker] parser.parse() for app/Providers/DatabaseServiceProvider.php: 6ms (20137 bytes)
[ParserWorker] extractSymbols completed for app/Providers/DatabaseServiceProvider.php: 0 symbols in 7ms (5514 iterations)
[ParserWorker] extractSymbols for app/Providers/DatabaseServiceProvider.php: 7ms (0 symbols)
[ParserWorker] extractCstFacts for app/Providers/DatabaseServiceProvider.php: 1ms (38 facts)
[ParserWorker] Total parse operation for app/Providers/DatabaseServiceProvider.php: 14ms
[CommitIndexer] 🕐 Structural diff for resources/css/layout/admin.css: 111ms
[CommitIndexer] Structural change detected in resources/css/layout/admin.css: 70.0%
[ParserWorker] parser.parse() for temp.ts: 0ms (147 bytes)
[ParserWorker] extractSymbols completed for temp.ts: 1 symbols in 0ms (46 iterations)
[ParserWorker] extractSymbols for temp.ts: 0ms (1 symbols)
[ParserWorker] extractCstFacts for temp.ts: 0ms (0 facts)
[ParserWorker] Total parse operation for temp.ts: 1ms
[ParserWorker] parser.parse() for resources/css/layout/admin.css: 6ms (8034 bytes)
[ParserWorker] extractCstFacts for resources/css/layout/admin.css: 1ms (12 facts)
[ParserWorker] Total parse operation for resources/css/layout/admin.css: 7ms
[ParserWorker] parser.parse() for temp.ts: 0ms (147 bytes)
[ParserWorker] extractSymbols completed for temp.ts: 1 symbols in 0ms (46 iterations)
[ParserWorker] extractSymbols for temp.ts: 0ms (1 symbols)
[ParserWorker] extractCstFacts for temp.ts: 0ms (0 facts)
[ParserWorker] Total parse operation for temp.ts: 0ms
[ParserWorker] parser.parse() for temp.ts: 0ms (147 bytes)
[ParserWorker] extractSymbols completed for temp.ts: 1 symbols in 0ms (46 iterations)
[ParserWorker] extractSymbols for temp.ts: 0ms (1 symbols)
[ParserWorker] extractCstFacts for temp.ts: 0ms (0 facts)
[ParserWorker] parser.parse() for resources/css/layout/admin.css: 2ms (9139 bytes)
[ParserWorker] Total parse operation for temp.ts: 0ms
[ParserWorker] extractCstFacts for resources/css/layout/admin.css: 1ms (12 facts)
[ParserWorker] Total parse operation for resources/css/layout/admin.css: 3ms
[ParserWorker] parser.parse() for resources/css/layout/admin.css: 1ms (8034 bytes)
[ParserWorker] extractCstFacts for resources/css/layout/admin.css: 1ms (12 facts)
[ParserWorker] Total parse operation for resources/css/layout/admin.css: 2ms
[ParserWorker] parser.parse() for resources/css/layout/admin.css: 2ms (9139 bytes)
[ParserWorker] extractCstFacts for resources/css/layout/admin.css: 1ms (12 facts)
[ParserWorker] Total parse operation for resources/css/layout/admin.css: 3ms
[ParserWorker] parser.parse() for app/Providers/DatabaseServiceProvider.php: 4ms (18262 bytes)
[ParserWorker] parser.parse() for temp.ts: 0ms (147 bytes)
[ParserWorker] extractSymbols completed for temp.ts: 1 symbols in 1ms (46 iterations)
[ParserWorker] extractSymbols for temp.ts: 1ms (1 symbols)
[ParserWorker] extractCstFacts for temp.ts: 0ms (0 facts)
[ParserWorker] Total parse operation for temp.ts: 1ms
[ParserWorker] extractSymbols completed for app/Providers/DatabaseServiceProvider.php: 0 symbols in 6ms (5178 iterations)
[ParserWorker] extractSymbols for app/Providers/DatabaseServiceProvider.php: 6ms (0 symbols)
[ParserWorker] extractCstFacts for app/Providers/DatabaseServiceProvider.php: 0ms (38 facts)
[ParserWorker] Total parse operation for app/Providers/DatabaseServiceProvider.php: 14ms
[ParserWorker] parser.parse() for app/Providers/DatabaseServiceProvider.php: 6ms (20137 bytes)
[ParserWorker] extractSymbols completed for app/Providers/DatabaseServiceProvider.php: 0 symbols in 7ms (5514 iterations)
[ParserWorker] extractSymbols for app/Providers/DatabaseServiceProvider.php: 7ms (0 symbols)
[ParserWorker] extractCstFacts for app/Providers/DatabaseServiceProvider.php: 1ms (38 facts)
[ParserWorker] Total parse operation for app/Providers/DatabaseServiceProvider.php: 14ms
[ParserWorker] parser.parse() for temp.ts: 0ms (147 bytes)
[ParserWorker] extractSymbols completed for temp.ts: 1 symbols in 0ms (46 iterations)
[ParserWorker] extractSymbols for temp.ts: 0ms (1 symbols)
[ParserWorker] extractCstFacts for temp.ts: 0ms (0 facts)
[ParserWorker] Total parse operation for temp.ts: 1ms
[ParserWorker] parser.parse() for resources/css/layout/admin.css: 6ms (8034 bytes)
[ParserWorker] extractCstFacts for resources/css/layout/admin.css: 1ms (12 facts)
[ParserWorker] Total parse operation for resources/css/layout/admin.css: 7ms
[CommitIndexer] 🕐 parser.extractHybridFacts for resources/css/layout/admin.css: 9ms (12 facts)
[CstTimeline] Queued 12 hybrid facts for resources/css/layout/admin.css@b15320dd
[CommitIndexer] 🕐 cstTimelineManager.saveFacts for resources/css/layout/admin.css: 3ms
[CommitIndexer] Saved 12 hybrid facts for resources/css/layout/admin.css@b15320dd
[CommitIndexer] 🕐 Total processFile for resources/css/layout/admin.css: 247ms
[CommitIndexer] 🕐 File 3/4 resources/css/layout/admin.css: 715ms
[ParserWorker] parser.parse() for temp.ts: 0ms (147 bytes)
[ParserWorker] extractSymbols completed for temp.ts: 1 symbols in 0ms (46 iterations)
[ParserWorker] extractSymbols for temp.ts: 0ms (1 symbols)
[ParserWorker] extractCstFacts for temp.ts: 0ms (0 facts)
[ParserWorker] Total parse operation for temp.ts: 0ms
[ParserWorker] parser.parse() for resources/css/layout/admin.css: 2ms (9139 bytes)
[ParserWorker] extractCstFacts for resources/css/layout/admin.css: 1ms (12 facts)
[ParserWorker] Total parse operation for resources/css/layout/admin.css: 3ms
[ParserWorker] parser.parse() for temp.ts: 0ms (147 bytes)
[ParserWorker] extractSymbols completed for temp.ts: 1 symbols in 1ms (46 iterations)
[ParserWorker] extractSymbols for temp.ts: 1ms (1 symbols)
[ParserWorker] extractCstFacts for temp.ts: 0ms (0 facts)
[ParserWorker] Total parse operation for temp.ts: 1ms
[ParserWorker] parser.parse() for temp.ts: 0ms (147 bytes)
[ParserWorker] extractSymbols completed for temp.ts: 1 symbols in 0ms (46 iterations)
[ParserWorker] extractSymbols for temp.ts: 0ms (1 symbols)
[ParserWorker] extractCstFacts for temp.ts: 0ms (0 facts)
[ParserWorker] Total parse operation for temp.ts: 1ms
[ParserWorker] parser.parse() for temp.ts: 0ms (147 bytes)
[ParserWorker] extractSymbols completed for temp.ts: 1 symbols in 0ms (46 iterations)
[ParserWorker] extractSymbols for temp.ts: 0ms (1 symbols)
[ParserWorker] extractCstFacts for temp.ts: 0ms (0 facts)
[ParserWorker] Total parse operation for temp.ts: 0ms
[ParserWorker] parser.parse() for temp.ts: 0ms (147 bytes)
[ParserWorker] extractSymbols completed for temp.ts: 1 symbols in 0ms (46 iterations)
[ParserWorker] extractSymbols for temp.ts: 0ms (1 symbols)
[ParserWorker] extractCstFacts for temp.ts: 0ms (0 facts)
[ParserWorker] Total parse operation for temp.ts: 0ms
[ParserWorker] parser.parse() for temp.ts: 0ms (147 bytes)
[ParserWorker] extractSymbols completed for temp.ts: 1 symbols in 0ms (46 iterations)
[ParserWorker] extractSymbols for temp.ts: 0ms (1 symbols)
[ParserWorker] extractCstFacts for temp.ts: 0ms (0 facts)
[ParserWorker] Total parse operation for temp.ts: 1ms
[ParserWorker] parser.parse() for app/Providers/DatabaseServiceProvider.php: 4ms (16925 bytes)
[CommitIndexer] 🕐 Snapshot creation for resources/js/app.js: 256ms
[ParserWorker] extractSymbols completed for app/Providers/DatabaseServiceProvider.php: 0 symbols in 6ms (4809 iterations)
[ParserWorker] extractSymbols for app/Providers/DatabaseServiceProvider.php: 6ms (0 symbols)
[ParserWorker] extractCstFacts for app/Providers/DatabaseServiceProvider.php: 0ms (38 facts)
[CommitIndexer] 🕐 parser.extractHybridFacts for resources/js/app.js: 3617ms (107 facts)
[CstTimeline] Queued 107 hybrid facts for resources/js/app.js@b15320dd
[CommitIndexer] 🕐 cstTimelineManager.saveFacts for resources/js/app.js: 17ms
[CommitIndexer] Saved 107 hybrid facts for resources/js/app.js@b15320dd
[CommitIndexer] 🕐 extractAndSaveHybridFacts for resources/js/app.js: 3635ms
[Snapshot] Creating snapshot for resources/js/app.js@6291bedf
[ParserWorker] parser.parse() for temp.ts: 0ms (147 bytes)
[ParserWorker] Total parse operation for app/Providers/DatabaseServiceProvider.php: 10ms
[ParserWorker] parser.parse() for app/Providers/DatabaseServiceProvider.php: 4ms (18262 bytes)
[ParserWorker] extractSymbols completed for app/Providers/DatabaseServiceProvider.php: 0 symbols in 8ms (5178 iterations)
[ParserWorker] extractSymbols for app/Providers/DatabaseServiceProvider.php: 8ms (0 symbols)
[ParserWorker] extractCstFacts for app/Providers/DatabaseServiceProvider.php: 0ms (38 facts)
[ParserWorker] Total parse operation for app/Providers/DatabaseServiceProvider.php: 12ms
[ParserWorker] parser.parse() for resources/js/app.js: 3598ms (37979 bytes)
[ParserWorker] extractCstFacts for resources/js/app.js: 2ms (96 facts)
[ParserWorker] Total parse operation for resources/js/app.js: 3600ms
[ParserWorker] extractSymbols completed for temp.ts: 1 symbols in 0ms (46 iterations)
[ParserWorker] extractSymbols for temp.ts: 0ms (1 symbols)
[ParserWorker] extractCstFacts for temp.ts: 0ms (0 facts)
[ParserWorker] Total parse operation for temp.ts: 0ms
[ParserWorker] parser.parse() for temp.ts: 0ms (147 bytes)
[ParserWorker] extractSymbols completed for temp.ts: 1 symbols in 0ms (46 iterations)
[ParserWorker] extractSymbols for temp.ts: 0ms (1 symbols)
[ParserWorker] extractCstFacts for temp.ts: 0ms (0 facts)
[ParserWorker] Total parse operation for temp.ts: 0ms
[ParserWorker] parser.parse() for app/Providers/DatabaseServiceProvider.php: 4ms (16925 bytes)
[ParserWorker] extractSymbols completed for app/Providers/DatabaseServiceProvider.php: 0 symbols in 6ms (4809 iterations)
[ParserWorker] extractSymbols for app/Providers/DatabaseServiceProvider.php: 6ms (0 symbols)
[ParserWorker] extractCstFacts for app/Providers/DatabaseServiceProvider.php: 0ms (38 facts)
[ParserWorker] Total parse operation for app/Providers/DatabaseServiceProvider.php: 10ms
[ParserWorker] parser.parse() for app/Providers/DatabaseServiceProvider.php: 4ms (18262 bytes)
[ParserWorker] extractSymbols completed for app/Providers/DatabaseServiceProvider.php: 0 symbols in 8ms (5178 iterations)
[ParserWorker] extractSymbols for app/Providers/DatabaseServiceProvider.php: 8ms (0 symbols)
[ParserWorker] extractCstFacts for app/Providers/DatabaseServiceProvider.php: 0ms (38 facts)
[ParserWorker] Total parse operation for app/Providers/DatabaseServiceProvider.php: 12ms
[ParserWorker] parser.parse() for resources/js/app.js: 3598ms (37979 bytes)
[ParserWorker] extractCstFacts for resources/js/app.js: 2ms (96 facts)
[ParserWorker] Total parse operation for resources/js/app.js: 3600ms
[CommitIndexer] 🕐 Structural diff for app/Providers/DatabaseServiceProvider.php: 3829ms
[CommitIndexer] Structural change detected in app/Providers/DatabaseServiceProvider.php: 100.0%
[ParserWorker] parser.parse() for resources/js/app.js: 8ms (34584 bytes)
[ParserWorker] extractSymbols completed for resources/js/app.js: 8 symbols in 12ms (7755 iterations)
[ParserWorker] extractSymbols for resources/js/app.js: 12ms (8 symbols)
[ParserWorker] extractCstFacts for resources/js/app.js: 1ms (87 facts)
[ParserWorker] Total parse operation for resources/js/app.js: 21ms
[ParserWorker] parser.parse() for resources/views/event-logs/create.blade.php: 0ms (11153 bytes)
[ParserWorker] extractSymbols completed for resources/views/event-logs/create.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/event-logs/create.blade.php: 1ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/event-logs/create.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/event-logs/create.blade.php: 1ms
[ParserWorker] parser.parse() for resources/views/event-logs/create.blade.php: 0ms (11211 bytes)
[ParserWorker] extractSymbols completed for resources/views/event-logs/create.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/event-logs/create.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/event-logs/create.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/event-logs/create.blade.php: 1ms
[ParserWorker] parser.parse() for app/Providers/DatabaseServiceProvider.php: 4ms (18262 bytes)
[ParserWorker] extractSymbols completed for app/Providers/DatabaseServiceProvider.php: 0 symbols in 5ms (5178 iterations)
[ParserWorker] extractSymbols for app/Providers/DatabaseServiceProvider.php: 5ms (0 symbols)
[ParserWorker] extractCstFacts for app/Providers/DatabaseServiceProvider.php: 0ms (38 facts)
[ParserWorker] Total parse operation for app/Providers/DatabaseServiceProvider.php: 13ms
[ParserWorker] parser.parse() for resources/views/resources/patch-notes/december-2025.blade.php: 1ms (9098 bytes)
[ParserWorker] extractSymbols completed for resources/views/resources/patch-notes/december-2025.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/resources/patch-notes/december-2025.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/resources/patch-notes/december-2025.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/resources/patch-notes/december-2025.blade.php: 1ms
[ParserWorker] parser.parse() for resources/views/resources/patch-notes/december-2025.blade.php: 0ms (9411 bytes)
[ParserWorker] extractSymbols completed for resources/views/resources/patch-notes/december-2025.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/resources/patch-notes/december-2025.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/resources/patch-notes/december-2025.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/resources/patch-notes/december-2025.blade.php: 1ms
[ParserWorker] parser.parse() for temp.ts: 0ms (147 bytes)
[ParserWorker] extractSymbols completed for temp.ts: 1 symbols in 0ms (46 iterations)
[ParserWorker] extractSymbols for temp.ts: 0ms (1 symbols)
[ParserWorker] extractCstFacts for temp.ts: 0ms (0 facts)
[ParserWorker] Total parse operation for temp.ts: 0ms
[ParserWorker] parser.parse() for resources/views/event-logs/edit.blade.php: 1ms (12464 bytes)
[ParserWorker] extractSymbols completed for resources/views/event-logs/edit.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/event-logs/edit.blade.php: 1ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/event-logs/edit.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/event-logs/edit.blade.php: 3ms
[ParserWorker] parser.parse() for resources/views/event-logs/edit.blade.php: 1ms (12460 bytes)
[ParserWorker] extractSymbols completed for resources/views/event-logs/edit.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/event-logs/edit.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/event-logs/edit.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/event-logs/edit.blade.php: 1ms
[ParserWorker] parser.parse() for app/Providers/DatabaseServiceProvider.php: 5ms (20137 bytes)
[ParserWorker] extractCstFacts for app/Providers/DatabaseServiceProvider.php: 1ms (38 facts)
[ParserWorker] Total parse operation for app/Providers/DatabaseServiceProvider.php: 8ms
[ParserWorker] parser.parse() for temp.ts: 0ms (147 bytes)
[ParserWorker] extractSymbols completed for temp.ts: 1 symbols in 0ms (46 iterations)
[ParserWorker] extractSymbols for temp.ts: 0ms (1 symbols)
[ParserWorker] extractCstFacts for temp.ts: 0ms (0 facts)
[ParserWorker] Total parse operation for temp.ts: 0ms
[CommitIndexer] 🕐 parser.extractHybridFacts for app/Providers/DatabaseServiceProvider.php: 23ms (38 facts)
[CstTimeline] Queued 38 hybrid facts for app/Providers/DatabaseServiceProvider.php@46212076
[CommitIndexer] 🕐 cstTimelineManager.saveFacts for app/Providers/DatabaseServiceProvider.php: 8ms
[CommitIndexer] Saved 38 hybrid facts for app/Providers/DatabaseServiceProvider.php@46212076
[CommitIndexer] 🕐 Total processFile for app/Providers/DatabaseServiceProvider.php: 3968ms
[CommitIndexer] 🕐 File 1/1 app/Providers/DatabaseServiceProvider.php: 3973ms
[CommitIndexer] 🕐 All files for commit 46212076: 4441ms (1 files)
[CommitIndexer] File contributed structural change: 1.000
[CommitIndexer] Commit 46212076: 1 files, structural change: 100.0%
[CommitIndexer] Storing 0 symbol changes for 46212076d65fad8b968db275fad41c91ffd848fd
[MovedBlockDetector] Detecting moves for commit 46212076
[MovedBlockDetector] Found 0 moved blocks, 0 lineage entries
[CommitIndexer] 🕐 Commit 3/5 46212076: 4455ms
[CommitIndexer] 🕐 Parent snapshot for resources/js/app.js: 82ms
[CommitIndexer] 🕐 Symbol diff for resources/js/app.js: 0ms
[StructDiff] Computing diff for resources/js/app.js
[ParserWorker] parser.parse() for resources/js/app.js: 8ms (34584 bytes)
[ParserWorker] extractSymbols completed for resources/js/app.js: 8 symbols in 12ms (7755 iterations)
[ParserWorker] extractSymbols for resources/js/app.js: 12ms (8 symbols)
[ParserWorker] extractCstFacts for resources/js/app.js: 1ms (87 facts)
[ParserWorker] Total parse operation for resources/js/app.js: 21ms
[ParserWorker] parser.parse() for resources/views/event-logs/create.blade.php: 0ms (11153 bytes)
[ParserWorker] extractSymbols completed for resources/views/event-logs/create.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/event-logs/create.blade.php: 1ms (0 symbols)
[ParserWorker] parser.parse() for temp.ts: 0ms (147 bytes)
[ParserWorker] extractSymbols completed for temp.ts: 1 symbols in 0ms (46 iterations)
[ParserWorker] extractSymbols for temp.ts: 0ms (1 symbols)
[ParserWorker] extractCstFacts for temp.ts: 1ms (0 facts)
[ParserWorker] Total parse operation for temp.ts: 1ms
[ParserWorker] parser.parse() for temp.ts: 0ms (147 bytes)
[ParserWorker] extractSymbols completed for temp.ts: 1 symbols in 0ms (46 iterations)
[ParserWorker] extractSymbols for temp.ts: 0ms (1 symbols)
[ParserWorker] extractCstFacts for temp.ts: 0ms (0 facts)
[ParserWorker] Total parse operation for temp.ts: 0ms
[ParserWorker] parser.parse() for temp.ts: 0ms (147 bytes)
[ParserWorker] extractSymbols completed for temp.ts: 1 symbols in 0ms (46 iterations)
[ParserWorker] extractSymbols for temp.ts: 0ms (1 symbols)
[ParserWorker] extractCstFacts for temp.ts: 0ms (0 facts)
[ParserWorker] Total parse operation for temp.ts: 1ms
[ParserWorker] parser.parse() for temp.ts: 0ms (147 bytes)
[ParserWorker] extractSymbols completed for temp.ts: 1 symbols in 0ms (46 iterations)
[ParserWorker] extractSymbols for temp.ts: 0ms (1 symbols)
[ParserWorker] extractCstFacts for temp.ts: 0ms (0 facts)
[ParserWorker] Total parse operation for temp.ts: 0ms
[ParserWorker] parser.parse() for temp.ts: 0ms (147 bytes)
[ParserWorker] extractSymbols completed for temp.ts: 1 symbols in 0ms (46 iterations)
[ParserWorker] extractSymbols for temp.ts: 0ms (1 symbols)
[ParserWorker] extractCstFacts for temp.ts: 0ms (0 facts)
[ParserWorker] Total parse operation for temp.ts: 0ms
[ParserWorker] parser.parse() for temp.ts: 1ms (147 bytes)
[ParserWorker] extractSymbols completed for temp.ts: 1 symbols in 0ms (46 iterations)
[ParserWorker] extractSymbols for temp.ts: 0ms (1 symbols)
[ParserWorker] extractCstFacts for temp.ts: 0ms (0 facts)
[ParserWorker] Total parse operation for temp.ts: 1ms
[ParserWorker] extractCstFacts for resources/views/event-logs/create.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/event-logs/create.blade.php: 1ms
[ParserWorker] parser.parse() for resources/views/event-logs/create.blade.php: 0ms (11211 bytes)
[ParserWorker] extractSymbols completed for resources/views/event-logs/create.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/event-logs/create.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/event-logs/create.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/event-logs/create.blade.php: 1ms
[ParserWorker] parser.parse() for app/Providers/DatabaseServiceProvider.php: 4ms (18262 bytes)
[ParserWorker] extractSymbols completed for app/Providers/DatabaseServiceProvider.php: 0 symbols in 5ms (5178 iterations)
[ParserWorker] extractSymbols for app/Providers/DatabaseServiceProvider.php: 5ms (0 symbols)
[ParserWorker] extractCstFacts for app/Providers/DatabaseServiceProvider.php: 0ms (38 facts)
[ParserWorker] Total parse operation for app/Providers/DatabaseServiceProvider.php: 13ms
[ParserWorker] parser.parse() for resources/views/resources/patch-notes/december-2025.blade.php: 1ms (9098 bytes)
[ParserWorker] extractSymbols completed for resources/views/resources/patch-notes/december-2025.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/resources/patch-notes/december-2025.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/resources/patch-notes/december-2025.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/resources/patch-notes/december-2025.blade.php: 1ms
[ParserWorker] parser.parse() for resources/views/resources/patch-notes/december-2025.blade.php: 0ms (9411 bytes)
[ParserWorker] extractSymbols completed for resources/views/resources/patch-notes/december-2025.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/resources/patch-notes/december-2025.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/resources/patch-notes/december-2025.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/resources/patch-notes/december-2025.blade.php: 1ms
[ParserWorker] parser.parse() for temp.ts: 0ms (147 bytes)
[ParserWorker] extractSymbols completed for temp.ts: 1 symbols in 0ms (46 iterations)
[ParserWorker] extractSymbols for temp.ts: 0ms (1 symbols)
[ParserWorker] extractCstFacts for temp.ts: 0ms (0 facts)
[ParserWorker] Total parse operation for temp.ts: 0ms
[ParserWorker] parser.parse() for resources/views/event-logs/edit.blade.php: 1ms (12464 bytes)
[ParserWorker] extractSymbols completed for resources/views/event-logs/edit.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/event-logs/edit.blade.php: 1ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/event-logs/edit.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/event-logs/edit.blade.php: 3ms
[ParserWorker] parser.parse() for resources/views/event-logs/edit.blade.php: 1ms (12460 bytes)
[ParserWorker] extractSymbols completed for resources/views/event-logs/edit.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/event-logs/edit.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/event-logs/edit.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/event-logs/edit.blade.php: 1ms
[ParserWorker] parser.parse() for app/Providers/DatabaseServiceProvider.php: 5ms (20137 bytes)
[ParserWorker] extractCstFacts for app/Providers/DatabaseServiceProvider.php: 1ms (38 facts)
[ParserWorker] Total parse operation for app/Providers/DatabaseServiceProvider.php: 8ms
[ParserWorker] parser.parse() for temp.ts: 0ms (147 bytes)
[ParserWorker] extractSymbols completed for temp.ts: 1 symbols in 0ms (46 iterations)
[ParserWorker] extractSymbols for temp.ts: 0ms (1 symbols)
[ParserWorker] extractCstFacts for temp.ts: 0ms (0 facts)
[ParserWorker] Total parse operation for temp.ts: 0ms
[CommitIndexer] 🕐 Structural diff for app/Providers/DatabaseServiceProvider.php: 3851ms
[CommitIndexer] Structural change detected in app/Providers/DatabaseServiceProvider.php: 100.0%
[ParserWorker] parser.parse() for temp.ts: 0ms (147 bytes)
[ParserWorker] extractSymbols completed for temp.ts: 1 symbols in 0ms (46 iterations)
[ParserWorker] extractSymbols for temp.ts: 0ms (1 symbols)
[ParserWorker] extractCstFacts for temp.ts: 1ms (0 facts)
[ParserWorker] Total parse operation for temp.ts: 1ms
[ParserWorker] parser.parse() for temp.ts: 0ms (147 bytes)
[ParserWorker] extractSymbols completed for temp.ts: 1 symbols in 0ms (46 iterations)
[ParserWorker] extractSymbols for temp.ts: 0ms (1 symbols)
[ParserWorker] extractCstFacts for temp.ts: 0ms (0 facts)
[ParserWorker] Total parse operation for temp.ts: 0ms
[ParserWorker] parser.parse() for temp.ts: 0ms (147 bytes)
[ParserWorker] extractSymbols completed for temp.ts: 1 symbols in 0ms (46 iterations)
[ParserWorker] extractSymbols for temp.ts: 0ms (1 symbols)
[ParserWorker] extractCstFacts for temp.ts: 0ms (0 facts)
[ParserWorker] Total parse operation for temp.ts: 1ms
[ParserWorker] parser.parse() for temp.ts: 0ms (147 bytes)
[ParserWorker] extractSymbols completed for temp.ts: 1 symbols in 0ms (46 iterations)
[ParserWorker] extractSymbols for temp.ts: 0ms (1 symbols)
[ParserWorker] extractCstFacts for temp.ts: 0ms (0 facts)
[ParserWorker] Total parse operation for temp.ts: 0ms
[ParserWorker] parser.parse() for temp.ts: 0ms (147 bytes)
[ParserWorker] extractSymbols completed for temp.ts: 1 symbols in 0ms (46 iterations)
[ParserWorker] extractSymbols for temp.ts: 0ms (1 symbols)
[ParserWorker] extractCstFacts for temp.ts: 0ms (0 facts)
[ParserWorker] Total parse operation for temp.ts: 0ms
[ParserWorker] parser.parse() for temp.ts: 1ms (147 bytes)
[ParserWorker] extractSymbols completed for temp.ts: 1 symbols in 0ms (46 iterations)
[ParserWorker] parser.parse() for app/Providers/DatabaseServiceProvider.php: 6ms (16925 bytes)
[ParserWorker] extractSymbols for temp.ts: 0ms (1 symbols)
[ParserWorker] extractCstFacts for temp.ts: 0ms (0 facts)
[ParserWorker] Total parse operation for temp.ts: 1ms
[ParserWorker] extractSymbols completed for app/Providers/DatabaseServiceProvider.php: 0 symbols in 9ms (4809 iterations)
[ParserWorker] extractSymbols for app/Providers/DatabaseServiceProvider.php: 9ms (0 symbols)
[ParserWorker] extractCstFacts for app/Providers/DatabaseServiceProvider.php: 0ms (38 facts)
[ParserWorker] Total parse operation for app/Providers/DatabaseServiceProvider.php: 15ms
[ParserWorker] parser.parse() for app/Providers/DatabaseServiceProvider.php: 6ms (16925 bytes)
[ParserWorker] extractSymbols completed for app/Providers/DatabaseServiceProvider.php: 0 symbols in 9ms (4809 iterations)
[ParserWorker] extractSymbols for app/Providers/DatabaseServiceProvider.php: 9ms (0 symbols)
[ParserWorker] extractCstFacts for app/Providers/DatabaseServiceProvider.php: 0ms (38 facts)
[ParserWorker] Total parse operation for app/Providers/DatabaseServiceProvider.php: 15ms
[CommitIndexer] 🕐 parser.extractHybridFacts for app/Providers/DatabaseServiceProvider.php: 8ms (38 facts)
[CstTimeline] Queued 38 hybrid facts for app/Providers/DatabaseServiceProvider.php@9f86403b
[CommitIndexer] 🕐 cstTimelineManager.saveFacts for app/Providers/DatabaseServiceProvider.php: 7ms
[CommitIndexer] Saved 38 hybrid facts for app/Providers/DatabaseServiceProvider.php@9f86403b
[CommitIndexer] 🕐 Total processFile for app/Providers/DatabaseServiceProvider.php: 4036ms
[CommitIndexer] 🕐 File 1/1 app/Providers/DatabaseServiceProvider.php: 4042ms
[CommitIndexer] 🕐 All files for commit 9f86403b: 4510ms (1 files)
[CommitIndexer] File contributed structural change: 1.000
[CommitIndexer] Commit 9f86403b: 1 files, structural change: 100.0%
[CommitIndexer] Storing 0 symbol changes for 9f86403bd61f11ceb65baa33589401451acc9574
[MovedBlockDetector] Detecting moves for commit 9f86403b
[MovedBlockDetector] Found 0 moved blocks, 0 lineage entries
[CommitIndexer] 🕐 Commit 5/5 9f86403b: 4519ms
[ParserWorker] parser.parse() for app/Providers/DatabaseServiceProvider.php: 7ms (18262 bytes)
[ParserWorker] extractCstFacts for app/Providers/DatabaseServiceProvider.php: 1ms (38 facts)
[ParserWorker] Total parse operation for app/Providers/DatabaseServiceProvider.php: 8ms
[CommitIndexer] 🕐 Structural diff for resources/views/resources/patch-notes/december-2025.blade.php: 3922ms
[ParserWorker] parser.parse() for app/Providers/DatabaseServiceProvider.php: 7ms (18262 bytes)
[ParserWorker] extractCstFacts for app/Providers/DatabaseServiceProvider.php: 1ms (38 facts)
[ParserWorker] Total parse operation for app/Providers/DatabaseServiceProvider.php: 8ms
[ParserWorker] parser.parse() for resources/views/resources/patch-notes/december-2025.blade.php: 1ms (9098 bytes)
[ParserWorker] extractSymbols completed for resources/views/resources/patch-notes/december-2025.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/resources/patch-notes/december-2025.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/resources/patch-notes/december-2025.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/resources/patch-notes/december-2025.blade.php: 1ms
[ParserWorker] parser.parse() for resources/views/resources/patch-notes/december-2025.blade.php: 1ms (9098 bytes)
[ParserWorker] extractSymbols completed for resources/views/resources/patch-notes/december-2025.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/resources/patch-notes/december-2025.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/resources/patch-notes/december-2025.blade.php: 0ms (0 facts)
[ParserWorker] parser.parse() for resources/views/resources/patch-notes/december-2025.blade.php: 1ms (9411 bytes)
[ParserWorker] extractCstFacts for resources/views/resources/patch-notes/december-2025.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/resources/patch-notes/december-2025.blade.php: 1ms
[ParserWorker] Total parse operation for resources/views/resources/patch-notes/december-2025.blade.php: 1ms
[CommitIndexer] 🕐 parser.extractHybridFacts for resources/views/resources/patch-notes/december-2025.blade.php: 2ms (0 facts)
[CommitIndexer] 🕐 cstTimelineManager.saveFacts for resources/views/resources/patch-notes/december-2025.blade.php: 1ms
[CommitIndexer] 🕐 Total processFile for resources/views/resources/patch-notes/december-2025.blade.php: 4070ms
[CommitIndexer] 🕐 File 1/1 resources/views/resources/patch-notes/december-2025.blade.php: 4074ms
[CommitIndexer] 🕐 All files for commit 2d307853: 4543ms (1 files)
[CommitIndexer] Commit 2d307853: 1 files, structural change: 0.0%
[CommitIndexer] Storing 0 symbol changes for 2d307853e1b34b3fc50e25a86d644c974b248c3b
[MovedBlockDetector] Detecting moves for commit 2d307853
[MovedBlockDetector] Found 0 moved blocks, 0 lineage entries
[CommitIndexer] 🕐 Commit 4/5 2d307853: 4553ms
[ParserWorker] parser.parse() for resources/views/resources/patch-notes/december-2025.blade.php: 1ms (9411 bytes)
[ParserWorker] extractCstFacts for resources/views/resources/patch-notes/december-2025.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/resources/patch-notes/december-2025.blade.php: 1ms
[CommitIndexer] 🕐 Structural diff for resources/views/event-logs/create.blade.php: 3977ms
[ParserWorker] parser.parse() for resources/views/event-logs/create.blade.php: 1ms (11153 bytes)
[ParserWorker] extractSymbols completed for resources/views/event-logs/create.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/event-logs/create.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/event-logs/create.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/event-logs/create.blade.php: 1ms
[CommitIndexer] 🕐 parser.extractHybridFacts for resources/views/event-logs/create.blade.php: 2ms (0 facts)
[CommitIndexer] 🕐 cstTimelineManager.saveFacts for resources/views/event-logs/create.blade.php: 1ms
[CommitIndexer] 🕐 Total processFile for resources/views/event-logs/create.blade.php: 4102ms
[CommitIndexer] 🕐 File 1/2 resources/views/event-logs/create.blade.php: 4107ms
[ParserWorker] parser.parse() for resources/views/event-logs/create.blade.php: 1ms (11211 bytes)
[ParserWorker] extractCstFacts for resources/views/event-logs/create.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/event-logs/create.blade.php: 1ms
[ParserWorker] parser.parse() for resources/views/event-logs/create.blade.php: 1ms (11153 bytes)
[ParserWorker] extractSymbols completed for resources/views/event-logs/create.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/event-logs/create.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/event-logs/create.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/event-logs/create.blade.php: 1ms
[ParserWorker] parser.parse() for resources/views/event-logs/create.blade.php: 1ms (11211 bytes)
[ParserWorker] extractCstFacts for resources/views/event-logs/create.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/event-logs/create.blade.php: 1ms
[CommitIndexer] 🕐 Structural diff for resources/views/event-logs/edit.blade.php: 4002ms
[ParserWorker] parser.parse() for resources/views/event-logs/edit.blade.php: 1ms (12464 bytes)
[ParserWorker] extractSymbols completed for resources/views/event-logs/edit.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/event-logs/edit.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/event-logs/edit.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/event-logs/edit.blade.php: 1ms
[ParserWorker] parser.parse() for resources/views/event-logs/edit.blade.php: 1ms (12464 bytes)
[ParserWorker] extractSymbols completed for resources/views/event-logs/edit.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] parser.parse() for resources/views/event-logs/edit.blade.php: 1ms (12460 bytes)
[ParserWorker] extractCstFacts for resources/views/event-logs/edit.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/event-logs/edit.blade.php: 1ms
[ParserWorker] extractSymbols for resources/views/event-logs/edit.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/event-logs/edit.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/event-logs/edit.blade.php: 1ms
[CommitIndexer] 🕐 parser.extractHybridFacts for resources/views/event-logs/edit.blade.php: 2ms (0 facts)
[CommitIndexer] 🕐 cstTimelineManager.saveFacts for resources/views/event-logs/edit.blade.php: 0ms
[CommitIndexer] 🕐 Total processFile for resources/views/event-logs/edit.blade.php: 4138ms
[CommitIndexer] 🕐 File 2/2 resources/views/event-logs/edit.blade.php: 4144ms
[CommitIndexer] 🕐 All files for commit 99fac67f: 4613ms (2 files)
[CommitIndexer] Commit 99fac67f: 2 files, structural change: 0.0%
[CommitIndexer] Storing 0 symbol changes for 99fac67fd0c49fb7ac7f44525a0669802d087e83
[MovedBlockDetector] Detecting moves for commit 99fac67f
[MovedBlockDetector] Found 0 moved blocks, 0 lineage entries
[CommitIndexer] 🕐 Commit 2/5 99fac67f: 4626ms
[ParserWorker] parser.parse() for resources/views/event-logs/edit.blade.php: 1ms (12460 bytes)
[ParserWorker] extractCstFacts for resources/views/event-logs/edit.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/event-logs/edit.blade.php: 1ms
[ParserWorker] parser.parse() for resources/js/app.js: 6ms (34584 bytes)
[ParserWorker] parser.parse() for resources/js/app.js: 6ms (34584 bytes)
[ParserWorker] extractSymbols completed for resources/js/app.js: 8 symbols in 7ms (7755 iterations)
[ParserWorker] extractSymbols for resources/js/app.js: 7ms (8 symbols)
[ParserWorker] extractCstFacts for resources/js/app.js: 1ms (87 facts)
[ParserWorker] Total parse operation for resources/js/app.js: 16ms
[ParserWorker] parser.parse() for resources/js/app.js: 8ms (37979 bytes)
[ParserWorker] extractSymbols completed for resources/js/app.js: 11 symbols in 10ms (8661 iterations)
[ParserWorker] extractSymbols for resources/js/app.js: 10ms (11 symbols)
[ParserWorker] extractCstFacts for resources/js/app.js: 1ms (96 facts)
[ParserWorker] Total parse operation for resources/js/app.js: 19ms
[DatabaseWriteQueue] Flushed 315 operations in single transaction
[ParserWorker] extractSymbols completed for resources/js/app.js: 8 symbols in 7ms (7755 iterations)
[ParserWorker] extractSymbols for resources/js/app.js: 7ms (8 symbols)
[ParserWorker] extractCstFacts for resources/js/app.js: 1ms (87 facts)
[ParserWorker] Total parse operation for resources/js/app.js: 16ms
[ParserWorker] parser.parse() for resources/js/app.js: 8ms (37979 bytes)
[ParserWorker] extractSymbols completed for resources/js/app.js: 11 symbols in 10ms (8661 iterations)
[ParserWorker] extractSymbols for resources/js/app.js: 10ms (11 symbols)
[ParserWorker] extractCstFacts for resources/js/app.js: 1ms (96 facts)
[ParserWorker] Total parse operation for resources/js/app.js: 19ms
[CommitIndexer] 🕐 Structural diff for resources/js/app.js: 442ms
[CommitIndexer] Structural change detected in resources/js/app.js: 100.0%
[ParserWorker] parser.parse() for resources/js/app.js: 7ms (34584 bytes)
[ParserWorker] parser.parse() for resources/js/app.js: 7ms (34584 bytes)
[ParserWorker] extractSymbols completed for resources/js/app.js: 8 symbols in 7ms (7755 iterations)
[ParserWorker] extractSymbols for resources/js/app.js: 7ms (8 symbols)
[ParserWorker] extractCstFacts for resources/js/app.js: 1ms (87 facts)
[ParserWorker] extractSymbols completed for resources/js/app.js: 8 symbols in 7ms (7755 iterations)
[ParserWorker] extractSymbols for resources/js/app.js: 7ms (8 symbols)
[ParserWorker] extractCstFacts for resources/js/app.js: 1ms (87 facts)
[ParserWorker] Total parse operation for resources/js/app.js: 16ms
[CommitIndexer] 🕐 parser.extractHybridFacts for resources/js/app.js: 9ms (107 facts)
[CstTimeline] Queued 107 hybrid facts for resources/js/app.js@b15320dd
[CommitIndexer] 🕐 cstTimelineManager.saveFacts for resources/js/app.js: 18ms
[CommitIndexer] Saved 107 hybrid facts for resources/js/app.js@b15320dd
[CommitIndexer] 🕐 Total processFile for resources/js/app.js: 4470ms
[CommitIndexer] 🕐 File 4/4 resources/js/app.js: 4476ms
[CommitIndexer] 🕐 All files for commit b15320dd: 4945ms (4 files)
[CommitIndexer] File contributed structural change: 0.700
[CommitIndexer] File contributed structural change: 1.000
[CommitIndexer] Commit b15320dd: 4 files, structural change: 100.0%
[CommitIndexer] Storing 3 symbol changes for b15320dd0316390b09a584ca603763a0f8bc8ce6
[MovedBlockDetector] Detecting moves for commit b15320dd
[MovedBlockDetector] Found 0 moved blocks, 0 lineage entries
[HotspotDetector] Batch updated 3 symbols, skipped 0 (dedup/cache)
[ParserWorker] Total parse operation for resources/js/app.js: 16ms
[ParserWorker] parser.parse() for resources/js/app.js: 7ms (37979 bytes)
[ParserWorker] extractCstFacts for resources/js/app.js: 1ms (96 facts)
[ParserWorker] Total parse operation for resources/js/app.js: 8ms
[CommitIndexer] 🕐 Commit 1/5 b15320dd: 4978ms
[DatabaseWriteQueue] Flushed 176 operations in single transaction
[CommitIndexer] Cache performance: 0 hits, 5 misses (0.0% hit rate)
🟧 [IndexCommitsStep] ensureCommitsIndexed returned
[IndexCommits] Completed 5 commits in 4998ms (1000ms/commit avg)
🟧 [IndexCommitsStep] Completed successfully
[Pipeline] Processing level: size, intended, hotspots, moved_blocks
⚖️ [SizeStep] Starting size check
[GitCacheService] Warming sizes for 6 items
Intended map: 3 symbols, 0 renamed
[BaseDetector:HotspotDetectorV2] Initialized with thresholds: {"similarityMin":0.7,"confidenceMin":0.5,"changeThreshold":3,"maxGroupSize":1000,"scoreWeight":1}
[BaseDetector:MovedBlockDetectorV2] Initialized with thresholds: {"similarityMin":0.7,"confidenceMin":0.5,"changeThreshold":3,"maxGroupSize":1000,"scoreWeight":1}
Intended map: 3 total (3 present, 0 absent, 0 renamed)
[HotspotDetector] Queued file hotspot update: resources/js/app.js (score: 48.7)
[HotspotDetector] Batch updated 3 symbols, skipped 0 (dedup/cache)
[ParserWorker] parser.parse() for resources/js/app.js: 7ms (37979 bytes)
[ParserWorker] extractCstFacts for resources/js/app.js: 1ms (96 facts)
[ParserWorker] Total parse operation for resources/js/app.js: 8ms
[MovedBlockStep] Detecting cross-version moves across 8 versions
[GitCacheService] Warmed sizes in 99ms
[SizeStep] No files filtered
⚖️ [SizeStep] Completed in 100ms
[MovedBlockStep] Found 0 cross-version symbol moves
[MovedBlockStep] Querying DB for existing moves involving 6 files
[MovedBlockStep] Final count: 0 moved blocks, 0 lineage entries
[Pipeline] Processing level: working
[WorkingStep] Scope paths: 6
[WorkingSnapshot] gitRoot: /home/ryan/sites/austinselite
[WorkingSnapshot] Processing 6 files with concurrency 8...
[ParserWorker] parser.parse() for resources/css/layout/admin.css: 1ms (9139 bytes)
[ParserWorker] extractCstFacts for resources/css/layout/admin.css: 1ms (12 facts)
[ParserWorker] Total parse operation for resources/css/layout/admin.css: 2ms
[ParserWorker] parser.parse() for resources/css/layout/admin.css: 1ms (9139 bytes)
[ParserWorker] parser.parse() for resources/js/app.js: 8ms (37979 bytes)
[ParserWorker] extractSymbols completed for resources/js/app.js: 11 symbols in 10ms (8661 iterations)
[ParserWorker] extractSymbols for resources/js/app.js: 10ms (11 symbols)
[ParserWorker] extractCstFacts for resources/js/app.js: 1ms (96 facts)
[ParserWorker] Total parse operation for resources/js/app.js: 19ms
[ParserWorker] parser.parse() for resources/views/event-logs/create.blade.php: 1ms (11211 bytes)
[ParserWorker] extractSymbols completed for resources/views/event-logs/create.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/event-logs/create.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/event-logs/create.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/event-logs/create.blade.php: 1ms
[ParserWorker] parser.parse() for resources/views/event-logs/edit.blade.php: 1ms (12460 bytes)
[ParserWorker] extractSymbols completed for resources/views/event-logs/edit.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/event-logs/edit.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/event-logs/edit.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/event-logs/edit.blade.php: 1ms
[ParserWorker] parser.parse() for app/Providers/DatabaseServiceProvider.php: 4ms (20137 bytes)
[ParserWorker] extractSymbols completed for app/Providers/DatabaseServiceProvider.php: 0 symbols in 5ms (5514 iterations)
[ParserWorker] extractSymbols for app/Providers/DatabaseServiceProvider.php: 6ms (0 symbols)
[ParserWorker] extractCstFacts for app/Providers/DatabaseServiceProvider.php: 0ms (38 facts)
[WorkingSnapshot] Progress: 6/6 (100%) - Elapsed: 0s, ETA: 0s
[WorkingSnapshot] Edge normalization: 195 normalized, 0 fuzzy-resolved, 195 unresolved
[WorkingStep] Generated working snapshot with 11 symbols
[Pipeline] Processing level: drift, legacy
[BaseDetector:DriftDetector] Initialized with thresholds: {"similarityMin":0.7,"confidenceMin":0.5,"changeThreshold":3,"maxGroupSize":1000,"scoreWeight":1}
[BaseDetector:LegacyDetector] Initialized with thresholds: {"similarityMin":0.7,"confidenceMin":0.5,"changeThreshold":3,"maxGroupSize":1000,"scoreWeight":1}
[DriftStep] Processing 6 files for hybrid drift (CST: true, Augment: true)
[BaseDetector:LegacyDetector] Cache miss, stored: detector:LegacyDetector:44136fa355b3678a1146ad16f7...
[LegacyStep] Legacy detection complete: 0 dead, 0 legacy used, 0 replaced leftovers
[DriftStep] Retrieved 25 hybrid facts across 3 files
[LegacyStep] 🕐 File 1/6 resources/css/layout/admin.css: 3ms
[DriftStep] 🕐 File 1/6 resources/css/layout/admin.css: 2ms
[LegacyStep] 🕐 File 2/6 resources/js/app.js: 1ms
[LegacyStep] 🕐 File 3/6 resources/views/event-logs/create.blade.php: 1ms
[DriftStep] 🕐 File 2/6 resources/js/app.js: 1ms
[LegacyStep] 🕐 File 4/6 resources/views/event-logs/edit.blade.php: 0ms
[LegacyStep] 🕐 File 5/6 app/Providers/DatabaseServiceProvider.php: 1ms
No prior version for 9f86403b - already at oldest commit. File: app/Providers/DatabaseServiceProvider.php
[LegacyStep] 🕐 File 6/6 resources/views/resources/patch-notes/december-2025.blade.php: 2ms
[DriftStep] 🕐 File 5/6 app/Providers/DatabaseServiceProvider.php: 2ms
[DriftStep] Processed 6 files in 10ms (600.0 files/sec)
[Pipeline] Processing level: bundle_facts
[BundleFacts] Checking prerequisites...
[BundleFacts] - commitFacts: 5 items
[BundleFacts] - scope: present
[BundleFacts] - intended: present
[BundleFacts] - working: present
[ParserWorker] Total parse operation for app/Providers/DatabaseServiceProvider.php: 10ms
[ParserWorker] parser.parse() for resources/views/resources/patch-notes/december-2025.blade.php: 1ms (9411 bytes)
[ParserWorker] extractSymbols completed for resources/views/resources/patch-notes/december-2025.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/resources/patch-notes/december-2025.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/resources/patch-notes/december-2025.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/resources/patch-notes/december-2025.blade.php: 1ms
Inputs: intended=3, hybridFacts=2 files, working.symbols=11
[Pipeline] Processing level: embedding_index
[ParserWorker] extractCstFacts for resources/css/layout/admin.css: 1ms (12 facts)
[ParserWorker] Total parse operation for resources/css/layout/admin.css: 2ms
[ParserWorker] parser.parse() for resources/js/app.js: 8ms (37979 bytes)
[ParserWorker] extractSymbols completed for resources/js/app.js: 11 symbols in 10ms (8661 iterations)
[ParserWorker] extractSymbols for resources/js/app.js: 10ms (11 symbols)
[ParserWorker] extractCstFacts for resources/js/app.js: 1ms (96 facts)
[ParserWorker] Total parse operation for resources/js/app.js: 19ms
[ParserWorker] parser.parse() for resources/views/event-logs/create.blade.php: 1ms (11211 bytes)
[ParserWorker] extractSymbols completed for resources/views/event-logs/create.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/event-logs/create.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/event-logs/create.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/event-logs/create.blade.php: 1ms
[ParserWorker] parser.parse() for resources/views/event-logs/edit.blade.php: 1ms (12460 bytes)
[ParserWorker] extractSymbols completed for resources/views/event-logs/edit.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/event-logs/edit.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/event-logs/edit.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/event-logs/edit.blade.php: 1ms
[ParserWorker] parser.parse() for app/Providers/DatabaseServiceProvider.php: 4ms (20137 bytes)
[ParserWorker] extractSymbols completed for app/Providers/DatabaseServiceProvider.php: 0 symbols in 5ms (5514 iterations)
[ParserWorker] extractSymbols for app/Providers/DatabaseServiceProvider.php: 6ms (0 symbols)
[ParserWorker] extractCstFacts for app/Providers/DatabaseServiceProvider.php: 0ms (38 facts)
[ParserWorker] Total parse operation for app/Providers/DatabaseServiceProvider.php: 10ms
[ParserWorker] parser.parse() for resources/views/resources/patch-notes/december-2025.blade.php: 1ms (9411 bytes)
[ParserWorker] extractSymbols completed for resources/views/resources/patch-notes/december-2025.blade.php: 0 symbols in 0ms (2 iterations)
[ParserWorker] extractSymbols for resources/views/resources/patch-notes/december-2025.blade.php: 0ms (0 symbols)
[ParserWorker] extractCstFacts for resources/views/resources/patch-notes/december-2025.blade.php: 0ms (0 facts)
[ParserWorker] Total parse operation for resources/views/resources/patch-notes/december-2025.blade.php: 1ms
Connected to http://localhost:6333 (embedding dim: 1536, model: openai/text-embedding-3-small)
[withTimeout] Qdrant get collection failed: Not Found
[Qdrant] Created collection: symbols (dim: 1536)
[Qdrant] Indexed fields on symbols
[withTimeout] Qdrant get collection failed: Not Found
[Qdrant] Created collection: commits (dim: 1536)
[Qdrant] Indexed fields on commits
[withTimeout] Qdrant get collection failed: Not Found
[Qdrant] Created collection: patterns (dim: 1536)
[Qdrant] Indexed fields on patterns
[EmbeddingIndexer] Indexing 5 commits...
[DatabaseWriteQueue] Flushed 1 operations in single transaction
[withTimeout] Qdrant get collection failed: Not Found
[Qdrant] Created collection: commits_project_7fffdb27ef0595c1 (dim: 1536)
[Qdrant] Indexed fields on commits_project_7fffdb27ef0595c1
[EmbeddingIndexer] Indexed commit 9f86403b to commits_project_7fffdb27ef0595c1
[EmbeddingIndexer] Indexed commit 2d307853 to commits_project_7fffdb27ef0595c1
[EmbeddingIndexer] Indexed commit b15320dd to commits_project_7fffdb27ef0595c1
[EmbeddingIndexer] Indexed commit 46212076 to commits_project_7fffdb27ef0595c1
[EmbeddingIndexer] Indexed commit 99fac67f to commits_project_7fffdb27ef0595c1
[EmbeddingIndexer] Verified collection commits_project_7fffdb27ef0595c1 has 5 points
[withTimeout] Qdrant get collection failed: Not Found
[Qdrant] Created collection: symbols_project_7fffdb27ef0595c1 (dim: 1536)
[Qdrant] Indexed fields on symbols_project_7fffdb27ef0595c1
[EmbeddingIndexer] Gathering symbol history from 5 commits...
[EmbeddingIndexer] Found 3 symbols for commit b15320dd
[EmbeddingIndexer] Found 0 symbols for commit 99fac67f
[EmbeddingIndexer] Found 0 symbols for commit 46212076
[EmbeddingIndexer] Found 0 symbols for commit 2d307853
[EmbeddingIndexer] Found 0 symbols for commit 9f86403b
[EmbeddingIndexer] Indexing 3 symbol shards to symbols_project_7fffdb27ef0595c1...
[EmbeddingIndexer] Checking for 3 existing embeddings...
[EmbeddingIndexer] Found 0 existing embeddings, will generate 3 new ones
[EmbeddingIndexer] Generating embeddings for 3 symbols (concurrency 30)...
[EmbeddingIndexer] Symbol indexing complete: 3 generated, 0 cached, 0 skipped
[withTimeout] Qdrant get collection failed: Not Found
[Qdrant] Created collection: patterns_project_7fffdb27ef0595c1 (dim: 1536)
[Qdrant] Indexed fields on patterns_project_7fffdb27ef0595c1
[EmbeddingIndexer] Indexing 3 theme shards to patterns_project_7fffdb27ef0595c1
[EmbeddingIndexer] Indexing complete
[Pipeline] Processing level: retrieve_history
[Qdrant] Indexed fields on commits_project_7fffdb27ef0595c1
[Qdrant] Indexed fields on symbols_project_7fffdb27ef0595c1
[Pipeline] Flushed all queued database writes
[Pipeline] Pipeline completed in 11565ms
🎯 [RefactorPipeline] runPipeline returned
🔄 [ANALYSIS_COMPLETED] @ 10:51:22
   Payload: {"facts":{"commits":5,"files":8,"symbols":11}}
   bundleFacts: null → present

[StateLogger] ANALYSIS_COMPLETED
[Store] Action: ANALYSIS_COMPLETED payloadKeys=facts,summary,reportId
[CockpitEffects] onAction received: ANALYSIS_COMPLETED
[CockpitProvider] Payload schema validation passed
[CockpitProvider] Posted message: setData
[CockpitProvider] Built bundle view (6 hotspots)
[AnalysisController] Background analysis complete.
[CockpitProvider] Payload schema validation passed
[CockpitProvider] Posted message: setData
Building tree for 553 files (status=scanning)
[ExplorerService] Hydrating symbols for 1 files
[ExplorerController] Updated explorer tree (2 root nodes)
[CockpitProvider] Payload schema validation passed
[CockpitProvider] Posted message: setData

📊 [AsyncStats] Summary:
Git log recent commits: 2 runs, avg 22ms, 0 err, 0 timeout
Git revparse branch: 3 runs, avg 20ms, 0 err, 0 timeout
Refresh commits: 1 runs, avg 1ms, 0 err, 0 timeout
Get staged files: 1 runs, avg 47ms, 0 err, 0 timeout
Get unstaged files: 1 runs, avg 1169ms, 0 err, 0 timeout
Skeleton resolution: 1 runs, avg 253ms, 0 err, 0 timeout
Git ls-files all: 2 runs, avg 16ms, 0 err, 0 timeout
Git show commit info: 6 runs, avg 25ms, 0 err, 0 timeout
Search commits: 1 runs, avg 2ms, 0 err, 0 timeout
Git diff-tree: 10 runs, avg 44ms, 0 err, 0 timeout
Git raw rev-list: 1 runs, avg 31ms, 0 err, 0 timeout
Pipeline step 'init': 1 runs, avg 505ms, 0 err, 0 timeout
Pipeline step 'workspace_overlay': 1 runs, avg 509ms, 0 err, 0 timeout
Pipeline step 'scope': 1 runs, avg 512ms, 0 err, 0 timeout
Pipeline step 'index_commits': 1 runs, avg 4997ms, 0 err, 0 timeout
Pipeline step 'size': 1 runs, avg 90ms, 0 err, 0 timeout
Pipeline step 'intended': 1 runs, avg 17ms, 0 err, 0 timeout
Pipeline step 'hotspots': 1 runs, avg 645ms, 0 err, 0 timeout
Git ls-tree: 5 runs, avg 26ms, 0 err, 0 timeout
Pipeline step 'moved_blocks': 1 runs, avg 140ms, 0 err, 0 timeout
Git raw log: 2 runs, avg 275ms, 0 err, 0 timeout
Pipeline step 'working': 1 runs, avg 40ms, 0 err, 0 timeout
Pipeline step 'drift': 1 runs, avg 23ms, 0 err, 0 timeout
Pipeline step 'legacy': 1 runs, avg 19ms, 0 err, 0 timeout
Pipeline step 'bundle_facts': 1 runs, avg 5ms, 0 err, 0 timeout
Qdrant connection test: 1 runs, avg 33ms, 0 err, 0 timeout
Pipeline step 'embedding_index': 1 runs, avg 4175ms, 0 err, 0 timeout
Qdrant get collection: 8 runs, avg 15ms, 6 err, 0 timeout
Qdrant create collection: 6 runs, avg 171ms, 0 err, 0 timeout
Qdrant create index project_id: 8 runs, avg 27ms, 0 err, 0 timeout
Worker for item 0: 3 runs, avg 576ms, 0 err, 0 timeout
Worker for item 1: 3 runs, avg 575ms, 0 err, 0 timeout
Worker for item 2: 3 runs, avg 587ms, 0 err, 0 timeout
Worker for item 3: 1 runs, avg 708ms, 0 err, 0 timeout
Worker for item 4: 1 runs, avg 706ms, 0 err, 0 timeout
retrieve_history: 1 runs, avg 1117ms, 0 err, 0 timeout
Pipeline step 'retrieve_history': 1 runs, avg 1117ms, 0 err, 0 timeout
[Reducer] Navigating to app/Helpers/DataCache.php, cache miss
🔄 [NAVIGATE_TO] @ 10:51:43
   Payload: {"frame":{"id":"app/Helpers/DataCache.php","level":"file","status":"scanning","dataKeys":"none"}}
   activeFrame: bundle:root (ready) → file:app/Helpers/DataCache.php (scanning)
      tier: undefined → undefined
   history: 0 entries → 1 entries
      Added: root

[StateLogger] NAVIGATE_TO
[Store] Action: NAVIGATE_TO payloadKeys=frame
[CockpitEffects] onAction received: NAVIGATE_TO
🔄 [ANALYSIS_PROGRESS_UPDATED] @ 10:51:43
   Payload: {"isAnalyzing":true,"step":"Analyzing frame..."}

[StateLogger] ANALYSIS_PROGRESS_UPDATED
[Store] Action: ANALYSIS_PROGRESS_UPDATED payloadKeys=isAnalyzing,step,progress
[CockpitEffects] onAction received: ANALYSIS_PROGRESS_UPDATED
[CockpitProvider] Payload schema validation passed
[CockpitProvider] Posted message: setData
[CockpitProvider] Payload schema validation passed
[CockpitProvider] Posted message: setData
[AnalysisService] Using normalized targetPath: app/Helpers/DataCache.php
🔬 Tier 1 START for app/Helpers/DataCache.php (activeFrame: app/Helpers/DataCache.php)
[FrameAnalyzer] Analyzing Tier 1: frameId=app/Helpers/DataCache.php, targetPath=app/Helpers/DataCache.php, workspaceRoot=/home/ryan/sites/austinselite -> fullPath=/home/ryan/sites/austinselite/app/Helpers/DataCache.php
[WARN] FrameAnalyzer: No symbols matched for "app/Helpers/DataCache.php". Total quickSymbols: 11. Sample paths: ["resources/js/app.js","resources/js/app.js","resources/js/app.js","resources/js/app.js","resources/js/app.js"]
[ParserWorker] parser.parse() for app/Helpers/DataCache.php: 2ms (4508 bytes)
[ParserWorker] parser.parse() for app/Helpers/DataCache.php: 2ms (4508 bytes)
[ParserWorker] extractSymbols completed for app/Helpers/DataCache.php: 17 symbols in 5ms (971 iterations)
[ParserWorker] extractSymbols for app/Helpers/DataCache.php: 6ms (17 symbols)
[ParserWorker] extractCstFacts for app/Helpers/DataCache.php: 1ms (1 facts)
[ParserWorker] Total parse operation for app/Helpers/DataCache.php: 14ms
✅ Tier 1 COMPLETE for app/Helpers/DataCache.php (16ms, 8798 bytes)
[Reducer] Merging tier 1 data for app/Helpers/DataCache.php. lineCommits: 0
🔄 [FRAME_ANALYSIS_TIER_1_COMPLETE] @ 10:51:43
   Payload: {"frameId":"app/Helpers/DataCache.php","data":{"keys":"content, lineCount, language, filePath, fileExists...","size":"large object (truncated)"}}
   activeFrame: status: scanning → ready, tier: undefined → structure
   activeFrame.data: empty → content, lineCount, language, filePath, fileExists, symbols, symbolId

[StateLogger] FRAME_ANALYSIS_TIER_1_COMPLETE
[Store] Action: FRAME_ANALYSIS_TIER_1_COMPLETE payloadKeys=frameId,data
[CockpitEffects] onAction received: FRAME_ANALYSIS_TIER_1_COMPLETE
[MessageController] Updated webview after tier 1 for app/Helpers/DataCache.php
🔄 [ANALYSIS_PROGRESS_UPDATED] @ 10:51:43
   Payload: {"isAnalyzing":true,"step":"Analyzing relationships..."}

[StateLogger] ANALYSIS_PROGRESS_UPDATED
[Store] Action: ANALYSIS_PROGRESS_UPDATED payloadKeys=isAnalyzing,step,progress
[CockpitEffects] onAction received: ANALYSIS_PROGRESS_UPDATED
🔬 Tier 2 START for app/Helpers/DataCache.php (activeFrame: app/Helpers/DataCache.php)
[WARN] [FrameAnalyzer] Tier 2 mismatch (outgoing): resources/js/app.js !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (incoming): idiomorph !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (outgoing): resources/js/app.js !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (incoming): alpinejs !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (outgoing): resources/js/app.js !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (incoming): utils/BulkSelector.js !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (outgoing): resources/js/app.js !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (incoming): utils/FieldFormatter.js !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (outgoing): resources/js/app.js !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (incoming): utils/FormValidator.js !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (outgoing): resources/js/app.js !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (incoming): LiveBind/src/index.ts !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (outgoing): resources/js/app.js !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (incoming): utils/Repeater.js !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (outgoing): resources/js/app.js !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (incoming): utils/SortableList.js !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (outgoing): resources/js/app.js !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (incoming): utils/TimePicker.js !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (outgoing): resources/js/app.js !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (incoming): utils/Toast.js !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (outgoing): resources/js/app.js !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (incoming): filepond !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (outgoing): resources/js/app.js !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (incoming): filepond-plugin-image-preview !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (outgoing): resources/js/app.js !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (incoming): filepond-plugin-image-resize !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (outgoing): resources/js/app.js !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (incoming): filepond-plugin-file-validate-size !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (outgoing): resources/js/app.js !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (incoming): filepond-plugin-file-validate-type !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (outgoing): resources/js/app.js !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (incoming): resources/js/app.js !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (outgoing): resources/js/app.js !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (incoming): unknown !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (outgoing): resources/js/app.js !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (incoming): unknown !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (outgoing): resources/js/app.js !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (incoming): unknown !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (outgoing): resources/js/app.js !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (incoming): unknown !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (outgoing): resources/js/app.js !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (incoming): unknown !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (outgoing): resources/js/app.js !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (incoming): unknown !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (outgoing): resources/js/app.js !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (incoming): unknown !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (outgoing): resources/js/app.js !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (incoming): unknown !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (outgoing): resources/js/app.js !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (incoming): unknown !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (outgoing): resources/js/app.js !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (incoming): unknown !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (outgoing): resources/js/app.js !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (incoming): unknown !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (outgoing): resources/js/app.js !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (incoming): unknown !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (outgoing): resources/js/app.js !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (incoming): unknown !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (outgoing): resources/js/app.js !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (incoming): unknown !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (outgoing): resources/js/app.js !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (incoming): unknown !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (outgoing): resources/js/app.js !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (incoming): unknown !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (outgoing): resources/js/app.js !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (incoming): resources/js/app.js !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (outgoing): resources/js/app.js !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (incoming): unknown !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (outgoing): resources/js/app.js !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (incoming): unknown !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (outgoing): resources/js/app.js !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (incoming): unknown !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (outgoing): resources/js/app.js !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (incoming): unknown !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (outgoing): resources/js/app.js !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (incoming): unknown !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (outgoing): resources/js/app.js !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (incoming): unknown !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (outgoing): resources/js/app.js !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (incoming): unknown !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (outgoing): resources/js/app.js !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (incoming): unknown !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (outgoing): resources/js/app.js !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (incoming): unknown !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (outgoing): resources/js/app.js !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (incoming): unknown !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (outgoing): resources/js/app.js !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (incoming): unknown !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (outgoing): resources/js/app.js !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (incoming): unknown !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (outgoing): resources/js/app.js !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (incoming): unknown !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (outgoing): resources/js/app.js !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (incoming): unknown !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (outgoing): resources/js/app.js !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (incoming): unknown !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (outgoing): resources/js/app.js !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (incoming): unknown !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (outgoing): resources/js/app.js !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (incoming): unknown !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (outgoing): resources/js/app.js !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (incoming): unknown !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (outgoing): resources/js/app.js !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (incoming): unknown !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (outgoing): resources/js/app.js !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (incoming): unknown !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (outgoing): resources/js/app.js !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (incoming): unknown !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (outgoing): resources/js/app.js !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (incoming): unknown !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (outgoing): resources/js/app.js !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (incoming): unknown !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (outgoing): resources/js/app.js !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (incoming): unknown !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (outgoing): resources/js/app.js !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (incoming): unknown !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (outgoing): resources/js/app.js !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (incoming): unknown !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (outgoing): resources/js/app.js !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (incoming): unknown !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (outgoing): resources/js/app.js !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (incoming): unknown !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (outgoing): resources/js/app.js !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (incoming): unknown !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (outgoing): resources/js/app.js !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (incoming): resources/js/app.js !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (outgoing): resources/js/app.js !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (incoming): unknown !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (outgoing): resources/js/app.js !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (incoming): unknown !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (outgoing): resources/js/app.js !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (incoming): unknown !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (outgoing): resources/js/app.js !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (incoming): unknown !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (outgoing): resources/js/app.js !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (incoming): unknown !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (outgoing): resources/js/app.js !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (incoming): unknown !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (outgoing): resources/js/app.js !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (incoming): unknown !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (outgoing): resources/js/app.js !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (incoming): unknown !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (outgoing): resources/js/app.js !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (incoming): unknown !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (outgoing): resources/js/app.js !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (incoming): unknown !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (outgoing): resources/js/app.js !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (incoming): unknown !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (outgoing): resources/js/app.js !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (incoming): resources/js/app.js !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (outgoing): resources/js/app.js !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (incoming): unknown !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (outgoing): resources/js/app.js !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (incoming): unknown !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (outgoing): resources/js/app.js !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (incoming): unknown !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (outgoing): resources/js/app.js !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (incoming): unknown !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (outgoing): resources/js/app.js !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (incoming): unknown !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (outgoing): resources/js/app.js !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (incoming): resources/js/app.js !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (outgoing): resources/js/app.js !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (incoming): unknown !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (outgoing): resources/js/app.js !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (incoming): unknown !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (outgoing): resources/js/app.js !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (incoming): unknown !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (outgoing): resources/js/app.js !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (incoming): unknown !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (outgoing): resources/js/app.js !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (incoming): unknown !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (outgoing): resources/js/app.js !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (incoming): unknown !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (outgoing): resources/js/app.js !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (incoming): unknown !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (outgoing): resources/js/app.js !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (incoming): unknown !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (outgoing): resources/js/app.js !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (incoming): resources/js/app.js !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (outgoing): resources/js/app.js !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (incoming): unknown !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (outgoing): resources/js/app.js !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (incoming): unknown !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (outgoing): resources/js/app.js !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (incoming): unknown !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (outgoing): resources/js/app.js !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (incoming): unknown !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (outgoing): resources/js/app.js !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (incoming): unknown !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (outgoing): resources/js/app.js !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (incoming): unknown !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (outgoing): resources/js/app.js !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (incoming): unknown !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (outgoing): resources/js/app.js !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (incoming): unknown !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (outgoing): resources/js/app.js !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (incoming): unknown !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (outgoing): resources/js/app.js !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (incoming): unknown !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (outgoing): resources/js/app.js !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (incoming): unknown !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (outgoing): resources/js/app.js !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (incoming): unknown !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (outgoing): resources/js/app.js !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (incoming): unknown !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (outgoing): resources/js/app.js !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (incoming): unknown !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (outgoing): resources/js/app.js !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (incoming): unknown !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (outgoing): resources/js/app.js !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (incoming): unknown !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (outgoing): resources/js/app.js !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (incoming): unknown !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (outgoing): resources/js/app.js !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (incoming): unknown !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (outgoing): resources/js/app.js !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (incoming): resources/js/app.js !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (outgoing): resources/js/app.js !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (incoming): unknown !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (outgoing): resources/js/app.js !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (incoming): unknown !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (outgoing): resources/js/app.js !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (incoming): unknown !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (outgoing): resources/js/app.js !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (incoming): unknown !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (outgoing): resources/js/app.js !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (incoming): unknown !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (outgoing): resources/js/app.js !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (incoming): unknown !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (outgoing): resources/js/app.js !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (incoming): unknown !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (outgoing): resources/js/app.js !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (incoming): unknown !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (outgoing): resources/js/app.js !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (incoming): unknown !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (outgoing): resources/js/app.js !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (incoming): unknown !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (outgoing): resources/js/app.js !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (incoming): unknown !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (outgoing): resources/js/app.js !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (incoming): unknown !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (outgoing): resources/js/app.js !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (incoming): unknown !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (outgoing): resources/js/app.js !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (incoming): unknown !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (outgoing): resources/js/app.js !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (incoming): unknown !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (outgoing): resources/js/app.js !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (incoming): unknown !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (outgoing): resources/js/app.js !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (incoming): unknown !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (outgoing): resources/js/app.js !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (incoming): unknown !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (outgoing): resources/js/app.js !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (incoming): unknown !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (outgoing): resources/js/app.js !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (incoming): unknown !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (outgoing): resources/js/app.js !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (incoming): unknown !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (outgoing): resources/js/app.js !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (incoming): unknown !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (outgoing): resources/js/app.js !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (incoming): unknown !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (outgoing): resources/js/app.js !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (incoming): unknown !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (outgoing): resources/js/app.js !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (incoming): resources/js/app.js !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (outgoing): resources/js/app.js !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (incoming): unknown !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (outgoing): resources/js/app.js !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (incoming): unknown !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (outgoing): resources/js/app.js !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (incoming): unknown !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (outgoing): resources/js/app.js !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (incoming): unknown !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (outgoing): resources/js/app.js !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (incoming): unknown !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (outgoing): resources/js/app.js !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (incoming): unknown !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (outgoing): resources/js/app.js !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (incoming): unknown !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (outgoing): resources/js/app.js !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (incoming): unknown !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (outgoing): resources/js/app.js !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (incoming): unknown !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (outgoing): resources/js/app.js !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (incoming): unknown !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (outgoing): resources/js/app.js !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (incoming): unknown !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (outgoing): resources/js/app.js !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (incoming): unknown !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (outgoing): resources/js/app.js !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (incoming): unknown !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (outgoing): resources/js/app.js !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (incoming): unknown !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (outgoing): resources/js/app.js !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (incoming): unknown !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (outgoing): resources/js/app.js !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (incoming): resources/js/app.js !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (outgoing): resources/js/app.js !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (incoming): unknown !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (outgoing): resources/js/app.js !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (incoming): unknown !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (outgoing): resources/js/app.js !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (incoming): unknown !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (outgoing): resources/js/app.js !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (incoming): unknown !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (outgoing): resources/js/app.js !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (incoming): unknown !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (outgoing): resources/js/app.js !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (incoming): unknown !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (outgoing): resources/js/app.js !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (incoming): unknown !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (outgoing): resources/js/app.js !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (incoming): unknown !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (outgoing): resources/js/app.js !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (incoming): unknown !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (outgoing): resources/js/app.js !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (incoming): unknown !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (outgoing): resources/js/app.js !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (incoming): unknown !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (outgoing): resources/js/app.js !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (incoming): unknown !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (outgoing): resources/js/app.js !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (incoming): unknown !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (outgoing): resources/js/app.js !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (incoming): resources/js/app.js !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (outgoing): resources/js/app.js !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (incoming): unknown !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (outgoing): resources/js/app.js !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (incoming): unknown !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (outgoing): resources/js/app.js !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (incoming): unknown !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (outgoing): resources/js/app.js !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (incoming): unknown !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (outgoing): resources/js/app.js !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (incoming): unknown !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (outgoing): resources/js/app.js !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (incoming): unknown !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (outgoing): resources/js/app.js !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (incoming): unknown !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (outgoing): resources/js/app.js !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (incoming): unknown !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (outgoing): resources/js/app.js !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (incoming): unknown !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (outgoing): resources/js/app.js !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (incoming): unknown !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (outgoing): resources/js/app.js !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (incoming): unknown !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (outgoing): resources/js/app.js !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (incoming): unknown !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (outgoing): resources/js/app.js !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (incoming): unknown !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (outgoing): resources/js/app.js !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (incoming): unknown !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (outgoing): resources/js/app.js !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (incoming): unknown !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (outgoing): resources/js/app.js !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (incoming): unknown !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (outgoing): resources/js/app.js !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (incoming): unknown !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (outgoing): resources/js/app.js !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (incoming): unknown !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (outgoing): resources/js/app.js !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (incoming): unknown !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (outgoing): resources/js/app.js !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (incoming): unknown !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (outgoing): resources/js/app.js !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (incoming): unknown !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (outgoing): resources/js/app.js !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (incoming): unknown !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (outgoing): resources/js/app.js !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (incoming): unknown !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (outgoing): resources/js/app.js !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (incoming): unknown !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (outgoing): resources/js/app.js !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (incoming): unknown !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (outgoing): resources/js/app.js !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (incoming): unknown !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (outgoing): resources/js/app.js !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (incoming): unknown !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (outgoing): resources/js/app.js !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (incoming): unknown !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (outgoing): resources/js/app.js !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (incoming): unknown !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (outgoing): resources/js/app.js !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (incoming): unknown !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (outgoing): resources/js/app.js !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (incoming): unknown !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (outgoing): resources/js/app.js !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (incoming): unknown !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (outgoing): resources/js/app.js !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (incoming): unknown !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (outgoing): resources/js/app.js !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (incoming): unknown !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (outgoing): resources/js/app.js !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (incoming): unknown !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (outgoing): resources/js/app.js !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (incoming): resources/js/app.js !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (outgoing): resources/js/app.js !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (incoming): unknown !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (outgoing): resources/js/app.js !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (incoming): unknown !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (outgoing): resources/js/app.js !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (incoming): unknown !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (outgoing): resources/js/app.js !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (incoming): unknown !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (outgoing): resources/js/app.js !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (incoming): unknown !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (outgoing): resources/js/app.js !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (incoming): unknown !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (outgoing): resources/js/app.js !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (incoming): unknown !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (outgoing): resources/js/app.js !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (incoming): unknown !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (outgoing): resources/js/app.js !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (incoming): unknown !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (outgoing): resources/js/app.js !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (incoming): unknown !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (outgoing): resources/js/app.js !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (incoming): unknown !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (outgoing): resources/js/app.js !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (incoming): unknown !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (outgoing): resources/js/app.js !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (incoming): unknown !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (outgoing): resources/js/app.js !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (incoming): unknown !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (outgoing): resources/js/app.js !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (incoming): unknown !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (outgoing): resources/js/app.js !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (incoming): unknown !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (outgoing): resources/js/app.js !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (incoming): unknown !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (outgoing): resources/js/app.js !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (incoming): unknown !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (outgoing): resources/js/app.js !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (incoming): resources/js/app.js !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (outgoing): resources/js/app.js !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (incoming): resources/js/app.js !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (outgoing): resources/js/app.js !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (incoming): unknown !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (outgoing): resources/js/app.js !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (incoming): unknown !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (outgoing): resources/js/app.js !== app/Helpers/DataCache.php
[WARN] [FrameAnalyzer] Tier 2 mismatch (incoming): unknown !== app/Helpers/DataCache.php
[CockpitProvider] Payload schema validation passed
[CockpitProvider] Posted message: setData
[CockpitProvider] Payload schema validation passed
[CockpitProvider] Posted message: setData
[ParserWorker] extractSymbols completed for app/Helpers/DataCache.php: 17 symbols in 5ms (971 iterations)
[ParserWorker] extractSymbols for app/Helpers/DataCache.php: 6ms (17 symbols)
[ParserWorker] extractCstFacts for app/Helpers/DataCache.php: 1ms (1 facts)
[ParserWorker] Total parse operation for app/Helpers/DataCache.php: 14ms
[CockpitProvider] Payload schema validation passed
[CockpitProvider] Posted message: setData
[GitOperations] getFileHistory returned 4 commits for app/Helpers/DataCache.php (requested 20)
[AnalysisService] Tier 2 complete for frameId=app/Helpers/DataCache.php
[AnalysisService] Active frame ID=app/Helpers/DataCache.php
[AnalysisService] Frame IDs match: true
[AnalysisService] lineCommits count: 192
✅ Tier 2 COMPLETE for app/Helpers/DataCache.php (517ms, 23645 bytes)
[Reducer] Merging tier 2 data for app/Helpers/DataCache.php. lineCommits: 192
🔄 [FRAME_ANALYSIS_TIER_2_COMPLETE] @ 10:51:44
   Payload: {"frameId":"app/Helpers/DataCache.php","data":{"keys":"blastRadius, hotspots, drift, history, diff...","size":"large object (truncated)"}}
   activeFrame: status: ready → ready, tier: structure → hybrid
   activeFrame.data: content, lineCount, language, filePath, fileExists, symbols, symbolId → content, lineCount, language, filePath, fileExists, symbols, symbolId, blastRadius, hotspots, drift, history, diff, lineCommits

[StateLogger] FRAME_ANALYSIS_TIER_2_COMPLETE
[Store] Action: FRAME_ANALYSIS_TIER_2_COMPLETE payloadKeys=frameId,data
[CockpitEffects] onAction received: FRAME_ANALYSIS_TIER_2_COMPLETE
[MessageController] Updated webview after tier 2 for app/Helpers/DataCache.php
🔄 [ANALYSIS_PROGRESS_UPDATED] @ 10:51:44
   Payload: {"isAnalyzing":true,"step":"Generating insights..."}

[StateLogger] ANALYSIS_PROGRESS_UPDATED
[Store] Action: ANALYSIS_PROGRESS_UPDATED payloadKeys=isAnalyzing,step,progress
[CockpitEffects] onAction received: ANALYSIS_PROGRESS_UPDATED
🔬 Tier 3 START for app/Helpers/DataCache.php (activeFrame: app/Helpers/DataCache.php)
[CockpitProvider] Payload schema validation passed
[CockpitProvider] Posted message: setData
[CockpitProvider] Payload schema validation passed
[CockpitProvider] Posted message: setData
✅ Tier 3 COMPLETE for app/Helpers/DataCache.php (52ms, 77 bytes)
[Reducer] Merging tier 3 data for app/Helpers/DataCache.php. lineCommits: 0
🔄 [FRAME_ANALYSIS_TIER_3_COMPLETE] @ 10:51:44
   Payload: {"frameId":"app/Helpers/DataCache.php","data":{"keys":"summary, risks","size":"large object (truncated)"}}
   activeFrame: status: ready → ready, tier: hybrid → semantics
   activeFrame.data: content, lineCount, language, filePath, fileExists, symbols, symbolId, blastRadius, hotspots, drift, history, diff, lineCommits → content, lineCount, language, filePath, fileExists, symbols, symbolId, blastRadius, hotspots, drift, history, diff, lineCommits, summary, risks

[StateLogger] FRAME_ANALYSIS_TIER_3_COMPLETE
[Store] Action: FRAME_ANALYSIS_TIER_3_COMPLETE payloadKeys=frameId,data
[CockpitEffects] onAction received: FRAME_ANALYSIS_TIER_3_COMPLETE
[MessageController] Updated webview after tier 3 for app/Helpers/DataCache.php
[AnalysisService] Analyzed frame app/Helpers/DataCache.php (file)
🔄 [ANALYSIS_PROGRESS_UPDATED] @ 10:51:44
   Payload: {"isAnalyzing":false}

[StateLogger] ANALYSIS_PROGRESS_UPDATED
[Store] Action: ANALYSIS_PROGRESS_UPDATED payloadKeys=isAnalyzing,step,progress
[CockpitEffects] onAction received: ANALYSIS_PROGRESS_UPDATED
[CockpitProvider] Payload schema validation passed
[CockpitProvider] Posted message: setData
[CockpitProvider] Payload schema validation passed
[CockpitProvider] Posted message: setData

📊 [AsyncStats] Summary:
Git log recent commits: 2 runs, avg 22ms, 0 err, 0 timeout
Git revparse branch: 3 runs, avg 20ms, 0 err, 0 timeout
Refresh commits: 1 runs, avg 1ms, 0 err, 0 timeout
Get staged files: 1 runs, avg 47ms, 0 err, 0 timeout
Get unstaged files: 1 runs, avg 1169ms, 0 err, 0 timeout
Skeleton resolution: 1 runs, avg 253ms, 0 err, 0 timeout
Git ls-files all: 2 runs, avg 16ms, 0 err, 0 timeout
Git show commit info: 6 runs, avg 25ms, 0 err, 0 timeout
Search commits: 1 runs, avg 2ms, 0 err, 0 timeout
Git diff-tree: 10 runs, avg 44ms, 0 err, 0 timeout
Git raw rev-list: 1 runs, avg 31ms, 0 err, 0 timeout
Pipeline step 'init': 1 runs, avg 505ms, 0 err, 0 timeout
Pipeline step 'workspace_overlay': 1 runs, avg 509ms, 0 err, 0 timeout
Pipeline step 'scope': 1 runs, avg 512ms, 0 err, 0 timeout
Pipeline step 'index_commits': 1 runs, avg 4997ms, 0 err, 0 timeout
Pipeline step 'size': 1 runs, avg 90ms, 0 err, 0 timeout
Pipeline step 'intended': 1 runs, avg 17ms, 0 err, 0 timeout
Pipeline step 'hotspots': 1 runs, avg 645ms, 0 err, 0 timeout
Git ls-tree: 5 runs, avg 26ms, 0 err, 0 timeout
Pipeline step 'moved_blocks': 1 runs, avg 140ms, 0 err, 0 timeout
Git raw log: 2 runs, avg 275ms, 0 err, 0 timeout
Pipeline step 'working': 1 runs, avg 40ms, 0 err, 0 timeout
Pipeline step 'drift': 1 runs, avg 23ms, 0 err, 0 timeout
Pipeline step 'legacy': 1 runs, avg 19ms, 0 err, 0 timeout
Pipeline step 'bundle_facts': 1 runs, avg 5ms, 0 err, 0 timeout
Qdrant connection test: 1 runs, avg 33ms, 0 err, 0 timeout
Pipeline step 'embedding_index': 1 runs, avg 4175ms, 0 err, 0 timeout
Qdrant get collection: 8 runs, avg 15ms, 6 err, 0 timeout
Qdrant create collection: 6 runs, avg 171ms, 0 err, 0 timeout
Qdrant create index project_id: 8 runs, avg 27ms, 0 err, 0 timeout
Worker for item 0: 3 runs, avg 576ms, 0 err, 0 timeout
Worker for item 1: 3 runs, avg 575ms, 0 err, 0 timeout
Worker for item 2: 3 runs, avg 587ms, 0 err, 0 timeout
Worker for item 3: 1 runs, avg 708ms, 0 err, 0 timeout
Worker for item 4: 1 runs, avg 706ms, 0 err, 0 timeout
retrieve_history: 1 runs, avg 1117ms, 0 err, 0 timeout
Pipeline step 'retrieve_history': 1 runs, avg 1117ms, 0 err, 0 timeout
Tier 1 analysis: 1 runs, avg 14ms, 0 err, 0 timeout
Git log file history: 1 runs, avg 95ms, 0 err, 0 timeout
Tier 2 analysis: 1 runs, avg 191ms, 0 err, 0 timeout
Git show file diff: 1 runs, avg 73ms, 0 err, 0 timeout
Git raw blame: 1 runs, avg 22ms, 0 err, 0 timeout
Tier 3 analysis: 1 runs, avg 51ms, 0 err, 0 timeout
