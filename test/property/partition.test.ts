import assert from "assert";
import { describe, it } from "node:test";
import fc from "fast-check";
import { rulePrefix } from "../harness.ts";
import { triggerSources, writtenSources } from "./axes/state-setter-sources.ts";
import {
  buildProgram,
  combination,
  describeCombination,
} from "./support/builder.ts";
import { runProperty } from "./support/check.ts";
import { lintInput, oneOf } from "./support/helpers.ts";
import { expectedStateRule, partitionTemplate } from "./support/partition.ts";

describe("property: state-setter rules partition one setter", () => {
  it("reports exactly the expected rule and nothing else", () => {
    runProperty(
      fc.property(
        fc.record({
          trigger: oneOf(triggerSources),
          written: oneOf(writtenSources),
          cleanup: fc.boolean(),
          input: combination(),
        }),
        ({ trigger, written, cleanup, input }) => {
          const code = buildProgram(
            partitionTemplate(trigger, written, cleanup),
            input,
          );
          const reportedRules = lintInput(code, input).map(
            ({ ruleId }) => ruleId,
          );
          const expectedRule = expectedStateRule(
            trigger,
            written,
            cleanup,
            input.hops,
          );
          assert.deepStrictEqual(
            reportedRules,
            expectedRule ? [`${rulePrefix}/${expectedRule}`] : [],
            `${trigger.name}, ${written.name}, cleanup=${cleanup}, ${describeCombination(input)}\n${code}`,
          );
        },
      ),
    );
  });
});
