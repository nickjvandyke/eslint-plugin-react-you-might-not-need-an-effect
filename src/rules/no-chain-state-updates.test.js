import { RuleTester } from "eslint";
import plugin from "../index.ts";
const js = String.raw;

const error = (messageId, data) => [{ messageId, data }];

import rule from "./no-chain-state-updates.ts";

new RuleTester({ ...plugin.configs.recommended, rules: {} }).run(
  "no-chain-state-updates",
  rule,
  {
    valid: [
      {
        name: "Set state to literal when props change",
        code: js`
        function List({ items }) {
          const [selection, setSelection] = useState();

          useEffect(() => {
            setSelection(null);
          }, [items]);
        }
      `,
      },
      {
        name: "Set state to derived internal state when internal state changes",
        code: js`
        function Counter() {
          const [count, setCount] = useState(0);
          const [doubleCount, setDoubleCount] = useState(0);

          useEffect(() => {
            setDoubleCount(count * 2);
          }, [count]);
        }
      `,
      },
      {
        name: "Set state to literal when external state changes",
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
        name: "Synchronize internal state with literal",
        code: js`
        function Component() {
          const [isMounted, setIsMounted] = useState(false);

          useEffect(() => {
            setIsMounted(true);
            return () => setIsMounted(false);
          }, [setIsMounted]);
        }
      `,
      },
      {
        name: "Set state to internal plus external state",
        code: js`
        function Game() {
          const [round, setRound] = useState(1);
          const [isGameOver, setIsGameOver] = useState(false);
          const { data: players } = useQuery('/players');

          useEffect(() => {
            setIsGameOver(round > 10 || players.length === 0);
          }, [round, players]);
        }
      `,
      },
      {
        // The plugin config does not define browser globals, so `navigator` is unresolved.
        name: "Set to unresolved global when it changes",
        code: js`
        function OnlineStatus() {
          const [online, setOnline] = useState(true);

          useEffect(() => {
            setOnline(navigator.onLine);
          }, [navigator.onLine]);
        }
      `,
      },
      {
        // `count` is read inside a call argument written to state.
        // `no-derived-state` owns this case, and this rule must not report it too.
        name: "Set state to a value derived through a call argument",
        code: js`
        function Counter() {
          const [count, setCount] = useState(0);
          const [countJson, setCountJson] = useState();

          useEffect(() => {
            setCountJson(JSON.stringify(count));
          }, [count]);
        }
      `,
      },
      {
        // `players` is written from a dependency, so this is derived state.
        // `no-derived-state` reports it, and this rule must not report it too.
        name: "Set state to external state in the dependencies when internal state changes",
        code: js`
        function Game() {
          const [round, setRound] = useState(1);
          const [isGameOver, setIsGameOver] = useState(false);
          const { data: players } = useQuery('/players');

          useEffect(() => {
            if (round > 10) {
              setIsGameOver(players.length === 0);
            }
          }, [round, players]);
        }
      `,
      },
      {
        // `value` is a dependency, so `no-derived-state` reports it.
        // Both rules must not report the same call.
        name: "Set state to a prop when state and prop are dependencies",
        code: js`
        function Component({ value }) {
          const [state, setState] = useState();

          useEffect(() => {
            setState(value);
          }, [state, value]);
        }
      `,
      },
    ],
    invalid: [
      {
        // `posts` is read inside a call argument in the dependency array.
        // Arguments are data, so the state dependency is found.
        name: "JSON.stringifying internal state in deps",
        code: js`
        function Feed() {
          const [posts, setPosts] = useState([]);
          const [scrollPosition, setScrollPosition] = useState(0);

          useEffect(() => {
            setScrollPosition(0);
          }, [JSON.stringify(posts)]);
        }
      `,
        errors: error("avoidChainingStateUpdates", { state: "scrollPosition" }),
      },
      {
        name: "Set state to literal when internal state changes",
        code: js`
        function Game() {
          const [round, setRound] = useState(1);
          const [isGameOver, setIsGameOver] = useState(false);

          useEffect(() => {
            if (round > 10) {
              setIsGameOver(true);
            }
          }, [round]);
        }
      `,
        errors: error("avoidChainingStateUpdates", { state: "isGameOver" }),
      },
      {
        name: "Set state to literal when internal or external state changes",
        code: js`
        function Game() {
          const [round, setRound] = useState(1);
          const [isGameOver, setIsGameOver] = useState(false);
          const { data: players } = useQuery('/players');

          useEffect(() => {
            if (round > 10 || players.length === 0) {
              setIsGameOver(true);
            }
          }, [round, players]);
        }
      `,
        errors: error("avoidChainingStateUpdates", { state: "isGameOver" }),
      },
      {
        name: "In an otherwise valid effect",
        code: js`
        function MyComponent() {
          const [state, setState] = useState();
          const [otherState, setOtherState] = useState('Meow');

          useEffect(() => {
            console.log('Meow');
            setState('Hello World');
          }, [otherState]);
        }
      `,
        errors: error("avoidChainingStateUpdates", { state: "state" }),
      },
      {
        // The unrelated call reads state, but that state is not written by the
        // setter. Only the setter's own arguments count as written values.
        name: "Wrapper setter with an unrelated state read",
        code: js`
        function MyComponent() {
          const [count, setCount] = useState(0);
          const [selection, setSelection] = useState();
          const [otherState, setOtherState] = useState();

          function update() {
            console.log(otherState);
            setSelection('Hello World');
          }

          useEffect(() => {
            update();
          }, [count]);
        }
      `,
        errors: error("avoidChainingStateUpdates", { state: "selection" }),
      },
    ],
  },
);
