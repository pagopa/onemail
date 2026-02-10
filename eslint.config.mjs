import pagopa from '@pagopa/eslint-config';

export default [
  ...pagopa,
  // extends
  // { ignores: [] },
  {
    files: ['**/*.ts', '**/*.tsx'],
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
];
