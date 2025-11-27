# Git Context Configuration

This extension supports multiple ways to configure settings, with the following priority order:

## Configuration Priority

1. **Local Config File** (`.git-context.config.json`) - Highest priority
2. **VS Code Settings** - When running as extension
3. **Environment Variables** - Fallback

## Local Config File

Create a `.git-context.config.json` file in your project root with your settings:

```json
{
  "openRouterApiKey": "your-api-key-here",
  "openRouterModel": "anthropic/claude-3-haiku:beta",
  "apiEndpoint": "https://openrouter.ai/api/v1",
  "difftasticPath": "/home/ryan/bin/difftastic",
  "defaultCommitCount": 5,
  "qdrantUrl": "",
  "qdrantApiKey": "",
  "embeddingProvider": "",
  "embeddingModel": "text-embedding-3-small"
}
```

**Benefits:**
- Works for both extension and test/CLI modes
- Project-specific configuration
- Easy to version control (add to `.gitignore` for secrets)
- No need to set environment variables

## Available Settings

| Setting | Type | Description | Default |
|---------|------|-------------|---------|
| `openRouterApiKey` | string | OpenRouter API key for LLM analysis | - |
| `openRouterModel` | string | OpenRouter model to use | `anthropic/claude-3-haiku:beta` |
| `apiEndpoint` | string | API endpoint for LLM provider | `https://openrouter.ai/api/v1` |
| `difftasticPath` | string | Path to difftastic binary | Auto-detected |
| `defaultCommitCount` | number | Default number of commits to analyze | `5` |
| `qdrantUrl` | string | Qdrant vector database URL | - |
| `qdrantApiKey` | string | Qdrant API key | - |
| `embeddingProvider` | string | Embedding provider endpoint | Uses LLM provider |
| `embeddingModel` | string | Embedding model to use | `text-embedding-3-small` |
| `tokensPerStep` | object | Token limits per analysis step | - |
| `customPrompts` | object | Custom prompts for LLM analysis | - |
| `customIgnorePaths` | array | Custom paths to ignore during analysis | - |

## For Testing

When running tests, create `.git-context.config.json` in the project root:

```bash
cp .git-context.config.example.json .git-context.config.json
# Edit .git-context.config.json with your settings
```

The test scripts will automatically use this config.

## VS Code Settings

When running as an extension, you can also configure via VS Code settings:

```json
{
  "git-context.openRouterApiKey": "your-key",
  "git-context.difftasticPath": "/path/to/difftastic"
}
```

## Environment Variables

Fallback for CLI/test mode (lowest priority):

```bash
export OPENROUTER_API_KEY=your-key
export DIFFTASTIC_PATH=/path/to/difftastic
export QDRANT_URL=http://localhost:6333
```
