import { RuleTester } from "eslint";
import plugin from "../index.ts";
const js = String.raw;

const error = (messageId, data) => [{ messageId, data }];

import rule from "./no-adjust-state-on-prop-change.ts";

new RuleTester({ ...plugin.configs.recommended, rules: {} }).run(
  "no-adjust-state-on-prop-change",
  rule,
  {
    valid: [
      {
        name: "Adjusting state directly during render",
        code: js`
        function List({ items }) {
          const [isReverse, setIsReverse] = useState(false);
          const [selection, setSelection] = useState(null);

          const [prevItems, setPrevItems] = useState(items);
          if (items !== prevItems) {
            setPrevItems(items);
            setSelection(null);
          }
        }
      `,
      },
      {
        name: "Set state to literal when internal state changes",
        code: js`
        function Counter() {
          const [count, setCount] = useState(0);
          const [otherState, setOtherState] = useState();

          useEffect(() => {
            setOtherState('Hello World');
          }, [count]);
        }
      `,
      },
      {
        // Internal state takes precedence: `no-chain-state-updates` owns
        // effects whose dependencies include internal state.
        name: "Set state to literal when internal state and a prop change",
        code: js`
        function List({ items }) {
          const [count, setCount] = useState(0);
          const [selection, setSelection] = useState();

          useEffect(() => {
            setSelection(null);
          }, [count, items]);
        }
      `,
      },
      {
        name: "Set state to a value derived from props",
        code: js`
        function Counter({ count }) {
          const [doubleCount, setDoubleCount] = useState(0);

          useEffect(() => {
            setDoubleCount(count * 2);
          }, [count]);
        }
      `,
      },
      {
        name: "Set state to a value derived from context",
        code: js`
        function Counter() {
          const count = useContext(CountContext);
          const [doubleCount, setDoubleCount] = useState(0);

          useEffect(() => {
            setDoubleCount(count * 2);
          }, [count]);
        }
      `,
      },
      {
        name: "Set state to a value derived from an external hook value",
        code: js`
        function Items() {
          const { data } = useQuery('/items');
          const [items, setItems] = useState([]);

          useEffect(() => {
            setItems(data);
          }, [data]);
        }
      `,
      },
      {
        name: "Set state inside an async function when an external hook value changes",
        code: js`
        function Items() {
          const { data } = useQuery('/items');
          const [items, setItems] = useState([]);

          useEffect(() => {
            const load = async () => {
              setItems(data);
            };
            load();
          }, [data]);
        }
      `,
      },
      {
        name: "Set ref value when an external hook value changes",
        code: js`
        function Items() {
          const { data } = useQuery('/items');
          const ref = useRef();

          useEffect(() => {
            ref.current.value = data;
          }, [data]);
        }
      `,
      },
      {
        name: "Set state to literal in a mount-only effect",
        code: js`
        function Items() {
          const [selection, setSelection] = useState(null);

          useEffect(() => {
            setSelection(null);
          }, []);
        }
      `,
      },
      {
        // `count` is read inside a call argument written to state.
        // `no-derived-state` owns this case, and this rule must not report it too.
        name: "Set state to a value derived through a call argument",
        code: js`
        function Counter({ count }) {
          const [countJson, setCountJson] = useState();

          useEffect(() => {
            setCountJson(JSON.stringify(count));
          }, [count]);
        }
      `,
      },
      {
        // A member access on a hook result is still the hook's value. The hook
        // arguments in `useQuery(id)` do not become dependencies of `data`.
        name: "Hook result member access does not expose hook arguments",
        code: js`
        function Items({ id }) {
          const data = useQuery(id).data;
          const [selection, setSelection] = useState(null);

          useEffect(() => {
            setSelection(null);
          }, [data]);
        }
      `,
      },
    ],
    invalid: [
      {
        name: "Set state to literal when prop changes",
        code: js`
        function List({ items }) {
          const [selection, setSelection] = useState();

          useEffect(() => {
            setSelection(null);
          }, [items]);
        }
      `,
        errors: error("avoidAdjustingStateWhenAValueChanges", {
          state: "selection",
          values: '"items"',
        }),
      },
      {
        name: "Set state to literal when prop changes, with cleanup",
        code: js`
        function List({ items }) {
          const [selection, setSelection] = useState();

          useEffect(() => {
            setSelection(null);

            return () => {
              console.log("cleanup");
            };
          }, [items]);
        }
      `,
        errors: error("avoidAdjustingStateWhenAValueChanges", {
          state: "selection",
          values: '"items"',
        }),
      },
      {
        name: "Set state to internal state when prop changes",
        code: js`
        function List({ items }) {
          const [selection, setSelection] = useState();
          const [internalData, setInternalData] = useState();

          useEffect(() => {
            setSelection(internalData);
          }, [items]);
        }
      `,
        errors: error("avoidAdjustingStateWhenAValueChanges", {
          state: "selection",
          values: '"items"',
        }),
      },
      {
        name: "Set state to external state when prop changes",
        code: js`
        function List({ items }) {
          const [selection, setSelection] = useState();
          const { data: externalData } = useDataSource();

          useEffect(() => {
            setSelection(externalData);
          }, [items]);
        }
      `,
        errors: error("avoidAdjustingStateWhenAValueChanges", {
          state: "selection",
          values: '"items"',
        }),
      },
      {
        name: "Conditionally set state to literal when prop changes",
        code: js`
        function Form({ result }) {
          const [error, setError] = useState();

          useEffect(() => {
            if (result.data) {
              setError(null);
            }
          }, [result]);
        }
      `,
        errors: error("avoidAdjustingStateWhenAValueChanges", {
          state: "error",
          values: '"result"',
        }),
      },
      {
        name: "Set state to literal when two props change",
        code: js`
        function List({ items, user }) {
          const [selection, setSelection] = useState();

          useEffect(() => {
            setSelection(null);
          }, [items, user]);
        }
      `,
        errors: error("avoidAdjustingStateWhenAValueChanges", {
          state: "selection",
          values: '"items" and "user"',
        }),
      },
      {
        name: "Set state to literal when context changes",
        code: js`
        function List() {
          const { items } = useContext(ListContext);
          const [selection, setSelection] = useState();

          useEffect(() => {
            setSelection(null);
          }, [items]);
        }
      `,
        errors: error("avoidAdjustingStateWhenAValueChanges", {
          state: "selection",
          values: '"items"',
        }),
      },
      {
        name: "Set state to literal when an external hook value changes",
        code: js`
        function Items() {
          const { data } = useQuery('/items');
          const [selection, setSelection] = useState(null);

          useEffect(() => {
            setSelection(null);
          }, [data]);
        }
      `,
        errors: error("avoidAdjustingStateWhenAValueChanges", {
          state: "selection",
          values: '"data"',
        }),
      },
      {
        name: "Set state to another external hook value when an external hook value changes",
        code: js`
        function Items() {
          const { data } = useQuery('/items');
          const preferred = usePreferredSelection();
          const [selection, setSelection] = useState(null);

          useEffect(() => {
            setSelection(preferred);
          }, [data]);
        }
      `,
        errors: error("avoidAdjustingStateWhenAValueChanges", {
          state: "selection",
          values: '"data"',
        }),
      },
      {
        name: "Conditionally set state to literal when an external hook value changes",
        code: js`
        function Items() {
          const { data } = useQuery('/items');
          const [selection, setSelection] = useState(null);

          useEffect(() => {
            if (data) {
              setSelection(null);
            }
          }, [data]);
        }
      `,
        errors: error("avoidAdjustingStateWhenAValueChanges", {
          state: "selection",
          values: '"data"',
        }),
      },
      {
        name: "Set state to literal when a prop and an external hook value change",
        code: js`
        function Items({ filter }) {
          const { data } = useQuery('/items');
          const [selection, setSelection] = useState(null);

          useEffect(() => {
            setSelection(null);
          }, [filter, data]);
        }
      `,
        errors: error("avoidAdjustingStateWhenAValueChanges", {
          state: "selection",
          values: '"filter" and "data"',
        }),
      },
      {
        // The unrelated call reads the dependency, but that value is not
        // written to the state. Only the setter's own arguments count.
        name: "Wrapper setter with an unrelated dependency read",
        code: js`
        function List({ items }) {
          const [selection, setSelection] = useState();

          function update() {
            console.log(items);
            setSelection(null);
          }

          useEffect(() => {
            update();
          }, [items]);
        }
      `,
        errors: error("avoidAdjustingStateWhenAValueChanges", {
          state: "selection",
          values: '"items"',
        }),
      },
      {
        name: "Reports each adjusted state update in one effect",
        code: js`
        function List({ items }) {
          const [selection, setSelection] = useState();
          const [expanded, setExpanded] = useState();

          useEffect(() => {
            setSelection(null);
            setExpanded(false);
          }, [items]);
        }
      `,
        errors: [
          {
            messageId: "avoidAdjustingStateWhenAValueChanges",
            data: { state: "selection", values: '"items"' },
          },
          {
            messageId: "avoidAdjustingStateWhenAValueChanges",
            data: { state: "expanded", values: '"items"' },
          },
        ],
      },
    ],
  },
);
