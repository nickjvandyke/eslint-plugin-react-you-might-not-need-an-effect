import { RuleTester } from "eslint";
import plugin from "../src/index.ts";
import noDerivedState from "../src/rules/no-derived-state.ts";
import noInitializeState from "../src/rules/no-initialize-state.ts";

const js = String.raw;
const config = { ...plugin.configs.recommended, rules: {} };

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
  {
    name: "useIsomorphicLayoutEffect from react-use",
    code: js`
      import { useIsomorphicLayoutEffect } from 'react-use';
      import { useState } from 'react';

      function Component({ value }) {
        const [state, setState] = useState();

        useIsomorphicLayoutEffect(() => {
          setState(value);
        }, [value]);
      }
    `,
  },
  {
    name: "useIsomorphicLayoutEffect from @radix-ui/react-use-isomorphic-layout-effect",
    code: js`
      import { useIsomorphicLayoutEffect } from '@radix-ui/react-use-isomorphic-layout-effect';
      import { useState } from 'react';

      function Component({ value }) {
        const [state, setState] = useState();

        useIsomorphicLayoutEffect(() => {
          setState(value);
        }, [value]);
      }
    `,
  },
  {
    name: "useIsomorphicEffect from @mantine/hooks",
    code: js`
      import { useIsomorphicEffect } from '@mantine/hooks';
      import { useState } from 'react';

      function Component({ value }) {
        const [state, setState] = useState();

        useIsomorphicEffect(() => {
          setState(value);
        }, [value]);
      }
    `,
  },
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
    name: "useUpdateEffect from react-use",
    code: js`
      import { useUpdateEffect } from 'react-use';
      import { useState } from 'react';

      function Component() {
        const [state, setState] = useState();

        useUpdateEffect(() => {
          setState('x');
        }, []);
      }
    `,
  },
  {
    name: "useUpdateEffect from ahooks",
    code: js`
      import { useUpdateEffect } from 'ahooks';
      import { useState } from 'react';

      function Component() {
        const [state, setState] = useState();

        useUpdateEffect(() => {
          setState('x');
        }, []);
      }
    `,
  },
  {
    name: "useUpdateEffect from primereact/hooks",
    code: js`
      import { useUpdateEffect } from 'primereact/hooks';
      import { useState } from 'react';

      function Component() {
        const [state, setState] = useState();

        useUpdateEffect(() => {
          setState('x');
        }, []);
      }
    `,
  },
  {
    name: "useDidUpdate from @mantine/hooks",
    code: js`
      import { useDidUpdate } from '@mantine/hooks';
      import { useState } from 'react';

      function Component() {
        const [state, setState] = useState();

        useDidUpdate(() => {
          setState('x');
        }, []);
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
    name: "useUnmountEffect from primereact/hooks",
    code: js`
      import { useUnmountEffect } from 'primereact/hooks';
      import { useState } from 'react';

      function Component() {
        const [state, setState] = useState();

        useUnmountEffect(() => {
          setState('x');
        });
      }
    `,
  },
  {
    name: "useMount from an unknown module",
    code: js`
      import { useMount } from 'some-unknown-library';
      import { useState } from 'react';

      function Component() {
        const [state, setState] = useState();

        useMount(() => {
          setState('x');
        });
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

new RuleTester(config).run("no-initialize-state", noInitializeState, {
  valid,
  invalid: [
    {
      name: "react-use useMount",
      code: js`
        import { useMount } from 'react-use';
        import { useState } from 'react';

        function Component() {
          const [state, setState] = useState();

          useMount(() => {
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
      name: "react-use useEffectOnce",
      code: js`
        import { useEffectOnce } from 'react-use';
        import { useState } from 'react';

        function Component() {
          const [state, setState] = useState();

          useEffectOnce(() => {
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
      name: "ahooks useMount",
      code: js`
        import { useMount } from 'ahooks';
        import { useState } from 'react';

        function Component() {
          const [state, setState] = useState();

          useMount(() => {
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
      name: "@react-hookz/web useMountEffect",
      code: js`
        import { useMountEffect } from '@react-hookz/web';
        import { useState } from 'react';

        function Component() {
          const [state, setState] = useState();

          useMountEffect(() => {
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
      name: "primereact/hooks useMountEffect",
      code: js`
        import { useMountEffect } from 'primereact/hooks';
        import { useState } from 'react';

        function Component() {
          const [state, setState] = useState();

          useMountEffect(() => {
            setState('x');
          });

          return <div>{state}</div>;
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

new RuleTester(config).run("no-derived-state", noDerivedState, {
  valid,
  invalid: [
    {
      name: "react-use useDeepCompareEffect",
      code: js`
        import { useDeepCompareEffect } from 'react-use';
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
      name: "ahooks useDeepCompareEffect",
      code: js`
        import { useDeepCompareEffect } from 'ahooks';
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
    {
      name: "@react-hookz/web useDeepCompareEffect",
      code: js`
        import { useDeepCompareEffect } from '@react-hookz/web';
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
    {
      name: "@mantine/hooks useShallowEffect",
      code: js`
        import { useShallowEffect } from '@mantine/hooks';
        import { useState } from 'react';

        function Component({ value }) {
          const [state, setState] = useState();

          useShallowEffect(() => {
            setState(value);
          }, [value]);
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
