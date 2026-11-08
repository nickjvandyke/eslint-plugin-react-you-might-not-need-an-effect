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
  "components and custom hooks",
  noDerivedState,
  {
    valid: [],
    invalid: [
      {
        name: "Function component",
        code: js`
        function DoubleCounter() {
          const [count, setCount] = useState(0);
          const [doubleCount, setDoubleCount] = useState(0);

          useEffect(() => setDoubleCount(count * 2), [count]);
        }
      `,
        errors: 1,
      },
      {
        name: "Arrow function component",
        code: js`
        const DoubleCounter = () => {
          const [count, setCount] = useState(0);
          const [doubleCount, setDoubleCount] = useState(0);

          useEffect(() => setDoubleCount(count * 2), [count]);
        }
      `,
        errors: 1,
      },
      {
        name: "Memoized component, with props",
        code: js`
        const DoubleCounter = memo(({ count }) => {
          const [doubleCount, setDoubleCount] = useState(0);

          useEffect(() => setDoubleCount(count), [count]);
        });
      `,
        errors: avoidDerivedState("doubleCount"),
      },
      {
        name: "Custom hook with state",
        code: js`
        function useCustomHook() {
          const [count, setCount] = useState(0);
          const [doubleCount, setDoubleCount] = useState(0);

          useEffect(() => {
            setDoubleCount(count * 2);
          }, [count]);

          return state;
        }

        function Component() {
          const customState = useCustomHook();
        }
      `,
        errors: avoidDerivedState("doubleCount"),
      },
      {
        name: "FunctionDeclaration custom hook with props",
        code: js`
        function useCustomHook(prop) {
          const [state, setState] = useState(0);

          useEffect(() => {
            setState(prop);
          }, [prop]);

          return state;
        }
      `,
        errors: avoidDerivedState("state"),
      },
      {
        name: "VariableDeclarator custom hook with object props",
        code: js`
        const useCustomHook = ({ prop }) => {
          const [state, setState] = useState(0);

          useEffect(() => {
            setState(prop);
          }, [prop]);

          return state;
        }
      `,
        errors: avoidDerivedState("state"),
      },
    ],
  },
);
