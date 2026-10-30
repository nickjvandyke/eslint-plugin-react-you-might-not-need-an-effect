// ESLint's RuleTester does not integrate with `node:test` directly.
// Point it at the Node.js test runner's functions instead of relying on globals.
// This file is preloaded in every test process with `--import ./test/setup.js`.
import { describe, it } from "node:test";
import { RuleTester } from "eslint";

RuleTester.describe = describe;
RuleTester.it = it;
