import { RuleTester } from "eslint";
import plugin from "../index.ts";
import noAdjustStateOnPropChange from "../rules/no-adjust-state-on-prop-change.ts";
import noPassLiveStateToParent from "../rules/no-pass-live-state-to-parent.ts";

const js = String.raw;

new RuleTester({ ...plugin.configs.recommended, rules: {} }).run(
  "messages: quoted names",
  noAdjustStateOnPropChange,
  {
    valid: [],
    invalid: [
      {
        name: "Quotes each name in a list of three",
        code: js`
        function List({ items, user, filter }) {
          const [selection, setSelection] = useState();

          useEffect(() => {
            setSelection(null);
          }, [items, user, filter]);
        }
      `,
        errors: [
          {
            messageId: "avoidAdjustingStateWhenAValueChanges",
            data: {
              state: "selection",
              values: '"items" and "user" and "filter"',
            },
          },
        ],
      },
    ],
  },
);

new RuleTester({ ...plugin.configs.recommended, rules: {} }).run(
  "messages: anonymous owner",
  noPassLiveStateToParent,
  {
    valid: [],
    invalid: [
      {
        name: "Falls back to the component label when the owner has no name",
        code: js`
        export default () => {
          const { onFetched } = useContext(ChildContext);
          const [data, setData] = useState();

          useEffect(() => {
            onFetched(data);
          }, [onFetched, data]);
        }
      `,
        errors: [
          {
            messageId: "avoidPassingLiveStateToParentInComponent",
            data: { state: '"data"', name: "this component" },
          },
        ],
      },
    ],
  },
);
