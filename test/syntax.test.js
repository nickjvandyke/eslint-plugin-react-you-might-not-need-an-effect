import { MyRuleTester, js } from "./rule-tester.js";
import noDerivedState from "../src/rules/no-derived-state.ts";

// Analysis is quite syntax-dependent,
// so here we have a bunch of semantically equivalent simple tests to verify various syntax.
// While this tests `no-derived-state`, it's mostly about the utility functions under the hood.
// TODO: may make more sense to unit test those directly
new MyRuleTester().run("syntax", noDerivedState, {
  valid: [
    {
      name: "Two components with overlapping names",
      // Not a super realistic example
      code: js`
        function ComponentOne() {
          const [data, setData] = useState();
        }

        function ComponentTwo() {
          const setData = (data) => {
            console.log(data);
          }

          useEffect(() => {
            setData('hello');
          }, []);
        }
      `,
    },
    {
      name: "Reacting to external state changes with member access in deps",
      code: js`
        function Feed() {
          const { data } = useQuery('/posts');
          const [scrollPosition, setScrollPosition] = useState(0);

          useEffect(() => {
            setScrollPosition(0);
          }, [data.posts]);
        }
      `,
    },
  ],
  invalid: [
    {
      name: "Derived state, with imports",
      code: js`
        import { useState, useEffect } from 'react';

         function DoubleCounter() {
           const [count, setCount] = useState(0);
           const [doubleCount, setDoubleCount] = useState(0);

           useEffect(() => setDoubleCount(count * 2), [count]);
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
      name: "Derived state, without imports",
      code: js`
        function Form() {
          const [firstName, setFirstName] = useState('Taylor');
          const [lastName, setLastName] = useState('Swift');

          const [fullName, setFullName] = useState('');
          useEffect(() => setFullName(firstName + ' ' + lastName), [firstName, lastName]);
        }
      `,
      errors: 1,
    },
    {
      name: "Derived state, React.useEffect import",
      code: js`
        import * as React from 'react';

        function DoubleCounter() {
          const [count, setCount] = React.useState(0);
          const [doubleCount, setDoubleCount] = React.useState(0);

          React.useEffect(() => {
            setDoubleCount(count * 2);
          }, [count]);
        }
      `,
      errors: 1,
    },
    {
      name: "Derived state, with renamed import",
      // TODO: We check for `useState` specifically to avoid false positives on state-like hooks (two-element destructuring).
      // Would need to go up to the import I guess.
      todo: true,
      code: js`
        import { useState as stateUser, useEffect } from 'react';

        function Form() {
          const [firstName, setFirstName] = stateUser('Taylor');
          const [lastName, setLastName] = stateUser('Swift');

          const [fullName, setFullName] = stateUser('');
          useEffect(() => setFullName(firstName + ' ' + lastName), [firstName, lastName]);
        }
      `,
      errors: [
        {
          messageId: "avoidDerivedState",
          data: { state: "undefined" },
        },
      ],
    },
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
      errors: [
        {
          messageId: "avoidDerivedState",
          data: { state: "doubleCount" },
        },
      ],
    },
    {
      name: "Effect one-liner body",
      code: js`
         const AvoidDuplicateTest = () => {
           const [count, setCount] = useState(0);
           const [doubleCount, setDoubleCount] = useState(0);

           useEffect(() => setDoubleCount(count * 2), [count]);
         }
       `,
      errors: 1,
    },
    {
      name: "Effect single-statement body",
      code: js`
         const DoubleCounter = () => {
           const [count, setCount] = useState(0);
           const [doubleCount, setDoubleCount] = useState(0);

           useEffect(() => { setDoubleCount(count * 2); }, [count]);
         }
       `,
      errors: 1,
    },
    {
      name: "Effect multi-statement body",
      code: js`
         const DoubleCounter = () => {
           const [count, setCount] = useState(0);
           const [doubleCount, setDoubleCount] = useState(0);

           useEffect(() => { setDoubleCount(count * 2); setDoubleCount(count * 2); }, [count]);
         }
       `,
      errors: 2,
    },
    {
      name: "Effect anonymous function body",
      code: js`
         const DoubleCounter = () => {
           const [count, setCount] = useState(0);
           const [doubleCount, setDoubleCount] = useState(0);

           useEffect(function() { setDoubleCount(count * 2); }, [count]);
         }
       `,
      errors: 1,
    },
    {
      name: "Non-destructured props",
      code: js`
         function DoubleCounter(props) {
           const [count, setCount] = useState(0);
           const [doubleCount, setDoubleCount] = useState(0);

           useEffect(() => setDoubleCount(props.count * 2), [props.count]);
         }
       `,
      errors: 1,
    },
    {
      name: "Destructured props",
      code: js`
         function DoubleCounter({ propCount }) {
           const [count, setCount] = useState(0);
           const [doubleCount, setDoubleCount] = useState(0);

           useEffect(() => setDoubleCount(propCount * 2), [propCount]);
         }
       `,
      errors: 1,
    },
    {
      name: "Renamed destructured props",
      code: js`
         function DoubleCounter({ count: countProp }) {
           const [count, setCount] = useState(0);
           const [doubleCount, setDoubleCount] = useState(0);

           useEffect(() => setDoubleCount(countProp * 2), [countProp]);
         }
       `,
      errors: 1,
    },
    {
      name: "Doubly deep MemberExpression in effect",
      code: js`
         function DoubleCounter(props) {
           const [count, setCount] = useState(0);
           const [doubleCount, setDoubleCount] = useState(0);

           useEffect(() => setDoubleCount(props.nested.count * 2), [props.nested.count]);
         }
       `,
      errors: 1,
    },
    {
      name: "Objects stored in state",
      code: js`
          function DoubleCounter() {
            const [count, setCount] = useState({ value: 0 });
            const [doubleCount, setDoubleCount] = useState({ value: 0 });

            useEffect(() => {
              setDoubleCount({ value: count.value * 2 });
            }, [count]);
          }
        `,
      errors: 1,
    },
    {
      name: "Optional chaining and nullish coalescing",
      code: js`
        function DoubleCounter({ count }) {
          const [doubleCount, setDoubleCount] = useState(0);

          useEffect(() => {
            setDoubleCount((count?.value ?? 1) * 2);
          }, [count?.value]);
        }
      `,
      errors: 1,
    },
    {
      // `exhaustive-deps` doesn't enforce member access in the deps
      name: "Member access in effect body but not in deps",
      code: js`
         function DoubleCounter(props) {
           const [count, setCount] = useState(0);
           const [doubleCount, setDoubleCount] = useState(0);

           useEffect(() => setDoubleCount(props.count * 2), [props]);
         }
       `,
      errors: 1,
    },
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
      name: "Destructured array skips element in variable declaration",
      code: js`
        function SecondPost({ posts }) {
          const [secondPost, setSecondPost] = useState();

          useEffect(() => {
            const [, second] = posts;
            setSecondPost(second);
          }, [posts]);
        }
      `,
      errors: 1,
    },
    {
      name: "Value-less useState",
      code: js`
        import { useState } from 'react';

        function AttemptCounter() {
          const [, setAttempts] = useState(0);
          const [count, setCount] = useState(0);

          useEffect(() => {
            setAttempts((prev) => {
              return prev + count;
            });
          }, [count]);
        }
      `,
      errors: [
        {
          messageId: "avoidDerivedState",
          data: { state: "setAttempts" },
        },
      ],
    },
    {
      name: "Setter-less useState",
      code: js`
        function AttemptCounter() {
          const [attempts, setAttempts] = useState(0);
          const [count] = useState(0);

          useEffect(() => {
            setAttempts(count);
          }, [count]);
        }
      `,
      errors: [
        {
          messageId: "avoidDerivedState",
          data: { state: "attempts" },
        },
      ],
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
      errors: [
        {
          messageId: "avoidDerivedState",
          data: { state: "doubleCount" },
        },
      ],
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
      errors: [
        {
          messageId: "avoidDerivedState",
          data: { state: "state" },
        },
      ],
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
      errors: [
        {
          messageId: "avoidDerivedState",
          data: { state: "state" },
        },
      ],
    },
    {
      // Effects shouldn't be called conditionally, but good to be prepared
      name: "Conditional useEffect",
      code: js`
        function DoubleCounter() {
          const [count, setCount] = useState(0);
          const [doubleCount, setDoubleCount] = useState(0);

          if (count > 10) {
            useEffect(() => {
              setDoubleCount(count * 2);
            }, [count]);
          }
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
      name: "Passing non-anonymous function to effect",
      code: js`
        function Form() {
          const [firstName, setFirstName] = useState('');
          const [lastName, setLastName] = useState('');
          const [name, setName] = useState('');

          function setDerivedName() {
            setName(firstName + ' ' + lastName);
          }

          useEffect(setDerivedName, [firstName, lastName]);
        }
      `,
      errors: [
        {
          messageId: "avoidDerivedState",
          data: { state: "name" },
        },
      ],
    },
    {
      name: "Destructured array skips element in arrow function params",
      code: js`
        function FilteredPosts({ posts }) {
          const [filteredPosts, setFilteredPosts] = useState([]);

          useEffect(() => {
            // Resulting AST node looks like:
            // {
            //   "type": "ArrayPattern",
            //   "elements": [
            //     null, <-- Must handle this!
            //     {
            //       "type": "Identifier",
            //       "name": "second"
            //     }
            //   ]
            // }
            setFilteredPosts(
              posts.filter(([, value]) => value !== "")
            );
          }, [posts]);
        }
      `,
      errors: [
        {
          messageId: "avoidDerivedState",
          data: { state: "filteredPosts" },
        },
      ],
    },
    {
      name: "Set derived state via direct alias",
      code: js`
        const Component = () => {
          const [data, setData] = useState();
          // No idea why someone would do this. But good to know we catch it.
          const setDataWrapper = setData;

          useEffect(() => {
            setDataWrapper(data);
          }, [data]);
        }
      `,
      errors: [
        {
          messageId: "avoidDerivedState",
          data: { state: "data" },
        },
      ],
    },
    {
      name: "Set derived state via destructured alias",
      code: js`
        const Component = () => {
          const [data, setData] = useState();
          const { setData: setDataAlias } = { setData };

          useEffect(() => {
            setDataAlias(data);
          }, [data]);
        }
      `,
      errors: [
        {
          messageId: "avoidDerivedState",
          data: { state: "data" },
        },
      ],
    },
    {
      name: "Set derived state via wrapped alias",
      code: js`
        const Component = () => {
          const [data, setData] = useState();
          const setDataWrapper = (v) => setData(v);

          useEffect(() => {
            setDataWrapper(data);
          }, [data]);
        }
      `,
      errors: [
        {
          messageId: "avoidDerivedState",
          data: { state: "data" },
        },
      ],
    },
  ],
});
