import { Linter, type Linter as LinterNamespace } from "eslint";
import tsParser from "@typescript-eslint/parser";
import fc from "fast-check";
import plugin from "../../src/index.ts";
import assert from "assert";

/**
 * Every property draws from the same eight-axis syntax matrix, which holds
 * 3,888,000 combinations and 1,350 value pairs. 1000 draws reach 100% pairwise
 * coverage with about 99% confidence. 100 draws covered only 84% of pairs.
 * A covering array needs about 115 rows, but random draws keep the generator
 * simple. The full suite then takes about 15 seconds.
 *
 * Set `FC_RUNS` for a faster local loop. Set `FC_SEED` to replay a failure.
 */
fc.configureGlobal({
  numRuns: Number(process.env.FC_RUNS ?? 1000),
  seed: process.env.FC_SEED ? Number(process.env.FC_SEED) : undefined,
});

export const linter = new Linter();
export const rulePrefix = "react-you-might-not-need-an-effect";

export type Diagnostic = Pick<
  LinterNamespace.LintMessage,
  "ruleId" | "messageId"
>;
export type Message = LinterNamespace.LintMessage;

export interface LintOptions {
  ts?: boolean;
  globals?: Record<string, boolean | "readonly" | "writable">;
}

export const lintMessages = (
  code: string,
  options: LintOptions = {},
): Message[] => {
  const config = {
    ...plugin.configs.recommended,
    languageOptions: {
      ...plugin.configs.recommended.languageOptions,
      ...(options.ts ? { parser: tsParser } : {}),
      ...(options.globals ? { globals: options.globals } : {}),
    },
  };
  const messages = linter.verify(code, [config as LinterNamespace.Config]);
  // Parser or config problems hide analysis problems. Fail loudly instead of
  // comparing two empty result lists.
  const fatal = messages.filter((message) => message.fatal);
  assert.deepStrictEqual(fatal, [], `parse error in:\n${code}`);
  return messages;
};

export const sortKey = ({ ruleId, messageId }: Diagnostic): string =>
  `${ruleId}/${messageId}`;

export const sortDiagnostics = (diagnostics: Diagnostic[]): Diagnostic[] =>
  [...diagnostics].sort((a, b) => sortKey(a).localeCompare(sortKey(b)));

export const diagnostic = (rule: string, messageId: string): Diagnostic => ({
  ruleId: `${rulePrefix}/${rule}`,
  messageId,
});

export const lint = (code: string, options: LintOptions = {}): Diagnostic[] =>
  sortDiagnostics(
    lintMessages(code, options).map(({ ruleId, messageId }) => ({
      ruleId,
      messageId,
    })),
  );

export const stateRuleIds = [
  "no-derived-state",
  "no-chain-state-updates",
  "no-adjust-state-on-prop-change",
] as const;

export const oneOf = <T>(values: readonly T[]) =>
  fc.constantFrom(...(values as [T, ...T[]]));

/** Selects the parser from the TypeScript axis. */
export const lintInput = (
  code: string,
  input: { ts: { name: string } },
): Diagnostic[] => lint(code, { ts: input.ts.name !== "none" });
