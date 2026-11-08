import noAdjustStateOnPropChange from "./rules/no-adjust-state-on-prop-change.ts";
import noResetAllStateOnPropChange from "./rules/no-reset-all-state-on-prop-change.ts";
import noEventHandler from "./rules/no-event-handler.ts";
import noPassLiveStateToParent from "./rules/no-pass-live-state-to-parent.ts";
import noInitializeState from "./rules/no-initialize-state.ts";
import noChainStateUpdates from "./rules/no-chain-state-updates.ts";
import noDerivedState from "./rules/no-derived-state.ts";
import noPassDataToParent from "./rules/no-pass-data-to-parent.ts";
import noExternalStoreSubscription from "./rules/no-external-store-subscription.ts";
import pkg from "../package.json" with { type: "json" };
import type { ESLint, Linter } from "eslint";

const plugin = {
  meta: {
    name: "react-you-might-not-need-an-effect",
    version: pkg.version,
  },
  rules: {
    "no-derived-state": noDerivedState,
    "no-chain-state-updates": noChainStateUpdates,
    "no-event-handler": noEventHandler,
    "no-adjust-state-on-prop-change": noAdjustStateOnPropChange,
    "no-reset-all-state-on-prop-change": noResetAllStateOnPropChange,
    "no-pass-live-state-to-parent": noPassLiveStateToParent,
    "no-pass-data-to-parent": noPassDataToParent,
    "no-external-store-subscription": noExternalStoreSubscription,
    "no-initialize-state": noInitializeState,
  },
} satisfies ESLint.Plugin;

type Severity = "error" | "warn";

const rules = (severity: Severity): Record<string, Severity> =>
  Object.fromEntries(
    Object.keys(plugin.rules).map((ruleName): [string, Severity] => [
      `${plugin.meta.name}/${ruleName}`,
      severity,
    ]),
  );

const languageOptions = {
  parserOptions: {
    ecmaFeatures: {
      jsx: true,
    },
  },
};

const flat = (severity: Severity, name: string): Linter.Config => ({
  name: `${plugin.meta.name}/${name}`,
  plugins: {
    [plugin.meta.name]: plugin,
  },
  languageOptions,
  rules: rules(severity),
});

const legacy = (severity: Severity): Linter.LegacyConfig => ({
  plugins: [plugin.meta.name],
  ...languageOptions,
  rules: rules(severity),
});

type Plugin = ESLint.Plugin & {
  configs: {
    recommended: Linter.Config;
    strict: Linter.Config;
    "legacy-recommended": Linter.LegacyConfig;
    "legacy-strict": Linter.LegacyConfig;
  };
};

// The configs reference `plugin` itself, so they are assigned after it exists.
// `Object.assign` mutates and returns the same object, so the identity that
// ESLint relies on for plugin resolution is preserved.
const pluginWithConfigs: Plugin = Object.assign(plugin, {
  configs: {
    recommended: flat("warn", "recommended"),
    strict: flat("error", "strict"),
    "legacy-recommended": legacy("warn"),
    "legacy-strict": legacy("error"),
  },
});

export default pluginWithConfigs;
