# AGENTS.md — eslint-plugin-react-you-might-not-need-an-effect

## Commands

| Command             | What it runs                                                      |
| ------------------- | ----------------------------------------------------------------- |
| `yarn build`        | `tsdown` — bundles `src/index.ts` → `dist/` (ESM + CJS + `.d.ts`) |
| `yarn typecheck`    | `tsgo` (not `tsc`)                                                |
| `yarn lint`         | `eslint` (flat config, `eslint.config.js`)                        |
| `yarn test`         | `mocha --recursive ./src ./test`                                  |
| `yarn format`       | `prettier --write .`                                              |
| `yarn format:check` | `prettier --check .`                                              |

Pre-commit: `simple-git-hooks` → `lint-staged` → `prettier --write` on all staged files.

Run order (CI match): `typecheck → lint → format:check → build → test`

## Project structure

- **Single package** (not a monorepo). Package manager: `yarn 4.12.0`, `nodeLinker: node-modules` (not PnP).
- **Entry**: `src/index.ts` — exports a flat ESLint plugin with 4 configs: `recommended`, `strict`, `legacy-recommended`, `legacy-strict`.
- **9 rules** in `src/rules/`, each a separate `.ts` file with a co-located `.test.js` file.
- **Utilities**: `src/util/ast.ts` (AST traversal/ref analysis), `src/util/react.ts` (React-specific helpers like `isUseEffect`, `isState`, `isProp`, etc.).
- **Test helpers** in `test/rule-tester.js`: `MyRuleTester` extends `RuleTester` with whitespace normalization and `.todo` test case support (auto-skipped). `js` tagged template for syntax highlighting.
- **Other tests**: `test/syntax.test.js` (syntax variants), `test/real-world.test.js` (recommended config on valid real-world code patterns), `test/config.test.js` / `test/config.test.cjs`.

## Key conventions

- ESLint **flat config only** in this repo (`eslint.config.js`). Uses `@eslint/js` recommended + `eslint-plugin-eslint-plugin` + `eslint-plugin-n`.
- Node >= 14, but the build/bundling targets Node 16+.
- `useLayoutEffect` is intentionally excluded from all rules (considered a valid DOM-interaction effect).
- `React.*` namespace calls (`React.useEffect`, `React.useState`) are supported alongside direct imports.
- Renamed imports (`useState as stateUser`) are a known limitation (marked `todo: true` in tests).
- Test files in `src/rules/` import rule source with `.ts` extension (ESM).
- **Formatting**: single Prettier config — trailing commas everywhere.
- `.gitignore` keeps `dist`, `node_modules`, `.yarn/*` (except patches/plugins/releases/sdks/versions).
- The plugin requires `globals` and its consumers need browser globals for full accuracy.
- Suggested companion rules for users: `react-hooks/exhaustive-deps` and `typescript-eslint/no-floating-promises`.

## Architecture notes

- Rules analyze `useEffect` calls by traversing references upstream (to find what feeds the effect) and downstream (to find what the effect touches).
- The `ascend`/`descend` utilities trace through variable definitions but **stop at import bindings** (external functions are opaque) and **skip function arguments** (too complex, would increase false positives).
- Synchronous call chains within the effect body are traced; async/promise/`void` chains are treated as valid external synchronization.
- Effects with a cleanup return statement are generally treated as valid subscriptions and skipped by most rules.
