import { ESLint } from "eslint";
import { LegacyESLint } from "eslint/use-at-your-own-risk";
const js = String.raw;
import assert from "assert";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
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

  const fixtures = fileURLToPath(new URL("./fixtures/config", import.meta.url));

  const lintFixtures = async (config) => {
    const eslint = new ESLint({
      overrideConfigFile: true,
      overrideConfig: config,
    });
    return eslint.lintFiles([fixtures]);
  };

  const ruleId = "react-you-might-not-need-an-effect/no-derived-state";

  it("does not set files in the flat configs", () => {
    assert.equal(plugin.configs.recommended.files, undefined);
    assert.equal(plugin.configs.strict.files, undefined);
  });

  it("lints only the files that the user's config already lints", async () => {
    const results = await lintFixtures([plugin.configs.recommended]);

    assert.deepEqual(
      results.map((result) => path.basename(result.filePath)).sort(),
      ["a.js"],
    );
    assert.ok(results[0].messages.some((message) => message.ruleId === ruleId));
  });

  it("lints .jsx and .ts when the user's config adds them", async () => {
    const results = await lintFixtures([
      plugin.configs.recommended,
      {
        files: ["**/*.{jsx,ts}"],
        ignores: ["**/*.d.ts"],
      },
    ]);

    assert.deepEqual(
      results.map((result) => path.basename(result.filePath)).sort(),
      ["a.js", "a.jsx", "a.ts"],
    );
    results.forEach((result) => {
      assert.ok(
        result.messages.some((message) => message.ruleId === ruleId),
        `${path.basename(result.filePath)} should report ${ruleId}`,
      );
    });
  });
});
