import { getGitRoot } from '../utils/config';
import { GitOperations } from '../analysis/git';
import { SymbolExtractor } from '../analysis/symbols';
import { DependencyExtractor } from '../analysis/dependencies';
import { RiskDetector } from '../analysis/heuristics';
import { LLMSummarizer } from '../llm/summarizer';
import { getDifftasticIntegration } from '../analysis/difftastic';
import { getDatabaseManager, ensureDatabaseInitialized } from '../storage/database';
import { AnalysisResult, SymbolInfo, SymbolDelta } from '../types';
import { detectNamingConvention, analyzeConventionDrift } from '../analysis/namingConventions';
import { extractImportPaths, analyzeImportPathDrift, detectFileNamingConvention } from '../analysis/conventionEnhancements';
import { detectLanguage } from '../utils/config';

// Analysis functions have been moved to RefactorPipeline service
// Use getRefactorPipeline() to access analysis functionality
