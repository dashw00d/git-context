// Mock VSCode module for standalone testing
const vscode = {
  commands: {
    registerCommand: () => ({}),
    executeCommand: () => Promise.resolve()
  },
  window: {
    showInformationMessage: () => {},
    showErrorMessage: () => {},
    createOutputChannel: () => ({
      appendLine: () => {},
      show: () => {}
    })
  },
  workspace: {
    onDidChangeConfiguration: () => ({}),
    getConfiguration: () => ({
      get: () => undefined,
      update: () => Promise.resolve()
    }),
    workspaceFolders: []
  },
  ExtensionContext: class {
    constructor() {
      this.subscriptions = [];
      this.extensionPath = '/tmp';
    }
  },
  Uri: {
    file: (path) => ({ fsPath: path, scheme: 'file' })
  }
};

module.exports = vscode;
