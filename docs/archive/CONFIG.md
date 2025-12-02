# Git Context Configuration

This extension supports multiple ways to configure settings, with the following priority order:

## Configuration Priority

1. **Local Config File** (`.git-context.config.json`) - Highest priority
2. **VS Code Settings** - When running as extension (with package.json defaults)
3. **Environment Variables** - Fallback for CLI/test mode
4. **Package.json Defaults** - Final fallback (defined in `package.json`)

## Local Config File

Create a `.git-context.config.json` file in your project root with your settings:

```json
{
  "openRouterApiKey": "your-api-key-here",
  "openRouterModel": "x-ai/grok-4.1-fast:free",
  "apiEndpoint": "https://openrouter.ai/api/v1",
  "difftasticPath": "/path/to/difftastic",
  "defaultCommitCount": 5,
  "qdrantUrl": "",
  "qdrantApiKey": "",
  "embeddingProvider": "https://openrouter.ai/api/v1",
  "embeddingModel": "openai/text-embedding-3-small",
  "allowedExtensions": ["php", "js", "ts", "tsx", "jsx"],
  "maxFileSize": 102400,
  "perProjectQdrantCollections": false
}
```

**Benefits:**
- Works for both extension and test/CLI modes
- Project-specific configuration
- Easy to version control (add to `.gitignore` for secrets)
- No need to set environment variables

## Available Settings

All settings and their defaults are defined in `package.json`. See VS Code Settings UI or check `package.json` for the complete list with defaults.

Key settings:
- `openRouterApiKey` - OpenRouter API key (required)
- `openRouterModel` - Model to use (default: `x-ai/grok-4.1-fast:free`)
- `apiEndpoint` - API endpoint (default: `https://openrouter.ai/api/v1`)
- `defaultCommitCount` - Default commits to analyze (default: `5`)
- `allowedExtensions` - File extensions to analyze (default: `["php", "js", "ts", "tsx", "jsx"]`)
- `maxFileSize` - Max file size in bytes (default: `102400` = 100KB)
- `live.*` - Live tracking configuration (see package.json for defaults)

## For Testing

When running tests, create `.git-context.config.json` in the project root:

```bash
# Create .git-context.config.json with your settings
{
  "openRouterApiKey": "your-key",
  "openRouterModel": "x-ai/grok-4.1-fast:free"
}
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
