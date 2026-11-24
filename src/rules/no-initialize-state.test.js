import { RuleTester } from "eslint";
import plugin from "../index.ts";
const js = String.raw;

const error = (messageId, data) => [{ messageId, data }];

import rule from "./no-initialize-state.ts";

new RuleTester({ ...plugin.configs.recommended, rules: {} }).run(
  "no-initialize-state",
  rule,
  {
    valid: [
      {
        name: "To external data via Promise",
        code: js`
        function MyComponent() {
          const [state, setState] = useState();

          useEffect(() => {
            fetch("https://api.example.com/data")
              .then(response => response.json())
              .then(data => setState(data));
          }, []);
        }
      `,
      },
      {
        // We ignore this because `react-hooks/exhaustive-deps` will flag the unnecessary dependency
        name: "Setter with other dependency",
        code: js`
        function MyComponent() {
          const [state, setState] = useState();
          const [other, setOther] = useState();

          useEffect(() => {
            setState("Hello");
          }, [other]);
        }
      `,
      },
      {
        name: "No dependency array, async setter",
        code: js`
        function MyComponent() {
          const [state, setState] = useState();

          useEffect(() => {
            fetch("https://api.example.com/data")
              .then((response) => response.json())
              .then((data) => setState(data));
          });
        }
      `,
      },
      {
        name: "Dependency array in a variable",
        code: js`
        function MyComponent({ other }) {
          const [state, setState] = useState();
          const deps = [other];

          useEffect(() => {
            setState("Hello");
          }, deps);
        }
      `,
      },
    ],
    invalid: [
      {
        name: "To literal",
        code: js`
        function MyComponent() {
          const [state, setState] = useState();

          useEffect(() => {
            setState("Hello");
          }, []);

          return <div>{state}</div>;
        }
      `,
        errors: error("avoidInitializingState", {
          state: "state",
          arguments: '"Hello"',
        }),
      },
      {
        name: "To literal, no dependency array",
        code: js`
        function MyComponent() {
          const [state, setState] = useState();

          useEffect(() => {
            setState("Hello");
          });

          return <div>{state}</div>;
        }
      `,
        errors: error("avoidInitializingState", {
          state: "state",
          arguments: '"Hello"',
        }),
      },
      {
        name: "To internal data",
        code: js`
        function MyComponent() {
          const [state, setState] = useState();
          const [otherState, setOtherState] = useState('Meow');

          useEffect(() => {
            setState(otherState);
          }, []);
        }
      `,
        errors: error("avoidInitializingState", {
          state: "state",
          arguments: "otherState",
        }),
      },
      {
        name: "In an otherwise valid effect",
        code: js`
        function MyComponent() {
          const [state, setState] = useState();

          useEffect(() => {
            console.log('Meow');
            setState('Hello World');
          }, []);
        }
      `,
        errors: error("avoidInitializingState", {
          state: "state",
          arguments: "'Hello World'",
        }),
      },
      {
        name: "Reports only the setter that is not part of a subscription",
        code: js`
        function MyComponent() {
          const [status, setStatus] = useState();
          const [online, setOnline] = useState(true);
          const update = () => setOnline(navigator.onLine);

          useEffect(() => {
            setStatus('ready');
            window.addEventListener('online', update);
            update();
            return () => window.removeEventListener('online', update);
          }, []);
        }
      `,
        errors: error("avoidInitializingState", {
          state: "status",
          arguments: "'ready'",
        }),
      },
      {
        name: "To undefined",
        code: js`
        function MyComponent() {
          const [state, setState] = useState('Meow');

          useEffect(() => {
            setState();
          }, []);
        }
      `,
        errors: error("avoidInitializingState", {
          state: "state",
          arguments: "undefined",
        }),
      },
      {
        name: "To equivalent derived literals",
        code: js`
        function MyComponent() {
          const upstream = 'Meow';
          const [state, setState] = useState(upstream);

          useEffect(() => {
            const upstreamTwo = 'Meow';
            setState(upstreamTwo);
          }, []);
        }
      `,
        errors: error("avoidInitializingState", {
          state: "state",
          arguments: "upstreamTwo",
        }),
      },
      {
        name: "Only setter in deps",
        code: js`
        function MyComponent() {
          const [state, setState] = useState();

          useEffect(() => {
            setState("Hello");
          }, [setState]);
        }
      `,
        errors: error("avoidInitializingState", {
          state: "state",
          arguments: '"Hello"',
        }),
      },
      {
        name: "Reports each initialized state in one effect",
        code: js`
        function MyComponent() {
          const [first, setFirst] = useState();
          const [second, setSecond] = useState();

          useEffect(() => {
            setFirst(1);
            setSecond(2);
          }, []);
        }
      `,
        errors: [
          {
            messageId: "avoidInitializingState",
            data: { state: "first", arguments: "1" },
          },
          {
            messageId: "avoidInitializingState",
            data: { state: "second", arguments: "2" },
          },
        ],
      },
    ],
  },
);
