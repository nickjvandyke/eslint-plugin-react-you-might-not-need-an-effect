import { MyRuleTester, js } from "../../test/rule-tester.js";
import rule from "./no-reset-all-state-on-prop-change.ts";

new MyRuleTester().run("no-reset-all-state-on-prop-change", rule, {
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
      // https://github.com/nickjvandyke/eslint-plugin-react-you-might-not-need-an-effect/issues/31
      // Verifies that the rule doesn't crash when it can't find the containing component to count `useState`s.
      // This *is* a rule-break, but detecting the lowercased function name would probably introduce more false positives than it'd save in false negatives.
      name: "Reset all state when a prop changes inside lowercased function definition",
      code: js`
        function buildComponent() {
          const [comment, setComment] = useState('type something');

          useEffect(() => {
            setComment('type something');
          }, [userId]);

          return <div>hi</div>;
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
      // https://github.com/nickjvandyke/eslint-plugin-react-you-might-not-need-an-effect/issues/55
      name: "Set state differently in callback to state-like hook",
      code: js`
        const Foo = () => {
          const [_0, setState] = React.useState(false);
          const [_1, startTransition] = React.useTransition();

          useEffect(() => {
            startTransition(() => {
              setState(true);
            });
          }, []);

          return null;
        };
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
      errors: [
        {
          messageId: "avoidResettingAllStateWhenAPropChanges",
          data: { prop: "userId" },
        },
      ],
    },
    {
      name: "Reset all state when a prop changes in memoized component",
      code: js`
        const ProfilePage = memo(({ userId }) => {
          const [user, setUser] = useState(null);
          const [comment, setComment] = useState('type something');

          useEffect(() => {
            setUser(null);
            setComment('type something');
          }, [userId]);
        })
      `,
      errors: [
        {
          messageId: "avoidResettingAllStateWhenAPropChanges",
          data: { prop: "userId" },
        },
      ],
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
      errors: [
        {
          messageId: "avoidResettingAllStateWhenAPropChanges",
          data: { prop: "userId" },
        },
      ],
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
      errors: [
        {
          messageId: "avoidResettingAllStateWhenAPropChanges",
          data: { prop: "userId" },
        },
      ],
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
      errors: [
        {
          messageId: "avoidResettingAllStateWhenAPropChanges",
          data: { prop: "userId" },
        },
      ],
    },
  ],
});
