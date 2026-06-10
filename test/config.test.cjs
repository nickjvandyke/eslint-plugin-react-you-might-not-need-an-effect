const { ESLint } = require("eslint");
const { LegacyESLint } = require("eslint/use-at-your-own-risk");
const js = String.raw;
const assert = require("assert");
// WARNING: Must `yarn build` before this test!
// eslint-disable-next-line n/no-missing-require
const plugin = require("../dist/index.cjs");

// Kinda duplicates `config.test.js` because legacy ESLint already `require`s the CJS build of the plugin.
// But I guess this file verifies that users can `require` the CJS build directly for their config?
// Idk, maybe delete.
describe("CJS build", () => {
  const codeThatDerivesState = js`
    import { useState, useEffect } from "react";

    const MyComponent = () => {
      const [state, setState] = useState(0);
      const [otherState, setOtherState] = useState(0);

      useEffect(() => {
        setState(otherState * 2);
      }, [state]);
    };
  `;

  it("flat config", async () => {
    const results = await new ESLint({
      // Use `overrideConfig` and `overrideConfigFile: true` to ignore the project's config
      overrideConfigFile: true,
      overrideConfig: [plugin.configs.recommended],
    }).lintText(codeThatDerivesState);

    assert.ok(
      results[0].messages
        .map((m) => m.ruleId)
        .includes("react-you-might-not-need-an-effect/no-derived-state"),
    );
  });

  it("legacy config", async () => {
    const results = await new LegacyESLint({
      overrideConfig: {
        extends: [
          "plugin:react-you-might-not-need-an-effect/legacy-recommended",
        ],
        parserOptions: {
          // To support the syntax in the code under test
          ecmaVersion: 2020,
          sourceType: "module",
        },
      },
    }).lintText(codeThatDerivesState);

    assert.ok(
      results[0].messages
        .map((m) => m.ruleId)
        .includes("react-you-might-not-need-an-effect/no-derived-state"),
    );
  });
});
