import fc from "fast-check";
import { lint, type Diagnostic } from "../harness.ts";

export const oneOf = <T>(values: readonly T[]) =>
  fc.constantFrom(...(values as [T, ...T[]]));

/** Selects the parser from the TypeScript axis. */
export const lintInput = (
  code: string,
  input: { ts: { name: string } },
): Diagnostic[] => lint(code, { ts: input.ts.name !== "none" });
