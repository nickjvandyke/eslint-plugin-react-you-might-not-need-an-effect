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
  "AST traversal and call chains",
  noDerivedState,
  {
    valid: [
      {
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
      {
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
        name: "Synchronous setter in anonymous function passed to constructor",
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
    ],
    invalid: [
      {
        name: "Doubly nested scopes in effect body",
        code: js`
        const DoubleCounter = () => {
          const [count, setCount] = useState(0);
          const [doubleCount, setDoubleCount] = useState(0);

          useEffect(() => {
            if (count > 10) {
              if (count > 100) {
                setDoubleCount(count * 4);
              } else {
                setDoubleCount(count * 2);
              }
            } else {
              setDoubleCount(count);
            }
          }, [count]);
        }
      `,
        errors: 3,
      },
      {
        name: "Destructured array skips element in arrow function params",
        code: js`
        function FilteredPosts({ posts }) {
          const [filteredPosts, setFilteredPosts] = useState([]);

          useEffect(() => {
            // ArrayPattern.elements can contain null for skipped elements.
            setFilteredPosts(
              posts.filter(([, value]) => value !== "")
            );
          }, [posts]);
        }
      `,
        errors: avoidDerivedState("filteredPosts"),
      },
    ],
  },
);
