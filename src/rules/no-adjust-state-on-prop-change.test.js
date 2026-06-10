import { RuleTester } from "eslint";
import plugin from "../../src/index.ts";
const js = String.raw;

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
        errors: [
          {
            messageId: "avoidAdjustingStateWhenAPropChanges",
            data: { state: "selection", props: '"items"' },
          },
        ],
      },
      {
        name: "Set state to internal state when prop changes",
        code: js`
        function List({ items }) {
          const [selection, setSelection] = useState();
          const [internalData, setInternalData] = useState();

          useEffect(() => {
            setSelection(internalData);
          }, [items, internalData]);
        }
      `,
        errors: [
          {
            messageId: "avoidAdjustingStateWhenAPropChanges",
            data: { state: "selection", props: '"items"' },
          },
        ],
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
        errors: [
          {
            messageId: "avoidAdjustingStateWhenAPropChanges",
            data: { state: "selection", props: '"items"' },
          },
        ],
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
        errors: [
          {
            messageId: "avoidAdjustingStateWhenAPropChanges",
            data: { state: "error", props: '"result"' },
          },
        ],
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
        errors: [
          {
            messageId: "avoidAdjustingStateWhenAPropChanges",
            data: { state: "selection", props: '"items" and "user"' },
          },
        ],
      },
    ],
  },
);
