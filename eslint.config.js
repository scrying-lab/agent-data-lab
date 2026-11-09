import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import jsxA11y from 'eslint-plugin-jsx-a11y'
import globals from 'globals'

export default tseslint.config(
  { ignores: ['.claude/**', 'dist/**', 'node_modules/**', 'test-results/**', 'playwright-report/**', 'infra/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx,js,mjs}'],
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
  { files: ['src/**/*.tsx'], ...jsxA11y.flatConfigs.recommended },
  {
    // One persistent announcer (src/announce.tsx) owns live regions. Components must not add their own.
    files: ['src/**/*.tsx'],
    ignores: ['src/announce.tsx'],
    rules: {
      'no-restricted-syntax': ['error',
        { selector: "JSXAttribute[name.name='aria-live']", message: 'Use announce() from src/announce.tsx instead of a new live region.' },
        { selector: "JSXAttribute[name.name='role'][value.value=/^(status|alert|log)$/]", message: 'Use announce() from src/announce.tsx instead of a new live region.' },
      ],
    },
  },
)
