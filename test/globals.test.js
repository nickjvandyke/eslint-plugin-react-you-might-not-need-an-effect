import { ESLint } from "eslint";
import globals from "globals";
import plugin from "../src/index.ts";
const js = String.raw;
import assert from "assert";
import { describe, it } from "node:test";

// A configured global resolves to a variable with no definitions. An
// unconfigured global stays unresolved. The rules must treat both the same, so
// users can define browser globals for `no-undef` without changing results.
describe("browser globals", () => {
  const lint = (code, languageOptions) =>
    new ESLint({
      overrideConfigFile: true,
      overrideConfig: [
        {
          ...plugin.configs.recommended,
          languageOptions: {
            ...plugin.configs.recommended.languageOptions,
            ...languageOptions,
          },
        },
      ],
    }).lintText(code);

  const summarize = (messages) =>
    messages.map(({ ruleId, messageId }) => ({ ruleId, messageId }));

  const ruleId = "react-you-might-not-need-an-effect";
  const configs = [
    ["without browser globals", {}],
    ["with browser globals", { globals: globals.browser }],
  ];

  describe("data passed to a parent", () => {
    const code = js`
      import { useEffect } from 'react';

      function Child({ onFetched }) {
        useEffect(() => {
          onFetched(window.location);
          onFetched(localStorage.getItem('key'));
        }, [onFetched]);
      }
    `;

    const expected = [
      {
        ruleId: `${ruleId}/no-pass-data-to-parent`,
        messageId: "avoidPassingDataToParentInComponent",
      },
      {
        ruleId: `${ruleId}/no-pass-data-to-parent`,
        messageId: "avoidPassingDataToParentInComponent",
      },
    ];

    configs.forEach(([name, languageOptions]) => {
      it(`reports the same problems ${name}`, async () => {
        const [result] = await lint(code, languageOptions);
        assert.deepStrictEqual(
          summarize(result.messages),
          expected,
          `Expected the same problems ${name}, but got: ${JSON.stringify(
            result.messages,
          )}`,
        );
      });
    });
  });

  describe("external store subscription", () => {
    // The setter reads a global, and the cleanup also touches that global.
    // Both only share the global, which says nothing about a subscription.
    const sharedGlobalCode = js`
      import { useEffect, useState } from 'react';

      function Store() {
        const [value, setValue] = useState(0);
        const setFromWindow = () => {
          const width = window.innerWidth;
          setValue(width);
        };

        useEffect(() => {
          setFromWindow();
          return () => window.removeEventListener('store', handler);
        }, []);
      }
    `;

    // The setter and the cleanup share the local `update` function, so this is
    // a real subscription and must stay flagged.
    const subscriptionCode = js`
      import { useEffect, useState } from 'react';

      function Store() {
        const [value, setValue] = useState(0);

        useEffect(() => {
          const update = () => setValue(window.__STORE__);
          window.addEventListener('store', update);
          update();
          return () => window.removeEventListener('store', update);
        }, []);
      }
    `;

    const filter = (messages) =>
      summarize(messages).filter(
        ({ ruleId: id }) => id === `${ruleId}/no-external-store-subscription`,
      );

    configs.forEach(([name, languageOptions]) => {
      it(`does not treat a shared global as a subscription ${name}`, async () => {
        const [result] = await lint(sharedGlobalCode, languageOptions);
        assert.deepStrictEqual(filter(result.messages), []);
      });

      it(`flags a real subscription ${name}`, async () => {
        const [result] = await lint(subscriptionCode, languageOptions);
        assert.deepStrictEqual(filter(result.messages), [
          {
            ruleId: `${ruleId}/no-external-store-subscription`,
            messageId: "avoidExternalStoreSubscription",
          },
        ]);
      });
    });
  });
});
