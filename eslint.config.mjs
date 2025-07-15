import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';
import eslintPluginSimpleImportSort from 'eslint-plugin-simple-import-sort';
import stylisticJs from '@stylistic/eslint-plugin';
import parser from '@typescript-eslint/parser';

const eslintConfig = [
  {
    plugins: {
      'simple-import-sort': eslintPluginSimpleImportSort,
      '@stylistic/js': stylisticJs,
    },
  },
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
    languageOptions: {
      parser,
    },
    rules: {
      // typescript-eslint
      // '@typescript-eslint/no-explicit-any': 'error',
      // '@typescript-eslint/no-unused-vars': 'error',

      // stylistic
      'spaced-comment': ['error', 'always'],

      // simple-import-sort
      'simple-import-sort/imports': [
        'warn',
        {
          groups: [
            // `react` first, `next` second, then packages starting with a character
            ['^react$', '^next', '^[a-z]'],
            // Packages starting with `@`
            ['^@'],
            // Packages starting with `~`
            ['^~'],
            // Imports starting with `../`
            ['^\\.\\.(?!/?$)', '^\\.\\./?$'],
            // Imports starting with `./`
            ['^\\./(?=.*/)(?!/?$)', '^\\.(?!/?$)', '^\\./?$'],
            // Style imports
            ['^.+\\.s?css$'],
            // Side effect imports
            ['^\\u0000'],
          ],
        },
      ],
    },
  },

  // prettier: this has to come last
  eslintPluginPrettierRecommended,
];

export default eslintConfig;
