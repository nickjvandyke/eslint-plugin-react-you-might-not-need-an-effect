import { RuleTester } from "eslint";
import plugin from "../../src/index.ts";
const js = String.raw;

import rule from "./no-derived-state.ts";

new RuleTester({ ...plugin.configs.recommended, rules: {} }).run(
  "no-derived-state",
  rule,
  {
    valid: [
      {
        name: "Compute in render from internal state",
        code: js`
        function Form() {
          const [firstName, setFirstName] = useState('Taylor');
          const [lastName, setLastName] = useState('Swift');

          const fullName = firstName + ' ' + lastName;
        }
      `,
      },
      {
        name: "Compute in render from props",
        code: js`
        function Form({ firstName, lastName }) {
          const fullName = firstName + ' ' + lastName;
        }
      `,
      },
      {
        name: "Set to literal on external state change",
        code: js`
        function Feed() {
          const { data: posts } = useQuery('/posts');
          const [scrollPosition, setScrollPosition] = useState(0);

          useEffect(() => {
            setScrollPosition(0);
          }, [posts]);
        }
      `,
      },
      {
        name: "Set to derived literal on external state change",
        code: js`
        function Feed() {
          const { data: posts } = useQuery('/posts');
          const [scrollPosition, setScrollPosition] = useState(0);

          useEffect(() => {
            const initialPosition = 0;
            setScrollPosition(initialPosition);
          }, [posts]);
        }
      `,
      },
      {
        name: "Set to external state",
        code: js`
        function Feed() {
          const { data: posts } = useQuery('/posts');
          const [selectedPost, setSelectedPost] = useState();

          useEffect(() => {
            setSelectedPost(posts[0]);
          }, [posts]);
        }
      `,
      },
      {
        name: "Fetch external state on mount",
        code: js`
        function Todos() {
          const [todos, setTodos] = useState([]);

          useEffect(() => {
            fetch('/todos').then((todos) => {
              setTodos(todos);
            });
          }, []);
        }
      `,
      },
      {
        name: "Sync external state",
        code: js`
        function Search() {
          const [query, setQuery] = useState();
          const [results, setResults] = useState();

          useEffect(() => {
            fetch('/search?query=' + query).then((data) => {
              setResults(data);
            });
          }, [query]);

          return (
            <div>
              <input
                name="query"
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              <ul>
                {results.map((result) => (
                  <li key={result.id}>{result.title}</li>
                ))}
              </ul>
            </div>
          )
        }
      `,
      },
      {
        // https://github.com/nickjvandyke/eslint-plugin-react-you-might-not-need-an-effect/issues/35
        // While it *could* be an anti-pattern or unnecessary, effects *are* meant to synchronize systems.
        // So we guess that a "subscription effect" is usually valid, or may be more readable.
        name: "Synchronize internal state",
        code: js`
        function Component() {
          const [name, setName] = useState();
          const [model] = useState(
            () => new FormModel(props)
          );

          useEffect(() => {
            model.setFieldDescriptor(name);
            return () => model.removeField(name);
          }, [model, name]);
        }
      `,
      },
      {
        name: "Subscribe to external state",
        code: js`
        import { subscribeToStatus } from 'library';

        function Status({ topic }) {
          const [status, setStatus] = useState();

          useEffect(() => {
            const unsubscribe = subscribeToStatus(topic, (status) => {
              setStatus(status);
            });

            return () => unsubscribe();
          }, [topic]);

          return <div>{status}</div>;
        }
      `,
      },
      {
        name: "From props via impure derived setter",
        code: js`
        function DoubleCounter({ count }) {
          const [doubleCount, setDoubleCount] = useState(0);

          const derivedSetter = () => {
            const multipler = fetch('/multipler');
            setDoubleCount(multiplier);
          }

          useEffect(() => {
            derivedSetter();
          }, [count]);
        }
      `,
      },
      {
        name: "Via impure promise global function",
        code: js`
        function Counter({ count }) {
          const [multipliedCount, setMultipliedCount] = useState();

          useEffect(() => {
            fetch('/multiplier')
              .then((res) => res.json())
              .then((multiplier) => setMultipliedCount(count * multiplier));
          }, [count]);
        }
      `,
      },
      {
        name: "Mutate internal state",
        code: js`
        function DoubleList() {
          const [list, setList] = useState([]);
          const [doubleList, setDoubleList] = useState([]);

          useEffect(() => {
            doubleList.push(...list);
          }, [list]);
        }
      `,
      },
      {
        name: "Synchronous setter in anonymous callback",
        code: js`
          function useHasOverflow({ contentRef, maxHeight }) {
            const [hasOverflow, setHasOverflow] = useState(false);

            useEffect(() => {
              const resizeObserver = createResizeObserver((element) => {
                const hasContentOverflow = element.scrollHeight > maxHeight;
                setHasOverflow(hasContentOverflow);
              })

              resizeObserver.observe(contentRef.current);
            }, [contentRef, maxHeight]);

            return hasOverflow;
          }
        `,
      },
      // False negatives from ignoring CallExpression arguments — the rule no longer traces state through fn args
      // {
      //   // TODO:
      //   name: "Pass state to derived setter which ignores args",
      //   code: js`
      //   function Form() {
      //     const [firstName, setFirstName] = useState('Dwayne');
      //     const [lastName, setLastName] = useState('The Rock');
      //     const [fullName, setFullName] = useState('');
      //
      //     const setDerivedFullName = (firstName, lastName) => {
      //       setFullName("Sparky");
      //     }
      //
      //     useEffect(() => {
      //       setDerivedFullName(firstName, lastName);
      //     }, [firstName, lastName]);
      //   }
      // `,
      // },
    ],
    invalid: [
      {
        name: "From internal state",
        code: js`
        function Form() {
          const [firstName, setFirstName] = useState('Taylor');
          const [lastName, setLastName] = useState('Swift');

          const [fullName, setFullName] = useState('');
          useEffect(() => setFullName(firstName + ' ' + lastName), [firstName, lastName]);
        }
      `,
        errors: [
          {
            messageId: "avoidDerivedState",
            data: { state: "fullName" },
          },
        ],
      },
      {
        name: "From derived internal state",
        code: js`
        function Form() {
          const [firstName, setFirstName] = useState('Taylor');
          const [lastName, setLastName] = useState('Swift');
          const [fullName, setFullName] = useState('');

          useEffect(() => {
            const name = firstName + ' ' + lastName;
            setFullName(name) 
          }, [firstName, lastName]);
        }
      `,
        errors: [
          {
            messageId: "avoidDerivedState",
            data: { state: "fullName" },
          },
        ],
      },
      {
        name: "From derived internal state outside effect",
        code: js`
        function Form() {
          const [firstName, setFirstName] = useState('Taylor');
          const [lastName, setLastName] = useState('Swift');
          const [fullName, setFullName] = useState('');
          const name = firstName + ' ' + lastName;

          useEffect(() => {
            setFullName(name) 
          }, [name]);
        }
      `,
        errors: [
          {
            messageId: "avoidDerivedState",
            data: { state: "fullName" },
          },
        ],
      },
      {
        name: "From internal state and external state",
        code: js`
        import { usePrefix } from 'library';

        function Component() {
          const [name, setName] = useState();
          const [prefixedName, setPrefixedName] = useState();
          const prefix = usePrefix(name);

          useEffect(() => {
            const newValue = prefix + name;
            setPrefixedName(newValue);
          }, [prefix, name])
        }
      `,
        errors: [
          {
            messageId: "avoidDerivedState",
            data: { state: "prefixedName" },
          },
        ],
      },
      {
        name: "From props",
        code: js`
        function Form({ firstName, lastName }) {
          const [fullName, setFullName] = useState('');

          useEffect(() => {
            setFullName(firstName + ' ' + lastName);
          }, [firstName, lastName]);
        }
      `,
        errors: [
          {
            messageId: "avoidDerivedState",
            data: { state: "fullName" },
          },
        ],
      },
      {
        name: "From intermediate prop",
        code: js`
        function Form({ firstName, lastName }) {
          const [fullName, setFullName] = useState('');
          const prefixedName = 'Dr. ' + firstName;

          useEffect(() => {
            setFullName(prefixedName + ' ' + lastName);
          }, [prefixedName, lastName]);
        }
      `,
        errors: [
          {
            messageId: "avoidDerivedState",
            data: { state: "fullName" },
          },
        ],
      },
      {
        name: "From props via method",
        code: js`
        function DoubleList({ list }) {
          const [doubleList, setDoubleList] = useState([]);

          useEffect(() => {
            setDoubleList(list.concat(list));
          }, [list]);
        }
      `,
        errors: [
          {
            messageId: "avoidDerivedState",
            data: { state: "doubleList" },
          },
        ],
      },
      {
        name: "From internal state via method",
        code: js`
        function DoubleList() {
          const [list, setList] = useState([]);
          const [doubleList, setDoubleList] = useState([]);

          useEffect(() => {
            setDoubleList(list.concat(list));
          }, [list]);
        }
      `,
        errors: [
          {
            messageId: "avoidDerivedState",
            data: { state: "doubleList" },
          },
        ],
      },
      {
        // Verifies that we don't check for upstream state and props in isolation
        name: "From props and internal state",
        code: js`
        function Form({ title }) {
          const [name, setName] = useState('Dwayne');
          const [fullName, setFullName] = useState('');

          useEffect(() => {
            setFullName(title + ' ' + name);
          }, [title, name]);
        }
      `,
        errors: [
          {
            messageId: "avoidDerivedState",
            data: { state: "fullName" },
          },
        ],
      },
      {
        name: "From props and internal state via intermediate variable",
        code: js`
        function Form({ title }) {
          const [name, setName] = useState('Dwayne');
          const [fullName, setFullName] = useState('');

          useEffect(() => {
            const newFullName = title + ' ' + name;
            setFullName(newFullName);
          }, [title, name]);
        }
      `,
        errors: [
          {
            messageId: "avoidDerivedState",
            data: { state: "fullName" },
          },
        ],
      },
      {
        name: "From internal plus external state",
        code: js`
        function Form() {
          const prefix = useQuery('/prefix');
          const [name, setName] = useState();
          const [prefixedName, setPrefixedName] = useState();

          useEffect(() => {
            setPrefixedName(prefix + name)
          }, [prefix, name]);
        }
      `,
        errors: [
          {
            messageId: "avoidDerivedState",
            data: { state: "prefixedName" },
          },
        ],
      },
      {
        name: "From props via callback setter",
        code: js`
        import { useState, useEffect } from 'react';

        function CountAccumulator({ count }) {
          const [total, setTotal] = useState(count);

          useEffect(() => {
            setTotal((prev) => prev + count);
          }, [count]);
        }
      `,
        errors: [
          {
            messageId: "avoidDerivedState",
            data: { state: "total" },
          },
        ],
      },
      {
        name: "From props via pure derived setter",
        code: js`
        function DoubleCounter({ count }) {
          const [doubleCount, setDoubleCount] = useState(0);

          const derivedSetter = (count) => setDoubleCount(count * 2);

          useEffect(() => {
            derivedSetter(count);
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
        name: "Partially update complex state from props",
        code: js`
        function Form({ firstName, lastName }) {
          const [formData, setFormData] = useState({
            title: 'Dr.',
            fullName: '',
          });

          useEffect(() => {
            setFormData({
              ...formData,
              fullName: firstName + ' ' + lastName,
            });
          }, [firstName, lastName, formData]);
        }
      `,
        errors: [
          {
            messageId: "avoidDerivedState",
            data: { state: "formData" },
          },
        ],
      },
      {
        name: "Partially update complex state from props via callback setter",
        code: js`
        function Form({ firstName, lastName }) {
          const [formData, setFormData] = useState({
            title: 'Dr.',
            fullName: '',
          });

          useEffect(() => {
            setFormData((prev) => ({
              ...prev,
              fullName: firstName + ' ' + lastName,
            }));
          }, [firstName, lastName]);
        }
      `,
        errors: [
          {
            messageId: "avoidDerivedState",
            data: { state: "formData" },
          },
        ],
      },
      {
        name: "Partially update complex state from props via derived setter",
        code: js`
        function Form({ firstName, lastName }) {
          const [formData, setFormData] = useState({
            title: 'Dr.',
            fullName: '',
          });

          const setFullName = (fullName) => setFormData({ ...formData, fullName });

          useEffect(() => {
            setFormData({
              ...formData,
              fullName: firstName + ' ' + lastName,
            });
          }, [firstName, lastName, formData]);
        }
      `,
        errors: [
          {
            messageId: "avoidDerivedState",
            data: { state: "formData" },
          },
        ],
      },
      {
        name: "Derived state in larger, otherwise legit effect",
        code: js`
        function Form() {
          const [firstName, setFirstName] = useState('Taylor');
          const [lastName, setLastName] = useState('Swift');
          const [fullName, setFullName] = useState('');

          useEffect(() => {
            console.log(name);

            setFullName(firstName + ' ' + lastName);
          }, [firstName, lastName]);
        }
      `,
        errors: [
          {
            messageId: "avoidDerivedState",
            data: { state: "fullName" },
          },
        ],
      },
      {
        // It's not technically a pure function since it closes over state,
        // but it's pure relative to the React component.
        name: "Set to result of semi-pure local ArrowFunctionExpression",
        code: js`
        function Form() {
          const [firstName, setFirstName] = useState('Dwayne');
          const [lastName, setLastName] = useState('The Rock');
          const [fullName, setFullName] = useState('');

          useEffect(() => {
            const computeName = () => firstName + ' ' + lastName;

            setFullName(computeName());
          }, [firstName, lastName]);
        }
      `,
        errors: [
          {
            messageId: "avoidDerivedState",
            data: { state: "fullName" },
          },
        ],
      },
      {
        name: "Set to result of semi-pure local FunctionDeclaration",
        code: js`
        function Form() {
          const [firstName, setFirstName] = useState('Dwayne');
          const [lastName, setLastName] = useState('The Rock');
          const [fullName, setFullName] = useState('');

          useEffect(() => {
            function computeName() {
              return firstName + ' ' + lastName;
            }

            setFullName(computeName());
          }, [firstName, lastName]);
        }
      `,
        errors: [
          {
            messageId: "avoidDerivedState",
            data: { state: "fullName" },
          },
        ],
      },
      {
        name: "Set to result of semi-pure function defined outside effect",
        code: js`
        function Form() {
          const [firstName, setFirstName] = useState('Dwayne');
          const [lastName, setLastName] = useState('The Rock');
          const [fullName, setFullName] = useState('');

          const computeName = () => firstName + ' ' + lastName;

          useEffect(() => {
            setFullName(computeName());
          }, [computeName]);
        }
      `,
        errors: [
          {
            messageId: "avoidDerivedState",
            data: { state: "fullName" },
          },
        ],
      },
      {
        name: "Via no-arg intermediate setter",
        code: js`
        function Form() {
          const [firstName, setFirstName] = useState('Dwayne');
          const [lastName, setLastName] = useState('The Rock');
          const [fullName, setFullName] = useState('');

          useEffect(() => {
            const doSet = () => {
              setFullName(firstName + ' ' + lastName);
            }

            doSet();
          }, [firstName, lastName]);
        }
      `,
        errors: [
          {
            messageId: "avoidDerivedState",
            data: { state: "fullName" },
          },
        ],
      },
    ],
  },
);
