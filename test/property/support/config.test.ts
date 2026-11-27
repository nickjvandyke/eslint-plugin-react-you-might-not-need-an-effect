import assert from "node:assert";
import { describe, it } from "node:test";
import { DEFAULT_RUNS, parseRuns, parseSeed } from "./config.ts";

describe("property run configuration", () => {
  it("uses the default run count when FC_RUNS is unset or empty", () => {
    assert.strictEqual(parseRuns(undefined), DEFAULT_RUNS);
    assert.strictEqual(parseRuns(""), DEFAULT_RUNS);
  });

  it("accepts a positive integer", () => {
    assert.strictEqual(parseRuns("1"), 1);
    assert.strictEqual(parseRuns("250"), 250);
  });

  it("rejects a run count that would disable or break the suite", () => {
    for (const value of ["0", "-1", "1.5", "abc", " "]) {
      assert.throws(() => parseRuns(value), /FC_RUNS/);
    }
  });

  it("replays an integer seed and ignores an unset one", () => {
    assert.strictEqual(parseSeed(undefined), undefined);
    assert.strictEqual(parseSeed(""), undefined);
    assert.strictEqual(parseSeed("0"), 0);
    assert.strictEqual(parseSeed("-42"), -42);
  });

  it("rejects a seed that is not an integer", () => {
    for (const value of ["1.5", "abc", " "]) {
      assert.throws(() => parseSeed(value), /FC_SEED/);
    }
  });
});
