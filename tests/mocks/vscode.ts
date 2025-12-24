import { vi } from 'vitest';

export const workspace = {
  getConfiguration: vi.fn().mockReturnValue({
    get: vi.fn((key, defaultValue) => defaultValue),
    update: vi.fn(),
  }),
  workspaceFolders: [],
  onDidChangeConfiguration: vi.fn(),
  onDidChangeTextDocument: vi.fn(),
  onDidSaveTextDocument: vi.fn(),
  createFileSystemWatcher: vi.fn().mockReturnValue({
    dispose: vi.fn(),
    onDidCreate: vi.fn(),
    onDidChange: vi.fn(),
    onDidDelete: vi.fn(),
  }),
  asRelativePath: vi.fn((path) => path),
  textDocuments: [],
};

export const window = {
  showInformationMessage: vi.fn(),
  showErrorMessage: vi.fn(),
  createOutputChannel: vi.fn().mockReturnValue({
    appendLine: vi.fn(),
    dispose: vi.fn(),
  }),
  activeTextEditor: undefined,
};

export const Uri = {
  file: vi.fn((path) => ({ fsPath: path, toString: () => `file://${path}` })),
  parse: vi.fn((path) => ({ fsPath: path, toString: () => path })),
};

export const Range = vi.fn();
export const Position = vi.fn();
export class CancellationError extends Error {
  constructor() {
    super('Cancellation requested');
    this.name = 'CancellationError';
  }
}
export const EventEmitter = vi.fn().mockImplementation(() => ({
  event: vi.fn(),
  fire: vi.fn(),
  dispose: vi.fn(),
}));

export const Disposable = {
  from: vi.fn(),
};

export default {
  workspace,
  window,
  Uri,
  Range,
  Position,
  EventEmitter,
  Disposable,
};
