import { MyRuleTester, js } from "../rule-tester.js";
import rule from "../../src/rules/no-event-handler.ts";

new MyRuleTester().run("no-event-handler", rule, {
  valid: [
    {
      name: "Sychronizing with external system",
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
      // https://github.com/nickjvandyke/eslint-plugin-react-you-might-not-need-an-effect/issues/70
      name: "Respond to prop passed to fn",
      code: js`
        import { useEffect } from 'react'

        // Captures an optional URL search param and persists it to localStorage + cookie.
        // First-touch attribution: never overwrites an existing code.
        export function useSaveReferralCode(refCode) {
          useEffect(() => {
            const valid = validateReferralCode(refCode)
            if (valid) saveReferredByCode(valid)
          }, [refCode])
        }
      `,
    },
  ],
  invalid: [
    {
      name: "Using props to handle an event and call an external function",
      code: js`
        function Form({ dataToSubmit }) {
          useEffect(() => {
            if (dataToSubmit) {
              submitData(dataToSubmit);
            }
          }, [dataToSubmit]);
        }
      `,
      errors: [
        {
          messageId: "avoidPropHandler",
        },
      ],
    },
    {
      name: "Using state to handle an event and call an external function",
      code: js`
        function Form() {
          const [name, setName] = useState();
          const [dataToSubmit, setDataToSubmit] = useState();

          useEffect(() => {
            if (dataToSubmit) {
              submitData(dataToSubmit);
            }
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
          messageId: "avoidEventHandler",
        },
      ],
    },
    {
      name: "Using state to handle an event, no deps argument",
      code: js`
        function Form() {
          const [dataToSubmit, setDataToSubmit] = useState();

          useEffect(() => {
            if (dataToSubmit) {
              submitData(dataToSubmit);
            }
          });

          return (
            <button onClick={() => setDataToSubmit({ name: 'test' })}>Submit</button>
          )
        }
      `,
      errors: [
        {
          messageId: "avoidEventHandler",
        },
      ],
    },
    {
      name: "Using state to handle an event, empty deps",
      code: js`
        function Form() {
          const [dataToSubmit, setDataToSubmit] = useState();

          useEffect(() => {
            if (dataToSubmit) {
              submitData(dataToSubmit);
            }
          }, []);

          return (
            <button onClick={() => setDataToSubmit({ name: 'test' })}>Submit</button>
          )
        }
      `,
      errors: [
        {
          messageId: "avoidEventHandler",
        },
      ],
    },
    {
      name: "Using state to handle an event and call a prop",
      code: js`
        function Form({ submitData }) {
          const [name, setName] = useState();
          const [dataToSubmit, setDataToSubmit] = useState();

          useEffect(() => {
            if (dataToSubmit) {
              submitData(dataToSubmit);
            }
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
          messageId: "avoidEventHandler",
        },
      ],
    },
    {
      name: "Early return in if test",
      code: js`
        function Form() {
          const [name, setName] = useState();
          const [dataToSubmit, setDataToSubmit] = useState();

          useEffect(() => {
            if (!dataToSubmit) return;

            submitData(dataToSubmit);
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
          messageId: "avoidEventHandler",
        },
      ],
    },
    {
      name: "Member access and double test in condition",
      code: js`
        function Form() {
          const [name, setName] = useState();
          const [dataToSubmit, setDataToSubmit] = useState();

          useEffect(() => {
            if (dataToSubmit.name && dataToSubmit.name.length > 0) {
              submitData(dataToSubmit);
            }
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
          messageId: "avoidEventHandler",
          line: 7,
          column: 17,
        },
        {
          messageId: "avoidEventHandler",
          line: 7,
          column: 38,
        },
      ],
    },
    {
      name: "Derived prop in multiple if tests",
      code: js`
        import { useEffect } from "react";

        function Form({ value }) {
          const derived = value + 2;

          useEffect(() => {
            if (derived === "a") return;
            if (derived === "b") return;
          }, [derived]);
        }
      `,
      errors: [
        {
          messageId: "avoidPropHandler",
          line: 8,
        },
        {
          messageId: "avoidPropHandler",
          line: 9,
        },
      ],
    },
    {
      name: "If test includes non-state",
      code: js`
        function Form() {
          const [name, setName] = useState();
          const [dataToSubmit, setDataToSubmit] = useState();

          useEffect(() => {
            if (dataToSubmit && Date.now() % 2 === 0) {
              submitData(dataToSubmit);
            }
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
          messageId: "avoidEventHandler",
        },
      ],
    },
  ],
});
