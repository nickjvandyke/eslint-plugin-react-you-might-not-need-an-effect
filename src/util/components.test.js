import { RuleTester } from "eslint";
import plugin from "../index.ts";
import noDerivedState from "../rules/no-derived-state.ts";
import noPassLiveStateToParent from "../rules/no-pass-live-state-to-parent.ts";

const js = String.raw;

const avoidDerivedState = (state) => [
  {
    messageId: "avoidDerivedState",
    data: { state },
  },
];

const avoidPassingLiveState = (state, name) => [
  {
    messageId: "avoidPassingLiveStateToParentInComponent",
    data: { state, name },
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

new RuleTester({ ...plugin.configs.recommended, rules: {} }).run(
  "components: HOCs and function expressions",
  noPassLiveStateToParent,
  {
    valid: [
      {
        name: "Pass internal state to HOC prop",
        code: js`
        import { withRouter } from 'react-router-dom';

        const MyComponent = withRouter(({ history }) => {
          const [option, setOption] = useState();

          useEffect(() => {
            history.push(option);
          }, [option]);
        });
      `,
      },
      {
        name: "Pass internal state to weird HOC prop",
        code: js`
        const MyComponent = inject('ourStore')(observer(({ ourStore }) => {
          const [option, setOption] = useState();

          useEffect(() => {
            ourStore.push(option);
          }, [option]);
        }));
      `,
      },
      {
        name: "Pass internal state to separately-wrapped HOC prop",
        code: js`
        import { withRouter } from 'react-router-dom';

        const MyComponent = ({ history }) => {
          const [option, setOption] = useState();

          useEffect(() => {
            history.push(option);
          }, [option]);
        };

        const wrapped = withRouter(MyComponent);
      `,
      },
      {
        // https://github.com/nickjvandyke/eslint-plugin-react-you-might-not-need-an-effect/issues/46
        name: "Pass internal state to weirdly-separately-wrapped HOC prop",
        code: js`
        import { withRouter } from 'react-router-dom';

        const MyComponent = ({ history }) => {
          const [option, setOption] = useState();

          useEffect(() => {
            history.push(option);
          }, [option]);
        };

        const EnhancedComponent = inject('ourStore')(observer(MyComponent))
        export default EnhancedComponent
      `,
      },
      {
        name: "Pass external state to HOC prop",
        code: js`
        import { withRouter } from 'react-router-dom';

        const MyComponent = withRouter(({ history }) => {
          const data = useSomeAPI();

          useEffect(() => {
            if (data.error) {
              history.push(data.error);
            }
          }, [data]);
        });
      `,
      },
    ],
    invalid: [
      {
        name: "Pass live internal state from a function-expression component",
        code: js`
        const Child = function ({ onFetched }) {
          const [data, setData] = useState();

          useEffect(() => {
            onFetched(data);
          }, [onFetched, data]);
        }
      `,
        errors: avoidPassingLiveState('"data"', '"Child"'),
      },
      {
        name: "Pass live internal state from a memoized function-expression component",
        code: js`
        const Child = memo(function ({ onFetched }) {
          const [data, setData] = useState();

          useEffect(() => {
            onFetched(data);
          }, [onFetched, data]);
        })
      `,
        errors: avoidPassingLiveState('"data"', '"Child"'),
      },
    ],
  },
);
