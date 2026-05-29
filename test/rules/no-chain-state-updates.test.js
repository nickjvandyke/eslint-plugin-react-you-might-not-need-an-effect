import { MyRuleTester, js } from "../rule-tester.js";
import rule from "../../src/rules/no-chain-state-updates.ts";

new MyRuleTester().run("no-chain-state-updates", rule, {
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
      // Because we don't trace the args passed to `JSON.stringify` (hard to generalize)
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
    },
  ],
  invalid: [
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
      errors: [
        {
          messageId: "avoidChainingStateUpdates",
        },
      ],
    },
    {
      name: "Set state to derived literal when internal state changes",
      code: js`
        function Game() {
          const [round, setRound] = useState(1);
          const [isGameOver, setIsGameOver] = useState(false);

          useEffect(() => {
            if (round > 10) {
              const finalRound = true;
              setIsGameOver(finalRound);
            }
          }, [round]);
        }
      `,
      errors: [
        {
          messageId: "avoidChainingStateUpdates",
        },
      ],
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
      errors: [
        {
          messageId: "avoidChainingStateUpdates",
        },
      ],
    },
    {
      name: "Set state to external state when internal state changes",
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
      errors: [
        {
          messageId: "avoidChainingStateUpdates",
        },
      ],
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
      errors: [
        {
          messageId: "avoidChainingStateUpdates",
          data: { state: "state" },
        },
      ],
    },
  ],
});
