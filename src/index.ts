import noAdjustStateOnPropChange from "./rules/no-adjust-state-on-prop-change.ts";
import noResetAllStateOnPropChange from "./rules/no-reset-all-state-on-prop-change.ts";
import noEventHandler from "./rules/no-event-handler.ts";
import noPassLiveStateToParent from "./rules/no-pass-live-state-to-parent.ts";
import noInitializeState from "./rules/no-initialize-state.ts";
import noChainStateUpdates from "./rules/no-chain-state-updates.ts";
import noDerivedState from "./rules/no-derived-state.ts";
import noPassDataToParent from "./rules/no-pass-data-to-parent.ts";
import globals from "globals";
import type { ESLint, Linter } from "eslint";

const plugin = {
  meta: {
    name: "react-you-might-not-need-an-effect",
  },
  rules: {
    "no-derived-state": noDerivedState,
    "no-chain-state-updates": noChainStateUpdates,
    "no-event-handler": noEventHandler,
    "no-adjust-state-on-prop-change": noAdjustStateOnPropChange,
    "no-reset-all-state-on-prop-change": noResetAllStateOnPropChange,
    "no-pass-live-state-to-parent": noPassLiveStateToParent,
    "no-pass-data-to-parent": noPassDataToParent,
    "no-initialize-state": noInitializeState,
  },
  // Later `Object.assign`ed because it needs to self-reference `plugin`
  configs: {},
};

const rules = (severity: "error" | "warn") =>
  Object.keys(plugin.rules).reduce((acc, ruleName) => {
    acc[plugin.meta.name + "/" + ruleName] = severity;
    return acc;
  }, {} as Record<string, "error" | "warn">);

const languageOptions = {
  globals: {
    // Required to resolve global references to their upstream global variables
    ...globals.browser,
  },
  parserOptions: {
    ecmaFeatures: {
      jsx: true,
    },
  },
};

const flat = (severity: "error" | "warn") => ({
  files: ["**/*.{js,jsx,mjs,cjs,ts,tsx,mts,cts}"],
  plugins: {
    [plugin.meta.name]: plugin,
  },
  languageOptions,
  rules: rules(severity),
});

const legacy = (severity: "error" | "warn") => ({
  plugins: [plugin.meta.name],
  ...languageOptions,
  rules: rules(severity),
});

Object.assign(plugin.configs, {
  recommended: flat("warn"),
  strict: flat("error"),
  "legacy-recommended": legacy("warn"),
  "legacy-strict": legacy("error"),
});

// HACK: Need to cast because of the `Object.assign`. Unsure of workaround - that's the official method...
// TODO: Possible to type this such we can spread it in `oxlint.config.ts`?
export default plugin as unknown as ESLint.Plugin & {
  configs: {
    recommended: Linter.Config;
    strict: Linter.Config;
    "legacy-recommended": Linter.LegacyConfig;
    "legacy-strict": Linter.LegacyConfig;
  };
};
