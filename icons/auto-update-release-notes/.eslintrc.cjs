module.exports = {
  root: false,
  parserOptions: {
    project: './tsconfig.json',
    tsconfigRootDir: __dirname,
  },
  rules: {
    '@typescript-eslint/no-magic-numbers': 'off',
  },
};
