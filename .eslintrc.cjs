module.exports = {
  root: true,
  env: {
    es2021: true,
    node: true,
  },
  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: './tsconfig.json',
  },
  plugins: ['@typescript-eslint', 'import'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:prettier/recommended',
  ],
  ignorePatterns: ['out/**', 'media/**', 'node_modules/**', '*.js', '*.js.map'],
  settings: {
    react: {
      version: 'detect',
    },
  },
  rules: {
    // Relaxed TS rules (existing)
    '@typescript-eslint/no-unsafe-assignment': 'off',
    'no-unused-vars': 'off',
    '@typescript-eslint/no-unused-vars': 'warn',
    '@typescript-eslint/no-unsafe-member-access': 'off',
    '@typescript-eslint/no-unsafe-call': 'off',
    '@typescript-eslint/no-unsafe-argument': 'off',
    '@typescript-eslint/restrict-template-expressions': 'off',
    '@typescript-eslint/no-floating-promises': 'off',
    '@typescript-eslint/no-explicit-any': 'off',
    '@typescript-eslint/no-inferrable-types': 'off',
    '@typescript-eslint/no-non-null-assertion': 'off',
    '@typescript-eslint/require-await': 'off',
    '@typescript-eslint/no-unnecessary-type-assertion': 'off',
    'no-case-declarations': 'off',
    'no-duplicate-case': 'off',
    'no-var-requires': 'off',
    '@typescript-eslint/no-var-requires': 'off',
    'no-constant-condition': 'off',

    // AGENTS.md: Enforce import order (Node → pkgs → local)
    'import/order': [
      'error',
      {
        groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index', 'object', 'type'],
        'newlines-between': 'never',
        alphabetize: {
          order: 'asc',
          caseInsensitive: true,
        },
      },
    ],
    'import/no-duplicates': 'error',

    // Architecture Anti-Patterns (block drift)
    'no-restricted-syntax': [
      'error',
      {
        selector: "MemberExpression[object.name='db'][property.name='prepare']",
        message:
          "Use 'prepare' from '../storage/statement-wrapper' instead of db.prepare(). Prevents memory leaks.",
      },
      {
        selector:
          "CallExpression[callee.property.name='postMessage'][callee.object.property.name='webview']",
        message:
          'Dispatch via store.dispatch() instead of direct postMessage. Enables Redux selectors.',
      },
      {
        selector:
          "CallExpression[callee.property.name=/^updateState|updatePartial|updateLiveState$/][callee.object.name='orchestrator']",
        message: 'Use store.dispatch() instead of orchestrator.*. Phasing out orchestrator.',
      },
      {
        selector:
          'ThrowStatement:not(:has(ArrowFunctionExpression, FunctionExpression, FunctionDeclaration[id.name=/.*Effect|.*Handler|.*Reducer/]))',
        message: 'No throws in services/pipelines. Log + return partial data (best-effort).',
      },
      {
        selector: "AssignmentExpression[left.type='Identifier'][left.name=/^state$/]",
        message: 'No direct state=. Use store.dispatch() + actions.',
      },
      {
        selector:
          "AssignmentExpression[left.type='MemberExpression'][left.object.type='Identifier'][left.object.name=/^state$/]",
        message: 'No state mutations. Use store.dispatch() + actions.',
      },
    ],

    // Logging: Use logInfo/logError/logDebug
    'no-console': 'error',

    // Security: No raw SQL
    'no-restricted-properties': [
      'error',
      {
        object: 'db',
        property: 'exec',
        message: 'No db.exec() (SQL injection). Use prepared statements.',
      },
    ],
  },
};
