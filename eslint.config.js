import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import stylistic from '@stylistic/eslint-plugin';
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';
import { defineConfig, globalIgnores } from 'eslint/config';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig([
    globalIgnores(['**/dist/**', '**/node_modules/**', '**/coverage/**']),

    // ── Shared: TypeScript base for all packages ──────────────────────────────
    {
        files: ['**/*.{ts,tsx}'],
        extends: [js.configs.recommended, tseslint.configs.recommended],
    },

    // ── Infra ─────────────────────────────────────────────────────────────────
    {
        files: ['infra/**/*.ts'],
        plugins: { '@stylistic': stylistic },
        rules: {
            'object-curly-spacing': 'off',
            '@stylistic/object-curly-spacing': ['error', 'always'],
            '@stylistic/template-curly-spacing': ['error', 'always'],
            '@stylistic/jsx-curly-spacing': ['error', 'always'],
        },
    },

    // ── Frontend ──────────────────────────────────────────────────────────────
    {
        files: ['frontend/**/*.{ts,tsx}'],
        extends: [
            reactHooks.configs.flat.recommended,
            reactRefresh.configs.vite,
        ],
        languageOptions: {
            ecmaVersion: 2020,
            globals: globals.browser,
        },
    },

    // ── Backend ───────────────────────────────────────────────────────────────
    {
        files: ['backend/**/*.ts'],
        extends: [
            tseslint.configs.recommendedTypeChecked,
            eslintPluginPrettierRecommended,
        ],
        languageOptions: {
            globals: {
                ...globals.node,
                ...globals.jest,
            },
            sourceType: 'commonjs',
            parserOptions: {
                projectService: true,
                tsconfigRootDir: resolve(__dirname, 'backend'),
            },
        },
        rules: {
            '@typescript-eslint/no-explicit-any': 'off',
            '@typescript-eslint/no-floating-promises': 'warn',
            '@typescript-eslint/no-unsafe-argument': 'warn',
            'prettier/prettier': ['error', { endOfLine: 'auto' }],
        },
    },
]);
