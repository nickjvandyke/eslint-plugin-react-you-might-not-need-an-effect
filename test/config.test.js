import { ESLint } from "eslint";
import { LegacyESLint } from "eslint/use-at-your-own-risk";
const js = String.raw;
import assert from "assert";
import plugin from "../src/index.ts";

describe("config", () => {
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

  ["flat", "legacy"].forEach((configType) => {
    ["recommended", "strict"].forEach((severity) => {
      it(`${configType} - ${severity}`, async () => {
        const eslint =
          configType === "flat"
            ? // Internally imports the ESM plugin
              new ESLint({
                // Use `overrideConfig` and `overrideConfigFile: true` to ignore the project's config
                overrideConfigFile: true,
                overrideConfig: [plugin.configs[severity]],
              })
            : // Internally requires the CJS plugin (from `dist`)
              // NOTE: Thus must `yarn build` before running this test!
              new LegacyESLint({
                overrideConfig: {
                  extends: [
                    `plugin:react-you-might-not-need-an-effect/legacy-${severity}`,
                  ],
                  parserOptions: {
                    // To support the syntax in the code under test
                    ecmaVersion: 2020,
                    sourceType: "module",
                  },
                },
              });
        const results = await eslint.lintText(codeThatDerivesState);

        assert.equal(
          results[0].messages.find(
            (m) =>
              m.ruleId ===
              "react-you-might-not-need-an-effect/no-derived-state",
          )?.severity,
          severity === "recommended" ? 1 : 2,
        );
      });
    });
  });

  it("should not report no-derived-state when explicitly disabled", async () => {
    const eslint = new ESLint({
      overrideConfig: [
        plugin.configs.recommended,
        {
          rules: {
            "react-you-might-not-need-an-effect/no-derived-state": "off",
          },
        },
      ],
    });

    const results = await eslint.lintText(codeThatDerivesState);
    assert.equal(
      results[0].messages.find(
        (m) =>
          m.ruleId === "react-you-might-not-need-an-effect/no-derived-state",
      ),
      undefined,
    );
  });
});
