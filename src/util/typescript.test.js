import { RuleTester } from "eslint";
import tsParser from "@typescript-eslint/parser";
import plugin from "../index.ts";
const js = String.raw;

import noDerivedState from "../rules/no-derived-state.ts";
import noPassLiveStateToParent from "../rules/no-pass-live-state-to-parent.ts";
import noPassDataToParent from "../rules/no-pass-data-to-parent.ts";
import noResetAllStateOnPropChange from "../rules/no-reset-all-state-on-prop-change.ts";

// TypeScript-only syntax (`as`, `satisfies`, `!`, `as const`) is erased before
// the code runs, so it must not change what the analysis sees.
const config = {
  ...plugin.configs.recommended,
  rules: {},
  languageOptions: {
    ...plugin.configs.recommended.languageOptions,
    parser: tsParser,
  },
};

new RuleTester(config).run("TypeScript: no-derived-state", noDerivedState, {
  valid: [
    {
      name: "Type annotation does not count as a runtime state reference",
      code: js`
      function Form() {
        const [count, setCount] = useState(0);
        const [label, setLabel] = useState("");

        useEffect(() => {
          setLabel(computeLabel() as typeof count);
        }, []);
      }
    `,
    },
  ],
  invalid: [
    {
      name: "State declared with a type assertion",
      code: js`
      function Form() {
        const [count, setCount] = useState(0) as [number, (v: number) => void];
        const [doubleCount, setDoubleCount] = useState(0) as [number, (v: number) => void];

        useEffect(() => {
          setDoubleCount(count * 2);
        }, [count]);
      }
    `,
      errors: [
        {
          messageId: "avoidDerivedState",
          data: { state: "doubleCount" },
        },
      ],
    },
    {
      name: "Deps array with a type assertion",
      code: js`
      function Form() {
        const [count, setCount] = useState(0);
        const [doubleCount, setDoubleCount] = useState(0);

        useEffect(() => {
          setDoubleCount(count * 2);
        }, [count] as const);
      }
    `,
      errors: [
        {
          messageId: "avoidDerivedState",
          data: { state: "doubleCount" },
        },
      ],
    },
    {
      name: "Setter argument with a type assertion",
      code: js`
      function Form() {
        const [count, setCount] = useState(0);
        const [doubleCount, setDoubleCount] = useState(0);

        useEffect(() => {
          setDoubleCount((count * 2) as number);
        }, [count]);
      }
    `,
      errors: [
        {
          messageId: "avoidDerivedState",
          data: { state: "doubleCount" },
        },
      ],
    },
  ],
});

new RuleTester(config).run(
  "TypeScript: no-pass-live-state-to-parent",
  noPassLiveStateToParent,
  {
    valid: [],
    invalid: [
      {
        name: "Non-null assertion on a prop callback",
        code: js`
        const Child = ({ onFetched }: { onFetched: (v: string) => void }) => {
          const [data, setData] = useState<string>();

          useEffect(() => {
            onFetched!(data);
          }, [onFetched, data]);
        }
      `,
        errors: [
          {
            messageId: "avoidPassingLiveStateToParentInComponent",
            data: { state: '"data"', name: '"Child"' },
          },
        ],
      },
      {
        name: "Component wrapped with satisfies",
        code: js`
        const Child = (({ onFetched }: { onFetched: (v: string) => void }) => {
          const [data, setData] = useState<string>();

          useEffect(() => {
            onFetched(data);
          }, [onFetched, data]);
        }) satisfies React.FC;
      `,
        errors: [
          {
            messageId: "avoidPassingLiveStateToParentInComponent",
            data: { state: '"data"', name: '"Child"' },
          },
        ],
      },
      {
        name: "Function-expression component wrapped in memo and a type assertion",
        code: js`
        const Child = memo(function ({ onFetched }: { onFetched: (v: string) => void }) {
          const [data, setData] = useState<string>();

          useEffect(() => {
            onFetched(data);
          }, [onFetched, data]);
        }) as React.FC;
      `,
        errors: [
          {
            messageId: "avoidPassingLiveStateToParentInComponent",
            data: { state: '"data"', name: '"Child"' },
          },
        ],
      },
      {
        name: "Prop callback accessed through an asserted object",
        code: js`
        const Child = (props: { onFetched: (v: string) => void }) => {
          const [data, setData] = useState<string>();

          useEffect(() => {
            (props as any).onFetched(data);
          }, [props, data]);
        }
      `,
        errors: [
          {
            messageId: "avoidPassingLiveStateToParentInComponent",
            data: { state: '"data"', name: '"Child"' },
          },
        ],
      },
    ],
  },
);

new RuleTester(config).run(
  "TypeScript: no-pass-data-to-parent",
  noPassDataToParent,
  {
    valid: [
      {
        name: "Pass an object constant declared with `as const`",
        code: js`
      const Child = ({ onData }: { onData: (v: unknown) => void }) => {
        const DATA = { ok: true } as const;

        useEffect(() => {
          onData(DATA);
        }, [onData]);
      }
    `,
      },
    ],
    invalid: [],
  },
);

new RuleTester(config).run(
  "TypeScript: no-reset-all-state-on-prop-change",
  noResetAllStateOnPropChange,
  {
    valid: [],
    invalid: [
      {
        name: "Initial state with a type assertion",
        code: js`
        function ProfilePage({ userId }: { userId: string }) {
          const [user, setUser] = useState(null as string | null);
          const [comment, setComment] = useState("type something");

          useEffect(() => {
            setUser(null);
            setComment("type something");
          }, [userId]);
        }
      `,
        errors: [
          {
            messageId: "avoidResettingAllStateWhenAPropChanges",
            data: { prop: "userId" },
          },
        ],
      },
    ],
  },
);
