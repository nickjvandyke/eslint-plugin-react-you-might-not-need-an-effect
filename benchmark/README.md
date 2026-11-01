# Benchmark

This benchmark documents the plugin's lint cost. It answers one question: does the analysis need a faster resolution model?

## Run

```bash
yarn benchmark
```

Node >= 22.18 is required. The script imports `src/index.ts` directly and uses native TypeScript type stripping.

## Synthetic fixture

The script generates 600 components. Every component has a `useEffect` with a 10-step alias chain and one state update. This is a worst case: every component exercises the analysis.

Example result on an Apple Silicon laptop:

| Case        | Time   | Delta   |
| ----------- | ------ | ------- |
| Parse only  | 164 ms | —       |
| 1 rule      | 200 ms | +36 ms  |
| All 9 rules | 320 ms | +156 ms |
| Per effect  | —      | 0.26 ms |

The worst-case plugin share is 48.7% of total lint time. That is high because the fixture is all effects. Real code is sparse.

## Docusaurus

Measured on Docusaurus `main` on 2026-11-01 with the full Docusaurus ESLint config (303 rules), ESLint 9.39.5, Node 26.8.2, and plugin 1.0.3.

| Scope                                               | Rule time | Plugin time | Share |
| --------------------------------------------------- | --------- | ----------- | ----- |
| `packages` (928 TS/TSX files, 60 `useEffect` calls) | 6,162.8ms | 30.2ms      | 0.49% |
| `website/src`                                       | 908.4ms   | 4.4ms       | 0.48% |

Wall time for `packages` was 10.77s. The plugin is about 0.28% of wall time.

The slowest plugin rule was `no-derived-state` at 5.0ms. The slowest rule overall was `react-hooks/static-components` at 1,724ms (28%). If lint time matters, that rule is the target.

### Reproduce

1. Shallow-clone Docusaurus.
2. Install a minimal harness with the Docusaurus ESLint dependencies and `eslint-plugin-react-you-might-not-need-an-effect@1.0.3`.
3. Symlink `node_modules` into the clone.
4. Run:

```bash
TIMING=all node_modules/.bin/eslint packages
```

Use `TIMING=all`, not `TIMING=1`. Use no `--quiet`: ESLint skips warning-level rules under `--quiet`, and the plugin's `recommended` config is all warnings.

## Conclusion

Do not replace the resolution model with a DAG and do not memoize. The plugin is a small fraction of lint time.

Revisit if the plugin's share exceeds about 5% on a real repo, or if the rule count grows enough that the 9x re-walk becomes visible.
