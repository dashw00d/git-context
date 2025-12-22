// Mock vscode module for CLI usage
export const workspace = {
  workspaceFolders: [] as any[],
  getConfiguration: () => ({
    get: (key: string, defaultValue: any) => {
      if (defaultValue !== undefined) return defaultValue;
      const defaults: Record<string, any> = {
        apiEndpoint: 'https://openrouter.ai/api/v1',
        openRouterApiKey:
          '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',
        openRouterModel: 'x-ai/grok-4.1-fast:free',
        difftasticPath: '/home/ryan/plugins/git-context/binaries/difftastic',
        defaultCommitCount: 5,
        embeddingProvider: 'https://openrouter.ai/api/v1',
        embeddingModel: 'openai/text-embedding-3-small',
        tokensPerStep: {
          default: 4000,
          intent: 4000,
          drift: 4000,
          cleanup: 4000,
          discover: 8000,
          quantify: 8000,
          plan: 8000,
          summary: 4000,
        },
      };
      return defaults[key];
    },
  }),
  onDidChangeConfiguration: () => ({
    dispose: () => {
      /* empty */
    },
  }),
};

export const window = {
  createOutputChannel: () => ({
    // eslint-disable-next-line no-console
    appendLine: (msg: string) => console.log(msg),
    show: () => {
      // empty
    },
  }),
};

export const Uri = {
  file: (path: string) => ({ fsPath: path }),
  parse: (uri: string) => ({ fsPath: uri }),
};

export class Range {
  start: { line: number; character: number };
  end: { line: number; character: number };

  constructor(startLine: number, startChar: number, endLine: number, endChar: number) {
    this.start = { line: startLine, character: startChar };
    this.end = { line: endLine, character: endChar };
  }
}

export class Position {
  line: number;
  character: number;

  constructor(line: number, char: number) {
    this.line = line;
    this.character = char;
  }
}

export class CancellationError extends Error {}

export class CancellationTokenSource {
  token: {
    isCancellationRequested: boolean;
    onCancellationRequested: (callback: () => void) => { dispose: () => void };
  };

  constructor() {
    this.token = {
      isCancellationRequested: false,
      onCancellationRequested: () => ({
        dispose: () => {
          /* mock */
        },
      }),
    };
  }

  cancel() {
    this.token.isCancellationRequested = true;
  }

  dispose() {
    /* mock */
  }
}
