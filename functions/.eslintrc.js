module.exports = {
  env: {
    es6: true,
    node: true
  },
  parserOptions: {
    ecmaVersion: 2018
  },
  extends: ['eslint:recommended', 'google', 'plugin:import/recommended', 'eslint-config-prettier', 'prettier'],
  plugins: ['prettier'],
  rules: {
    'no-restricted-globals': ['error', 'name', 'length'],
    'prefer-arrow-callback': 'error',
    'prettier/prettier': [
      'warn',
      {
        arrowParens: 'always',
        semi: false,
        trailingComma: 'none',
        tabWidth: 2,
        endOfLine: 'auto',
        useTabs: false,
        singleQuote: true,
        printWidth: 120
      }
    ]
  },
  overrides: [
    {
      files: ['**/*.spec.*'],
      env: {
        mocha: true
      },
      rules: {}
    }
  ],
  globals: {}
}
