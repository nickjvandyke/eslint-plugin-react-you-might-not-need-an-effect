# AGENTS.md — eslint-plugin-react-you-might-not-need-an-effect

## Commands

| Command             | What it runs                                                                                      |
| ------------------- | ------------------------------------------------------------------------------------------------- |
| `yarn build`        | `tsdown` — bundles `src/index.ts` → `dist/` (ESM + CJS + `.d.ts`)                                 |
| `yarn typecheck`    | `tsgo` (not `tsc`)                                                                                |
| `yarn lint`         | `eslint` (flat config, `eslint.config.js`)                                                        |
| `yarn test`         | `node --import ./test/setup.js --test "src/**/*.test.js" "test/**/*.test.js" "test/**/*.test.ts"` |
| `yarn format`       | `prettier --write .`                                                                              |
| `yarn format:check` | `prettier --check .`                                                                              |

Pre-commit: `simple-git-hooks` → `lint-staged` → `prettier --write` on all staged files.

Run order (CI match): `typecheck → lint → format:check → build → test`

Property tests pass their draw count at the call site through `runProperty` in `test/property/support/check.ts`. `FC_RUNS` sets the draws (default 1000, positive integer). `FC_SEED` replays a failure from the seed that fast-check prints. Invalid values stop the run at startup.

## Project structure

- **Single package** (not a monorepo). Package manager: `yarn 4.12.0`, `nodeLinker: node-modules` (not PnP).
- **Entry**: `src/index.ts` — exports a flat ESLint plugin with 4 configs: `recommended`, `strict`, `legacy-recommended`, `legacy-strict`.
- **9 rules** in `src/rules/`, each a separate `.ts` file with a co-located `.test.js` file.
- **Utilities**: `src/util/ast.ts` (AST traversal, ref analysis, synchronous call chains), `src/util/typescript.ts` (TypeScript wrappers and type-only keys), `src/util/hooks.ts` (React hook and third-party effect detection), `src/util/components.ts` (component, HOC, and custom hook detection), `src/util/effect.ts` (effect function, deps, cleanup, subscription setters, and dependency-variable extraction), `src/util/state.ts` (state and setter detection), `src/util/reset.ts` (full state reset detection and trigger prop), `src/util/props.ts` (prop and external value detection), `src/util/refs.ts` (ref detection).
- **Test pattern**: Rule semantics live in `src/rules/*.test.js` with `RuleTester` from `eslint` + `plugin` from `../index.ts`, and define `const js = String.raw` inline. Rule test files pass `{ ...plugin.configs.recommended, rules: {} }` to `RuleTester`. Syntax and boundary behavior is verified generatively in `test/property/*.test.ts`, not in `src/util/`.
- **Integration tests**: `test/` holds only cross-cutting tests. `test/property/*.test.ts` (property-based tests with `fast-check`: transparent syntax must preserve diagnostics, opaque boundaries must suppress them, state-setter rules must partition), `test/effect-hooks.test.ts` (third-party effect hook lookup table), `test/edge-cases.test.ts` (fixed regressions and message-wording cases), `test/termination.test.ts` (deep call chains and call-graph cycles), `test/real-world.test.js` (recommended config on valid real-world code patterns), `test/config.test.js`, `test/oxlint.test.js` (runs the built plugin through the real Oxlint CLI, so it needs `yarn build` first), and `test/setup.js`.

## Key conventions

- ESLint **flat config only** in this repo (`eslint.config.js`). Uses `@eslint/js` recommended + `eslint-plugin-eslint-plugin` + `eslint-plugin-n`.
- `**/*.ts` files use the `typescript-eslint` recommended config, scoped with `tseslint.config` and `files`/`extends`. It enables `@typescript-eslint/no-unused-vars` and disables core `no-unused-vars`/`no-undef` for TypeScript. `tsgo` also checks `noUnusedLocals` and `noUnusedParameters`.
- Tests need Node >= 22.18 (they import `.ts` files directly, which needs native type stripping). The published package keeps `engines.node` at `>=14`.
- Integration tests in `test/*.test.ts` are typechecked: `tsconfig.json` includes `test/**/*.ts`, and `@types/node` provides the `node:test` and `assert` types.
- `useLayoutEffect` is intentionally excluded from all rules (considered a valid DOM-interaction effect).
- `React.*` namespace calls (`React.useEffect`, `React.useState`) are supported alongside direct imports.
- Renamed imports (`useState as stateUser`) are supported by resolving import bindings from `react`, `preact/hooks`, `preact/compat`, and `@wordpress/element`. Names that do not resolve to one of those imports fall back to name matching.
- Test files in `src/rules/` import rule source with `.ts` extension (ESM).
- Syntax transforms and opaque boundaries belong in `test/property/*.test.ts`, split by invariant (`transparency`, `boundaries`, `partition`, `typescript`). Invariant test files live at the root of `test/property/`. Generators and support live in subdirectories: `axes/` (one file per axis, named by the input dimension, never by `src/util` module) and `support/` (`builder.ts`, `check.ts`, `config.ts`, `fixtures.ts`, `helpers.ts`, `partition.ts`; `config.test.ts` tests the run configuration). Support files are typechecked but not run as tests. Fixed lookup tables and regressions live in `test/effect-hooks.test.ts` and `test/edge-cases.test.ts`. Keep `src/util/` free of test files.
- **Formatting**: single Prettier config — trailing commas everywhere.
- `.gitignore` keeps `dist`, `node_modules`, `.yarn/*` (except patches/plugins/releases/sdks/versions).
- The plugin has no runtime dependencies and does not require browser globals. Global references, resolved or unresolved, behave like external globals. A local alias of a global counts as a global.
- Suggested companion rules for users: `react-hooks/exhaustive-deps` and `typescript-eslint/no-floating-promises`.
- Third-party effect wrappers are matched by module + export. Only `useEffect`-equivalent wrappers are included; layout, update, async, debounced, and conditional wrappers are excluded.

## Test placement

Put a test where the outcome it pins lives. An outcome is a conclusion the plugin reaches about a program: "this value is render-safe", "this cleanup makes the effect a subscription", "these two rules overlap, so one must win", "transparent syntax does not change the answer". `memo`, `as const`, and a namespace import are spellings, not outcomes.

Ask two questions before adding a case.

1. Would it fail if the outcome changed? If not, it pins nothing. Delete it.
2. Which file owns that outcome? Rule semantics go to `src/rules/*.test.js`. Syntax and traversal variation go to `test/property/*.test.ts`. A fixed shape that no generator reaches goes to `test/edge-cases.test.ts`.

One outcome can need several cases: reported and not reported, component and custom hook, synchronous and asynchronous. Split when the expected results differ, or when one claim can hide another. Merge when two claims share a template and expected result but differ only by a generated input axis. Pass both axes to `combination()` in one property. A property covers the product of its axes, so splitting axes removes combinations from the sample. A second case that repeats an outcome is a duplicate, whatever syntax it uses.

1. `src/rules/*.test.js` holds rule semantics. Cover each distinct data source, dependency shape, cleanup behavior, and message format once. Keep one synchronous case and one asynchronous case per rule.
2. `test/property/*.test.ts` holds syntax and traversal variation: aliases, hops, wrappers, IIFEs, containers, and globals. Do not repeat those variations in rule tests.
3. Keep a syntax test in a rule file only when that rule makes a different choice about that syntax. Mark the exception in `test/property/support/fixtures.ts` with the template's `expected(container)`.
4. `test/effect-hooks.test.ts` holds only the third-party hook table. `test/edge-cases.test.ts` holds only fixed regressions that no property covers.
5. If a rule test and a property test both fail on one change, they pin the same outcome. Delete the rule test. Keep the narrower one.
6. Split a test file when one section outgrows the file's theme. Do not split by `src/util` module; these cases are cross-cutting.

## Architecture notes

- Rules analyze `useEffect` calls by traversing references upstream (to find what feeds the effect) and downstream (to find what the effect touches).
- The `ascend`/`descend` utilities trace through variable definitions but **stop at import bindings** (external functions are opaque). `descend` walks call arguments, so data inside calls (dependency arrays, setter arguments, cleanup bodies) is found. `ascend` stops at hook calls other than `useMemo` and `useCallback`, because a hook returns a new value that its arguments only configure. `getSynchronousCallChain` stops at a value produced by a call, because calling that value does not run the arguments of the call that produced it.
- Synchronous call chains within the effect body are traced; async/promise/`void` chains are treated as valid external synchronization. An immediately invoked function runs now, so it stays synchronous; a callback that may run later does not.
- Effects with a cleanup return statement are generally treated as valid subscriptions and skipped by most rules.
- Derived vs adjust split: `no-derived-state` owns setters whose arguments come from effect dependencies. Trigger-only dependencies belong to `no-adjust-state-on-prop-change` when they are external (props, `useContext`, hook values) and to `no-chain-state-updates` when they are internal state.
- Overlap precedence: `no-external-store-subscription` owns subscribed setters, so `no-initialize-state` skips them. `no-reset-all-state-on-prop-change` owns full resets outside custom hooks, so `no-adjust-state-on-prop-change` skips those. Custom hooks keep the adjust rule because a hook cannot receive `key`.
