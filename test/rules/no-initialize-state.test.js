import { MyRuleTester, js } from "../rule-tester.js";
import rule from "../../src/rules/no-initialize-state.ts";

new MyRuleTester().run("no-initialize-state", rule, {
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
      name: "To external data via async IIFE",
      code: js`
        function MyComponent() {
          const [state, setState] = useState();

          useEffect(() => {
            (async () => {
              const response = await fetch("https://api.example.com/data");
              const data = await response.json();
              setState(data);
            })();
          }, []);
        }
      `,
    },
    {
      // Don't know why someone would use a synchronous IIFE here,
      // hence we don't make the effort to flag it, but just documenting this behavior.
      name: "To literal inside synchronous IIFE",
      code: js`
        function MyComponent() {
          const [state, setState] = useState();

          useEffect(() => {
            (() => {
              setState("Hello");
            })();
          }, []);
        }
      `,
    },
    {
      name: "To literal inside IIFE inside callback",
      code: js`
        import { useEffect, useState } from 'react';

        export const MyComponent = () => {
          const [state, setState] = useState();

          useEffect(() => {
            window.addEventListener('load', () => {
              (() => {
                setState('Loaded');
              })();
            });
          }, []);
        };
      `,
    },
    {
      name: "To literal inside callback inside IIFE",
      code: js`
        import { useEffect, useState } from 'react';

        export const MyComponent = () => {
          const [state, setState] = useState();

          useEffect(() => {
            (() => {
              window.addEventListener('load', () => {
                setState('Loaded');
              });
            })();
          }, []);
        };
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
      errors: [
        {
          messageId: "avoidInitializingState",
          data: { state: "state", arguments: '"Hello"' },
        },
      ],
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
      errors: [
        {
          messageId: "avoidInitializingState",
          data: { state: "state", arguments: "otherState" },
        },
      ],
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
      errors: [
        {
          messageId: "avoidInitializingState",
          data: { state: "state", arguments: "'Hello World'" },
        },
      ],
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
      errors: [
        {
          messageId: "avoidInitializingState",
          data: { state: "state", arguments: "undefined" },
        },
      ],
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
      errors: [
        {
          messageId: "avoidInitializingState",
          data: { state: "state", arguments: "upstreamTwo" },
        },
      ],
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
      errors: [
        {
          messageId: "avoidInitializingState",
          data: { state: "state", arguments: '"Hello"' },
        },
      ],
    },
  ],
});
