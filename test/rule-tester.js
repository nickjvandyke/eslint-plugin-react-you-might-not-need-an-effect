import assert from "assert";
import { RuleTester } from "eslint";
import plugin from "../src/index.ts";

// For syntax highlighting inside code under test
export const js = String.raw;

export class MyRuleTester extends RuleTester {
  constructor(options) {
    super({
      ...plugin.configs.recommended,
      ...options,
      rules: {}, // Avoid double-testing the rule passed to `run()`
    });
  }

  run(name, rule, tests) {
    const originalStrictEqual = assert.strictEqual;
    try {
      assert.strictEqual = (actual, expected, ...rest) => {
        if (typeof actual === "string" && typeof expected === "string") {
          return originalStrictEqual(
            normalizeWhitespace(actual),
            normalizeWhitespace(expected),
            ...rest,
          );
        }
        return originalStrictEqual(actual, expected, ...rest);
      };

      const { valid = [], invalid = [] } = tests;

      [...valid, ...invalid]
        .filter((test) => test.todo)
        .forEach((test) => {
          it.skip(test.name);
        });

      const filteredTests = {
        valid: valid.filter((test) => !test.todo),
        invalid: invalid.filter((test) => !test.todo),
      };

      super.run(name, rule, filteredTests);
    } finally {
      // Restore the original strictEqual function to avoid unintended effects
      assert.strictEqual = originalStrictEqual;
    }
  }
}

const normalizeWhitespace = (str) =>
  typeof str === "string" ? str.replace(/\s+/g, " ").trim() : str;
