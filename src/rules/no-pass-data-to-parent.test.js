import { RuleTester } from "eslint";
import plugin from "../index.ts";
const js = String.raw;

const error = (messageId, data) => [{ messageId, data }];

import rule from "./no-pass-data-to-parent.ts";

new RuleTester({ ...plugin.configs.recommended, rules: {} }).run(
  "no-pass-data-to-parent",
  rule,
  {
    valid: [
      {
        name: "Pass literal value",
        code: js`
        const Child = ({ onTextChanged }) => {
          useEffect(() => {
            onTextChanged("Hello World");
          }, [onTextChanged]);
        }
      `,
      },
      {
        name: "Pass derived literal value",
        code: js`
        const Child = ({ onTextChanged }) => {
          const hello = "Hello";
          const world = "World";
          const greeting = hello + " " + world;
          useEffect(() => {
            onTextChanged(greeting);
          }, [onTextChanged]);
        }
      `,
      },
      {
        name: "Pass internal state",
        code: js`
        const Child = ({ onTextChanged }) => {
          const [text, setText] = useState();

          useEffect(() => {
            onTextChanged(text);
          }, [onTextChanged, text]);

          return (
            <input
              type="text"
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
          );
        }
      `,
      },
      {
        name: "Pass prop",
        code: js`
        const Child = ({ text, onTextChanged }) => {
          useEffect(() => {
            onTextChanged(text);
          }, [onTextChanged, text]);

          return (
            <input
              type="text"
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
          );
        }
      `,
      },
      {
        name: "Pass context value",
        code: js`
        const Child = ({ onTextChanged }) => {
          const text = useContext(TextContext);

          useEffect(() => {
            onTextChanged(text);
          }, [onTextChanged, text]);
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
        // https://github.com/nickjvandyke/eslint-plugin-react-you-might-not-need-an-effect/issues/37
        // Alternate solutions exist, but this is arguably the most readable.
        name: "Pass cleanup function that depends on ref",
        code: js`
        import { dropTargetForElements } from "@atlaskit/pragmatic-drag-and-drop/element/adapter";

        function DeleteDropTarget({ onDelete }) {
          const ref = React.useRef(null);

          React.useEffect(() => {
            const element = ref.current;
            if (!element) {
              return;
            }

            const cleanup = dropTargetForElements({
              element,
              onDrop: ({ source }) => {
                onDelete(source.data);
              },
            });

            return cleanup;
          }, [onDelete]);

          return <div ref={ref}>Drop an item here to delete</div>;
        };
      `,
      },
      {
        // https://github.com/nickjvandyke/eslint-plugin-react-you-might-not-need-an-effect/issues/43
        name: "Effect inside custom hook returns MemberExpression cleanup",
        code: js`
        function useActorLogger(actorRef) {
          useEffect(() => {
            return actorRef.system.inspect((next) => {
              if (next.type === '@xstate.snapshot') {
                console.log('ACTOR SNAPSHOT', next.snapshot);
              }
            }).unsubscribe;
          }, [actorRef]);
        }
      `,
      },
      {
        name: "Pass window event data to parent",
        code: js`
        const Child = ({ onResized }) => {
          useEffect(() => {
            window.addEventListener('resize', (event) => {
              onResized({
                width: window.innerWidth,
                height: window.innerHeight,
              });
            });
            return () => window.removeEventListener('resize', handleResize);
          }, [onResized]);
        }
      `,
      },
    ],
    invalid: [
      {
        name: "Pass external state",
        code: js`
        const Child = ({ onFetched }) => {
          const data = useSomeAPI();

          useEffect(() => {
            onFetched(data);
          }, [onFetched, data]);
        }
      `,
        errors: error("avoidPassingDataToParentInComponent", {
          data: '"useSomeAPI"',
          name: '"Child"',
        }),
      },
      {
        // `messageId` + `data` renders the same template in the test and the
        // rule, so only a literal message catches duplicated quotes.
        name: "Message quotes each interpolated name exactly once",
        code: js`
        const Child = ({ onData }) => {
          const value = useFetch();

          useEffect(() => {
            onData(value);
          }, [onData, value]);
        }
      `,
        errors: [
          {
            message:
              'Avoid passing data to parents in an effect. Instead, fetch "useFetch" in the parent and pass it down to "Child" as a prop.',
          },
        ],
      },
      {
        name: "Pass external state, empty deps",
        code: js`
        const Child = ({ onFetched }) => {
          const data = useSomeAPI();

          useEffect(() => {
            onFetched(data);
          }, []);
        }
      `,
        errors: error("avoidPassingDataToParentInComponent", {
          data: '"useSomeAPI"',
          name: '"Child"',
        }),
      },
      {
        name: "Pass external state in custom hook",
        code: js`
        const useCustomHook = ({ onFetched }) => {
          const data = useSomeAPI();

          useEffect(() => {
            onFetched(data);
          }, [onFetched, data]);
        }
      `,
        errors: error("avoidPassingDataToParentInHook", {
          data: '"useSomeAPI"',
          name: '"useCustomHook"',
        }),
      },
      {
        name: "Pass derived external state",
        code: js`
        const Child = ({ onFetched }) => {
          const data = useSomeAPI();
          const firstElement = data[0];

          useEffect(() => {
            onFetched(firstElement);
          }, [onFetched, firstElement]);
        }
      `,
        errors: error("avoidPassingDataToParentInComponent", {
          data: '"useSomeAPI"',
          name: '"Child"',
        }),
      },
      {
        name: "Pass multiple external state",
        code: js`
        const Child = ({ onResult }) => {
          const data = useSomeAPI();
          const meta = useOtherAPI();

          useEffect(() => {
            onResult(data, meta);
          }, [onResult, data, meta]);
        }
      `,
        errors: [
          {
            message:
              'Avoid passing data to parents in an effect. Instead, fetch "useSomeAPI" and "useOtherAPI" in the parent and pass it down to "Child" as a prop.',
          },
        ],
      },
      {
        name: "Pass external data and internal state (only data in message)",
        code: js`
        const Child = ({ onChanged }) => {
          const [count, setCount] = useState(0);
          const data = useSomeAPI();

          useEffect(() => {
            onChanged(data, count);
          }, [onChanged, data, count]);
        }
      `,
        errors: error("avoidPassingDataToParentInComponent", {
          data: '"useSomeAPI"',
          name: '"Child"',
        }),
      },
      {
        name: "Pass external state via context callback",
        code: js`
        const Child = () => {
          const { onFetched } = useContext(ChildContext);
          const data = useSomeAPI();

          useEffect(() => {
            onFetched(data);
          }, [onFetched, data]);
        }
      `,
        errors: error("avoidPassingDataToParentInComponent", {
          data: '"useSomeAPI"',
          name: '"Child"',
        }),
      },
    ],
  },
);
