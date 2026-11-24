import { describe, it } from "node:test";
import fc from "fast-check";
import { tsContainers } from "./axes/containers.ts";
import { tsPropShapes } from "./axes/property-access.ts";
import { combination } from "./builder.ts";
import { checkProgram, runProperty } from "./check.ts";
import {
  asConstTemplate,
  passLiveTemplate,
  typeOnlyTemplate,
} from "./fixtures.ts";

describe("property: TypeScript type-only syntax", () => {
  it("does not count type-only references as runtime reads", () => {
    runProperty(
      fc.property(combination(), (input) => {
        checkProgram(
          typeOnlyTemplate,
          input,
          typeOnlyTemplate.expected(input.container),
          { ts: true },
        );
      }),
    );
  });

  it("treats an as-const local object as data, not a parent value", () => {
    runProperty(
      fc.property(combination(), (input) => {
        checkProgram(
          asConstTemplate,
          input,
          asConstTemplate.expected(input.container),
          { ts: true },
        );
      }),
    );
  });
});

describe("property: TypeScript-only wrappers", () => {
  it("reads props through an asserted props object", () => {
    runProperty(
      fc.property(combination({ propShapes: tsPropShapes }), (input) => {
        checkProgram(
          passLiveTemplate,
          input,
          passLiveTemplate.expected(input.container),
          { ts: true },
        );
      }),
    );
  });

  it("sees through assertions on the component expression", () => {
    runProperty(
      fc.property(combination({ containers: tsContainers }), (input) => {
        checkProgram(
          passLiveTemplate,
          input,
          passLiveTemplate.expected(input.container),
          { ts: true },
        );
      }),
    );
  });
});
