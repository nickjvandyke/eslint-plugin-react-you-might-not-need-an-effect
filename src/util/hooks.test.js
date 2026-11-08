import { RuleTester } from "eslint";
import plugin from "../index.ts";
import noDerivedState from "../rules/no-derived-state.ts";
import noInitializeState from "../rules/no-initialize-state.ts";
import noPassDataToParent from "../rules/no-pass-data-to-parent.ts";

const js = String.raw;
const config = { ...plugin.configs.recommended, rules: {} };

// `useEffect`-like wrappers that accept `(callback, deps)`.
const wrappersWithDeps = [
  ["useIsomorphicLayoutEffect", "react-use"],
  ["useIsomorphicLayoutEffect", "@radix-ui/react-use-isomorphic-layout-effect"],
  ["useIsomorphicEffect", "@mantine/hooks"],
];

// `useEffect`-like wrappers that accept only `(callback)`.
const wrappersWithoutDeps = [
  ["useUpdateEffect", "react-use"],
  ["useUpdateEffect", "ahooks"],
  ["useUpdateEffect", "primereact/hooks"],
  ["useDidUpdate", "@mantine/hooks"],
  ["useUnmountEffect", "primereact/hooks"],
  ["useMount", "some-unknown-library"],
];

const wrapperWithDepsCase = (hook, module) => ({
  name: `${hook} from ${module}`,
  code: js`
    import { ${hook} } from '${module}';
    import { useState } from 'react';

    function Component({ value }) {
      const [state, setState] = useState();

      ${hook}(() => {
        setState(value);
      }, [value]);
    }
  `,
});

const wrapperWithoutDepsCase = (hook, module) => ({
  name: `${hook} from ${module}`,
  code: js`
    import { ${hook} } from '${module}';
    import { useState } from 'react';

    function Component() {
      const [state, setState] = useState();

      ${hook}(() => {
        setState('x');
      });
    }
  `,
});

const valid = [
  {
    name: "useLayoutEffect",
    code: js`
      import { useLayoutEffect, useState } from 'react';

      function Component({ value }) {
        const [state, setState] = useState();

        useLayoutEffect(() => {
          setState(value);
        }, [value]);
      }
    `,
  },
  ...wrappersWithDeps.map(([hook, module]) =>
    wrapperWithDepsCase(hook, module),
  ),
  ...wrappersWithoutDeps.map(([hook, module]) =>
    wrapperWithoutDepsCase(hook, module),
  ),
  {
    name: "useCustomCompareEffect from @react-hookz/web",
    code: js`
      import { useCustomCompareEffect } from '@react-hookz/web';
      import { useState } from 'react';

      function Component({ value }) {
        const [state, setState] = useState();

        useCustomCompareEffect(
          () => {
            setState(value);
          },
          [value],
          (a, b) => a === b,
          useLayoutEffect,
        );
      }
    `,
  },
  {
    name: "useAsyncEffect from ahooks",
    code: js`
      import { useAsyncEffect } from 'ahooks';
      import { useState } from 'react';

      function Component() {
        const [state, setState] = useState();

        useAsyncEffect(async () => {
          setState('x');
        }, []);
      }
    `,
  },
  {
    name: "useDebounceEffect from ahooks",
    code: js`
      import { useDebounceEffect } from 'ahooks';
      import { useState } from 'react';

      function Component() {
        const [state, setState] = useState();

        useDebounceEffect(
          () => {
            setState('x');
          },
          [],
          { wait: 100 },
        );
      }
    `,
  },
  {
    name: "useConditionalEffect from @react-hookz/web",
    code: js`
      import { useConditionalEffect } from '@react-hookz/web';
      import { useState } from 'react';

      function Component({ value }) {
        const [state, setState] = useState();

        useConditionalEffect(
          () => {
            setState(value);
          },
          [value],
          () => true,
        );
      }
    `,
  },
  {
    name: "useIntervalEffect from @react-hookz/web",
    code: js`
      import { useIntervalEffect } from '@react-hookz/web';
      import { useState } from 'react';

      function Component() {
        const [state, setState] = useState();

        useIntervalEffect(() => {
          setState('x');
        }, 1000);
      }
    `,
  },
  {
    name: "local useMount that is not imported",
    code: js`
      import { useState } from 'react';

      function useMount(callback) {
        callback();
      }

      function Component() {
        const [state, setState] = useState();

        useMount(() => {
          setState('x');
        });
      }
    `,
  },
  {
    name: "useEffectEvent callback stays opaque",
    code: js`
      import { useEffect, useEffectEvent, useState } from 'react';

      function Component() {
        const [state, setState] = useState();
        const onMount = useEffectEvent(() => {
          setState('x');
        });

        useEffect(onMount, []);
      }
    `,
  },
];

// Mount-only wrappers are `useEffect`-like, so `no-initialize-state` reports.
const mountOnlyWrappers = [
  ["useMount", "react-use"],
  ["useEffectOnce", "react-use"],
  ["useMount", "ahooks"],
  ["useMountEffect", "@react-hookz/web"],
  ["useMountEffect", "primereact/hooks"],
];

const mountOnlyWrapperCase = (hook, module) => ({
  name: `${module} ${hook}`,
  code: js`
    import { ${hook} } from '${module}';
    import { useState } from 'react';

    function Component() {
      const [state, setState] = useState();

      ${hook}(() => {
        setState('x');
      });
    }
  `,
  errors: [
    {
      messageId: "avoidInitializingState",
      data: { state: "state", arguments: "'x'" },
    },
  ],
});

new RuleTester(config).run("no-initialize-state", noInitializeState, {
  valid,
  invalid: [
    ...mountOnlyWrappers.map(([hook, module]) =>
      mountOnlyWrapperCase(hook, module),
    ),
    {
      name: "namespace import",
      code: js`
        import * as reactUse from 'react-use';
        import { useState } from 'react';

        function Component() {
          const [state, setState] = useState();

          reactUse.useMount(() => {
            setState('x');
          });
        }
      `,
      errors: [
        {
          messageId: "avoidInitializingState",
          data: { state: "state", arguments: "'x'" },
        },
      ],
    },
    {
      name: "renamed import",
      code: js`
        import { useMount as mount } from 'react-use';
        import { useState } from 'react';

        function Component() {
          const [state, setState] = useState();

          mount(() => {
            setState('x');
          });
        }
      `,
      errors: [
        {
          messageId: "avoidInitializingState",
          data: { state: "state", arguments: "'x'" },
        },
      ],
    },
  ],
});

// Deep-compare wrappers are `useEffect`-like, so `no-derived-state` reports.
const deepCompareWrappers = [
  ["useDeepCompareEffect", "react-use"],
  ["useDeepCompareEffect", "ahooks"],
  ["useDeepCompareEffect", "@react-hookz/web"],
  ["useShallowEffect", "@mantine/hooks"],
];

const deepCompareWrapperCase = (hook, module) => ({
  name: `${module} ${hook}`,
  code: js`
    import { ${hook} } from '${module}';
    import { useState } from 'react';

    function Component({ value }) {
      const [state, setState] = useState();

      ${hook}(() => {
        setState(value);
      }, [value]);
    }
  `,
  errors: [{ messageId: "avoidDerivedState", data: { state: "state" } }],
});

new RuleTester(config).run("no-derived-state", noDerivedState, {
  valid,
  invalid: [
    ...deepCompareWrappers.map(([hook, module]) =>
      deepCompareWrapperCase(hook, module),
    ),
    {
      name: "react-use useCustomCompareEffect",
      code: js`
        import { useCustomCompareEffect } from 'react-use';
        import { useState } from 'react';

        function Component({ value }) {
          const [state, setState] = useState();

          useCustomCompareEffect(
            () => {
              setState(value);
            },
            [value],
            (a, b) => a === b,
          );
        }
      `,
      errors: [{ messageId: "avoidDerivedState", data: { state: "state" } }],
    },
    {
      name: "use-deep-compare-effect default import",
      code: js`
        import useDeepCompareEffect from 'use-deep-compare-effect';
        import { useState } from 'react';

        function Component({ value }) {
          const [state, setState] = useState();

          useDeepCompareEffect(() => {
            setState(value);
          }, [value]);
        }
      `,
      errors: [{ messageId: "avoidDerivedState", data: { state: "state" } }],
    },
  ],
});

const avoidDerivedState = (state) => [
  {
    messageId: "avoidDerivedState",
    data: { state },
  },
];

// React-compatible packages that expose the same hook API.
const reactModules = [
  "react",
  "preact/hooks",
  "preact/compat",
  "@wordpress/element",
];

const renamedImportCase = (module) => ({
  name: `Renamed useState and useEffect imports from ${module}`,
  code: js`
    import { useState as stateUser, useEffect as effect } from '${module}';

    function Form() {
      const [firstName, setFirstName] = stateUser('Nick');
      const [lastName, setLastName] = stateUser('van Dyke');

      const [fullName, setFullName] = stateUser('');
      effect(() => setFullName(firstName + ' ' + lastName), [firstName, lastName]);
    }
  `,
  errors: avoidDerivedState("fullName"),
});

new RuleTester(config).run("hooks: imports", noDerivedState, {
  valid: [],
  invalid: [
    {
      name: "With imports",
      code: js`
        import { useState, useEffect } from 'react';

        function DoubleCounter() {
          const [count, setCount] = useState(0);
          const [doubleCount, setDoubleCount] = useState(0);

          useEffect(() => setDoubleCount(count * 2), [count]);
        }
      `,
      errors: avoidDerivedState("doubleCount"),
    },
    {
      name: "Without imports",
      code: js`
        function Form() {
          const [firstName, setFirstName] = useState('Nick');
          const [lastName, setLastName] = useState('van Dyke');

          const [fullName, setFullName] = useState('');
          useEffect(() => setFullName(firstName + ' ' + lastName), [firstName, lastName]);
        }
      `,
      errors: 1,
    },
    {
      name: "React.useEffect",
      code: js`
        import * as React from 'react';

        function DoubleCounter() {
          const [count, setCount] = React.useState(0);
          const [doubleCount, setDoubleCount] = React.useState(0);

          React.useEffect(() => {
            setDoubleCount(count * 2);
          }, [count]);
        }
      `,
      errors: 1,
    },
    ...reactModules.map((module) => renamedImportCase(module)),
    {
      name: "Renamed namespace import",
      code: js`
        import * as ReactAlias from 'react';

        function Form() {
          const [firstName, setFirstName] = ReactAlias.useState('Nick');
          const [lastName, setLastName] = ReactAlias.useState('van Dyke');

          const [fullName, setFullName] = ReactAlias.useState('');
          ReactAlias.useEffect(() => setFullName(firstName + ' ' + lastName), [firstName, lastName]);
        }
      `,
      errors: avoidDerivedState("fullName"),
    },
    {
      name: "Renamed default import",
      code: js`
        import ReactAlias from 'react';

        function Form() {
          const [firstName, setFirstName] = ReactAlias.useState('Nick');
          const [lastName, setLastName] = ReactAlias.useState('van Dyke');

          const [fullName, setFullName] = ReactAlias.useState('');
          ReactAlias.useEffect(() => setFullName(firstName + ' ' + lastName), [firstName, lastName]);
        }
      `,
      errors: avoidDerivedState("fullName"),
    },
    {
      name: "Renamed useContext import",
      code: js`
        import { useContext as useCtx, useState, useEffect } from 'react';

        function Theme() {
          const theme = useCtx(ThemeContext);
          const [isDark, setIsDark] = useState(false);

          useEffect(() => setIsDark(theme === 'dark'), [theme]);
        }
      `,
      errors: avoidDerivedState("isDark"),
    },
    {
      name: "Namespace useContext",
      code: js`
        import * as React from 'react';

        function Theme() {
          const theme = React.useContext(ThemeContext);
          const [isDark, setIsDark] = React.useState(false);

          React.useEffect(() => setIsDark(theme === 'dark'), [theme]);
        }
      `,
      errors: avoidDerivedState("isDark"),
    },
  ],
});

new RuleTester(config).run("hooks: useRef imports", noPassDataToParent, {
  valid: [
    {
      name: "Renamed useRef import",
      code: js`
        import { useRef as useReference, useEffect } from 'react';

        const Child = ({ onRef }) => {
          const ref = useReference();

          useEffect(() => {
            onRef(ref.current);
          }, [onRef, ref.current]);
        }
      `,
    },
  ],
  invalid: [],
});
