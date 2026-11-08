# AGENTS.md — eslint-plugin-react-you-might-not-need-an-effect

## Commands

| Command             | What it runs                                                                  |
| ------------------- | ----------------------------------------------------------------------------- |
| `yarn build`        | `tsdown` — bundles `src/index.ts` → `dist/` (ESM + CJS + `.d.ts`)             |
| `yarn typecheck`    | `tsgo` (not `tsc`)                                                            |
| `yarn lint`         | `eslint` (flat config, `eslint.config.js`)                                    |
| `yarn test`         | `node --import ./test/setup.js --test "src/**/*.test.js" "test/**/*.test.js"` |
| `yarn format`       | `prettier --write .`                                                          |
| `yarn format:check` | `prettier --check .`                                                          |

Pre-commit: `simple-git-hooks` → `lint-staged` → `prettier --write` on all staged files.

Run order (CI match): `typecheck → lint → format:check → build → test`

## Project structure

- **Single package** (not a monorepo). Package manager: `yarn 4.12.0`, `nodeLinker: node-modules` (not PnP).
- **Entry**: `src/index.ts` — exports a flat ESLint plugin with 4 configs: `recommended`, `strict`, `legacy-recommended`, `legacy-strict`.
- **9 rules** in `src/rules/`, each a separate `.ts` file with a co-located `.test.js` file.
- **Utilities**: `src/util/ast.ts` (AST traversal, ref analysis, constant checks), `src/util/typescript.ts` (TypeScript wrappers and type-only keys), `src/util/hooks.ts` (React hook and third-party effect detection), `src/util/components.ts` (component, HOC, and custom hook detection), `src/util/effect.ts` (effect function, deps, and cleanup extraction), `src/util/state.ts` (state and setter detection), `src/util/props.ts` (prop detection), `src/util/refs.ts` (ref detection).
- **Test pattern**: Unit tests are co-located with the source they cover. Rule tests live in `src/rules/*.test.js`; utility tests live in `src/util/*.test.js`. Each imports `RuleTester` from `eslint` + `plugin` from `../index.ts`, and defines `const js = String.raw` inline. Rule test files pass `{ ...plugin.configs.recommended, rules: {} }` to `RuleTester`.
- **Integration tests**: `test/` holds only cross-cutting tests. `test/real-world.test.js` (recommended config on valid real-world code patterns), `test/config.test.js`, `test/oxlint.test.js` (runs the built plugin through the real Oxlint CLI, so it needs `yarn build` first), and `test/setup.js`.

## Key conventions

- ESLint **flat config only** in this repo (`eslint.config.js`). Uses `@eslint/js` recommended + `eslint-plugin-eslint-plugin` + `eslint-plugin-n`.
- `**/*.ts` files use the `typescript-eslint` recommended config, scoped with `tseslint.config` and `files`/`extends`. It enables `@typescript-eslint/no-unused-vars` and disables core `no-unused-vars`/`no-undef` for TypeScript. `tsgo` also checks `noUnusedLocals` and `noUnusedParameters`.
- Tests need Node >= 22.18 (they import `.ts` files directly, which needs native type stripping). The published package keeps `engines.node` at `>=14`.
- `useLayoutEffect` is intentionally excluded from all rules (considered a valid DOM-interaction effect).
- `React.*` namespace calls (`React.useEffect`, `React.useState`) are supported alongside direct imports.
- Renamed imports (`useState as stateUser`) are supported by resolving import bindings from `react`, `preact/hooks`, `preact/compat`, and `@wordpress/element`. Names that do not resolve to one of those imports fall back to name matching.
- Test files in `src/rules/` import rule source with `.ts` extension (ESM).
- **Formatting**: single Prettier config — trailing commas everywhere.
- `.gitignore` keeps `dist`, `node_modules`, `.yarn/*` (except patches/plugins/releases/sdks/versions).
- The plugin has no runtime dependencies. Unresolved global references behave like external globals, so browser globals are not required for analysis.
- Suggested companion rules for users: `react-hooks/exhaustive-deps` and `typescript-eslint/no-floating-promises`.
- Third-party effect wrappers are matched by module + export. Only `useEffect`-equivalent wrappers are included; layout, update, async, debounced, and conditional wrappers are excluded.

## Architecture notes

- Rules analyze `useEffect` calls by traversing references upstream (to find what feeds the effect) and downstream (to find what the effect touches).
- The `ascend`/`descend` utilities trace through variable definitions but **stop at import bindings** (external functions are opaque) and **skip function arguments** (too complex, would increase false positives).
- Synchronous call chains within the effect body are traced; async/promise/`void` chains are treated as valid external synchronization.
- Effects with a cleanup return statement are generally treated as valid subscriptions and skipped by most rules.
