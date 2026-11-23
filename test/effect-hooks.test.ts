import assert from "assert";
import { describe, it } from "node:test";
import { diagnostic, lint } from "./property/helpers.ts";

// ---------------------------------------------------------------------------
// Third-party effect hooks (src/util/hooks.ts)
// ---------------------------------------------------------------------------

const derivedBody = (hookCall: string): string => `
  import { useState } from 'react';

  function C() {
    const [count, setCount] = useState(0);
    const [double, setDouble] = useState(0);

    ${hookCall}
  }
`;

const derivedCall = (callee: string): string =>
  `${callee}(() => { setDouble(count * 2); }, [count]);`;

const initializeCall = (callee: string): string =>
  `${callee}(() => { setState('Hello'); });`;

const initializeBody = (hookCall: string): string => `
  import { useState } from 'react';

  function C() {
    const [state, setState] = useState();

    ${hookCall}
  }
`;

const effectHooksWithDeps = [
  ["useDeepCompareEffect", "react-use"],
  ["useCustomCompareEffect", "react-use"],
  ["useDeepCompareEffect", "ahooks"],
  ["useDeepCompareEffect", "@react-hookz/web"],
  ["useShallowEffect", "@mantine/hooks"],
  ["useDeepCompareEffect", "use-deep-compare-effect"],
];

const mountOnlyEffectHooks = [
  ["useMount", "react-use"],
  ["useEffectOnce", "react-use"],
  ["useMount", "ahooks"],
  ["useMountEffect", "@react-hookz/web"],
  ["useMountEffect", "primereact/hooks"],
];

const opaqueEffectHooks = [
  ["useLayoutEffect", "react"],
  ["useIsomorphicLayoutEffect", "react-use"],
  ["useIsomorphicLayoutEffect", "@radix-ui/react-use-isomorphic-layout-effect"],
  ["useIsomorphicEffect", "@mantine/hooks"],
  ["useUpdateEffect", "react-use"],
  ["useUpdateEffect", "ahooks"],
  ["useUpdateEffect", "primereact/hooks"],
  ["useDidUpdate", "@mantine/hooks"],
  ["useUnmountEffect", "primereact/hooks"],
  ["useMount", "some-unknown-library"],
  ["useAsyncEffect", "ahooks"],
  ["useDebounceEffect", "ahooks"],
  ["useConditionalEffect", "@react-hookz/web"],
  ["useCustomCompareEffect", "@react-hookz/web"],
  ["useIntervalEffect", "@react-hookz/web"],
];

describe("third-party effect hooks", () => {
  for (const [hook, module] of effectHooksWithDeps) {
    it(`${module} ${hook} keeps derived state reports`, () => {
      const importLine =
        hook === "useDeepCompareEffect" && module === "use-deep-compare-effect"
          ? `import ${hook} from '${module}';`
          : `import { ${hook} } from '${module}';`;
      const code = `${importLine}\n${derivedBody(derivedCall(hook))}`;
      assert.deepStrictEqual(
        lint(code),
        [diagnostic("no-derived-state", "avoidDerivedState")],
        code,
      );
    });
  }

  it("supports a namespace import for a third-party hook", () => {
    const code = `
      import * as reactUse from 'react-use';
      import { useState } from 'react';

      function C() {
        const [state, setState] = useState();

        reactUse.useMount(() => { setState('x'); });
      }
    `;
    assert.deepStrictEqual(
      lint(code),
      [diagnostic("no-initialize-state", "avoidInitializingState")],
      code,
    );
  });

  it("supports a renamed third-party import", () => {
    const code = `
      import { useMount as mount } from 'react-use';
      import { useState } from 'react';

      function C() {
        const [state, setState] = useState();

        mount(() => { setState('x'); });
      }
    `;
    assert.deepStrictEqual(
      lint(code),
      [diagnostic("no-initialize-state", "avoidInitializingState")],
      code,
    );
  });

  for (const [hook, module] of mountOnlyEffectHooks) {
    it(`${module} ${hook} reports state initialization`, () => {
      const code = `import { ${hook} } from '${module}';\n${initializeBody(
        initializeCall(hook),
      )}`;
      assert.deepStrictEqual(
        lint(code),
        [diagnostic("no-initialize-state", "avoidInitializingState")],
        code,
      );
    });
  }

  for (const [hook, module] of opaqueEffectHooks) {
    it(`${module} ${hook} is not treated as useEffect`, () => {
      const code = `import { ${hook} } from '${module}';\n${derivedBody(
        derivedCall(hook),
      )}`;
      assert.deepStrictEqual(lint(code), [], code);
    });
  }

  it("keeps a local useMount opaque", () => {
    const code = `
      import { useState } from 'react';

      function useMount(callback) {
        callback();
      }

      function C() {
        const [state, setState] = useState();

        useMount(() => { setState('x'); });
      }
    `;
    assert.deepStrictEqual(lint(code), [], code);
  });

  it("keeps a useEffectEvent callback opaque", () => {
    const code = `
      import { useEffect, useEffectEvent, useState } from 'react';

      function C() {
        const [state, setState] = useState();
        const onMount = useEffectEvent(() => { setState('x'); });

        useEffect(onMount, []);
      }
    `;
    assert.deepStrictEqual(lint(code), [], code);
  });

  it("reports a custom compare effect from react-use", () => {
    const code = `
      import { useCustomCompareEffect } from 'react-use';
      import { useState } from 'react';

      function C() {
        const [count, setCount] = useState(0);
        const [double, setDouble] = useState(0);

        useCustomCompareEffect(
          () => { setDouble(count * 2); },
          [count],
          (a, b) => a === b,
        );
      }
    `;
    assert.deepStrictEqual(
      lint(code),
      [diagnostic("no-derived-state", "avoidDerivedState")],
      code,
    );
  });
});
