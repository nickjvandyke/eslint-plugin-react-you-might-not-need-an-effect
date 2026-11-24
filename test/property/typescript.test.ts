import { describe, it } from "node:test";
import fc from "fast-check";
import { diagnostic } from "../harness.ts";
import { containers, tsContainers } from "./axes/containers.ts";
import { tsPropShapes } from "./axes/property-access.ts";
import { combination, templateResult } from "./builder.ts";
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
          [diagnostic("no-initialize-state", "avoidInitializingState")],
          { ts: true },
        );
      }),
    );
  });

  it("treats an as-const local object as data, not a parent value", () => {
    runProperty(
      fc.property(combination(), (input) => {
        checkProgram(asConstTemplate, input, [], { ts: true });
      }),
    );
  });
});

describe("property: TypeScript-only wrappers", () => {
  const componentContainers = containers.filter((container) => !container.hook);

  it("reads props through an asserted props object", () => {
    runProperty(
      fc.property(
        combination({
          containers: componentContainers,
          propShapes: tsPropShapes,
        }),
        (input) => {
          checkProgram(
            passLiveTemplate,
            input,
            templateResult(passLiveTemplate, input.container),
            { ts: true },
          );
        },
      ),
    );
  });

  it("sees through assertions on the component expression", () => {
    runProperty(
      fc.property(combination({ containers: tsContainers }), (input) => {
        checkProgram(
          passLiveTemplate,
          input,
          templateResult(passLiveTemplate, input.container),
          { ts: true },
        );
      }),
    );
  });
});
