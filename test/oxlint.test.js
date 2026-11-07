import { describe } from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import { it } from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const require = createRequire(import.meta.url);
const oxlintDirectory = path.dirname(require.resolve("oxlint/package.json"));
// `oxlint` is a Rust binary wrapped in a JS script. Run the script with Node
// so the test works on every platform.
const oxlintBin = path.join(oxlintDirectory, "bin", "oxlint");

const pluginName = "eslint-plugin-react-you-might-not-need-an-effect";
const repoRoot = fileURLToPath(new URL("..", import.meta.url));

const config = `import plugin from "${pluginName}";
import { defineConfig } from "oxlint";

export default defineConfig({
  jsPlugins: ["${pluginName}"],
  rules: { ...plugin.configs.recommended.rules },
  env: { browser: true },
});
`;

const js = String.raw;

const javascriptCode = js`
  import { useEffect, useState } from "react";

  export function Form() {
    const [firstName] = useState("Nick");
    const [lastName] = useState("van Dyke");
    const [fullName, setFullName] = useState("");

    useEffect(() => {
      setFullName(firstName + " " + lastName);
    }, [firstName, lastName]);

    return fullName;
  }
`;

// Oxlint parses TypeScript itself and translates its AST for JS plugins.
// It does not reuse `@typescript-eslint/parser`, so this guards the bridge.
const typescriptCode = js`
  import { useEffect, useState } from "react";

  export function Form() {
    const [firstName] = useState("Nick") as [string];
    const [lastName] = useState("van Dyke") as [string];
    const [fullName, setFullName] = useState("") as [string, (v: string) => void];

    useEffect(() => {
      setFullName(firstName + " " + lastName);
    }, [firstName, lastName] as const);

    return fullName;
  }
`;

const lintWithOxlint = async (filename, code) => {
  const directory = await mkdtemp(path.join(tmpdir(), "oxlint-"));

  try {
    // Symlink the packages so the config can use the same bare specifiers as
    // the README example.
    const nodeModules = path.join(directory, "node_modules");
    await mkdir(nodeModules);
    await symlink(repoRoot, path.join(nodeModules, pluginName), "junction");
    await symlink(
      oxlintDirectory,
      path.join(nodeModules, "oxlint"),
      "junction",
    );

    const configPath = path.join(directory, "oxlint.config.mjs");
    const filePath = path.join(directory, filename);

    await writeFile(configPath, config);
    await writeFile(filePath, code);

    const { stdout } = await execFileAsync(process.execPath, [
      oxlintBin,
      "--config",
      configPath,
      "--format",
      "json",
      filePath,
    ]);

    return JSON.parse(stdout).diagnostics;
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
};

const findDerivedStateDiagnostic = (diagnostics, filename) => {
  const diagnostic = diagnostics.find(
    (d) => d.code === "react-you-might-not-need-an-effect(no-derived-state)",
  );
  assert.ok(diagnostic, "expected a no-derived-state diagnostic");
  assert.equal(diagnostic.severity, "warning");
  assert.equal(path.basename(diagnostic.filename), filename);
};

describe("oxlint", () => {
  it("loads the plugin and runs the recommended config", async () => {
    const diagnostics = await lintWithOxlint("form.js", javascriptCode);
    findDerivedStateDiagnostic(diagnostics, "form.js");
  });

  it("passes TypeScript syntax to the plugin", async () => {
    const diagnostics = await lintWithOxlint("form.ts", typescriptCode);
    findDerivedStateDiagnostic(diagnostics, "form.ts");
  });
});
