import { MyRuleTester, js } from "../rule-tester.js";
import rule from "../../src/rules/no-derived-state.js";

new MyRuleTester().run("no-derived-state", rule, {
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
      name: "Set to external state, with multiple setter calls",
      code: js`
        function Feed() {
          const { data: posts } = useQuery('/posts');
          const [selectedPost, setSelectedPost] = useState();

          useEffect(() => {
            setSelectedPost(posts[0]);
          }, [posts]);

          return (
            <div>
              {posts.map((post) => (
                <div key={post.id} onClick={() => setSelectedPost(post)}>
                  {post.title}
                </div>
              ))}
            </div>
          )
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
      name: "From derived external state with multiple calls to setter",
      code: js`
        function Form() {
          const name = useQuery('/name');
          const [fullName, setFullName] = useState('');

          useEffect(() => {
            const prefixedName = 'Dr. ' + name;
            setFullName(prefixedName) 
          }, [name]);

          return (
            <input
              name="fullName"
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />
          )
        }
      `,
    },
    {
      name: "From props via unpure derived setter",
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
      name: "Via unpure promise global function",
      code: js`
        function Counter({ count }) {
          const [multipliedCount, setMultipliedCount] = useState();

          useEffect(() => {
            fetch('/multiplier')
              .then((res) => res.json())
              .then((multiplier) => setMultipliedCount(count * multiplier));
          }, [count]);

          return (
            // So single-setter doesn't trigger
            <button onClick={() => setMultipliedCount(0)}>reset</button>
          )
        }
      `,
      errors: [
        {
          messageId: "avoidDerivedState",
          data: { state: "multipliedCount" },
        },
      ],
    },
    // TODO: Maybe move some of these to/from `syntax.test.js`
    {
      // https://github.com/nickjvandyke/eslint-plugin-react-you-might-not-need-an-effect/issues/35
      name: "Defined-then-called async external global function",
      code: js`
        function Component() {
          const api = useFetchWrapper();
          const [state, setState] = useState();

          useEffect(() => {
            async function fetchIt() {
              const response = await fetch('/endpoint');
              setState(response);
            }

            void fetchIt();
          }, []);
        }
      `,
    },
    {
      // https://github.com/nickjvandyke/eslint-plugin-react-you-might-not-need-an-effect/issues/35
      // For "always in sync" detection
      name: "Defined-then-called async function from API in deps",
      code: js`
        function Component() {
          const api = useFetchWrapper();
          const [state, setState] = useState();

          useEffect(() => {
            async function fetchIt() {
              const response = await api.doFetch('/endpoint');
              setState(response);
            }

            void fetchIt();
          }, [api]);
        }
      `,
    },
    {
      name: "From external data retrieved in async IIFE with API in deps",
      code: js`
        function Component() {
          const api = useFetchWrapper();
          const [state, setState] = useState();

          useEffect(() => {
            (async function fetchIt() {
              const response = await api.doFetch('/endpoint');
              setState(response);
            })();
          }, [api]);
        }
      `,
    },
    {
      // https://github.com/nickjvandyke/eslint-plugin-react-you-might-not-need-an-effect/issues/16
      name: "From external data retrieved in overly-complicated async IIFE",
      code: js`
        import { useEffect, useState } from 'react';

        export const App = () => {
          const [response, setResponse] = useState(null);

          const fetchYesNoApi = () => {
            return (async () => {
              try {
                const response = await fetch('https://yesno.wtf/api');
                if (!response.ok) {
                  throw new Error('Network error');
                }
                const data = await response.json();
                setResponse(data);
              } catch (err) {
                console.error(err);
              }
            })();
          };

          useEffect(() => { 
            (async () => {
              await fetchYesNoApi();
            })();
          }, []);

          return (
            <div>{response}</div>
          );
        };
      `,
    },
    {
      name: "Named function passed to event callback",
      code: js`
        function Component() {
          const [count, setCount] = useState(0);
          const [doubleCount, setDoubleCount] = useState(0);

          useEffect(() => {
            function handleClick() {
              setDoubleCount(count * 2);
            }

            document.addEventListener('click', handleClick);
            return () => document.removeEventListener('click', handleClick);
          }, [count]);
        }
      `,
    },
    {
      name: "Pass internal args to external local function",
      code: js`
        function Form() {
          const [firstName, setFirstName] = useState('Dwayne');
          const [lastName, setLastName] = useState('The Rock');
          const [fullName, setFullName] = useState('');

          const doSet = (arg1, arg2) => {
            console.log(arg1, arg2);
          }

          useEffect(() => {
            doSet(firstName, lastName);
          }, [firstName, lastName]);
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
      name: "Synchronous setter in anonymous function passed to constructor",
      // TODO: Because we get all of the refs in `resizeObserver`'s def at once,
      // and can't short-circuit traversing the anonymous function.
      // Whereas with named functions, we see the argument ref is not a call expression, so don't traverse it.
      code: js`
          function useHasOverflow({ contentRef, maxHeight }) {
            const [hasOverflow, setHasOverflow] = useState(false);

            useEffect(() => {
              const resizeObserver = new ResizeObserver((element) => {
                const hasContentOverflow = element.scrollHeight > maxHeight;
                setHasOverflow(hasContentOverflow);
              })

              resizeObserver.observe(contentRef.current);
              // In real-world, this effect would need a cleanup function that calls resizeObserver.disconnect.
              // So, not the most realistic example. But the concept holds.
            }, [contentRef, maxHeight]);

            return hasOverflow;
          }
        `,
    },
    {
      name: "Synchronous setter in anonymous function passed to call expression",
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
    {
      name: "Synchronous setter in named function passed to constructor",
      code: js`
          function useHasOverflow({ contentRef, maxHeight }) {
            const [hasOverflow, setHasOverflow] = useState(false);

            useEffect(() => {
              const fn = (element) => {
                const hasContentOverflow = element.scrollHeight > maxHeight;
                setHasOverflow(hasContentOverflow);
              }
              const resizeObserver = new ResizeObserver(fn)

              resizeObserver.observe(contentRef.current);
            }, [contentRef, maxHeight]);

            return hasOverflow;
          }
        `,
    },
    {
      name: "Synchronous setter in named function passed to call expression",
      code: js`
          function useHasOverflow({ contentRef, maxHeight }) {
            const [hasOverflow, setHasOverflow] = useState(false);

            useEffect(() => {
              const fn = (element) => {
                const hasContentOverflow = element.scrollHeight > maxHeight;
                setHasOverflow(hasContentOverflow);
              }
              const resizeObserver = createResizeObserver(fn)

              resizeObserver.observe(contentRef.current);
            }, [contentRef, maxHeight]);

            return hasOverflow;
          }
        `,
    },
    // False negatives from ignoring CallExpression arguments — the rule no longer traces state through fn args
    {
      name: "From internal state via pure global function",
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
      name: "From internal state via local unpure function",
      code: js`
        function Form() {
          const [firstName, setFirstName] = useState('Dwayne');
          const [lastName, setLastName] = useState('The Rock');
          const [fullName, setFullName] = useState('');

          function computeName(firstName, lastName) {
            console.log('meow');
            return firstName + ' ' + lastName;
          }

          useEffect(() => {
            setFullName(computeName(firstName, lastName));
          }, [firstName, lastName]);
        }
      `,
    },
    {
      name: "Set to result of pure local ArrowFunctionExpression",
      code: js`
        function Form() {
          const [firstName, setFirstName] = useState('Dwayne');
          const [lastName, setLastName] = useState('The Rock');
          const [fullName, setFullName] = useState('');

          const computeName = (firstName, lastName) => {
            return firstName + ' ' + lastName;
          }

          useEffect(() => {
            const newFullName = computeName(firstName, lastName);
            setFullName(newFullName);
          }, [firstName, lastName, computeName]);
        }
      `,
    },
    {
      name: "Set to result of internal useCallback; repeat references to a useState variable",
      code: js`
        function Form() {
          const [firstName, setFirstName] = useState('Dwayne');
          const [lastName, setLastName] = useState('The Rock');
          const [fullName, setFullName] = useState('');

          const computeName = useCallback(() => firstName + ' ' + lastName, [firstName, lastName]);

          useEffect(() => {
            setFullName(computeName());
          }, [computeName]);
        }
      `,
    },
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
      name: "From internal plus external state with single setter call",
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
    {
      // Actually a false positive - just tracking this behavior.
      name: "Pass state to derived setter which ignores args",
      code: js`
        function Form() {
          const [firstName, setFirstName] = useState('Dwayne');
          const [lastName, setLastName] = useState('The Rock');
          const [fullName, setFullName] = useState('');

          const setDerivedFullName = (firstName, lastName) => {
            setFullName("Sparky");
          }

          useEffect(() => {
            setDerivedFullName(firstName, lastName);
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
});
