import assert from "assert";
import { describe, it } from "node:test";
import fc from "fast-check";
import "./config.ts";
import { rulePrefix } from "../harness.ts";
import { triggerSources, writtenSources } from "./axes/state-setter-sources.ts";
import { buildProgram, combination, describeCombination } from "./builder.ts";
import { lintInput, oneOf, stateRuleIds } from "./helpers.ts";
import { expectedStateRule, partitionTemplate } from "./partition.ts";

describe("property: state-setter rules partition one setter", () => {
  it("reports at most one state-setter rule, and the expected one", () => {
    fc.assert(
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
          const reportedRules = lintInput(code, input)
            .map(({ ruleId }) => ruleId)
            .filter((ruleId) =>
              stateRuleIds.some((rule) => ruleId === `${rulePrefix}/${rule}`),
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
