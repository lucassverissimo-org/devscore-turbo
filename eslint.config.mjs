import js from '@eslint/js'
import tseslint from 'typescript-eslint'
export default tseslint.config(
  { ignores: ['dist/**', 'node_modules/**', '.netlify/**', 'supabase/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_' },
      ],
    },
  },
  {
    files: ['scripts/*.mjs'],
    languageOptions: {
      globals: { process: 'readonly', fetch: 'readonly', console: 'readonly' },
    },
  },
  {
    files: ['*.js', '*.cjs'],
    languageOptions: { globals: { module: 'readonly' } },
  }
)
