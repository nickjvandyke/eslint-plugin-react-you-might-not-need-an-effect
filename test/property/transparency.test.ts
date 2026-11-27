import { describe, it } from "node:test";
import fc from "fast-check";
import { combination } from "./support/builder.ts";
import { checkProgram, runProperty } from "./support/check.ts";
import {
  contextTemplates,
  refTemplates,
  templates,
  validTemplate,
} from "./support/fixtures.ts";
import { oneOf } from "./support/helpers.ts";

for (const template of templates) {
  describe(`property: ${template.rule} survives transparent syntax`, () => {
    it("reports the expected diagnostics for every combination", () => {
      runProperty(
        fc.property(combination(), (input) => {
          checkProgram(template, input, template.expected(input.container));
        }),
      );
    });
  });
}

describe("property: valid code survives transparent syntax", () => {
  it("reports nothing for every combination", () => {
    runProperty(
      fc.property(combination(), (input) => {
        checkProgram(
          validTemplate,
          input,
          validTemplate.expected(input.container),
        );
      }),
    );
  });
});

describe("property: value sources survive transparent syntax", () => {
  it("treats context values like props", () => {
    runProperty(
      fc.property(
        fc.record({
          template: oneOf(contextTemplates),
          input: combination(),
        }),
        ({ template, input }) => {
          checkProgram(template, input, template.expected(input.container));
        },
      ),
    );
  });

  it("does not treat ref reads as render values", () => {
    runProperty(
      fc.property(
        fc.record({
          template: oneOf(refTemplates),
          input: combination(),
        }),
        ({ template, input }) => {
          checkProgram(template, input, template.expected(input.container));
        },
      ),
    );
  });
});
