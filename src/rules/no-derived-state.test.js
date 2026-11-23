import { RuleTester } from "eslint";
import plugin from "../index.ts";
const js = String.raw;

const error = (messageId, data) => [{ messageId, data }];

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
          const [firstName, setFirstName] = useState('Nick');
          const [lastName, setLastName] = useState('van Dyke');

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
        name: "Adjust state to a value that is not in the dependencies",
        // The value is available during render, but the effect does not react
        // to it. `no-adjust-state-on-prop-change` handles this case.
        code: js`
        function List({ items }) {
          const [selection, setSelection] = useState();
          const { data: externalData } = useDataSource();

          useEffect(() => {
            setSelection(externalData);
          }, [items]);
        }
      `,
      },
      {
        name: "Set to a ref value in the dependencies",
        // `ref.current` is only updated after render, so it is not render-safe.
        code: js`
        function Element() {
          const ref = useRef();
          const [width, setWidth] = useState(0);

          useEffect(() => {
            setWidth(ref.current.offsetWidth);
          }, [ref]);
        }
      `,
      },
      {
        // Without a dependency array there is no reactive value to compare
        // against. `no-initialize-state` covers mount-only effects, and users
        // are expected to enable `react-hooks/exhaustive-deps` for the rest.
        name: "No dependency array",
        code: js`
        function DoubleCounter() {
          const [count, setCount] = useState(0);
          const [doubleCount, setDoubleCount] = useState(0);

          useEffect(() => {
            setDoubleCount(count * 2);
          });
        }
      `,
      },
      {
        // The plugin config does not define browser globals, so `window` is unresolved.
        name: "Set to unresolved global (external state)",
        code: js`
        function WindowSize() {
          const [width, setWidth] = useState(0);

          useEffect(() => {
            setWidth(window.innerWidth);
          }, [window.innerWidth]);
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
      // False negatives from ignoring CallExpression arguments — the rule no longer traces state through fn args
    ],
    invalid: [
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
        errors: error("avoidDerivedState", { state: "selectedPost" }),
      },
      {
        name: "From a prop when state and prop are dependencies",
        code: js`
        function Component({ value }) {
          const [state, setState] = useState();

          useEffect(() => {
            setState(value);
          }, [state, value]);
        }
      `,
        errors: error("avoidDerivedState", { state: "state" }),
      },
      {
        name: "From a custom hook value",
        code: js`
        function Search() {
          const [params] = useSearchParams();
          const [query, setQuery] = useState();

          useEffect(() => {
            setQuery(params.get('q'));
          }, [params]);
        }
      `,
        errors: error("avoidDerivedState", { state: "query" }),
      },
      {
        name: "From internal state",
        code: js`
        function Form() {
          const [firstName, setFirstName] = useState('Nick');
          const [lastName, setLastName] = useState('van Dyke');

          const [fullName, setFullName] = useState('');
          useEffect(() => setFullName(firstName + ' ' + lastName), [firstName, lastName]);
        }
      `,
        errors: error("avoidDerivedState", { state: "fullName" }),
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
        errors: error("avoidDerivedState", { state: "prefixedName" }),
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
        errors: error("avoidDerivedState", { state: "fullName" }),
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
        errors: error("avoidDerivedState", { state: "doubleList" }),
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
        errors: error("avoidDerivedState", { state: "doubleList" }),
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
        errors: error("avoidDerivedState", { state: "fullName" }),
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
        errors: error("avoidDerivedState", { state: "total" }),
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
        errors: error("avoidDerivedState", { state: "formData" }),
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
        errors: error("avoidDerivedState", { state: "formData" }),
      },
      {
        name: "Derived state in larger, otherwise legit effect",
        code: js`
        function Form() {
          const [firstName, setFirstName] = useState('Nick');
          const [lastName, setLastName] = useState('van Dyke');
          const [fullName, setFullName] = useState('');

          useEffect(() => {
            console.log(name);

            setFullName(firstName + ' ' + lastName);
          }, [firstName, lastName]);
        }
      `,
        errors: error("avoidDerivedState", { state: "fullName" }),
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
        errors: error("avoidDerivedState", { state: "fullName" }),
      },
      {
        // The written value comes from a call argument, no matter how many
        // variables sit between the dependency and the setter.
        name: "From internal state via a call result variable",
        code: js`
        function Counter() {
          const [count, setCount] = useState(0);
          const [countJson, setCountJson] = useState();

          useEffect(() => {
            const value = JSON.stringify(count);
            setCountJson(value);
          }, [count]);
        }
      `,
        errors: error("avoidDerivedState", { state: "countJson" }),
      },
      {
        // Arguments of a call written to state are data, even when the callee
        // is imported and its implementation is unavailable.
        name: "From internal state via external function",
        code: js`
        import { computeName } from 'library';

        function Component() {
          const [firstName] = useState('Dwayne');
          const [lastName] = useState('The Rock');
          const [fullName, setFullName] = useState('');

          useEffect(() => {
            setFullName(computeName(firstName, lastName));
          }, [firstName, lastName])
        }
      `,
        errors: error("avoidDerivedState", { state: "fullName" }),
      },
      {
        name: "Bare return is not treated as a cleanup function",
        code: js`
        function Form({ firstName, lastName }) {
          const [fullName, setFullName] = useState('');

          useEffect(() => {
            setFullName(firstName + ' ' + lastName);
            return;
          }, [firstName, lastName]);
        }
      `,
        errors: error("avoidDerivedState", { state: "fullName" }),
      },
    ],
  },
);
