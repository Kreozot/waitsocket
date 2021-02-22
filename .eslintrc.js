module.exports = {
  extends: 'eslint-config-airbnb-typescript',
  parserOptions: {
    project: './tsconfig.eslint.json',
    tsconfigRootDir: __dirname,
  },
  env: {
    browser: true,
  },
  ignorePatterns: ['node_modules/**/*', '/*.js'],
  rules: {
    'class-methods-use-this': 'off',
  },
};
