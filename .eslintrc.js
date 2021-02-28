module.exports = {
  extends: ['eslint-config-airbnb-typescript', 'plugin:jsdoc/recommended'],
  parserOptions: {
    project: './tsconfig.eslint.json',
    tsconfigRootDir: __dirname,
  },
  env: {
    browser: true,
  },
  ignorePatterns: ['node_modules/**/*', '/*.js'],
  plugins: [
    'jsdoc',
  ],
  rules: {
    'class-methods-use-this': 'off',
    'jsdoc/require-throws': 'error',
  },
};
