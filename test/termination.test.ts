import assert from "assert";
import { describe, it } from "node:test";
import { diagnostic, lint } from "./property/helpers.ts";

/**
 * Lints a program and fails with the code when analysis does not return.
 * A hang never returns, so the budget only needs to be generous.
 */
const lintWithin = (code: string, budgetMs = 2000): ReturnType<typeof lint> => {
  const start = Date.now();
  const diagnostics = lint(code);
  const elapsed = Date.now() - start;
  assert.ok(elapsed < budgetMs, `lint took ${elapsed}ms\n${code}`);
  return diagnostics;
};

// ---------------------------------------------------------------------------
// Deep call chains
// ---------------------------------------------------------------------------

describe("deep call chains", () => {
  it("follows a chain of 50 local functions", () => {
    // A fixed depth: a shorter chain exercises nothing a longer chain does not.
    const depth = 50;
    const declarations = ["const f0 = (v) => v;"];
    for (let i = 1; i <= depth; i++) {
      declarations.push(`const f${i} = (v) => f${i - 1}(v);`);
    }
    const code = `
      function C() {
        const [count, setCount] = useState(0);
        const [double, setDouble] = useState(0);
        ${declarations.join("\n")}
        useEffect(() => {
          setDouble(f${depth}(count * 2));
        }, [count]);
      }
    `;
    assert.deepStrictEqual(
      lintWithin(code),
      [diagnostic("no-derived-state", "avoidDerivedState")],
      code,
    );
  });
});

// ---------------------------------------------------------------------------
// Call graph cycles
// ---------------------------------------------------------------------------

/** A component whose effect writes `f0(count * 2)` into other state. */
const cycleComponent = (declarations: string): string => `
  function C() {
    const [count, setCount] = useState(0);
    const [double, setDouble] = useState(0);
    ${declarations}
    useEffect(() => {
      setDouble(f0(count * 2));
    }, [count]);
  }
`;

describe("call graph cycles", () => {
  it("follows a self-recursive function", () => {
    const code = cycleComponent("const f0 = (v) => f0(v);");
    assert.deepStrictEqual(
      lintWithin(code),
      [diagnostic("no-derived-state", "avoidDerivedState")],
      code,
    );
  });

  it("follows mutually recursive functions", () => {
    const code = cycleComponent(
      ["const f0 = (v) => f1(v);", "const f1 = (v) => f0(v);"].join("\n"),
    );
    assert.deepStrictEqual(
      lintWithin(code),
      [diagnostic("no-derived-state", "avoidDerivedState")],
      code,
    );
  });

  it("follows a complete call graph", () => {
    // The worst case: every function calls every function. Random sampling
    // never reaches this shape, so the case is fixed at the largest size that
    // still runs quickly.
    const nodes = 12;
    const declarations = Array.from(
      { length: nodes },
      (_, i) =>
        `const f${i} = (v) => ${Array.from(
          { length: nodes },
          (_, j) => `f${j}(v)`,
        ).join(" + ")};`,
    ).join("\n");
    const code = cycleComponent(declarations);
    assert.deepStrictEqual(
      lintWithin(code),
      [diagnostic("no-derived-state", "avoidDerivedState")],
      code,
    );
  });
});
