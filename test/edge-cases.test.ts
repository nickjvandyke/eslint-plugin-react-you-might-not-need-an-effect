import globals from "globals";
import assert from "assert";
import { describe, it } from "node:test";
import {
  diagnostic,
  lint,
  lintMessages,
  type LintOptions,
} from "./property/helpers.ts";

const configurations: [string, LintOptions][] = [
  ["without browser globals", {}],
  ["with browser globals", { globals: globals.browser }],
];

// ---------------------------------------------------------------------------
// Scope and naming
// ---------------------------------------------------------------------------

describe("scope and naming", () => {
  it("labels an anonymous owner as this component", () => {
    const code = `
      import { useEffect, useState } from 'react';

      export default () => {
        const { onFetched } = useContext(ChildContext);
        const [data, setData] = useState();

        useEffect(() => {
          onFetched(data);
        }, [onFetched, data]);
      };
    `;
    const messages = lintMessages(code);
    assert.deepStrictEqual(
      messages.map(({ messageId }) => messageId),
      ["avoidPassingLiveStateToParentInComponent"],
    );
    assert.ok(messages[0], "expected one diagnostic");
    assert.strictEqual(messages[0].message.includes("this component"), true);
  });

  it("does not leak state setters between sibling components", () => {
    const code = `
      import { useEffect, useState } from 'react';

      function Sibling() {
        const [data, setData] = useState();
      }

      function C() {
        const setData = (value) => console.log(value);

        useEffect(() => {
          setData('hello');
        }, []);
      }
    `;
    assert.deepStrictEqual(lint(code), [], code);
  });
});

// ---------------------------------------------------------------------------
// Browser globals
// ---------------------------------------------------------------------------

describe("browser globals", () => {
  it("does not treat a shared global as a subscription", () => {
    const code = `
      import { useEffect, useState } from 'react';

      function Store() {
        const [value, setValue] = useState(0);
        const setFromWindow = () => {
          const width = window.innerWidth;
          setValue(width);
        };

        useEffect(() => {
          setFromWindow();
          return () => window.removeEventListener('store', handler);
        }, []);
      }
    `;
    for (const [, options] of configurations) {
      const externalStore = lint(code, options).filter(({ ruleId }) =>
        (ruleId ?? "").endsWith("/no-external-store-subscription"),
      );
      assert.deepStrictEqual(externalStore, [], code);
    }
  });
});

// ---------------------------------------------------------------------------
// Call aliases and wrapper setters
// ---------------------------------------------------------------------------

describe("call aliases", () => {
  it("follows a wrapper callback alias to its prop", () => {
    const code = `
      function Child({ onFetched }) {
        const [data, setData] = useState();
        const onFetchedWrapper = (v) => onFetched(v);
        useEffect(() => {
          onFetchedWrapper(data);
        }, [onFetched, data]);
      }
    `;
    assert.deepStrictEqual(
      lint(code),
      [
        diagnostic(
          "no-pass-live-state-to-parent",
          "avoidPassingLiveStateToParentInComponent",
        ),
      ],
      code,
    );
  });
});

// ---------------------------------------------------------------------------
// State tuple slots
// ---------------------------------------------------------------------------

describe("state tuple slots", () => {
  it("tracks object state", () => {
    const code = `
      function DoubleCounter() {
        const [count, setCount] = useState({ value: 0 });
        const [doubleCount, setDoubleCount] = useState({ value: 0 });

        useEffect(() => {
          setDoubleCount({ value: count.value * 2 });
        }, [count]);
      }
    `;
    assert.deepStrictEqual(
      lint(code),
      [diagnostic("no-derived-state", "avoidDerivedState")],
      code,
    );
  });

  it("reports a setter that is only in the setter tuple slot", () => {
    const code = `
      import { useState } from 'react';
      function C() {
        const [, setAttempts] = useState(0);
        const [count, setCount] = useState(0);
        useEffect(() => { setAttempts((prev) => prev + count); }, [count]);
      }
    `;
    assert.deepStrictEqual(
      lint(code),
      [diagnostic("no-derived-state", "avoidDerivedState")],
      code,
    );
  });

  it("reports a setter whose state value is not destructured", () => {
    const code = `
      function C() {
        const [attempts, setAttempts] = useState(0);
        const [count] = useState(0);
        useEffect(() => { setAttempts(count); }, [count]);
      }
    `;
    assert.deepStrictEqual(
      lint(code),
      [diagnostic("no-derived-state", "avoidDerivedState")],
      code,
    );
  });
});

// ---------------------------------------------------------------------------
// Effect call boundaries
// ---------------------------------------------------------------------------

describe("effect call boundaries", () => {
  it("allows an array hole in arrow function params", () => {
    const code = `
      function FilteredPosts({ posts }) {
        const [filteredPosts, setFilteredPosts] = useState([]);

        useEffect(() => {
          setFilteredPosts(posts.filter(([, value]) => value !== ''));
        }, [posts]);
      }
    `;
    assert.deepStrictEqual(
      lint(code),
      [diagnostic("no-derived-state", "avoidDerivedState")],
      code,
    );
  });

  it("ignores calls to local functions that do not set state", () => {
    const code = `
      function C() {
        const [first, setFirst] = useState('Dwayne');
        const [last, setLast] = useState('The Rock');
        const [full, setFull] = useState('');

        const log = (a, b) => console.log(a, b);

        useEffect(() => { log(first, last); }, [first, last]);
      }
    `;
    assert.deepStrictEqual(lint(code), [], code);
  });

  it("keeps a setter alias declared inside an async function opaque", () => {
    // The alias is declared inside the async function, so the chain from
    // `load()` must stop before `set(data)`.
    const code = `
      function Component() {
        const [count, setCount] = useState(0);
        const [double, setDouble] = useState();

        useEffect(() => {
          const load = async () => {
            const set = setDouble;
            const data = await fetchDouble(count);
            set(data);
          };
          load();
        }, [count]);
      }
    `;
    assert.deepStrictEqual(lint(code), [], code);
  });

  it("keeps internal useCallback results opaque", () => {
    // The setter receives the `useCallback` result, and that result is the
    // value computed from the callback's arguments.
    const code = `
      function C() {
        const [name, setName] = useState('');
        const compute = useCallback(() => 'x', []);
        useEffect(() => { setName(compute()); }, [compute]);
      }
    `;
    assert.deepStrictEqual(
      lint(code),
      [diagnostic("no-derived-state", "avoidDerivedState")],
      code,
    );
  });
});

// ---------------------------------------------------------------------------
// Call graph cycles
// ---------------------------------------------------------------------------

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
