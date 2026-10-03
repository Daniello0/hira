import tseslint from 'typescript-eslint';

const sourceFiles = ['packages/**/*.ts', 'apps/**/*.ts', 'apps/**/*.tsx', 'vitest.config.ts'];

export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/.next/**',
      '**/node_modules/**',
      '**/coverage/**',
      '**/.venv/**',
      '**/.venv*/**',
      '**/*Курсач*/**',
      'Wiki/**',
      'cpu-tei-benchmark/**',
      'apps/web/next-env.d.ts',
    ],
  },
  ...tseslint.configs.recommended.map((config) => ({
    ...config,
    files: sourceFiles,
  })),
  {
    files: sourceFiles,
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
);
