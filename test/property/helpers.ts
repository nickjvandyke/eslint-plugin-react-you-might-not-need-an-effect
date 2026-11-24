import fc from "fast-check";
import { lint, type Diagnostic } from "../harness.ts";

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
