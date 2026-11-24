import { Linter, type Linter as LinterNamespace } from "eslint";
import tsParser from "@typescript-eslint/parser";
import plugin from "../src/index.ts";
import assert from "assert";

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
