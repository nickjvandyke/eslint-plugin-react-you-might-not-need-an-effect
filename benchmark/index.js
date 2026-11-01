import { ESLint } from "eslint";
import plugin from "../src/index.ts";

const PLUGIN_NAME = "react-you-might-not-need-an-effect";
const COMPONENTS = 600;
const CHAIN_LENGTH = 10;
const RUNS = 9;

const makeFixture = () => {
  let code = 'import { useEffect, useState } from "react";\n';

  for (let i = 0; i < COMPONENTS; i++) {
    let body = "const x0 = other + 1;";
    for (let j = 1; j <= CHAIN_LENGTH; j++) {
      body += ` const x${j} = x${j - 1} + 1;`;
    }

    code +=
      `function Component${i}() {` +
      ` const [value, setValue] = useState(0);` +
      ` const [other, setOther] = useState(0);` +
      ` useEffect(() => { ${body} setValue(x${CHAIN_LENGTH}); }, [other]);` +
      ` return null;` +
      ` }\n`;
  }

  return code;
};

const code = makeFixture();

const baseConfig = {
  files: ["**/*.js"],
  plugins: { [PLUGIN_NAME]: plugin },
  languageOptions: {
    parserOptions: {
      ecmaFeatures: { jsx: true },
    },
  },
};

const configs = {
  "parse only": { files: ["**/*.js"], rules: {} },
  "1 rule": {
    ...baseConfig,
    rules: { [`${PLUGIN_NAME}/no-derived-state`]: "warn" },
  },
  "all 9 rules": plugin.configs.recommended,
};

const measure = async (config) => {
  const eslint = new ESLint({
    overrideConfigFile: true,
    overrideConfig: [config],
  });

  // Warm up the JIT and module graph.
  for (let i = 0; i < 2; i++) {
    await eslint.lintText(code, { filePath: `benchmark-warmup-${i}.js` });
  }

  const times = [];
  for (let i = 0; i < RUNS; i++) {
    const start = process.hrtime.bigint();
    // Unique paths avoid any result caching between runs.
    await eslint.lintText(code, { filePath: `benchmark-${i}.js` });
    times.push(Number(process.hrtime.bigint() - start) / 1e6);
  }

  times.sort((a, b) => a - b);
  return times[0];
};

const main = async () => {
  const results = {};
  for (const [name, config] of Object.entries(configs)) {
    results[name] = await measure(config);
  }

  const parse = results["parse only"];
  const one = results["1 rule"];
  const all = results["all 9 rules"];
  const overhead = all - parse;

  console.log(
    `Fixture: ${COMPONENTS} components, ${CHAIN_LENGTH}-step chain, ${COMPONENTS} effects`,
  );
  console.log(`Runs: ${RUNS} (minimum)\n`);
  console.log(`Parse only       ${parse.toFixed(0)} ms`);
  console.log(
    `1 rule           ${one.toFixed(0)} ms  (+${(one - parse).toFixed(0)} ms)`,
  );
  console.log(
    `All 9 rules      ${all.toFixed(0)} ms  (+${overhead.toFixed(0)} ms)`,
  );
  console.log(`Per effect       ${(overhead / COMPONENTS).toFixed(3)} ms`);
  console.log(
    `Worst-case share ${((overhead / all) * 100).toFixed(1)}% of total`,
  );
  console.log(
    "\nWorst case: every component has an effect. Real-world share is 0.49% on Docusaurus (see README).",
  );
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
