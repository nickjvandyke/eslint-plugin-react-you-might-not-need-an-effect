import { RuleTester } from "eslint";
import plugin from "../index.ts";
import noDerivedState from "../rules/no-derived-state.ts";

const js = String.raw;

const avoidDerivedState = (state) => [
  {
    messageId: "avoidDerivedState",
    data: { state },
  },
];

new RuleTester({ ...plugin.configs.recommended, rules: {} }).run(
  "state and setters",
  noDerivedState,
  {
    valid: [
      {
        name: "Two components with overlapping names",
        // Not a super realistic example
        code: js`
        function ComponentOne() {
          const [data, setData] = useState();
        }

        function ComponentTwo() {
          const setData = (data) => {
            console.log(data);
          }

          useEffect(() => {
            setData('hello');
          }, []);
        }
      `,
      },
      {
        // Only `const` aliases are followed, because `let` may be reassigned before use.
        name: "Alias declared with `let` is ignored",
        code: js`
        const Component = () => {
          const [data, setData] = useState();

          useEffect(() => {
            let set = setData;
            set(data);
          }, [data]);
        }
      `,
      },
    ],
    invalid: [
      {
        name: "Objects stored in state",
        code: js`
        function DoubleCounter() {
          const [count, setCount] = useState({ value: 0 });
          const [doubleCount, setDoubleCount] = useState({ value: 0 });

          useEffect(() => {
            setDoubleCount({ value: count.value * 2 });
          }, [count]);
        }
      `,
        errors: 1,
      },
      {
        name: "Value-less useState",
        code: js`
        import { useState } from 'react';

        function AttemptCounter() {
          const [, setAttempts] = useState(0);
          const [count, setCount] = useState(0);

          useEffect(() => {
            setAttempts((prev) => {
              return prev + count;
            });
          }, [count]);
        }
      `,
        errors: avoidDerivedState("setAttempts"),
      },
      {
        name: "Setter-less useState",
        code: js`
        function AttemptCounter() {
          const [attempts, setAttempts] = useState(0);
          const [count] = useState(0);

          useEffect(() => {
            setAttempts(count);
          }, [count]);
        }
      `,
        errors: avoidDerivedState("attempts"),
      },
      {
        name: "Set derived state via direct alias",
        code: js`
        const Component = () => {
          const [data, setData] = useState();
          // No idea why someone would do this. But good to know we catch it.
          const setDataWrapper = setData;

          useEffect(() => {
            setDataWrapper(data);
          }, [data]);
        }
      `,
        errors: avoidDerivedState("data"),
      },
      {
        name: "Set derived state via destructured alias",
        code: js`
        const Component = () => {
          const [data, setData] = useState();
          const { setData: setDataAlias } = { setData };

          useEffect(() => {
            setDataAlias(data);
          }, [data]);
        }
      `,
        errors: avoidDerivedState("data"),
      },
      {
        name: "Set derived state via wrapped alias",
        code: js`
        const Component = () => {
          const [data, setData] = useState();
          const setDataWrapper = (v) => setData(v);

          useEffect(() => {
            setDataWrapper(data);
          }, [data]);
        }
      `,
        errors: avoidDerivedState("data"),
      },
      {
        name: "Default value in the state destructuring",
        code: js`
        function Form({ count }) {
          const [doubleCount = 0, setDoubleCount] = useState(0);

          useEffect(() => {
            setDoubleCount(count * 2);
          }, [count]);
        }
      `,
        errors: avoidDerivedState("doubleCount"),
      },
      {
        name: "Wrapper setter that reads another state first",
        code: js`
        function Form() {
          const [firstName, setFirstName] = useState('Nick');
          const [fullName, setFullName] = useState('');

          function updateFullName() {
            const name = firstName;
            setFullName(name);
          }

          useEffect(() => {
            updateFullName();
          }, [firstName]);
        }
      `,
        errors: avoidDerivedState("fullName"),
      },
    ],
  },
);
