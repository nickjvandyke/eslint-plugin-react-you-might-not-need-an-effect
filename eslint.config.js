import eslint from "@eslint/js";
import tsParser from "@typescript-eslint/parser";
import eslintPlugin from "eslint-plugin-eslint-plugin";
import nodePlugin from "eslint-plugin-n";
import globals from "globals";

export default [
  eslint.configs.recommended,
  eslintPlugin.configs["flat/recommended"],
  nodePlugin.configs["flat/recommended"],
  {
    ignores: ["dist/**", "node_modules/**", ".yarn/**"],
  },
  {
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  },
  {
    files: ["**/*.ts"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
      },
    },
    rules: {
      // The core rule does not understand TypeScript type positions and reports
      // their parameters as unused. `tsgo` checks unused values instead.
      "no-unused-vars": "off",
    },
  },
  {
    // Tests use `node:test` and native TypeScript type stripping,
    // which need Node >= 22.18. The published package still supports older Node.
    files: ["test/**"],
    rules: {
      "n/no-unsupported-features/node-builtins": [
        "error",
        { version: ">=22.18.0" },
      ],
    },
  },
];
