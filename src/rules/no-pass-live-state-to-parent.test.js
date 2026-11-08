import { RuleTester } from "eslint";
import plugin from "../index.ts";
const js = String.raw;

const error = (messageId, data) => [{ messageId, data }];

import rule from "./no-pass-live-state-to-parent.ts";

new RuleTester({ ...plugin.configs.recommended, rules: {} }).run(
  "no-pass-live-state-to-parent",
  rule,
  {
    valid: [
      {
        name: "Pass literal value to prop callback",
        code: js`
        const Child = ({ onTextChanged }) => {
          useEffect(() => {
            onTextChanged("Hello World");
          }, [onTextChanged]);
        }
      `,
      },
      {
        name: "Pass live external state",
        code: js`
        const Child = ({ onFetched }) => {
          const data = useSomeAPI();

          useEffect(() => {
            onFetched(data);
          }, [onFetched, data]);
        }
      `,
      },
      {
        // No idea why someone would do this, but maybe there's a less contrived pattern.
        // Plus the rule's message and linked docs only mention state - obviously you can't "lift" a prop.
        name: "Pass prop to parent",
        code: js`
        const Child = ({ text, onTextChanged }) => {
          useEffect(() => {
            onTextChanged(text);
          }, [text, onTextChanged]);
        }
      `,
      },
      {
        // Context values are owned by an ancestor, just like props.
        name: "Pass context value to parent",
        code: js`
        const Child = ({ onTextChanged }) => {
          const text = useContext(TextContext);

          useEffect(() => {
            onTextChanged(text);
          }, [text, onTextChanged]);
        }
      `,
      },
      {
        name: "No-arg prop callback",
        code: js`
        function Form({ onClose }) {
          const [name, setName] = useState();
          const [isOpen, setIsOpen] = useState(true);

          useEffect(() => {
            if (!isOpen) {
              onClose();
            }
          }, [isOpen]);

          return (
            <button onClick={() => setIsOpen(false)}>Close</button>
          )
        }
      `,
      },
      {
        // This might be an anti-pattern in the first place...
        name: "Prop getter",
        code: js`
        function Child({ getData }) {
          useEffect(() => {
            console.log(getData());
          }, [getData]);
        }
      `,
      },
      {
        name: "Pass ref to parent",
        code: js`
        const Child = ({ onRef }) => {
          const ref = useRef();

          useEffect(() => {
            onRef(ref.current);
          }, [onRef, ref.current]);

          return <div ref={ref}>Child</div>;
        }
      `,
      },
    ],
    invalid: [
      {
        name: "Pass live internal state",
        code: js`
        const Child = ({ onTextChanged }) => {
          const [text, setText] = useState();

          useEffect(() => {
            onTextChanged(text);
          }, [onTextChanged, text]);

          return (
            <input
              type="text"
              onChange={(e) => setText(e.target.value)}
            />
          );
        }
      `,
        errors: error("avoidPassingLiveStateToParentInComponent", {
          state: '"text"',
          name: '"Child"',
        }),
      },
      {
        name: "Pass live internal state, empty deps",
        code: js`
        const Child = ({ onTextChanged }) => {
          const [text, setText] = useState();

          useEffect(() => {
            onTextChanged(text);
          }, []);
        }
      `,
        errors: error("avoidPassingLiveStateToParentInComponent", {
          state: '"text"',
          name: '"Child"',
        }),
      },
      {
        name: "Pass live derived internal state in custom hook",
        code: js`
        const useCustomHook = ({ onTextChanged }) => {
          const [text, setText] = useState();

          useEffect(() => {
            onTextChanged(text);
          }, [onTextChanged, text]);
        }
      `,
        errors: error("avoidPassingLiveStateToParentInHook", {
          state: '"text"',
          name: '"useCustomHook"',
        }),
      },
      {
        name: "Pass live internal state AND external state",
        code: js`
        const Child = ({ onTextChanged }) => {
          const [text, setText] = useState();
          const data = useSomeAPI();

          useEffect(() => {
            onTextChanged(text, data);
          }, [onTextChanged, text, data]);
        }
      `,
        errors: error("avoidPassingLiveStateToParentInComponent", {
          state: '"text"',
          name: '"Child"',
        }),
      },
      {
        name: "Pass live derived internal state",
        code: js`
        const Child = ({ onTextChanged }) => {
          const [text, setText] = useState();

          useEffect(() => {
            const firstChar = text[0];
            onTextChanged(firstChar);
          }, [onTextChanged, text]);
        }
      `,
        errors: error("avoidPassingLiveStateToParentInComponent", {
          state: '"text"',
          name: '"Child"',
        }),
      },
      {
        name: "Pass final internal state",
        code: js`
        function Form({ onSubmit }) {
          const [dataToSubmit, setDataToSubmit] = useState();

          useEffect(() => {
            if (!dataToSubmit) return;

            onSubmit(dataToSubmit);
          }, [dataToSubmit]);
        }
      `,
        errors: error("avoidPassingLiveStateToParentInComponent", {
          state: '"dataToSubmit"',
          name: '"Form"',
        }),
      },
      {
        name: "Pass multiple live internal state",
        code: js`
        const Child = ({ onChanged }) => {
          const [text, setText] = useState();
          const [count, setCount] = useState(0);

          useEffect(() => {
            onChanged(text, count);
          }, [onChanged, text, count]);
        }
      `,
        errors: [
          {
            message:
              'Avoid passing live state to parents in an effect. Instead, lift "text" and "count" to the parent and pass it down to "Child" as a prop.',
          },
        ],
      },
      {
        name: "Pass live internal state via context callback",
        code: js`
        const Child = () => {
          const { onTextChanged } = useContext(ChildContext);
          const [text, setText] = useState();

          useEffect(() => {
            onTextChanged(text);
          }, [onTextChanged, text]);
        }
      `,
        errors: error("avoidPassingLiveStateToParentInComponent", {
          state: '"text"',
          name: '"Child"',
        }),
      },
      {
        // `messageId` + `data` renders the same template in the test and the
        // rule, so only a literal message catches duplicated quotes.
        name: "Message quotes each interpolated name exactly once",
        code: js`
        const Child = ({ onData }) => {
          const [value, setValue] = useState();

          useEffect(() => {
            onData(value);
          }, [onData, value]);
        }
      `,
        errors: [
          {
            message:
              'Avoid passing live state to parents in an effect. Instead, lift "value" to the parent and pass it down to "Child" as a prop.',
          },
        ],
      },
      {
        name: "Message quotes each interpolated name exactly once in custom hook",
        code: js`
        const useCustom = ({ onData }) => {
          const [value, setValue] = useState();

          useEffect(() => {
            onData(value);
          }, [onData, value]);
        }
      `,
        errors: [
          {
            message:
              'Avoid passing live state to parents in an effect. Instead, return "value" from "useCustom".',
          },
        ],
      },
    ],
  },
);
