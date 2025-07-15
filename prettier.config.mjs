const routesNoPrintWidth = [];

const config = {
  trailingComma: 'es5',
  bracketSpacing: true,
  printWidth: 80,
  semi: true,
  singleQuote: true,
  tabWidth: 2,
  useTabs: false,
  bracketSameLine: false,
  endOfLine: 'lf',
  overrides: [
    {
      files: ['*.html'],
      options: {
        parser: 'html',
      },
    },
    {
      files: ['*.json'],
      options: {
        singleQuote: false,
      },
    },
    {
      files: ['*.{css,scss}'],
      options: {
        singleQuote: true,
      },
    },
    {
      files: routesNoPrintWidth,
      options: {
        printWidth: 1000,
      },
    },
  ],
  plugins: ['prettier-plugin-tailwindcss'],
  tailwindStylesheet: './entrypoints/popup/style.css',
};

export default config;
