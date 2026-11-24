import globals from "globals";
import assert from "assert";
import { describe, it } from "node:test";
import { diagnostic, lint, lintMessages, type LintOptions } from "./harness.ts";

const js = String.raw;

const configurations: [string, LintOptions][] = [
  ["without browser globals", {}],
  ["with browser globals", { globals: globals.browser }],
];

// ---------------------------------------------------------------------------
// Scope and naming
// ---------------------------------------------------------------------------

describe("scope and naming", () => {
  it("labels an anonymous owner as this component", () => {
    const code = js`
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
    const code = js`
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
    const code = js`
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

  it("reports the same data with and without configured globals", () => {
    const reads: [string, string][] = [
      ["window", ".innerWidth"],
      ["navigator", ".onLine"],
      ["localStorage", ".getItem('key')"],
      ["document", ".title"],
    ];

    for (const [root, member] of reads) {
      // Alias the global object itself, so the alias is still a global value.
      // `const value = window.innerWidth` would make `value` an ordinary local.
      for (let hops = 0; hops <= 3; hops++) {
        const declarations: string[] = [];
        let source = root;
        for (let i = 0; i < hops; i++) {
          declarations.push(`const g${i} = ${source};`);
          source = `g${i}`;
        }
        const expression = `${source}${member}`;
        const code = js`
          import { useEffect, useState } from 'react';

          function Child({ onFetched }) {
            const [value, setValue] = useState();
            ${declarations.join("\n")}

            useEffect(() => {
              setValue(${expression});
              onFetched(${expression});
            }, [onFetched, ${expression}]);
          }
        `;
        const results = configurations.map(([, options]) =>
          lint(code, options),
        );
        assert.deepStrictEqual(results[0], results[1], code);
        // The global read reaches the parent callback, so the comparison must
        // observe it. Otherwise both runs would agree on an empty list.
        assert.ok(
          results[0]?.some(
            ({ messageId }) =>
              messageId === "avoidPassingDataToParentInComponent",
          ),
          code,
        );
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Call aliases and wrapper setters
// ---------------------------------------------------------------------------

describe("call aliases", () => {
  it("follows a wrapper callback alias to its prop", () => {
    const code = js`
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
// TypeScript import-equals aliases
// ---------------------------------------------------------------------------

describe("TypeScript import-equals aliases", () => {
  // https://github.com/nickjvandyke/eslint-plugin-react-you-might-not-need-an-effect/issues/90
  it("ignores a call through a non-React alias", () => {
    const code = js`
      import { z } from 'zod';
      import str = z.string;

      export const schema = str();
    `;
    assert.deepStrictEqual(lint(code, { ts: true }), [], code);
  });

  it("does not resolve an alias of a React hook", () => {
    // `import x = A.b` names a local alias, so it stays opaque like
    // `const effect = React.useEffect`.
    const code = js`
      import React from 'react';
      import effect = React.useEffect;

      function C() {
        const [count, setCount] = React.useState(0);
        effect(() => { setCount(count + 1); }, [count]);
      }
    `;
    assert.deepStrictEqual(lint(code, { ts: true }), [], code);
  });
});

// ---------------------------------------------------------------------------
// State tuple slots
// ---------------------------------------------------------------------------

describe("state tuple slots", () => {
  it("tracks object state", () => {
    const code = js`
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
    const code = js`
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
    const code = js`
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
    const code = js`
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
    const code = js`
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
    const code = js`
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
    const code = js`
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
// Message wording
// ---------------------------------------------------------------------------

describe("message wording", () => {
  it("quotes every name in a dependency list", () => {
    const names = ["value0", "value1", "value2"];
    const list = names.join(", ");
    const code = js`
      function C({ ${list} }) {
        const [selection, setSelection] = useState();

        useEffect(() => {
          setSelection(null);
        }, [${list}]);
      }
    `;
    const [message] = lintMessages(code);
    const expected =
      'Avoid adjusting state when "value0" and "value1" and "value2" changes. ' +
      'Instead, adjust "selection" directly during render, or refactor your state to avoid this need entirely.';
    assert.strictEqual(message?.message, expected, code);
  });
});
