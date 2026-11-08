import { RuleTester } from "eslint";
import plugin from "../index.ts";
import noDerivedState from "../rules/no-derived-state.ts";
import noPassLiveStateToParent from "../rules/no-pass-live-state-to-parent.ts";

const js = String.raw;

const avoidDerivedState = (state) => [
  {
    messageId: "avoidDerivedState",
    data: { state },
  },
];

const avoidPassingLiveState = (state, name) => [
  {
    messageId: "avoidPassingLiveStateToParentInComponent",
    data: { state, name },
  },
];

new RuleTester({ ...plugin.configs.recommended, rules: {} }).run(
  "props and context",
  noDerivedState,
  {
    valid: [
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
        name: "Non-destructured props",
        code: js`
        function DoubleCounter(props) {
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
          const [doubleCount, setDoubleCount] = useState(0);

          useEffect(() => setDoubleCount(props.nested.count * 2), [props.nested.count]);
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
          const [doubleCount, setDoubleCount] = useState(0);

          useEffect(() => setDoubleCount(props.count * 2), [props]);
        }
      `,
        errors: 1,
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
        name: "From context",
        code: js`
        function Theme() {
          const theme = useContext(ThemeContext);
          const [isDark, setIsDark] = useState(false);

          useEffect(() => setIsDark(theme === 'dark'), [theme]);
        }
      `,
        errors: avoidDerivedState("isDark"),
      },
      {
        name: "From destructured context",
        code: js`
        function Theme() {
          const { theme } = useContext(ThemeContext);
          const [isDark, setIsDark] = useState(false);

          useEffect(() => setIsDark(theme === 'dark'), [theme]);
        }
      `,
        errors: avoidDerivedState("isDark"),
      },
    ],
  },
);

new RuleTester({ ...plugin.configs.recommended, rules: {} }).run(
  "props: call aliases",
  noPassLiveStateToParent,
  {
    valid: [],
    invalid: [
      {
        name: "Pass live internal state via derived prop",
        code: js`
        const Child = ({ onFetched }) => {
          const [data, setData] = useState();
          const onFetchedWrapper = (v) => onFetched(v);

          useEffect(() => {
            onFetchedWrapper(data);
          }, [onFetched, data]);
        }
      `,
        errors: avoidPassingLiveState('"data"', '"Child"'),
      },
      {
        name: "Pass live internal state via later-destructured prop",
        code: js`
        const Child = (props) => {
          const [data, setData] = useState();
          const { onFetched } = props;

          useEffect(() => {
            onFetched(data);
          }, [onFetched, data]);
        }
      `,
        errors: avoidPassingLiveState('"data"', '"Child"'),
      },
      {
        name: "Pass live internal state via member-access alias of a prop",
        code: js`
        const Child = (props) => {
          const [data, setData] = useState();
          const onFetched = props.onFetched;

          useEffect(() => {
            onFetched(data);
          }, [onFetched, data]);
        }
      `,
        errors: avoidPassingLiveState('"data"', '"Child"'),
      },
      {
        name: "Pass live internal state via member destructuring of a prop",
        code: js`
        const Child = (props) => {
          const [data, setData] = useState();
          const { onFetched } = props.callbacks;

          useEffect(() => {
            onFetched(data);
          }, [onFetched, data]);
        }
      `,
        errors: avoidPassingLiveState('"data"', '"Child"'),
      },
    ],
  },
);
