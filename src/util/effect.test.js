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
  "effect shapes",
  noDerivedState,
  {
    valid: [
      {
        name: "Effect callback is a parameter, so the effect body is opaque",
        code: js`
        function useThing(callback) {
          const [count, setCount] = useState(0);

          useEffect(callback, []);
          setCount(count * 2);
        }
      `,
      },
    ],
    invalid: [
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
        name: "Effect with no dependency array",
        code: js`
        function DoubleCounter() {
          const [count, setCount] = useState(0);
          const [doubleCount, setDoubleCount] = useState(0);

          useEffect(() => {
            setDoubleCount(count * 2);
          });
        }
      `,
        errors: avoidDerivedState("doubleCount"),
      },
      {
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
        errors: avoidDerivedState("doubleCount"),
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
        errors: avoidDerivedState("name"),
      },
    ],
  },
);
