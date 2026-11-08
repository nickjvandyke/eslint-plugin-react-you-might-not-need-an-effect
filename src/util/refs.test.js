import { RuleTester } from "eslint";
import plugin from "../index.ts";
import noPassDataToParent from "../rules/no-pass-data-to-parent.ts";

const js = String.raw;

new RuleTester({ ...plugin.configs.recommended, rules: {} }).run(
  "refs",
  noPassDataToParent,
  {
    valid: [
      {
        name: "Pass ref to parent",
        code: js`
        const Child = ({ onRef }) => {
          const ref = useRef();

          useEffect(() => {
            onRef(ref.current);
          }, [onRef, ref.current]);
        }
      `,
      },
      {
        name: "Register callback on own ref to pass data to parent",
        code: js`
        const Child = ({ onClicked }) => {
          const ref = useRef();

          useEffect(() => {
            ref.current.addEventListener('click', (event) => {
              onClicked(event);
            });
          }, [onClicked, ref]);
        }
      `,
      },
      {
        name: "Register external callback on ref prop",
        code: js`
        const Child = ({ ref }) => {
          useEffect(() => {
            ref.current.addEventListener('click', (event) => {
              console.log('Clicked', event);
            });
          }, [ref]);
        }
      `,
      },
    ],
    invalid: [],
  },
);
