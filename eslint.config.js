const tseslint = require("@typescript-eslint/eslint-plugin");
const tsparser = require("@typescript-eslint/parser");
const stylistic = require("@stylistic/eslint-plugin");

module.exports = [
  {
    files: ["**/*.ts"],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        project: "./tsconfig.json",
      },
    },
    plugins: {
      "@typescript-eslint": tseslint,
      "@stylistic": stylistic,
    },
    rules: {
      // TypeScript rules
      ...tseslint.configs.recommended.rules,
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
      "@typescript-eslint/no-explicit-any": "warn",
      "no-console": "off",
      "prefer-const": "error",
      "no-var": "error",

      // Formatting rules (warn = auto-fixed, but won't block build)
      "@stylistic/indent": ["warn", 4],
      "@stylistic/quotes": ["warn", "double", { avoidEscape: true }],
      "@stylistic/semi": ["warn", "always"],
      "@stylistic/comma-dangle": ["warn", "always-multiline"],
      "@stylistic/eol-last": ["warn", "always"],
      "@stylistic/no-trailing-spaces": "warn",
      "@stylistic/no-multiple-empty-lines": ["warn", { max: 1, maxEOF: 0 }],
      "@stylistic/object-curly-spacing": ["warn", "always"],
      "@stylistic/array-bracket-spacing": ["warn", "never"],
      "@stylistic/comma-spacing": ["warn", { before: false, after: true }],
      "@stylistic/key-spacing": ["warn", { beforeColon: false, afterColon: true }],
      "@stylistic/keyword-spacing": ["warn", { before: true, after: true }],
      "@stylistic/space-before-blocks": ["warn", "always"],
      "@stylistic/space-infix-ops": "warn",
      "@stylistic/arrow-spacing": ["warn", { before: true, after: true }],
      "@stylistic/brace-style": ["warn", "1tbs", { allowSingleLine: true }],
      "@stylistic/block-spacing": ["warn", "always"],
    },
  },
  {
    ignores: ["node_modules/**", "dist/**", "**/*.lua", "**/*.js"],
  },
];
