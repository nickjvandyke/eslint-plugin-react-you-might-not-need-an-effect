import assert from "assert";
import fc, { type IProperty } from "fast-check";
import { lint, type Diagnostic } from "../../harness.ts";
import {
  buildProgram,
  describeCombination,
  type ProgramInput,
  type Template,
} from "./builder.ts";
import { numRuns, seed } from "./config.ts";
import { lintInput } from "./helpers.ts";

/**
 * Runs a property at the configured draw count. Every property goes through
 * this call, so the run count cannot depend on import order.
 */
export const runProperty = <Ts>(property: IProperty<Ts>): void => {
  fc.assert(property, { numRuns, seed });
};

/**
 * Generates a program from `template` and `input`, then compares its
 * diagnostics. The message names the combination that failed.
 */
export const checkProgram = (
  template: Template,
  input: ProgramInput,
  expected: Diagnostic[],
  options: { ts?: boolean } = {},
): void => {
  const code = buildProgram(template, input);
  const actual = options.ts ? lint(code, { ts: true }) : lintInput(code, input);
  assert.deepStrictEqual(
    actual,
    expected,
    `${template.rule ? `${template.rule}: ` : ""}${describeCombination(input)}\n${code}`,
  );
};
