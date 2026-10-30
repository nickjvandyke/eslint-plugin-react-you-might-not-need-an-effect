import eslint from "@eslint/js";
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
