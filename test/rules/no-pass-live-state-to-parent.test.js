import { MyRuleTester, js } from "../rule-tester.js";
import rule from "../../src/rules/no-pass-live-state-to-parent.js";

new MyRuleTester().run("no-pass-live-state-to-parent", rule, {
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
      errors: [
        {
          messageId: "avoidPassingLiveStateToParentInComponent",
        },
      ],
    },
    {
      name: "Pass live internal state, no deps argument",
      code: js`
        const Child = ({ onTextChanged }) => {
          const [text, setText] = useState();

          useEffect(() => {
            onTextChanged(text);
          });

          return (
            <input
              type="text"
              onChange={(e) => setText(e.target.value)}
            />
          );
        }
      `,
      errors: [
        {
          messageId: "avoidPassingLiveStateToParentInComponent",
        },
      ],
    },
    {
      name: "Pass live internal state, empty deps",
      code: js`
        const Child = ({ onTextChanged }) => {
          const [text, setText] = useState();

          useEffect(() => {
            onTextChanged(text);
          }, []);

          return (
            <input
              type="text"
              onChange={(e) => setText(e.target.value)}
            />
          );
        }
      `,
      errors: [
        {
          messageId: "avoidPassingLiveStateToParentInComponent",
        },
      ],
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
      errors: [
        {
          messageId: "avoidPassingLiveStateToParentInHook",
        },
      ],
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

          return (
            <input
              type="text"
              onChange={(e) => setText(e.target.value)}
            />
          );
        }
      `,
      errors: [
        {
          messageId: "avoidPassingLiveStateToParentInComponent",
        },
      ],
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

          return (
            <input
              type="text"
              onChange={(e) => setText(e.target.value)}
            />
          );
        }
      `,
      errors: [
        {
          messageId: "avoidPassingLiveStateToParentInComponent",
        },
      ],
    },
    {
      name: "Pass live internal state via derived prop",
      code: js`
        const Child = ({ onFetched }) => {
          const [data, setData] = useState();
          const onFetchedWrapper = (v) => onFetched(v);

          useEffect(() => {
            onFetchedWrapper(data);
          }, [onFetched, data]);
        }
      `,
      errors: [
        {
          messageId: "avoidPassingLiveStateToParentInComponent",
        },
      ],
    },
    {
      name: "Pass live internal state via later-destructured prop",
      todo: true, // TODO: See `isEventualCallTo`
      code: js`
        const Child = (props) => {
          const [data, setData] = useState();
          const { onFetched } = props;

          useEffect(() => {
            onFetched(data);
          }, [onFetched, data]);
        }
      `,
      errors: [
        {
          messageId: "avoidPassingLiveStateToParentInComponent",
        },
      ],
    },
    {
      name: "Pass final internal state",
      code: js`
        function Form({ onSubmit }) {
          const [name, setName] = useState();
          const [dataToSubmit, setDataToSubmit] = useState();

          useEffect(() => {
            if (!dataToSubmit) return;

            onSubmit(dataToSubmit);
          }, [dataToSubmit]);

          return (
            <div>
              <input
                name="name"
                type="text"
                onChange={(e) => setName(e.target.value)}
              />
              <button onClick={() => setDataToSubmit({ name })}>Submit</button>
            </div>
          )
        }
      `,
      errors: [
        {
          messageId: "avoidPassingLiveStateToParentInComponent",
        },
      ],
    },
  ],
});
