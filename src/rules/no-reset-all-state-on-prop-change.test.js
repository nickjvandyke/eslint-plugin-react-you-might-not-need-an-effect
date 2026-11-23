import { RuleTester } from "eslint";
import plugin from "../index.ts";
const js = String.raw;

const error = (messageId, data) => [{ messageId, data }];

import rule from "./no-reset-all-state-on-prop-change.ts";

new RuleTester({ ...plugin.configs.recommended, rules: {} }).run(
  "no-reset-all-state-on-prop-change",
  rule,
  {
    valid: [
      {
        name: "Set state when a prop changes, but not to its default value",
        code: js`
        function List({ items }) {
          const [selection, setSelection] = useState();

          useEffect(() => {
            setSelection(items[0]);
          }, [items]);
        }
      `,
      },
      {
        name: "Reset some state when a prop changes",
        code: js`
        function ProfilePage({ userId }) {
          const [user, setUser] = useState(null);
          const [comment, setComment] = useState('type something');
          const [catName, setCatName] = useState('Sparky');

          useEffect(() => {
            setUser(null);
            setComment('meow')
          }, [userId]);
        }
      `,
      },
      {
        // Because undefined !== null
        name: "Undefined state initializer compared to state setter with literal null",
        code: js`
        function List({ items }) {
          const [selectedItem, setSelectedItem] = useState();

          useEffect(() => {
            setSelectedItem(null);
          }, [items]);
        }
      `,
      },
      {
        name: "Reset all state when a prop changes in a custom hook",
        code: js`
        function useCustomHook({ userId }) {
          const [user, setUser] = useState(null);
          const [comment, setComment] = useState('type something');

          useEffect(() => {
            setUser(null);
            setComment('type something');
          }, [userId]);
        }
      `,
      },
      {
        name: "Reset all state to derived initial state when a prop changes",
        code: js`
        function ProfilePage({ userId }) {
          const initialState = 'meow meow'
          const [comment, setComment] = useState(initialState);

          useEffect(() => {
            const derivedInitialState = initialState + '!';
            setComment(derivedInitialState);
          }, [userId]);
        }
      `,
      },
      {
        // https://github.com/nickjvandyke/eslint-plugin-react-you-might-not-need-an-effect/issues/55
        name: "Set state differently in callback to state-like hook",
        code: js`
        const Foo = () => {
          const [_0, setState] = useState(false);
          const [_1, startTransition] = useTransition();

          useEffect(() => {
            startTransition(() => {
              setState(true);
            });
          }, []);

          return null;
        };
      `,
      },
      {
        // The helper call has no argument, but the real setter call writes
        // `null`, which is not the `undefined` initial value.
        name: "Set state to a non-initial value inside a helper",
        code: js`
        function ProfilePage({ userId }) {
          const [user, setUser] = useState();

          useEffect(() => {
            const run = () => setUser(null);
            run();
          }, [userId]);
        }
      `,
      },
      {
        // The helper guards the value, so the caller argument is not written.
        name: "Set state to a guarded value inside a helper",
        code: js`
        function ProfilePage({ userId }) {
          const [user, setUser] = useState(null);
          const run = (fallback) => setUser(userId ?? fallback);

          useEffect(() => {
            run(null);
          }, [userId]);
        }
      `,
      },
      {
        // Resetting and then overwriting the same state is not a reset.
        name: "Reset state then overwrite it",
        code: js`
        function ProfilePage({ userId }) {
          const [user, setUser] = useState(null);

          useEffect(() => {
            setUser(null);
            setUser(userId);
          }, [userId]);
        }
      `,
      },
    ],
    invalid: [
      {
        name: "Reset all state when a prop changes",
        code: js`
        function ProfilePage({ userId }) {
          const [user, setUser] = useState(null);
          const [comment, setComment] = useState('type something');

          useEffect(() => {
            setUser(null);
            setComment('type something');
          }, [userId]);
        }
      `,
        errors: error("avoidResettingAllStateWhenAPropChanges", {
          prop: "userId",
        }),
      },
      {
        name: "Reset all state when context changes",
        code: js`
        function ProfilePage() {
          const { userId } = useContext(UserContext);
          const [user, setUser] = useState(null);
          const [comment, setComment] = useState('type something');

          useEffect(() => {
            setUser(null);
            setComment('type something');
          }, [userId]);
        }
      `,
        errors: error("avoidResettingAllStateWhenAPropChanges", {
          prop: "userId",
        }),
      },
      {
        name: "Reset all state by calling the same setter twice",
        code: js`
        function ProfilePage({ userId }) {
          const [user, setUser] = useState(null);

          useEffect(() => {
            setUser(null);
            setUser(null);
          }, [userId]);
        }
      `,
        errors: error("avoidResettingAllStateWhenAPropChanges", {
          prop: "userId",
        }),
      },
      {
        name: "Reset all state to shared var when a prop changes",
        code: js`
        function ProfilePage({ userId }) {
          const initialState = 'meow meow'
          const [user, setUser] = useState(null);
          const [comment, setComment] = useState(initialState);

          useEffect(() => {
            setUser(null);
            setComment(initialState);
          }, [userId]);
        }
      `,
        errors: error("avoidResettingAllStateWhenAPropChanges", {
          prop: "userId",
        }),
      },
      {
        name: "Reset all state when a prop member changes",
        code: js`
        function ProfilePage({ user }) {
          const [comment, setComment] = useState('type something');

          useEffect(() => {
            setComment('type something');
          }, [user.id]);
        }
      `,
        errors: [
          {
            messageId: "avoidResettingAllStateWhenAPropChanges",
            // TODO: Ideally would be "user.id"
            data: { prop: "user" },
          },
        ],
      },
      {
        name: "Reset all state when one of two props change",
        code: js`
        function ProfilePage({ userId, friends }) {
          const [comment, setComment] = useState('type something');

          useEffect(() => {
            setComment('type something');
          }, [userId, friends]);
        }
      `,
        errors: error("avoidResettingAllStateWhenAPropChanges", {
          prop: "userId",
        }),
      },
      {
        // These are equivalent because state initializes to `undefined` when it has no argument
        name: "Undefined state initializer compared to state setter with literal undefined",
        code: js`
        function List({ items }) {
          const [selectedItem, setSelectedItem] = useState();

          useEffect(() => {
            setSelectedItem(undefined);
          }, [items]);
        }
      `,
        errors: [
          {
            messageId: "avoidResettingAllStateWhenAPropChanges",
          },
        ],
      },
      {
        name: "Reset all state to function call result when a prop changes",
        code: js`
        function ProfilePage({ userId }) {
          const [comment, setComment] = useState(getInitialComment());

          useEffect(() => {
            setComment(getInitialComment());
          }, [userId]);
        }

        function getInitialComment() {
          return 'type something';
        }
      `,
        errors: error("avoidResettingAllStateWhenAPropChanges", {
          prop: "userId",
        }),
      },
      {
        name: "Reset all state via a wrapper setter",
        code: js`
        function ProfilePage({ userId }) {
          const [user, setUser] = useState(null);

          const resetUser = () => setUser(null);

          useEffect(() => {
            resetUser();
          }, [userId]);
        }
      `,
        errors: error("avoidResettingAllStateWhenAPropChanges", {
          prop: "userId",
        }),
      },
      {
        // The helper and the direct call reach the same state. It still counts
        // as one reset of one state.
        name: "Reset the same state through a helper and a direct call",
        code: js`
        function ProfilePage({ userId }) {
          const [user, setUser] = useState(null);

          useEffect(() => {
            const run = () => setUser(null);
            run();
            setUser(null);
          }, [userId]);
        }
      `,
        errors: error("avoidResettingAllStateWhenAPropChanges", {
          prop: "userId",
        }),
      },
      {
        // The wrapper forwards its argument, so the no-argument call resets to
        // the `undefined` initial value.
        name: "Reset all state through a wrapper setter with no argument",
        code: js`
        function ProfilePage({ userId }) {
          const [user, setUserReal] = useState();
          const setUser = (value) => setUserReal(value);

          useEffect(() => {
            setUser();
          }, [userId]);
        }
      `,
        errors: error("avoidResettingAllStateWhenAPropChanges", {
          prop: "userId",
        }),
      },
    ],
  },
);
