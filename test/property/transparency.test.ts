import { describe, it } from "node:test";
import fc from "fast-check";
import "./config.ts";
import { diagnostic } from "../harness.ts";
import { containers } from "./axes/containers.ts";
import { combination, templateResult } from "./builder.ts";
import { checkProgram } from "./check.ts";
import {
  contextTemplates,
  refTemplates,
  templates,
  validTemplate,
} from "./fixtures.ts";
import { oneOf } from "./helpers.ts";

for (const template of templates) {
  describe(`property: ${template.rule} survives transparent syntax`, () => {
    const allowedContainers = containers.filter(
      (container) => !(template.skipHooks && container.hook),
    );

    it("reports the expected diagnostics for every combination", () => {
      fc.assert(
        fc.property(combination({ containers: allowedContainers }), (input) => {
          checkProgram(
            template,
            input,
            templateResult(template, input.container),
          );
        }),
      );
    });
  });
}

describe("property: valid code survives transparent syntax", () => {
  it("reports nothing for every combination", () => {
    fc.assert(
      fc.property(combination(), (input) => {
        checkProgram(validTemplate, input, []);
      }),
    );
  });
});

describe("property: value sources survive transparent syntax", () => {
  it("treats context values like props", () => {
    fc.assert(
      fc.property(
        fc.record({
          template: oneOf(contextTemplates),
          input: combination(),
        }),
        ({ template, input }) => {
          checkProgram(template, input, [
            diagnostic("no-derived-state", "avoidDerivedState"),
          ]);
        },
      ),
    );
  });

  it("does not treat ref reads as render values", () => {
    fc.assert(
      fc.property(
        fc.record({
          template: oneOf(refTemplates),
          input: combination(),
        }),
        ({ template, input }) => {
          checkProgram(template, input, []);
        },
      ),
    );
  });
});
