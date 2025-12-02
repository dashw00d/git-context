# LLM Module (`llm/`)

## Purpose

The `llm/` module manages integration with Large Language Models for intelligent commit analysis, summarization, and explanation generation. It provides a unified interface for different LLM providers while handling token management, prompt engineering, and context formatting.

## Key Components

### OpenRouter Client (`openrouter.ts`)

Primary LLM client supporting multiple providers through OpenRouter.

```typescript
export class OpenRouterClient {
  constructor(
    private apiKey: string,
    private config: LLMConfig
  ) {}

  async complete(prompt: string, options?: CompletionOptions): Promise<LLMResponse> {
    const response = await fetch(`${this.config.endpoint}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: options?.model || this.config.model,
        messages: [{ role: 'user', content: prompt }],
        temperature: options?.temperature || 0.7,
        max_tokens: options?.maxTokens,
      }),
    });

    const data = await response.json();
    return {
      content: data.choices[0].message.content,
      usage: {
        promptTokens: data.usage.prompt_tokens,
        completionTokens: data.usage.completion_tokens,
        totalTokens: data.usage.total_tokens,
      },
    };
  }
}
```

### Prompt Management (`prompts.ts`)

Templates and utilities for crafting effective LLM prompts.

```typescript
export const PROMPTS = {
  commitSummary: (context: CommitContext) => `
Analyze this commit and provide a concise summary:

${formatCommitContext(context)}

Focus on:
- What functionality was changed
- Why the change was made
- Any breaking changes or migrations
- Security or performance implications

Keep the summary under 100 words.
`,

  refactorAnalysis: (facts: RefactorFacts) => `
Analyze this refactoring:

${formatFactsForLLM(facts)}

Provide:
1. Intent assessment
2. Completeness evaluation
3. Risk analysis
4. Next steps recommendations

Structure your response in clear sections.
`,

  symbolExplanation: (symbol: SymbolInfo, history: SymbolChange[]) => `
Explain the evolution of this symbol:

Symbol: ${symbol.name}
Kind: ${symbol.kind}
File: ${symbol.filePath}

Changes:
${history.map(change => `- ${change.type}: ${change.description}`).join('\n')}

Explain what this symbol does and how it has evolved.
`,
};
```

### Summarizer (`summarizer.ts`)

High-level summarization operations combining multiple LLM calls.

```typescript
export class LLMSummarizer {
  constructor(private client: LLMClient) {}

  async summarizeCommit(commit: CommitData): Promise<CommitSummary> {
    const prompt = PROMPTS.commitSummary(commit);
    const response = await this.client.complete(prompt, {
      model: 'anthropic/claude-3-haiku',
      temperature: 0.3,
      maxTokens: 200,
    });

    return {
      summary: response.content,
      tokensUsed: response.usage.totalTokens,
      confidence: calculateConfidence(response.content),
    };
  }

  async analyzeRefactoring(bundleFacts: RefactorBundleFacts): Promise<RefactorAnalysis> {
    const prompt = PROMPTS.refactorAnalysis(bundleFacts);
    const response = await this.client.complete(prompt, {
      model: 'anthropic/claude-3-sonnet',
      temperature: 0.2,
      maxTokens: 1000,
    });

    return parseAnalysisResponse(response.content);
  }
}
```

## Architecture

### Provider Abstraction

Unified interface for different LLM providers:

```typescript
interface LLMClient {
  complete(prompt: string, options?: CompletionOptions): Promise<LLMResponse>;
}

interface CompletionOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  stopSequences?: string[];
}
```

### Token Management

Intelligent token budgeting and truncation:

```typescript
export class TokenManager {
  private readonly limits = {
    'anthropic/claude-3-haiku': 200000,
    'anthropic/claude-3-sonnet': 200000,
    'gpt-4': 128000,
    'gpt-3.5-turbo': 16385,
  };

  budgetTokens(content: string, model: string, reservedTokens = 1000): string {
    const limit = this.limits[model];
    const availableTokens = limit - reservedTokens;

    return truncateToTokenLimit(content, availableTokens);
  }
}
```

## Key Concepts

### Prompt Engineering

Structured prompts with clear instructions and examples:

```typescript
const effectivePrompt = `
You are analyzing a Git commit. Your task is to provide a clear, concise summary.

COMMIT INFO:
- SHA: ${commit.sha}
- Author: ${commit.author}
- Message: ${commit.message}

CHANGES:
${formatChanges(commit.changes)}

OUTPUT FORMAT:
- Summary (2-3 sentences)
- Impact level: LOW/MEDIUM/HIGH
- Breaking changes: YES/NO

Be specific and technical. Focus on what changed and why.
`;
```

### Context Formatting

Convert complex data structures to LLM-readable format:

```typescript
function formatBundleFactsForLLM(facts: RefactorBundleFacts): string {
  return `
REFACTORING ANALYSIS
==================

Time Range: ${facts.commitRange.oldest} to ${facts.commitRange.newest}
Files Changed: ${facts.filesChanged}
Symbols Changed: ${facts.symbolsChanged}

KEY FINDINGS:
${facts.drift ? formatDriftFindings(facts.drift) : 'No drift detected'}
${facts.legacy ? formatLegacyFindings(facts.legacy) : 'No legacy issues'}

INCOMPLETENESS:
${formatIncompleteness(facts.incompleteness)}
`;
}
```

### Multi-Step Analysis

Complex analysis broken into focused LLM calls:

```typescript
async analyzeComplexRefactoring(facts: ComplexFacts): Promise<CompleteAnalysis> {
  // Step 1: Basic intent detection
  const intent = await this.client.complete(PROMPTS.intentAnalysis(facts));

  // Step 2: Risk assessment
  const risks = await this.client.complete(PROMPTS.riskAnalysis(facts, intent));

  // Step 3: Recommendations
  const recommendations = await this.client.complete(PROMPTS.recommendations(facts, intent, risks));

  return combineAnalyses(intent, risks, recommendations);
}
```

## Dependencies

- **analysis/** - Context data for prompts
- **utils/** - Configuration and token management
- **storage/** - Caching of LLM responses

## Usage Examples

### Basic Completion

```typescript
import { OpenRouterClient } from './llm/openrouter';

const client = new OpenRouterClient(apiKey, { model: 'claude-3-haiku' });
const response = await client.complete('Summarize this commit: ...');
console.log(response.content);
```

### Commit Analysis

```typescript
import { LLMSummarizer } from './llm/summarizer';

const summarizer = new LLMSummarizer(client);
const summary = await summarizer.summarizeCommit(commitData);
console.log(`Summary: ${summary.summary}`);
console.log(`Confidence: ${summary.confidence}`);
```

### Token Budgeting

```typescript
import { TokenManager } from './llm/tokenManager';

const manager = new TokenManager();
const budgetedContent = manager.budgetTokens(largeContext, 'claude-3-sonnet');
const response = await client.complete(`Analyze: ${budgetedContent}`);
```
