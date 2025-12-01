module.exports = {
  root: true,
  env: {
    es2021: true,
    node: true
  },
  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: './tsconfig.json'
  },
  plugins: ['@typescript-eslint'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended'
  ],
  ignorePatterns: ['out/**', 'media/**', 'node_modules/**'],
  rules: {
    '@typescript-eslint/no-unsafe-assignment': 'off',
    "no-unused-vars": "off",
    "@typescript-eslint/no-unused-vars": "warn",
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
    
    // Architecture Pattern Enforcement
    'no-restricted-syntax': [
      'error',
      {
        selector: "MemberExpression[object.name='db'][property.name='prepare']",
        message: "Use 'prepare' from '../storage/statement-wrapper' instead of db.prepare(). This prevents memory leaks from unfinialized statements."
      },
      {
        selector: "CallExpression[callee.object.property.name='webview'][callee.property.name='postMessage']",
        message: "Dispatch actions via store.dispatch() instead of direct postMessage. Direct postMessage bypasses centralized state management."
      },
      {
        selector: "CallExpression[callee.property.name=/^updateState|updatePartial|updateLiveState$/][callee.object.name='orchestrator']",
        message: "Use store.dispatch() instead of orchestrator.updateState/updatePartial/updateLiveState(). The orchestrator is being phased out in favor of Redux patterns."
      },
      {
        selector: "ThrowStatement:not(:has(ArrowFunctionExpression, FunctionExpression, FunctionDeclaration[id.name=/.*Effect|.*Handler|.*Reducer/]))",
        message: "Avoid throwing errors in pipeline/service code. Use best-effort mode: log the error and return partial data instead."
      },
      {
        selector: "AssignmentExpression[left.type='Identifier'][left.name=/^state$/]",
        message: "Don't overwrite state directly. Use store.dispatch() with actions to modify state."
      },
      {
        selector: "AssignmentExpression[left.type='MemberExpression'][left.object.type='Identifier'][left.object.name=/^state$/]",
        message: "Don't mutate state directly. Use store.dispatch() with actions to modify state."
      }
    ],
    
    // Enforce contextual logging (use logInfo/logError/logDebug instead of console.*)
    'no-console': 'error',
    
    // Security: Prevent SQL injection
    'no-restricted-properties': [
      'error',
      {
        object: 'db',
        property: 'exec',
        message: "Avoid db.exec() with dynamic SQL. Use prepared statements via the statement wrapper instead."
      }
    ]
  }
};
