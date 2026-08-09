import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import jsxA11y from 'eslint-plugin-jsx-a11y'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
      jsxA11y.flatConfigs.recommended,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    rules: {
      // These inputs mount only after a user opens a dialog or inline editor;
      // moving focus into the requested surface is the accessible behavior.
      'jsx-a11y/no-autofocus': 'off',
    },
  },
  {
    files: ['e2e/**/*.ts', 'playwright.*.config.ts'],
    languageOptions: {
      globals: globals.node,
    },
  },
  {
    files: ['src/components/ui/**/*.{ts,tsx}', 'src/store/workspace.tsx'],
    rules: {
      'react-refresh/only-export-components': 'off',
    },
  },
])
