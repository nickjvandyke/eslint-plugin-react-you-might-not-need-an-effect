# ESLint - React - You Might Not Need An Effect

![NPM version](https://img.shields.io/npm/v/eslint-plugin-react-you-might-not-need-an-effect)
![NPM Downloads](https://img.shields.io/npm/dw/eslint-plugin-react-you-might-not-need-an-effect)

ESLint plugin to catch when [You Might Not Need An Effect](https://react.dev/learn/you-might-not-need-an-effect) (and more) to make your code easier to follow, faster to run, and less error-prone. Highly recommended for new React developers as you learn its mental model, and even experienced developers may be surprised!

- **Actionable fixes:** Reports specific anti-patterns, with suggestions and links.
- **Deep analysis:** Analyzes state, props, refs, and their upstream sources.
- **Dependency-aware:** Considers _when_ an effect runs to determine if its logic is actually redundant.
- **Edge-case obsessed:** Focuses on unusual syntax and heuristics to keep the signal-to-noise ratio high.

> React's official [`eslint-plugin-react-hooks/set-state-in-effect`](https://react.dev/reference/eslint-plugin-react-hooks/lints/set-state-in-effect) rule flags synchronous `setState` calls inside effects, helping prevent unnecessary re-renders. However, unnecessary _effects_ aren’t limited to this, as I'm sure we've all seen (or written 😅).

## 📦 Installation

### NPM

```bash
npm install --save-dev eslint-plugin-react-you-might-not-need-an-effect
```

### Yarn

```bash
yarn add -D eslint-plugin-react-you-might-not-need-an-effect
```

## ⚙️ Configuration

### Recommended

Add the plugin's `recommended` config to your ESLint configuration file to enable every rule as a warning.

Experimentally, use the `strict` config instead to enable every rule as an error.

#### Legacy config (`.eslintrc`)

```js
{
  "extends": [
    "plugin:react-you-might-not-need-an-effect/legacy-recommended",
    // or
    "plugin:react-you-might-not-need-an-effect/legacy-strict",
  ],
}
```

#### Flat config (`eslint.config.js`)

```js
import reactYouMightNotNeedAnEffect from "eslint-plugin-react-you-might-not-need-an-effect";

export default [
  reactYouMightNotNeedAnEffect.configs.recommended,
  // or
  reactYouMightNotNeedAnEffect.configs.strict,
];
```

### Custom

If not using an included config, manually set your `languageOptions`:

```js
import globals from "globals";

// ...
{
  globals: {
    ...globals.browser,
  },
  parserOptions: {
    ecmaFeatures: {
      jsx: true,
    },
  },
};
```

### Suggested

Consider enforcing these rules in your codebase for more accurate analysis.

- [`react-hooks/exhaustive-deps`](https://www.npmjs.com/package/eslint-plugin-react-hooks): the plugin assumes your effects receive correct dependencies.
- [`typescript-eslint/no-floating-promises`](https://typescript-eslint.io/rules/no-floating-promises/): helps the plugin infer calls to asynchronous functions.

## 🔎 Rules

See the [tests](./test) for extensive (in)valid examples for each rule.

### `no-derived-state` — [docs](https://react.dev/learn/you-might-not-need-an-effect#updating-state-based-on-props-or-state)

Disallow storing derived state in an effect:

```js
function Form() {
  const [firstName, setFirstName] = useState('Taylor');
  const [lastName, setLastName] = useState('Swift');

  const [fullName, setFullName] = useState('');
  useEffect(() => {
    // ❌ Avoid storing derived state. Compute "fullName" directly during render, optionally with `useMemo` if it's expensive.
    setFullName(firstName + ' ' + lastName);
  }, [firstName, lastName]);
}
```

Disallow storing state derived from *any* state (even external) when the setter is only called once:

```js
function Form() {
  const prefix = useQuery('/prefix');
  const [name, setName] = useState();
  const [prefixedName, setPrefixedName] = useState();

  useEffect(() => {
    // ❌ Avoid storing derived state. "prefixedName" is only set here, and thus could be computed directly during render.
    setPrefixedName(prefix + name)
  }, [prefix, name]);
}
```

### `no-chain-state-updates` — [docs](https://react.dev/learn/you-might-not-need-an-effect#chains-of-computations)

Disallow chaining state updates in an effect:

```js
function Game() {
  const [round, setRound] = useState(1);
  const [isGameOver, setIsGameOver] = useState(false);

  useEffect(() => {
    if (round > 10) {
      // ❌ Avoid chaining state changes. When possible, update all relevant state simultaneously.
      setIsGameOver(true);
    }
  }, [round]);
}
```

### `no-event-handler` — [docs](https://react.dev/learn/you-might-not-need-an-effect#sharing-logic-between-event-handlers)

Disallow using state and an effect as an event handler:

```js
function ProductPage({ product, addToCart }) {
  useEffect(() => {
    if (product.isInCart) {
      // ❌ Avoid using state and effects as an event handler. Instead, call the event handling code directly when the event occurs.
      showNotification(`Added ${product.name} to the shopping cart!`);
    }
  }, [product]);
}
```

### `no-adjust-state-on-prop-change` — [docs](https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes)

Disallow adjusting state in an effect when a prop changes:

```js
function List({ items }) {
  const [isReverse, setIsReverse] = useState(false);
  const [selection, setSelection] = useState(null);

  useEffect(() => {
    // ❌ Avoid adjusting state when a prop changes. Instead, adjust the state directly during render, or refactor your state to avoid this need entirely.
    setSelection(null);
  }, [items]);
}
```

### `no-reset-all-state-on-prop-change` — [docs](https://react.dev/learn/you-might-not-need-an-effect#resetting-all-state-when-a-prop-changes)

Disallow resetting all state in an effect when a prop changes:

```js
function List({ items }) {
  const [selection, setSelection] = useState(null);

  useEffect(() => {
    // ❌ Avoid resetting all state when a prop changes. If "items" is a key, pass it as `key` instead so React will reset the component.
    setSelection(null);
  }, [items]);
}
```

### `no-pass-live-state-to-parent` — [docs](https://react.dev/learn/you-might-not-need-an-effect#notifying-parent-components-about-state-changes)

Disallow passing live state to parents in an effect:

```js
function Child({ onTextChanged }) {
  const [text, setText] = useState();

  useEffect(() => {
    // ❌ Avoid passing live state to parents in an effect. Instead, lift the state to the parent and pass it down to the child as a prop.
    onTextChanged(text);
  }, [onTextChanged, text]);
}
```

### `no-pass-data-to-parent` — [docs](https://react.dev/learn/you-might-not-need-an-effect#passing-data-to-the-parent)

Disallow passing data to parents in an effect:

```js
function Child({ onDataFetched }) {
  const { data } = useQuery('/data')

  useEffect(() => {
    // ❌ Avoid passing data to parents in an effect. Instead, let the parent fetch the data itself and pass it down to the child as a prop.
    onDataFetched(data)
  }, [data, onDataFetched]);
}
```

### `no-initialize-state`

Disallow initializing state in an effect:

```js
function Component() {
  const [state, setState] = useState();

  useEffect(() => {
    // ❌ Avoid initializing state in an effect. Instead, initialize "state"'s `useState()` with "Hello World". For SSR hydration, prefer `useSyncExternalStore()`.
    setState("Hello World");
  }, []);
}
```

### `no-empty-effect`

Disallow empty effects:

```js
function Component() {
  // ❌ This effect is empty and could be removed.
  useEffect(() => {}, []);
}
```

## 💬 Feedback

The ways to (mis)use an effect in real-world code are practically endless! This plugin is not exhaustive. If you encounter unexpected behavior or see opportunities for improvement, please open an issue. Your feedback helps improve the plugin for everyone!

## 📖 Learn More

- https://react.dev/reference/react/useEffect
- https://react.dev/learn/you-might-not-need-an-effect
- https://react.dev/learn/synchronizing-with-effects
- https://react.dev/learn/separating-events-from-effects
- https://react.dev/learn/lifecycle-of-reactive-effects
