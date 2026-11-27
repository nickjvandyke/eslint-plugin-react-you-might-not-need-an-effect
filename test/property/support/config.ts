/**
 * Every property draws from the same eight-axis syntax matrix, which holds
 * 3,888,000 combinations and 1,406 value pairs. 1000 draws reached every pair
 * in measurement; 100 draws covered 84%. Properties that add axes or draw a
 * template inside the generator see fewer effective draws per template. The
 * full suite then takes about 7 seconds.
 *
 * Runs are passed at the call site by `runProperty`, never through global
 * config, so a new test file cannot silently fall back to fast-check's
 * default 100 runs.
 *
 * Set `FC_RUNS` for a faster local loop. It must be a positive integer.
 * Set `FC_SEED` to replay a failure from the seed that fast-check prints.
 */

export const DEFAULT_RUNS = 1000;

export const parseRuns = (value: string | undefined): number => {
  if (value === undefined || value === "") return DEFAULT_RUNS;
  const runs = Number(value);
  if (!Number.isInteger(runs) || runs < 1) {
    throw new Error(`FC_RUNS must be a positive integer, got "${value}"`);
  }
  return runs;
};

export const parseSeed = (value: string | undefined): number | undefined => {
  if (value === undefined || value === "") return undefined;
  const seed = Number(value);
  if (value.trim() === "" || !Number.isInteger(seed)) {
    throw new Error(`FC_SEED must be an integer, got "${value}"`);
  }
  return seed;
};

export const numRuns = parseRuns(process.env.FC_RUNS);

export const seed = parseSeed(process.env.FC_SEED);
