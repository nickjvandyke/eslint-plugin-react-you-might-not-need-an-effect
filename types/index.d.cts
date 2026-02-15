import type { ESLint, Linter } from "eslint";

declare const plugin: ESLint.Plugin & {
  configs: {
    recommended: Linter.Config;
    strict: Linter.Config;
    "legacy-recommended": Linter.LegacyConfig;
    "legacy-strict": Linter.LegacyConfig;
  };
};
export = plugin;
